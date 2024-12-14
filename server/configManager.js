const logger = require("./lib/logger.js");
const { PrismaClient } = require("@prisma/client");

class ConfigManager {
  constructor() {
    this.prisma = new PrismaClient();
  }

  async loadConfigsFromDB() {
    try {
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
    } catch (error) {
      logger.error("Error loading configs from database:", error);
    }
  }

  async getConfig(key) {
    // Check if the value is already cached
    if (global.config && global.config[key] != null) {
      return global.config[key];
    }
    const config = await this.prisma.ow_config.findFirst({where: {key: key}});
    if (config == null) {
      return null;
    }
    return config.value;

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
    var config = await this.prisma.ow_config.findFirst({
      where: { key: key, is_public: 1 },
    });
    if (config == null) {
      return null;
    }
    return config.value;
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
module.exports = configManagerInstance;
