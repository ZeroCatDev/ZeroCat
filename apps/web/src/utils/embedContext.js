const EMBED_BASE_KEYS = new Set(['type', 'id']);
const EMBED_SPECIAL_KEYS = new Set(['type', 'id', 'branch', 'commit']);

export const isPlainObject = (value) => (
  Object.prototype.toString.call(value) === '[object Object]'
);

export const normalizeEmbedId = (value) => {
  if (value === undefined || value === null || `${value}` === '') return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return value;
};

export const normalizeEmbedObject = (source) => {
  if (!isPlainObject(source)) return {};
  const result = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
};

export const buildRelatedEmbedData = ({ type, id, branch, commit, embedData } = {}) => {
  const data = normalizeEmbedObject(embedData);

  if (type !== undefined && type !== null && `${type}` !== '') {
    data.type = type;
  }

  const normalizedId = normalizeEmbedId(id);
  if (normalizedId !== undefined) {
    data.id = normalizedId;
  }

  if (branch !== undefined && branch !== null && `${branch}` !== '') {
    data.branch = branch;
  }

  if (commit !== undefined && commit !== null && `${commit}` !== '') {
    data.commit = commit;
  }

  return data;
};

export const isSameEmbedTarget = (left, right) => {
  const leftData = normalizeEmbedObject(left);
  const rightData = normalizeEmbedObject(right);

  const leftType = leftData.type;
  const rightType = rightData.type;
  if (!leftType || !rightType || String(leftType) !== String(rightType)) {
    return false;
  }

  const leftId = normalizeEmbedId(leftData.id);
  const rightId = normalizeEmbedId(rightData.id);
  if (leftId === undefined || rightId === undefined) {
    return false;
  }

  return String(leftId) === String(rightId);
};

export const getEmbedSpecialMarkers = (embedData) => {
  const data = normalizeEmbedObject(embedData);

  const branch = data.branch && String(data.branch) !== 'main'
    ? String(data.branch)
    : '';

  let commit = '';
  if (data.commit !== undefined && data.commit !== null && `${data.commit}` !== '') {
    const normalized = String(data.commit);
    commit = normalized === 'latest' ? normalized : normalized.slice(0, 7);
  }

  const extras = [];
  for (const [key, value] of Object.entries(data)) {
    if (EMBED_SPECIAL_KEYS.has(key) || EMBED_BASE_KEYS.has(key)) continue;
    if (!['string', 'number', 'boolean'].includes(typeof value)) continue;
    if (`${value}` === '') continue;
    extras.push({ key, value: String(value) });
  }

  return {
    branch,
    commit,
    extras,
    hasSpecialMarkers: Boolean(branch || commit || extras.length)
  };
};

