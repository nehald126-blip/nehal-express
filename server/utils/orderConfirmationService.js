const { ensureInvoice } = require('./invoiceService');
const { sendOrderConfirmationSafe } = require('./emailService');

async function finalizeOrderConfirmation(order, options = {}) {
  try {
    await ensureInvoice(order);
  } catch (err) {
    console.error(`Invoice metadata could not be created for ${order.id}:`, err.message);
  }

  return sendOrderConfirmationSafe(order, options);
}

module.exports = {
  finalizeOrderConfirmation
};
