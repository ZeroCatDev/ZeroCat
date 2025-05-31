import { createTransport } from "nodemailer";
import zcconfig from "../config/zcconfig.js";
import logger from "../logger.js";

let transporter;

const getMailConfig = async () => {
  const enabled = await zcconfig.get("mail.enabled");
  if (!enabled) {
    return null;
  }

  const host = await zcconfig.get("mail.host");
  const port = await zcconfig.get("mail.port");
  const secure = await zcconfig.get("mail.secure");
  const user = await zcconfig.get("mail.auth.user");
  const pass = await zcconfig.get("mail.auth.pass");
  const fromName = await zcconfig.get("mail.from_name");
  const fromAddress = await zcconfig.get("mail.from_address");

  if (!host || !port || !user || !pass) {
    logger.error("Missing required mail configuration");
    return null;
  }

  const config = {
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    }
  };

  return {
    config,
    from: fromName ? `${fromName} <${fromAddress}>` : fromAddress
  };
};

const initializeTransporter = async () => {
  try {
    const mailConfig = await getMailConfig();
    if (!mailConfig) {
      logger.info("Email service is disabled or not properly configured");
      return false;
    }

    logger.debug("Initializing email transporter with config:", mailConfig.config);
    transporter = createTransport(mailConfig.config);

    // Test the connection
    await transporter.verify();
    logger.info("Email service initialized successfully");
    return true;
  } catch (error) {
    logger.error("Failed to initialize email service:", error);
    return false;
  }
};

const sendEmail = async (to, subject, html) => {
  try {
    if (!transporter) {
      const initialized = await initializeTransporter();
      if (!initialized) {
        throw new Error("Email service is not available or not properly configured");
      }
    }

    const mailConfig = await getMailConfig();
    if (!mailConfig) {
      throw new Error("Email service is disabled or not properly configured");
    }

    await transporter.sendMail({
      from: mailConfig.from,
      to: to,
      subject: subject,
      html: html,
    });

    return true;
  } catch (error) {
    logger.error("Error sending email:", error);
    throw error;
  }
};

// Initialize email service when the module is loaded
initializeTransporter().catch(error => {
  logger.error("Failed to initialize email service on module load:", error);
});

export { sendEmail };