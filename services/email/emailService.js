import { createTransport } from "nodemailer";
import zcconfig from "../../services/config/zcconfig.js";
import logger from "../logger.js";
let transporter;
const service = await zcconfig.get("mail.service");
const user = await zcconfig.get("mail.user");
const pass = await zcconfig.get("mail.pass");
const siteName = await zcconfig.get("site.name");
const mailFrom = await zcconfig.get("mail.from");
const from = `${siteName} <${mailFrom}>`;

  logger.debug("Initializing email transporter:", service, user);
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