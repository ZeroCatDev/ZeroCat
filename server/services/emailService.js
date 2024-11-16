import configManager from "../configManager.js";

import { createTransport } from 'nodemailer';
let service, user, pass
 configManager.getConfig('mail.service').then((res) => {
  service = res
});
 configManager.getConfig('mail.user').then((res) => {
  user = res
});
 configManager.getConfig('mail.pass').then((res) => {
  pass = res
});
const transporter = createTransport({
  service:  service,
  secure: true,
  auth: {
    user:  user,
    pass:  pass,
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `${await configManager.getConfig('site.name')} <${await configManager.getConfig('mail.from')}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

export  { sendEmail };
