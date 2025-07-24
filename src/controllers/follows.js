import {prisma} from "../services/global.js";
import logger from "../services/logger.js";
import {createEvent} from "./events.js";

/**
 * Follow a user
 *
 * @param {number} followerId - User ID following
 * @param {number} followedId - User ID being followed
 * @param {string} note - Note to add to the follow relationship
 * @returns {Promise<Object>} Follow information
 */
export async function followUser(followerId, followedId, note = "") {
    try {
        // Don't allow following yourself
        if (followerId === followedId) {
            throw new Error("不能关注自己");
        }

        // Check if followed user exists
        const followedUser = await prisma.ow_users.findUnique({
            where: {id: followedId},
        });

        if (!followedUser) {
            throw new Error("用户不存在");
        }

        // Check if already following
        const existingFollow = await prisma.ow_user_relationships.findUnique({
            where: {
                unique_user_relationship: {
                    source_user_id: followerId,
                    target_user_id: followedId,
                    relationship_type: "follow",
                },
            },
        });

        if (existingFollow) {
            // If already following and note provided, update the note
            if (note) {
                return await updateFollowNote(followerId, followedId, note);
            }
            return existingFollow;
        }

        // Create relationship record with note
        const relationship = await prisma.ow_user_relationships.create({
            data: {
                source_user_id: followerId,
                target_user_id: followedId,
                relationship_type: "follow",
                metadata: {
                    note: note || "",
                },
            },
        });
        await createEvent(
            "user_follow",
            followerId,
            "user",
            followedId,
            {}
        );

        logger.debug(`Created follow notification for user ${followedId}`);

        return relationship;
    } catch (error) {
        logger.error("Error in followUser:", error);
        throw error;
    }
}

/**
 * Unfollow a user
 *
 * @param {number} followerId - User ID unfollowing
 * @param {number} followedId - User ID being unfollowed
 * @returns {Promise<Object>} Unfollow information
 */
export async function unfollowUser(followerId, followedId) {
    try {
        // Delete relationship if it exists
        const result = await prisma.ow_user_relationships.deleteMany({
            where: {
                source_user_id: followerId,
                target_user_id: followedId,
                relationship_type: "follow",
            },
        });

        return {count: result.count};
    } catch (error) {
        logger.error("Error in unfollowUser:", error);
        throw error;
    }
}

/**
 * Block a user
 *
 * @param {number} blockerId - User ID blocking
 * @param {number} blockedId - User ID being blocked
 * @param {string} reason - Reason for blocking
 * @returns {Promise<Object>} Block information
 */
export async function blockUser(blockerId, blockedId, reason = "") {
    try {
        // Don't allow blocking yourself
        if (blockerId === blockedId) {
            throw new Error("不能拉黑自己");
        }

        // Check if blocked user exists
        const blockedUser = await prisma.ow_users.findUnique({
            where: {id: blockedId},
        });

        if (!blockedUser) {
            throw new Error("用户不存在");
        }

        // Check if already blocked
        const existingBlock = await prisma.ow_user_relationships.findUnique({
            where: {
                unique_user_relationship: {
                    source_user_id: blockerId,
                    target_user_id: blockedId,
                    relationship_type: "block",
                },
            },
        });

        if (existingBlock) {
            // If already blocked and reason provided, update the reason
            if (reason) {
                return await updateBlockReason(blockerId, blockedId, reason);
            }
            return existingBlock;
        }

        // If the blocker follows the blocked user, automatically unfollow
        await prisma.ow_user_relationships.deleteMany({
            where: {
                source_user_id: blockerId,
                target_user_id: blockedId,
                relationship_type: "follow",
            },
        });

        // Create relationship record with reason
        const relationship = await prisma.ow_user_relationships.create({
            data: {
                source_user_id: blockerId,
                target_user_id: blockedId,
                relationship_type: "block",
                metadata: {
                    reason: reason || "",
                },
            },
        });

        return relationship;
    } catch (error) {
        logger.error("Error in blockUser:", error);
        throw error;
    }
}

/**
 * Unblock a user
 *
 * @param {number} blockerId - User ID unblocking
 * @param {number} blockedId - User ID being unblocked
 * @returns {Promise<Object>} Unblock information
 */
export async function unblockUser(blockerId, blockedId) {
    try {
        // Delete relationship if it exists
        const result = await prisma.ow_user_relationships.deleteMany({
            where: {
                source_user_id: blockerId,
                target_user_id: blockedId,
                relationship_type: "block",
            },
        });

        return {count: result.count};
    } catch (error) {
        logger.error("Error in unblockUser:", error);
        throw error;
    }
}

/**
 * Get user followers
 *
 * @param {number} userId - User ID
 * @param {number} limit - Maximum number of followers to return
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Object>} Followers information
 */
export async function getUserFollowers(userId, limit = 20, offset = 0) {
    try {
        // Find all users who follow the target user
        const relationships = await prisma.ow_user_relationships.findMany({
            where: {
                target_user_id: userId,
                relationship_type: "follow",
            },
            include: {
                // Join with ow_users to get follower details
                // Note: This doesn't work directly with Prisma, we need to adjust the query
            },
            orderBy: {created_at: "desc"},
            take: limit,
            skip: offset,
        });

        // Since we don't have direct relations in the model, we need to get users separately
        const followerIds = relationships.map((rel) => rel.source_user_id);

        // Get user details for all followers
        const followerDetails = await prisma.ow_users.findMany({
            where: {
                id: {in: followerIds},
            },
            select: {
                id: true,
                username: true,
                display_name: true,
                avatar: true,
            },
        });

        // Create a map of user IDs to user details
        const userMap = followerDetails.reduce((map, user) => {
            map[user.id] = user;
            return map;
        }, {});

        // Combine relationship data with user details
        const followers = relationships.map((rel) => ({
            ...rel,
            user: userMap[rel.source_user_id],
        }));

        // Get total count
        const totalCount = await prisma.ow_user_relationships.count({
            where: {
                target_user_id: userId,
                relationship_type: "follow",
            },
        });

        return {
            followers,
            total: totalCount,
            limit,
            offset,
        };
    } catch (error) {
        logger.error("Error in getUserFollowers:", error);
        throw error;
    }
}

/**
 * Get users followed by a user
 *
 * @param {number} userId - User ID
 * @param {number} limit - Maximum number of followed users to return
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Object>} Following information
 */
export async function getUserFollowing(userId, limit = 20, offset = 0) {
    try {
        // Find all users who the source user follows
        const relationships = await prisma.ow_user_relationships.findMany({
            where: {
                source_user_id: userId,
                relationship_type: "follow",
            },
            orderBy: {created_at: "desc"},
            take: limit,
            skip: offset,
        });

        // Get the IDs of followed users
        const followedIds = relationships.map((rel) => rel.target_user_id);

        // Get user details for all followed users
        const followedDetails = await prisma.ow_users.findMany({
            where: {
                id: {in: followedIds},
            },
            select: {
                id: true,
                username: true,
                display_name: true,
                avatar: true,
            },
        });

        // Create a map of user IDs to user details
        const userMap = followedDetails.reduce((map, user) => {
            map[user.id] = user;
            return map;
        }, {});

        // Combine relationship data with user details
        const following = relationships.map((rel) => ({
            ...rel,
            user: userMap[rel.target_user_id],
        }));

        // Get total count
        const totalCount = await prisma.ow_user_relationships.count({
            where: {
                source_user_id: userId,
                relationship_type: "follow",
            },
        });

        return {
            following,
            total: totalCount,
            limit,
            offset,
        };
    } catch (error) {
        logger.error("Error in getUserFollowing:", error);
        throw error;
    }
}

/**
 * Get users blocked by a user
 *
 * @param {number} userId - User ID
 * @param {number} limit - Maximum number of blocked users to return
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Object>} Blocked users information
 */
export async function getUserBlocked(userId, limit = 20, offset = 0) {
    try {
        // Find all users who the source user has blocked
        const relationships = await prisma.ow_user_relationships.findMany({
            where: {
                source_user_id: userId,
                relationship_type: "block",
            },
            orderBy: {created_at: "desc"},
            take: limit,
            skip: offset,
        });

        // Get the IDs of blocked users
        const blockedIds = relationships.map((rel) => rel.target_user_id);

        // Get user details for all blocked users
        const blockedDetails = await prisma.ow_users.findMany({
            where: {
                id: {in: blockedIds},
            },
            select: {
                id: true,
                username: true,
                display_name: true,
                avatar: true,
                bio: true,
            },
        });

        // Create a map of user IDs to user details
        const userMap = blockedDetails.reduce((map, user) => {
            map[user.id] = user;
            return map;
        }, {});

        // Combine relationship data with user details
        const blocked = relationships.map((rel) => ({
            ...rel,
            user: userMap[rel.target_user_id],
        }));

        // Get total count
        const totalCount = await prisma.ow_user_relationships.count({
            where: {
                source_user_id: userId,
                relationship_type: "block",
            },
        });

        return {
            blocked,
            total: totalCount,
            limit,
            offset,
        };
    } catch (error) {
        logger.error("Error in getUserBlocked:", error);
        throw error;
    }
}

/**
 * Check if a user is following another user
 *
 * @param {number} followerId - Follower user ID
 * @param {number} followedId - Followed user ID
 * @returns {Promise<boolean>} Whether the follower is following the followed user
 */
export async function isFollowing(followerId, followedId) {
    try {
        const relationship = await prisma.ow_user_relationships.findUnique({
            where: {
                unique_user_relationship: {
                    source_user_id: followerId,
                    target_user_id: followedId,
                    relationship_type: "follow",
                },
            },
        });

        return !!relationship;
    } catch (error) {
        logger.error("Error in isFollowing:", error);
        throw error;
    }
}

/**
 * Check if a user has blocked another user
 *
 * @param {number} blockerId - Blocker user ID
 * @param {number} blockedId - Blocked user ID
 * @returns {Promise<boolean>} Whether the blocker has blocked the blocked user
 */
export async function isBlocking(blockerId, blockedId) {
    try {
        const relationship = await prisma.ow_user_relationships.findUnique({
            where: {
                unique_user_relationship: {
                    source_user_id: blockerId,
                    target_user_id: blockedId,
                    relationship_type: "block",
                },
            },
        });

        return !!relationship;
    } catch (error) {
        logger.error("Error in isBlocking:", error);
        throw error;
    }
}

/**
 * Get all relationships between two users
 *
 * @param {number} userId1 - First user ID
 * @param {number} userId2 - Second user ID
 * @returns {Promise<Object>} Relationships between the two users
 */
export async function getRelationshipsBetweenUsers(userId1, userId2) {
    try {
        // Get relationships where userId1 is the source
        const outgoingRelationships = await prisma.ow_user_relationships.findMany({
            where: {
                source_user_id: userId1,
                target_user_id: userId2,
            },
        });

        // Get relationships where userId1 is the target
        const incomingRelationships = await prisma.ow_user_relationships.findMany({
            where: {
                source_user_id: userId2,
                target_user_id: userId1,
            },
        });

        // Format into easy-to-use object
        const relationshipMap = {
            outgoing: outgoingRelationships.reduce((map, rel) => {
                map[rel.relationship_type] = true;
                return map;
            }, {}),
            incoming: incomingRelationships.reduce((map, rel) => {
                map[rel.relationship_type] = true;
                return map;
            }, {}),
        };

        return {
            isFollowing: !!relationshipMap.outgoing.follow,
            isFollowedBy: !!relationshipMap.incoming.follow,
            isBlocking: !!relationshipMap.outgoing.block,
            isBlockedBy: !!relationshipMap.incoming.block,
            isMuting: !!relationshipMap.outgoing.mute,
            hasFavorited: !!relationshipMap.outgoing.favorite,
            relationships: {
                outgoing: outgoingRelationships,
                incoming: incomingRelationships,
            },
        };
    } catch (error) {
        logger.error("Error in getRelationshipsBetweenUsers:", error);
        throw error;
    }
}

/**
 * Update follow note
 *
 * @param {number} followerId - User ID following
 * @param {number} followedId - User ID being followed
 * @param {string} note - Note to add to the follow relationship
 * @returns {Promise<Object>} Updated follow relationship
 */
export async function updateFollowNote(followerId, followedId, note) {
    try {
        // Check if relationship exists
        const existingFollow = await prisma.ow_user_relationships.findUnique({
            where: {
                unique_user_relationship: {
                    source_user_id: followerId,
                    target_user_id: followedId,
                    relationship_type: "follow",
                },
            },
        });

        if (!existingFollow) {
            throw new Error("关注关系不存在");
        }

        // Update the relationship note
        const updatedRelationship = await prisma.ow_user_relationships.update({
            where: {
                id: existingFollow.id,
            },
            data: {
                metadata: {
                    note: note || "",
                },
                updated_at: new Date(),
            },
        });

        return updatedRelationship;
    } catch (error) {
        logger.error("Error in updateFollowNote:", error);
        throw error;
    }
}

/**
 * Update block reason
 *
 * @param {number} blockerId - User ID blocking
 * @param {number} blockedId - User ID being blocked
 * @param {string} reason - Reason for blocking
 * @returns {Promise<Object>} Updated block relationship
 */
export async function updateBlockReason(blockerId, blockedId, reason) {
    try {
        // Check if relationship exists
        const existingBlock = await prisma.ow_user_relationships.findUnique({
            where: {
                unique_user_relationship: {
                    source_user_id: blockerId,
                    target_user_id: blockedId,
                    relationship_type: "block",
                },
            },
        });

        if (!existingBlock) {
            throw new Error("拉黑关系不存在");
        }

        // Update the relationship reason
        const updatedRelationship = await prisma.ow_user_relationships.update({
            where: {
                id: existingBlock.id,
            },
            data: {
                metadata: {
                    reason: reason || "",
                },
                updated_at: new Date(),
            },
        });

        return updatedRelationship;
    } catch (error) {
        logger.error("Error in updateBlockReason:", error);
        throw error;
    }
}

/**
 * Get relationship notes
 *
 * @param {number} userId - User ID requesting the notes
 * @param {number} targetUserId - Target user ID
 * @returns {Promise<Object>} Notes information
 */
export async function getRelationshipNotes(userId, targetUserId) {
    try {
        // Get follow note if exists
        const followRelationship = await prisma.ow_user_relationships.findUnique({
            where: {
                unique_user_relationship: {
                    source_user_id: userId,
                    target_user_id: targetUserId,
                    relationship_type: "follow",
                },
            },
        });

        // Get block reason if exists
        const blockRelationship = await prisma.ow_user_relationships.findUnique({
            where: {
                unique_user_relationship: {
                    source_user_id: userId,
                    target_user_id: targetUserId,
                    relationship_type: "block",
                },
            },
        });

        return {
            follow: followRelationship
                ? {
                    note: followRelationship.metadata?.note || "",
                    created_at: followRelationship.created_at,
                    updated_at: followRelationship.updated_at,
                }
                : null,
            block: blockRelationship
                ? {
                    reason: blockRelationship.metadata?.reason || "",
                    created_at: blockRelationship.created_at,
                    updated_at: blockRelationship.updated_at,
                }
                : null,
        };
    } catch (error) {
        logger.error("Error in getRelationshipNotes:", error);
        throw error;
    }
}

export default {
    // Follow
    followUser,
    unfollowUser,
    getUserFollowers,
    getUserFollowing,
    isFollowing,

    // Block
    blockUser,
    unblockUser,
    getUserBlocked,
    isBlocking,

    // General
    getRelationshipsBetweenUsers,
    updateFollowNote,
    updateBlockReason,
    getRelationshipNotes,
};
