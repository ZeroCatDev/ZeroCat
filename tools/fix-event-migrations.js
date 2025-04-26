/**
 * @fileoverview Helper script to fix event system migration issues
 *
 * Usage:
 * node tools/fix-event-migrations.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get directory name in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'prisma', 'migrations');

/**
 * Main function to fix migration issues
 */
async function main() {
  console.log('Event System Migration Fix Tool');
  console.log('--------------------------------');

  // 1. Check for conflicting migrations
  const oldEventMigration = path.join(migrationsDir, '20240704000000_enhance_event_model');
  const newEventMigration = path.join(migrationsDir, '20240705000000_enhance_event_model');

  if (fs.existsSync(oldEventMigration)) {
    console.log(`Found old migration directory: ${oldEventMigration}`);
    console.log('Removing old migration directory...');
    fs.rmSync(oldEventMigration, { recursive: true, force: true });
    console.log('Old migration directory removed.');
  }

  // 2. Check if new migration exists
  if (!fs.existsSync(newEventMigration)) {
    console.log(`New migration not found at: ${newEventMigration}`);
    console.log('Creating new migration directory...');
    fs.mkdirSync(newEventMigration, { recursive: true });

    // Create migration file
    const migrationSql = `-- AlterTable: Update events table structure
-- We keep the existing structure but modify how we use the event_data field

-- Add index on actor_id for better performance on actor-based queries
CREATE INDEX IF NOT EXISTS \`idx_events_actor_id\` ON \`events\` (\`actor_id\`);

-- Add combined index for event_type and target_id to optimize common queries
CREATE INDEX IF NOT EXISTS \`idx_events_type_target\` ON \`events\` (\`event_type\`, \`target_id\`);

-- Add index on public field for filtering public/private events efficiently
CREATE INDEX IF NOT EXISTS \`idx_events_public\` ON \`events\` (\`public\`);`;

    fs.writeFileSync(path.join(newEventMigration, 'migration.sql'), migrationSql);
    console.log('New migration file created.');
  } else {
    console.log(`New migration exists at: ${newEventMigration}`);
  }

  // 3. Fix migration entries in _prisma_migrations table
  console.log('\nTo fix entries in the _prisma_migrations table, run:');
  console.log('----------------------------------------------------------');
  console.log('-- Connect to your MySQL database and run these commands:');
  console.log('DELETE FROM _prisma_migrations WHERE migration_name = \'20240704000000_enhance_event_model\';');
  console.log('INSERT INTO _prisma_migrations (migration_name, started_at, applied_at) VALUES (\'20240705000000_enhance_event_model\', NOW(), NOW());');
  console.log('----------------------------------------------------------');

  // 4. Update documentation references
  const docsFile = path.join(rootDir, 'docs', 'events-system.md');
  if (fs.existsSync(docsFile)) {
    let content = fs.readFileSync(docsFile, 'utf8');
    content = content.replace(/20240704000000_enhance_event_model/g, '20240705000000_enhance_event_model');
    fs.writeFileSync(docsFile, content);
    console.log('Updated documentation references.');
  }

  console.log('\nEvent migration fix complete!');
  console.log('Run "npx prisma migrate resolve --applied 20240705000000_enhance_event_model" to mark the migration as applied.');
}

// Run the script
main().catch(error => {
  console.error('Error fixing migrations:', error);
  process.exit(1);
});