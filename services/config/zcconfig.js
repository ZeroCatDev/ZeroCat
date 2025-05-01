import logger from "../logger.js";

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient()

class zcconfig {

  async loadConfigsFromDB() {
    try {
      // Fetch all configurations from the database
      const configs = await prisma.ow_config.findMany();

      // Reset configuration objects
      global.config = {};
      global.publicconfig = {};
      global.configinfo = configs || [];

      // Populate configuration objects
      if (Array.isArray(configs)) {
        configs.forEach(({ key, value, is_public }) => {
          // Internal configurations
          global.config[key] = value;

          // Public configurations
          if (is_public === 1) {
            global.publicconfig[key] = value;
          }
        });
      }

      return true;
    } catch (error) {
      logger.error("Error loading configs from database:", error);
      return false;
    }
  }

  async get(key) {
    if (!key) {
      logger.warn("Attempt to get config with null/undefined key");
      return null;
    }

    // Check if the value is already cached
    if (global.config && global.config[key] !== undefined) {
      return global.config[key];
    }

    try {
      const config = await prisma.ow_config.findFirst({where: {key}});
      const value = config?.value ?? null;

      // Update cache
      if (global.config && value !== null) {
        global.config[key] = value;
      }

      return value;
    } catch (error) {
      logger.error(`Error retrieving config for key: ${key}`, error);
      return null;
    }
  }

}

// Create a singleton instance of the zcconfig class
const zcconfigInstance = new zcconfig();
export default zcconfigInstance;

