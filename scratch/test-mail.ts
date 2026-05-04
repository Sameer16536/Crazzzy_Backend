import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const transporter = nodemailer.createTransport({
  host  : process.env.SMTP_HOST,
  port  : parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth  : {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

console.log('Testing SMTP connection...');
console.log('Host:', process.env.SMTP_HOST);
console.log('Port:', process.env.SMTP_PORT);
console.log('User:', process.env.SMTP_USER);

transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP Verification Error:', error);
  } else {
    console.log('Server is ready to take our messages');
    
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.SMTP_USER, // Send to self
      subject: 'Test Email',
      text: 'This is a test email from the Crazzzy Backend script.',
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Send Error:', error);
      } else {
        console.log('Email sent: ' + info.response);
      }
      process.exit();
    });
  }
});
