import { createTransport } from "nodemailer";
import configManager from "../configManager.js";
import logger from "../logger.js";
let transporter;
const service = await configManager.getConfig("mail.service");
const user = await configManager.getConfig("mail.user");
const pass = await configManager.getConfig("mail.pass");
const siteName = await configManager.getConfig("site.name");
const mailFrom = await configManager.getConfig("mail.from");
const from = `${siteName} <${mailFrom}>`;

  logger.info("Initializing email transporter:", service, user);
  logger.debug({
    service,
    secure: true,
    auth: {
      user,
      pass,
    },
  });
  transporter = createTransport({
    service,
    secure: true,
    auth: {
      user,
      pass,
    },
  });



const sendEmail = async (to, subject, html) => {
  try {

    await transporter.sendMail({
      from: from,
      to: to,
      subject: `${siteName} ${subject}`,
      html: html,
    });
  } catch (error) {
    logger.error("Error sending email:", error);
  }
};

export { sendEmail };