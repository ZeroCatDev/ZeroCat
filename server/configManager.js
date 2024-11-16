import { PrismaClient } from "@prisma/client";

class ConfigManager {
  constructor() {
    this.prisma = new PrismaClient();
  }

  async loadConfigsFromDB() {
    // Fetch all configurations from the database
    const configs = await this.prisma.ow_config.findMany();

    // Internal configurations
    global.config = {};
    configs.forEach(({ key, value }) => {
      global.config[key] = value;
    });

    // Public configurations
    global.publicconfig = {};
    configs.forEach(({ key, value, is_public }) => {
      if (is_public == 1) {
        global.publicconfig[key] = value;
      }
    });

    // Configuration information
    global.configinfo = configs;

    //console.log(global.configinfo); // Log the updated config info
  }

  async getConfig(key) {
    // Check if the value is already cached
    if (global.config && global.config[key]) {
      return global.config[key];
    }
    // If not cached, fetch from the database
    await this.loadConfigsFromDB();
    // If not cached, fetch from the database
    if (global.config && global.config[key]) {
      return global.config[key];
    }
    throw new Error(`Config key "${key}" not found.`);
  }

  async getPublicConfigs(key) {
    // Check if the value is already cached
    if (global.publicconfig && global.publicconfig[key]) {
      return global.publicconfig[key];
    }
    // If not cached, fetch from the database
    await this.loadConfigsFromDB();

    if (global.publicconfig && global.publicconfig[key]) {
      return global.publicconfig[key];
    }
    throw new Error(`Config key "${key}" not found.`);
  }

  async getConfigFromDB(key) {
    await this.loadConfigsFromDB();

    if (global.config && global.config[key]) {
      return global.config[key];
    }

    throw new Error(`Config key "${key}" not found.`);
  }
}

// Create a singleton instance of the ConfigManager class
const configManagerInstance = new ConfigManager();
export default configManagerInstance;
