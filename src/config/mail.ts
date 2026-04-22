import nodemailer from 'nodemailer';
import { Order, OrderItem, Product } from '@prisma/client';

export const transporter = nodemailer.createTransport({
  host  : process.env.SMTP_HOST,
  port  : parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth  : {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool          : true,
  maxConnections: 3,
  rateDelta     : 1000,
  rateLimit     : 5,
});

transporter.verify((err: Error | null) => {
  if (err) console.warn('[Mail] SMTP verification failed:', err.message);
  else     console.log('[Mail] SMTP transporter ready');
});

const BRAND_COLOR  = '#FF4B00';
const BRAND_NAME   = 'Crazzzy';
const BRAND_DOMAIN = 'crazzzy.in';

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:${BRAND_COLOR};padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">
                🛍️ ${BRAND_NAME}.in
              </h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">
                Your Favourite Shopping Destination
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background:#fafafa;border-top:1px solid #eeeeee;padding:24px 40px;text-align:center;">
              <p style="margin:0;color:#999999;font-size:12px;line-height:1.6;">
                This email was sent by <strong>${BRAND_NAME}.in</strong>.<br/>
                If you didn't request this, you can safely ignore this email.<br/>
                <a href="https://${BRAND_DOMAIN}" style="color:${BRAND_COLOR};text-decoration:none;">
                  ${BRAND_DOMAIN}
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function otpBlock(otp: string): string {
  return `
    <div style="background:#fff8f6;border:2px dashed ${BRAND_COLOR};border-radius:10px;
                padding:24px;text-align:center;margin:24px 0;">
      <p style="margin:0 0 8px;color:#666666;font-size:13px;text-transform:uppercase;letter-spacing:1px;">
        Your One-Time Code
      </p>
      <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#1a1a1a;font-family:monospace;">
        ${otp}
      </div>
      <p style="margin:12px 0 0;color:#999999;font-size:12px;">
        ⏱ Expires in <strong>10 minutes</strong>. Do not share this code with anyone.
      </p>
    </div>`;
}

export async function sendMail(options: { to: string, subject: string, html: string, text: string }) {
  return transporter.sendMail({
    from   : `"${BRAND_NAME}.in" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to     : options.to,
    subject: options.subject,
    html   : options.html,
    text   : options.text,
  });
}

export async function sendVerificationEmail(email: string, otp: string) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:700;">
      Verify your email address 📧
    </h2>
    <p style="margin:0 0 20px;color:#555555;font-size:15px;line-height:1.6;">
      Thanks for signing up with <strong>${BRAND_NAME}.in</strong>! Use the code below
      to verify your email and activate your account.
    </p>
    ${otpBlock(otp)}
  `);

  await sendMail({
    to     : email,
    subject: `${otp} — Verify your ${BRAND_NAME}.in account`,
    html,
    text   : `Your ${BRAND_NAME}.in verification code is: ${otp}\nExpires in 10 minutes.`,
  });
}

export async function sendPasswordResetEmail(email: string, otp: string) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:700;">
      Reset your password 🔐
    </h2>
    <p style="margin:0 0 20px;color:#555555;font-size:15px;line-height:1.6;">
      We received a request to reset the password for your <strong>${BRAND_NAME}.in</strong>
      account. Enter the code below to proceed.
    </p>
    ${otpBlock(otp)}
  `);

  await sendMail({
    to     : email,
    subject: `${otp} — Reset your ${BRAND_NAME}.in password`,
    html,
    text   : `Your ${BRAND_NAME}.in password reset code is: ${otp}\nExpires in 10 minutes.`,
  });
}

export async function sendWelcomeEmail(email: string, name: string) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:700;">
      Welcome to ${BRAND_NAME}.in, ${name}! 🎉
    </h2>
    <p style="margin:0 0 20px;color:#555555;font-size:15px;line-height:1.6;">
      Your email has been verified and your account is all set. Start exploring
      thousands of products at the best prices.
    </p>
  `);

  await sendMail({
    to     : email,
    subject: `Welcome to ${BRAND_NAME}.in — You're all set! 🎉`,
    html,
    text   : `Hi ${name}, welcome to ${BRAND_NAME}.in! Your account is verified. Shop now.`,
  });
}

export async function sendLoginAlertEmail(email: string, name: string) {
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:700;">
      New sign-in to your account 🔔
    </h2>
    <p style="margin:0 0 20px;color:#555555;font-size:15px;line-height:1.6;">
      Hi <strong>${name}</strong>, we detected a new sign-in to your ${BRAND_NAME}.in account at ${now} IST.
    </p>
  `);

  await sendMail({
    to     : email,
    subject: `New sign-in to your ${BRAND_NAME}.in account`,
    html,
    text   : `Hi ${name}, a new sign-in was detected at ${now} IST.`,
  });
}

// --- New Order Emails ---

type PopulatedOrderItem = OrderItem & { product: Product };

export async function sendOrderReceiptEmail(email: string, name: string, order: Order, items: PopulatedOrderItem[]) {
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eeeeee;">${item.product.title} x ${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eeeeee; text-align: right;">₹${item.price.toString()}</td>
    </tr>
  `).join('');

  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:700;">
      Order Confirmed! 📦
    </h2>
    <p style="margin:0 0 20px;color:#555555;font-size:15px;line-height:1.6;">
      Hi <strong>${name}</strong>, thank you for your order. We've received it and are getting it ready for shipment!
    </p>
    <div style="background:#f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="margin:0 0 12px; font-size: 16px;">Order #${order.id} Summary</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; text-align: left;">
        ${itemsHtml}
        <tr>
          <td style="padding: 12px; font-weight: 700;">Total Paid</td>
          <td style="padding: 12px; font-weight: 700; text-align: right; color: ${BRAND_COLOR};">₹${order.totalAmount.toString()}</td>
        </tr>
      </table>
    </div>
    <div style="text-align:center;margin:28px 0;">
      <a href="https://${BRAND_DOMAIN}/account/orders/${order.id}"
         style="background:${BRAND_COLOR};color:#ffffff;text-decoration:none;
                padding:14px 36px;border-radius:8px;font-size:15px;font-weight:700;
                display:inline-block;">
        View Order Status →
      </a>
    </div>
  `);

  await sendMail({
    to     : email,
    subject: `Order Confirmation #${order.id} — ${BRAND_NAME}.in`,
    html,
    text   : `Hi ${name}, your order #${order.id} for ₹${order.totalAmount.toString()} is confirmed.`,
  });
}
