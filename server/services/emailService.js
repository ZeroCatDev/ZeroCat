const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: global.config.mail.service,
  secure: true,
  auth: {
    user: global.config.mail.user,
    pass: global.config.mail.pass,
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `${global.config.site.name} <${global.config.mail.from}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

module.exports = { sendEmail };
