
//prisma client
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
class ConfigManager {
    constructor() {
        this.prisma = new PrismaClient();
        this.config = {};
    }

    async loadConfigs() {
        const configs = await this.prisma.newconfig.findMany();
        configs.forEach(({ key, value }) => {
            this.config[key] = value;
        });
    }

    async getConfig(key) {
        if (this.config[key]) {
            return this.config[key];
        }

        const config = await this.prisma.newconfig.findUnique({
            where: { key: key }
        });

        if (config) {
            this.config[key] = config.value;
            return config.value;
        }

        throw new Error(`Config key "${key}" not found.`);
    }

    async initialize() {
        await this.loadConfigs();
    }
}

module.exports = new ConfigManager();
