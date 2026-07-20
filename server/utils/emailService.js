const nodemailer = require('nodemailer');
const { generateInvoicePdf } = require('./invoiceService');

let transporter;
let verificationStarted = false;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const rawPort = Number(process.env.SMTP_PORT || 587);
  const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port,
    secure: process.env.SMTP_SECURE
      ? String(process.env.SMTP_SECURE).toLowerCase() === 'true'
      : port === 465,
    auth: { user, pass },
    from
  };
}

function getTransporter() {
  const smtp = getSmtpConfig();
  if (!smtp) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.auth,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000
    });
  }
  return transporter;
}

async function verifyEmailTransporter() {
  const mailer = getTransporter();
  if (!mailer || verificationStarted) return;
  verificationStarted = true;
  try {
    await mailer.verify();
    console.log('Email transporter ready');
  } catch (err) {
    console.error('Email transporter verification failed:', err.code || err.message);
  }
}

async function sendEmail({ to, subject, html, text, attachments }) {
  if (!to) throw new Error('Email recipient is required');
  const smtp = getSmtpConfig();
  const mailer = getTransporter();
  if (!smtp || !mailer) throw new Error('SMTP configuration is incomplete');
  return mailer.sendMail({ from: smtp.from, to, subject, text, html, attachments });
}

function resolveRecipient(order, fallbackEmail) {
  return fallbackEmail || order.customer?.email || process.env.ORDER_EMAIL_FALLBACK || null;
}

async function sendOrderConfirmation(order, { customerEmail } = {}) {
  const smtp = getSmtpConfig();
  const to = resolveRecipient(order, customerEmail);

  if (!smtp) {
    console.warn(`Order email skipped for ${order.id}: SMTP configuration is incomplete`);
    return { skipped: true, reason: 'missing_smtp_config' };
  }

  if (!to) {
    console.warn(`Order email skipped for ${order.id}: recipient email is missing`);
    return { skipped: true };
  }

  const invoicePdf = await generateInvoicePdf(order);
  await sendEmail({
    to,
    subject: `Nehal Express order confirmation - ${order.id}`,
    text: [
      `Thank you for shopping with Nehal Express.`,
      `Order ID: ${order.id}`,
      `Invoice Number: ${order.invoiceNumber}`,
      `Payment Method: ${order.paymentMethod}`,
      `Payment Status: ${order.paymentStatus}`,
      `Total: Rs ${Number(order.total || 0).toLocaleString('en-IN')}`
    ].join('\n'),
    html: `
      <p>Thank you for shopping with <strong>Nehal Express</strong>.</p>
      <p>Your order <strong>${order.id}</strong> has been placed successfully.</p>
      <p>
        <strong>Invoice:</strong> ${order.invoiceNumber}<br>
        <strong>Payment:</strong> ${order.paymentMethod} - ${order.paymentStatus}<br>
        <strong>Total:</strong> Rs ${Number(order.total || 0).toLocaleString('en-IN')}
      </p>
      <p>Your invoice is attached as a PDF.</p>
    `,
    attachments: [
      {
        filename: `${order.invoiceNumber}.pdf`,
        content: invoicePdf,
        contentType: 'application/pdf'
      }
    ]
  });

  order.emailSentAt = new Date();
  await order.save();

  return { sent: true };
}

async function sendOrderConfirmationSafe(order, options) {
  try {
    return await sendOrderConfirmation(order, options);
  } catch (err) {
    console.error(`Order email failed for ${order.id}:`, err.message);
    return { failed: true, error: err.message };
  }
}

module.exports = {
  sendEmail,
  verifyEmailTransporter,
  sendOrderConfirmationSafe
};
