import { Router } from 'express';
const router = Router();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { randomBytes } from 'crypto';
import zcconfig from '../../services/config/zcconfig.js';
import logger from '../../services/logger.js';
import codeRunManager from '../../services/coderunManager.js';

// Get active runners endpoint
router.get('/getrunners', async (req, res) => {
  try {
    const allRunners = codeRunManager.getAllRunners();
    const activeRunners = [];

    // Get all runner devices to match with request URLs
    const devices = await prisma.ow_coderun_devices.findMany({
      where: {
        status: 'active',
        request_url: {
          not: ''
        }
      }
    });

    // Match active runners with their device info
    for (const device of devices) {
      const runnerStatus = allRunners[device.id];
      if (runnerStatus && runnerStatus.status === 'active') {
        activeRunners.push({
          id: device.id,
          device_name: device.device_name,
          request_url: device.request_url,
        });
      }
    }

    res.json({
      success: true,
      runners: activeRunners
    });
  } catch (error) {
    console.error('Error getting active runners:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Device registration endpoint
router.post('/register', async (req, res) => {
  try {
    const { auth_token, device_name ,request_url} = req.body;

    // Verify auth token matches config
    const configAuthToken = await zcconfig.get('coderun.authtoken');
    logger.debug(`configAuthToken: ${configAuthToken}`);
    logger.debug(`auth_token: ${auth_token}`);
    if (!configAuthToken || auth_token !== configAuthToken) {
      return res.status(401).json({ success: false, error: 'Invalid auth token' });
    }

    // Generate runner token
    const runnerToken = randomBytes(32).toString('hex');

    const device = await prisma.ow_coderun_devices.create({
      data: {
        device_name,
        request_url: request_url||'',
        runner_token: runnerToken,
        status: 'active'
      }
    });

    // Initialize device in manager
    await codeRunManager.updateRunnerStatus(device.id, 'active');

    res.json({
      success: true,
      device_id: device.id,
      runner_token: runnerToken
    });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Device status report endpoint
router.post('/device', async (req, res) => {
  try {
    const { docker, system, coderun } = req.body;
    const { runner_token } = req.headers;

    // Verify runner token
    const device = await prisma.ow_coderun_devices.findFirst({
      where: {
        runner_token,
      }
    });

    if (!device) {
      return res.status(401).json({ success: false, error: 'Invalid runner token or device not found' });
    }

    // Update device status using manager
    await codeRunManager.handleRunnerReport(device.id, { docker, system, coderun });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating device status:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Device config fetch endpoint
router.get('/config', async (req, res) => {
  try {
    const { runner_token } = req.headers;

    // Verify runner token
    const device = await prisma.ow_coderun_devices.findFirst({
      where: {
        runner_token,
      }
    });

    if (!device) {
      return res.status(401).json({ success: false, error: 'Invalid runner token or device not found' });
    }

    // Get default config
    const defaultConfig = {
      enabled: await zcconfig.get('coderun.enabled', true),
      poolSize: await zcconfig.get('coderun.pool_size', 5),
      reportInterval: await zcconfig.get('coderun.report_interval'),
      jwtSecret: await zcconfig.get('security.jwttoken')
    };

    // Merge with device-specific config
    const config = {
      ...defaultConfig,
      ...(device.device_config || {})
    };

    res.json({ success: true, config });
  } catch (error) {
    console.error('Error fetching device config:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;