const configManager = require("../configManager");

const nodemailer = require("nodemailer");
let service, user, pass, transporter;
configManager.getConfig("mail.service").then((res) => {
  service = res;

  configManager.getConfig("mail.user").then((res) => {
    user = res;

    configManager.getConfig("mail.pass").then((res) => {
      pass = res;
      //console.log(service, user, pass);
      transporter = nodemailer.createTransport({
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
    console.error("Error sending email:", error);
  }
};

module.exports = { sendEmail };
