import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

/**
 * Migration script to move data from user_follows table to user_relationships table
 */
async function migrateFollowsToRelationships() {
  try {
    logger.info('Starting migration of user follows to user relationships...');

    // Get all follows from the old table
    const follows = await prisma.$queryRaw`
      SELECT follower_id, followed_id, created_at FROM user_follows
    `;

    logger.info(`Found ${follows.length} follows to migrate`);

    // Count of successful migrations
    let successCount = 0;
    let errorCount = 0;

    // Process in batches to avoid overloading the database
    const batchSize = 100;
    for (let i = 0; i < follows.length; i += batchSize) {
      const batch = follows.slice(i, i + batchSize);

      // Process each follow in the batch
      const promises = batch.map(async (follow) => {
        try {
          // Check if the relationship already exists
          const existingRelationship = await prisma.user_relationships.findUnique({
            where: {
              unique_user_relationship: {
                source_user_id: follow.follower_id,
                target_user_id: follow.followed_id,
                relationship_type: 'follow'
              }
            }
          });

          // Skip if already exists
          if (existingRelationship) {
            return { skipped: true };
          }

          // Create the relationship
          await prisma.user_relationships.create({
            data: {
              source_user_id: follow.follower_id,
              target_user_id: follow.followed_id,
              relationship_type: 'follow',
              created_at: follow.created_at,
              metadata: {}
            }
          });

          successCount++;
          return { success: true };
        } catch (error) {
          errorCount++;
          logger.error(`Error migrating follow: ${follow.follower_id} -> ${follow.followed_id}`, error);
          return { success: false, error };
        }
      });

      // Wait for all promises in the batch to complete
      await Promise.all(promises);

      logger.info(`Processed ${Math.min(i + batchSize, follows.length)} of ${follows.length} follows`);
    }

    logger.info(`Migration completed. Results: ${successCount} successful, ${errorCount} errors`);

    return {
      total: follows.length,
      success: successCount,
      errors: errorCount
    };
  } catch (error) {
    logger.error('Error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// If this script is run directly
if (process.argv[1] === import.meta.url) {
  migrateFollowsToRelationships()
    .then((result) => {
      console.log('Migration completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default migrateFollowsToRelationships;