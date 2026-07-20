const { sendEmail } = require('./emailService');

function getFriendlyStatusMessage(newStatus) {
  switch (newStatus) {
    case 'Packed':
      return 'Your order has been packed and is being prepared for dispatch.';
    case 'Shipped':
      return 'Your order has been shipped. We will notify you when it is delivered.';
    case 'Delivered':
      return 'Great news! Your order has been delivered successfully.';
    case 'Cancelled':
      return 'Your order has been cancelled. If you have any questions, please contact us.';
    default:
      return 'Your order status has been updated.';
  }
}

function formatOrderTotals(order) {
  const total = Number(order?.total || 0);
  return `Rs ${total.toLocaleString('en-IN')}`;
}

function resolveRecipient(order) {
  return order?.customer?.email || process.env.ORDER_EMAIL_FALLBACK || null;
}

async function sendOrderStatusEmail(order, { oldStatus, newStatus } = {}) {
  const to = resolveRecipient(order);
  if (!to) {
    console.warn(`Order status email skipped for ${order?.id}: recipient email is missing`);
    return { skipped: true, reason: 'missing_recipient' };
  }

  const customerName = order?.customer?.name || 'Customer';
  const paymentStatus = order?.paymentStatus || 'Pending';
  const statusMessage = getFriendlyStatusMessage(newStatus);

  const subject = `Nehal Express order update - ${order?.id} (${newStatus})`;

  const text = [
    `Hi ${customerName},`,
    '',
    `Your order status has been updated.`,
    `Order ID: ${order?.id}`,
    `New status: ${newStatus}`,
    `Payment status: ${paymentStatus}`,
    `Total: ${formatOrderTotals(order)}`,
    '',
    statusMessage,
    '',
    `Thanks for shopping with Nehal Express.`
  ].join('\n');

  const html = `
    <p>Hi <strong>${customerName}</strong>,</p>
    <p>Your order status has been updated.</p>
    <ul>
      <li><strong>Order ID:</strong> ${order?.id}</li>
      <li><strong>New status:</strong> ${newStatus}</li>
      <li><strong>Payment status:</strong> ${paymentStatus}</li>
      <li><strong>Total:</strong> ${formatOrderTotals(order)}</li>
    </ul>
    <p>${statusMessage}</p>
    <p>Thanks for shopping with <strong>Nehal Express</strong>.</p>
  `;

  await sendEmail({
    to,
    subject,
    text,
    html
  });

  return { sent: true };
}

async function sendOrderStatusEmailSafe(order, oldStatus, newStatus) {
  try {
    return await sendOrderStatusEmail(order, { oldStatus, newStatus });
  } catch (err) {
    console.warn(`Order status email failed for ${order?.id}:`, err.message);
    return { failed: true, error: err.message };
  }
}

module.exports = {
  sendOrderStatusEmailSafe
};

