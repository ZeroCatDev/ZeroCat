import {PrismaClient} from "@prisma/client";
import zcconfig from "./config/zcconfig.js";
import logger from "./logger.js";
import schedulerService from "./scheduler.js";
import {set} from "./cachekv.js";

const prisma = new PrismaClient();

class CodeRunManager {
    constructor() {
        this.runners = new Map(); // Store runner status
        this.CACHE_KEY = "system:coderun:runners";
    }

    async initialize() {
        // Load existing active devices from database
        try {
            const activeDevices = await prisma.ow_coderun_devices.findMany({
                where: {
                    status: 'active'
                }
            });

            // Initialize state for each active device
            const now = new Date();
            for (const device of activeDevices) {
                this.runners.set(device.id, {
                    lastReport: now,
                    status: 'active',
                    lastReportData: {
                        docker: {},
                        system: {},
                        coderun: {}
                    }
                });
            }

            logger.info(`[CodeRunManager] Loaded ${activeDevices.length} active devices from database`);
        } catch (error) {
            logger.error('[CodeRunManager] Error loading active devices:', error);
        }

        // Get report interval from config
        const reportInterval = await zcconfig.get(
            "coderun.report_interval",
        ); // Default 5 min
        const checkInterval = reportInterval * 1.5;

        // Register scheduler task
        schedulerService.registerTask("coderun-status-check", {
            interval: checkInterval,
            handler: async () => this.checkInactiveRunners(),
            runImmediately: true,
        });

        // Update cache after initialization
        await this.updateCache();

        logger.info(
            "[CodeRunManager] Initialized with check interval:",
            checkInterval
        );
    }

    async updateRunnerStatus(runnerId, status) {
        const now = new Date();
        this.runners.set(runnerId, {
            lastReport: now,
            status: status,
        });

        // Update cache
        await this.updateCache();
    }

    async checkInactiveRunners() {
        const reportInterval = await zcconfig.get(
            "coderun.report_interval",
            300000
        );
        const now = new Date();
        const inactiveThreshold = new Date(now.getTime() - reportInterval * 2);

        // Check each runner
        for (const [runnerId, runnerData] of this.runners.entries()) {
            if (
                runnerData.lastReport < inactiveThreshold &&
                runnerData.status === "active"
            ) {
                // Mark as inactive in database
                await prisma.ow_coderun_devices.update({
                    where: {id: runnerId},
                    data: {status: "inactive"},
                });

                // Update local status
                runnerData.status = "inactive";
                logger.info(`[CodeRunManager] Runner ${runnerId} marked as inactive`);
            }
        }

        // Update cache after changes
        await this.updateCache();
    }

    async handleRunnerReport(runnerId, reportData) {
        const existingRunner = this.runners.get(runnerId);
        const wasInactive = existingRunner?.status === "inactive";

        // Update runner status
        await this.updateRunnerStatus(runnerId, "active");

        // If runner was inactive, reactivate in database
        if (wasInactive) {
            await prisma.ow_coderun_devices.update({
                where: {id: runnerId},
                data: {status: "active"},
            });
            logger.info(`[CodeRunManager] Runner ${runnerId} reactivated`);
        }

        // Store report data
        this.runners.get(runnerId).lastReportData = reportData;
    }

    async updateCache() {
        // Convert Map to object for storage
        const runnersData = Object.fromEntries(this.runners);
        await set(1, this.CACHE_KEY, runnersData);
    }

    getRunnerStatus(runnerId) {
        return this.runners.get(runnerId);
    }

    getAllRunners() {
        return Object.fromEntries(this.runners);
    }
}

const codeRunManager = new CodeRunManager();
export default codeRunManager;
