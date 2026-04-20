const nodemailer = require('nodemailer');

let testAccount = null;
let transporter = null;

const sendEmail = async (options) => {
    // For local development, we will use Ethereal (a fake SMTP service provided by Nodemailer)
    // In production, you would configure Sengrid, Mailgun, AWS SES, etc.
    if (!testAccount) {
        testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user, // Generated ethereal user
                pass: testAccount.pass  // Generated ethereal password
            }
        });
    }

    const message = {
        from: '"Secure Auth Framework" <noreply@secureos.local>',
        to: options.email,
        subject: options.subject,
        text: options.message
    };

    const info = await transporter.sendMail(message);

    console.log('-------------------------------------------');
    console.log('MFA EMAIL SENT!');
    console.log(`To: ${options.email}`);
    console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    console.log(`(Development Note: Check the Preview URL above to view the fake email)`);
    console.log(`Or simply use this OTP: ${options.rawOtp}`);
    console.log('-------------------------------------------');
};

module.exports = sendEmail;
