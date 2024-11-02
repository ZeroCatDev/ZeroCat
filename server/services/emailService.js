const configManager = require("../configManager");

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service:  configManager.getConfigSync('mail.service'),
  secure: true,
  auth: {
    user:  configManager.getConfigSync('mail.user'),
    pass:  configManager.getConfigSync('mail.pass'),
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

module.exports = { sendEmail };
