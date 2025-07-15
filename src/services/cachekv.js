import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Get value by key for a specific user
 * @param {number} userId - The user ID
 * @param {string} key - The key to get
 * @returns {Promise<any>} The value stored for the key
 */
export async function get(userId, key) {
    try{
  const item = await prisma.ow_cache_kv.findUnique({
    where: {
      user_id_key: {
        user_id: userId,
        key: key
      }
    }
  });

    return item;
  } catch (error) {
    console.error('获取失败:', error);
    return undefined;
  }
}

/**
 * Get value by key for a specific user
 * @param {number} userId - The user ID
 * @param {string} key - The key to get
 * @returns {Promise<any>} The value stored for the key
 */
export async function getValue(userId, key) {
  try{
const item = await prisma.ow_cache_kv.findUnique({
  where: {
    user_id_key: {
      user_id: userId,
      key: key
    }
  }
});

  return item.value;
} catch (error) {
  console.error('获取失败:', error);
  return undefined;
}
}
/**
 * Set value for key for a specific user
 * @param {number} userId - The user ID
 * @param {string} key - The key to set
 * @param {any} value - The value to store (will be stored as JSON)
 * @param {string} [creatorIp] - Optional IP address of the creator
 * @returns {Promise<Object>} The created or updated KV pair
 */
export async function set(userId, key, value, creatorIp = '') {
  return prisma.ow_cache_kv.upsert({
    where: {
      user_id_key: {
        user_id: userId,
        key: key
      }
    },
    update: {
      value: value,
      creator_ip: creatorIp
    },
    create: {
      user_id: userId,
      key: key,
      value: value,
      creator_ip: creatorIp
    }
  });
}

/**
 * Delete a key for a specific user
 * @param {number} userId - The user ID
 * @param {string} key - The key to delete
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function remove(userId, key) {
  try {
    await prisma.ow_cache_kv.delete({
      where: {
        user_id_key: {
          user_id: userId,
          key: key
        }
      }
    });
    return true;
  } catch (error) {
    if (error.code === 'P2025') {
      return false;
    }
    throw error;
  }
}

/**
 * List all keys for a specific user with pagination
 * @param {number} userId - The user ID
 * @param {Object} options - Pagination options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @returns {Promise<Object>} Paginated list of KV pairs and pagination info
 */
export async function list(userId, { page = 1, limit = 20, showValue = false } = {}) {
  const items = await prisma.ow_cache_kv.findMany({
    where: {
      user_id: userId
    },
    select: {
      key: true,
      value: showValue ? true : false,
      created_at: true,
      updated_at: true
    },
    skip: (page - 1) * limit,
    take: limit,
    orderBy: {
      created_at: 'desc'
    }
  });

  const total = await prisma.ow_cache_kv.count({
    where: {
      user_id: userId
    }
  });

  return {
    items,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      total_pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Check if a key exists for a specific user
 * @param {number} userId - The user ID
 * @param {string} key - The key to check
 * @returns {Promise<boolean>} True if key exists, false otherwise
 */
export async function exists(userId, key) {
  const count = await prisma.ow_cache_kv.count({
    where: {
      user_id: userId,
      key: key
    }
  });
  return count > 0;
}

/**
 * Get multiple values by keys for a specific user
 * @param {number} userId - The user ID
 * @param {string[]} keys - Array of keys to get
 * @returns {Promise<Object>} Object with keys and their values
 */
export async function getMultiple(userId, keys) {
  const items = await prisma.ow_cache_kv.findMany({
    where: {
      user_id: userId,
      key: {
        in: keys
      }
    }
  });

  return items.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});
}

/**
 * Set multiple key-value pairs for a specific user
 * @param {number} userId - The user ID
 * @param {Object} entries - Object with key-value pairs to set
 * @param {string} [creatorIp] - Optional IP address of the creator
 * @returns {Promise<Object[]>} Array of created or updated KV pairs
 */
export async function setMultiple(userId, entries, creatorIp = '') {
  const operations = Object.entries(entries).map(([key, value]) =>
    prisma.ow_cache_kv.upsert({
      where: {
        user_id_key: {
          user_id: userId,
          key: key
        }
      },
      update: {
        value: value,
        creator_ip: creatorIp
      },
      create: {
        user_id: userId,
        key: key,
        value: value,
        creator_ip: creatorIp
      }
    })
  );

  return Promise.all(operations);
}