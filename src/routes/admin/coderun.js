import {Router} from "express";
import {prisma} from "../../services/prisma.js";
import {needAdmin} from "../../middleware/auth.js";
import codeRunManager from "../../services/coderunManager.js";

const router = Router();

// List all CodeRun devices
router.get("/devices", needAdmin, async (req, res) => {
    try {
        const devices = await prisma.ow_coderun_devices.findMany({
            orderBy: {created_at: "desc"},
        });
        res.json({success: true, devices});
    } catch (error) {
        console.error("Error fetching devices:", error);
        res.status(500).json({success: false, error: "Internal server error"});
    }
});

// Get runner status from manager
router.get("/status", needAdmin, async (req, res) => {
    try {
        const runnerStatus = codeRunManager.getAllRunners();
        res.json({success: true, status: runnerStatus});
    } catch (error) {
        console.error("Error fetching runner status:", error);
        res.status(500).json({success: false, error: "Internal server error"});
    }
});

// Get a single device status
router.get("/devices/:id/status", needAdmin, async (req, res) => {
    try {
        const status = codeRunManager.getRunnerStatus(req.params.id);
        if (!status) {
            return res
                .status(404)
                .json({success: false, error: "Runner status not found"});
        }
        res.json({success: true, status});
    } catch (error) {
        console.error("Error fetching device status:", error);
        res.status(500).json({success: false, error: "Internal server error"});
    }
});

// Get a single device
router.get("/devices/:id", needAdmin, async (req, res) => {
    try {
        const device = await prisma.ow_coderun_devices.findUnique({
            where: {id: req.params.id},
        });
        if (!device) {
            return res
                .status(404)
                .json({success: false, error: "Device not found"});
        }
        res.json({success: true, device});
    } catch (error) {
        console.error("Error fetching device:", error);
        res.status(500).json({success: false, error: "Internal server error"});
    }
});

// Update device configuration
router.put("/devices/:id", needAdmin, async (req, res) => {
    try {
        const {device_name, request_url, device_config, status} = req.body;
        const device = await prisma.ow_coderun_devices.update({
            where: {id: req.params.id},
            data: {
                device_name,
                request_url,
                device_config,
                status,
                updated_at: new Date(),
            },
        });

        // Update status in manager if changed
        if (status) {
            await codeRunManager.updateRunnerStatus(req.params.id, status);
        }

        res.json({success: true, device});
    } catch (error) {
        console.error("Error updating device:", error);
        res.status(500).json({success: false, error: "Internal server error"});
    }
});

// Delete a device
router.delete("/devices/:id", needAdmin, async (req, res) => {
    try {
        await prisma.ow_coderun_devices.delete({
            where: {id: req.params.id},
        });
        res.json({success: true});
    } catch (error) {
        console.error("Error deleting device:", error);
        res.status(500).json({success: false, error: "Internal server error"});
    }
});

// Delete all inactive devices
router.delete("/devices/inactive/all", needAdmin, async (req, res) => {
    try {
        const result = await prisma.ow_coderun_devices.deleteMany({
            where: {
                status: {
                    not: "active",
                },
            },
        });
        res.json({success: true, deletedCount: result.count});
    } catch (error) {
        console.error("Error deleting inactive devices:", error);
        res.status(500).json({success: false, error: "Internal server error"});
    }
});

export default router;
