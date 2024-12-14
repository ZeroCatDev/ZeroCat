import logger from "../logger.js";
import configManager from "../configManager.js";

import { createTransport } from "nodemailer";
let service, user, pass, transporter;
configManager.getConfig("mail.service").then((res) => {
  service = res;

  configManager.getConfig("mail.user").then((res) => {
    user = res;

    configManager.getConfig("mail.pass").then((res) => {
      pass = res;
      //logger.debug(service, user, pass);
      transporter = createTransport({
        service: service,
        secure: true,
        auth: {
          user: user,
          pass: pass,
        },
      });
    });
  });
});

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `${await configManager.getConfig(
        "site.name"
      )} <${await configManager.getConfig("mail.from")}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    logger.error("Error sending email:", error);
  }
};

export  { sendEmail };
