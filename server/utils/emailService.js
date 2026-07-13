const nodemailer = require('nodemailer');
const { generateInvoicePdf } = require('./invoiceService');

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const rawPort = Number(process.env.SMTP_PORT || 587);
  const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    from
  };
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
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth
  });

  await transporter.sendMail({
    from: smtp.from,
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
  sendOrderConfirmationSafe
};
