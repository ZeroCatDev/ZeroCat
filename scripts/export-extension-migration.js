import { promises as fs } from 'fs';
import path from 'path';
import "dotenv/config";
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.ts'

const connectionString = `postgresql://zerocat:DK6WZyxhaHWQztYK@100.74.26.106:5432/zerocat`

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

const OUTPUT_ROOT = path.resolve('migration-output/extensions');
const INLINE_DIR = path.join(OUTPUT_ROOT, 'inline-scripts');
const CSV_PATH = path.join(OUTPUT_ROOT, 'extension-migration.csv');
const BATCH_SIZE = 100;

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function randomSuffix() {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');
}

function csvEscape(value) {
  const str = value ?? '';
  if (typeof str !== 'string') {
    return csvEscape(String(str));
  }
  const needsQuotes = str.includes(',') || str.includes('"') || str.includes('\n');
  if (needsQuotes) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function parseDataUrl(dataUrl) {
  const firstComma = dataUrl.indexOf(',');
  if (firstComma === -1) return null;
  const meta = dataUrl.slice(0, firstComma).toLowerCase();
  const payload = dataUrl.slice(firstComma + 1);
  if (meta.includes(';base64')) {
    return Buffer.from(payload, 'base64').toString('utf8');
  }
  try {
    return decodeURIComponent(payload);
  } catch (err) {
    return null;
  }
}

async function fetchCommitsAndProjects(sha) {
  const commits = await prisma.ow_projects_commits.findMany({
    where: { commit_file: sha },
    select: {
      id: true,
      project_id: true,
    },
  });

  const projectIds = [...new Set(commits.map((c) => c.project_id).filter(Boolean))];
  const projects = projectIds.length
    ? await prisma.ow_projects.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true, title: true },
      })
    : [];

  return { commits, projects };
}

async function processFile(record) {
  const { sha256, source } = record;
  if (!source) return [];

  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (err) {
    console.warn(`Skip ${sha256}: invalid JSON`);
    return [];
  }

  const extensionURLs = parsed?.extensionURLs;
  if (!extensionURLs || typeof extensionURLs !== 'object') {
    return [];
  }

  const rows = [];
  const { commits, projects } = await fetchCommitsAndProjects(sha256);

  for (const [key, value] of Object.entries(extensionURLs)) {
    const url = typeof value === 'string' ? value.trim() : '';
    if (!url) continue;

    const isDataUrl = url.startsWith('data:text/javascript');
    const isTurboWarp = url.startsWith('https://extensions.turbowarp.org');

    if (!isDataUrl && !isTurboWarp) {
      continue;
    }

    let savedFile = '';
    if (isDataUrl) {
      const decoded = parseDataUrl(url);
      if (!decoded) {
        console.warn(`Skip inline extension ${key} of ${sha256}: cannot parse data URL`);
        continue;
      }
      const filename = `${key}-${randomSuffix()}.js`;
      const filePath = path.join(INLINE_DIR, filename);
      await fs.writeFile(filePath, decoded, 'utf8');
      savedFile = path.relative(OUTPUT_ROOT, filePath);
    }

    const commitIds = commits.map((c) => c.id).join('|');
    const projectIds = projects.map((p) => String(p.id)).join('|');
    const projectNames = projects
      .map((p) => (p.title || p.name || '').trim())
      .filter(Boolean)
      .join('|');

    rows.push([
      sha256,
      key,
      isDataUrl ? 'data-url' : 'turbowarp',
      url,
      savedFile,
      commitIds,
      projectIds,
      projectNames,
    ]);
  }

  return rows;
}

async function main() {
  await ensureDir(OUTPUT_ROOT);
  await ensureDir(INLINE_DIR);

  const csvRows = [
    [
      'sha256',
      'extension_key',
      'url_type',
      'url',
      'saved_file',
      'commit_ids',
      'project_ids',
      'project_names',
    ],
  ];

  let cursor = null;
  let processed = 0;
  let matched = 0;

  while (true) {
    const batch = await prisma.ow_projects_file.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { sha256: cursor } } : {}),
      orderBy: { sha256: 'asc' },
      select: { sha256: true, source: true },
    });

    if (!batch.length) break;

    for (const record of batch) {
      const rows = await processFile(record);
      if (rows.length) {
        matched += rows.length;
        csvRows.push(...rows);
      }
      processed += 1;
      if (processed % 100 === 0) {
        console.log(`Scanned ${processed} records, found ${matched} extensions`);
      }
    }

    cursor = batch[batch.length - 1].sha256;
  }

  const csvContent = csvRows.map((row) => row.map(csvEscape).join(',')).join('\n');
  await fs.writeFile(CSV_PATH, csvContent, 'utf8');

  console.log(`Done. Processed ${processed} records, found ${matched} extensions.`);
  console.log(`CSV written to ${CSV_PATH}`);
  console.log(`Inline scripts saved under ${INLINE_DIR}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });