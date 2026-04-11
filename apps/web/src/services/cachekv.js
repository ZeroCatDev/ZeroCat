import axios from "../axios/axios";

/**
 * Get a value by key from the cache
 * @param {string} key - The key to retrieve
 * @returns {Promise<any>} The value stored for the key
 * @throws {Error} If the request fails or key is not found
 */
export async function get(key) {
  try {
    const response = await axios.get(`/cachekv/${encodeURIComponent(key)}`);
    return response.data.value;
  } catch (error) {
    if (error.response?.status === 404) {
      return undefined;
    }
    throw error;
  }
}

/**
 * Get a value by key from the cache
 * @param {string} key - The key to retrieve
 * @returns {Promise<any>} The value stored for the key
 * @throws {Error} If the request fails or key is not found
 */
export async function info(key) {
  try {
    const response = await axios.get(`/cachekv/${encodeURIComponent(key)}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return undefined;
    }
    throw error;
  }
}

/**
 * Set a value for a key in the cache
 * @param {string} key - The key to set
 * @param {any} value - The value to store
 * @returns {Promise<any>} The stored cache item
 * @throws {Error} If the request fails
 */
export async function set(key, value) {
  const response = await axios.post(
    `/cachekv/${encodeURIComponent(key)}`,
    value
  );
  return response.data.data;
}

/**
 * Remove a key from the cache
 * @param {string} key - The key to remove
 * @returns {Promise<boolean>} True if the key was deleted, false if it didn't exist
 * @throws {Error} If the request fails
 */
export async function remove(key) {
  try {
    await axios.delete(`/cachekv/${encodeURIComponent(key)}`);
    return true;
  } catch (error) {
    if (error.response?.status === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * List all cache keys with pagination
 * @param {Object} options - Pagination options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @param {boolean} [options.showValue=false] - Whether to include values in the response
 * @param {boolean} [options.total=false] - Whether to include total count in the response
 * @returns {Promise<{items: Array<any>, pagination: Object}>} List of cache items and pagination info
 * @throws {Error} If the request fails
 */
export async function list({page = 1, limit = 20, showValue = false, total = false} = {}) {
  const response = await axios.get("/cachekv", {
    params: {page, limit, showValue, total}
  });
  return {
    items: response.data.data,
    pagination: response.data.pagination
  };
}
