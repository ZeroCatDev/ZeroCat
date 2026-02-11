import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: "127.0.0.1",
    port: 25,
    secure: false,
    auth: {
        user: "b698484cae6ac85987666938da81b881",
        pass: "0e06800c050e9c9d026f9bec99135f7e1d312983b0db4405c442dcdb07fc3359"
    },
    ignoreTLS: true

});

await transporter.sendMail({
    from: "notify@zerocat.dev",
    to: "1847261658@qq.com",
    subject: "SMTP 测试邮件",
    text: "这是一封纯文本测试邮件。",
    html: "<b>这是一封 HTML 测试邮件。</b>",
sender: "ZeroCat Mail"
});

console.log("sent");
