const PDFDocument = require('pdfkit');

const INVOICE_PREFIX = 'NEINV';

function getGstRate() {
  const rate = Number(process.env.GST_RATE || 0);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

function currency(value) {
  return 'Rs ' + Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(value) {
  return new Date(value || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function safeText(value, fallback = '') {
  return String(value ?? fallback);
}

function buildInvoiceNumber(order) {
  const date = new Date(order.createdAt || Date.now());
  const year = date.getFullYear();
  const serial = safeText(order.id).replace(/[^a-z0-9]/gi, '') || Date.now();
  return `${INVOICE_PREFIX}-${year}-${serial}`;
}

async function ensureInvoice(order) {
  let changed = false;

  if (!order.invoiceNumber) {
    const now = new Date();
    order.invoiceNumber = buildInvoiceNumber(order);
    order.invoiceGeneratedAt = order.invoiceGeneratedAt || now;
    changed = true;
  } else if (!order.invoiceGeneratedAt) {
    order.invoiceGeneratedAt = new Date();
    changed = true;
  }

  if (changed) {
    await order.save();
  }

  return order;
}

function drawRow(doc, y, columns, options = {}) {
  const { bold = false } = options;
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
  columns.forEach((column) => {
    doc.text(column.text, column.x, y, {
      width: column.width,
      align: column.align || 'left'
    });
  });
}

function fitPage(doc, y, neededHeight = 80) {
  const bottom = doc.page.height - doc.page.margins.bottom - 32;
  if (y + neededHeight <= bottom) return y;
  doc.addPage();
  return doc.page.margins.top;
}

async function generateInvoicePdf(order) {
  await ensureInvoice(order);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 44 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;
    const right = left + pageWidth;

    doc
      .font('Helvetica-Bold')
      .fontSize(24)
      .fillColor('#2b231f')
      .text('Nehal Express', left, 42);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#6d625d')
      .text('Clothing & Accessories', left, 70)
      .text('India', left, 84);

    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#7b1d2a')
      .text('TAX INVOICE', right - 180, 44, { width: 180, align: 'right' });

    doc.moveTo(left, 104).lineTo(right, 104).strokeColor('#ded5cd').stroke();

    doc.fillColor('#2b231f').fontSize(10).font('Helvetica-Bold').text('Company', left, 118);
    doc.font('Helvetica').fontSize(9).fillColor('#2b231f');
    doc.text('Nehal Express', left, 138);
    doc.text('Clothing & Accessories', left, 153);
    doc.text('India', left, 168);

    doc.fillColor('#2b231f').fontSize(10).font('Helvetica-Bold').text('Bill To', left + 235, 118);
    doc.font('Helvetica').fontSize(9).fillColor('#2b231f');
    doc.text(safeText(order.customer?.name), left + 235, 138);
    doc.text(safeText(order.customer?.phone), left + 235, 153);
    doc.text(safeText(order.customer?.address), left + 235, 168, { width: 180 });
    doc.text(
      [order.customer?.city, order.customer?.state, order.customer?.pincode].filter(Boolean).join(', '),
      left + 235,
      206,
      { width: 180 }
    );

    const metaX = right - 220;
    const meta = [
      ['Invoice No.', order.invoiceNumber],
      ['Order ID', order.id],
      ['Invoice Date', formatDate(order.invoiceGeneratedAt || order.createdAt)],
      ['Order Date', formatDate(order.createdAt)],
      ['Payment Method', order.paymentMethod],
      ['Payment Status', order.paymentStatus]
    ];
    meta.forEach(([label, value], index) => {
      const y = 118 + index * 18;
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#6d625d').text(label, metaX, y, { width: 95 });
      doc.font('Helvetica').fontSize(9).fillColor('#2b231f').text(safeText(value), metaX + 100, y, {
        width: 120,
        align: 'right'
      });
    });

    let y = 260;
    doc.rect(left, y - 9, pageWidth, 24).fill('#f4eee7');
    drawRow(
      doc.fillColor('#2b231f'),
      y,
      [
        { text: 'Product', x: left + 10, width: 230 },
        { text: 'Qty', x: left + 250, width: 45, align: 'right' },
        { text: 'Price', x: left + 310, width: 80, align: 'right' },
        { text: 'Amount', x: left + 410, width: 95, align: 'right' }
      ],
      { bold: true }
    );

    y += 28;
    (order.items || []).forEach((item) => {
      const metaText = [item.size, item.color].filter(Boolean).join(' / ');
      const itemName = safeText(item.name);
      const nameHeight = doc.heightOfString(itemName, {
        width: 230
      });
      const rowHeight = Math.max(26, nameHeight + (metaText ? 14 : 0) + 8);
      y = fitPage(doc, y, rowHeight + 16);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#2b231f').text(safeText(item.name), left + 10, y, {
        width: 230
      });
      if (metaText) {
        doc.font('Helvetica').fontSize(8).fillColor('#6d625d').text(metaText, left + 10, y + nameHeight + 2, {
          width: 230
        });
      }
      drawRow(doc.fillColor('#2b231f'), y, [
        { text: safeText(item.qty), x: left + 250, width: 45, align: 'right' },
        { text: currency(item.price), x: left + 310, width: 80, align: 'right' },
        { text: currency(item.lineTotal), x: left + 410, width: 95, align: 'right' }
      ]);
      y += rowHeight;
      doc.moveTo(left, y - 8).lineTo(right, y - 8).strokeColor('#eee6df').stroke();
    });

    const gstRate = getGstRate();
    const gstAmount = gstRate > 0 ? Number(((order.subtotal || 0) * gstRate) / (100 + gstRate)) : 0;
    const totalsX = right - 220;
    y = fitPage(doc, Math.max(y + 16, 430), 150);
    const totals = [
      ['Subtotal', currency(order.subtotal)],
      ['Shipping', order.shipping ? currency(order.shipping) : 'Free'],
      ...(order.discountAmount ? [[`Coupon ${order.couponCode || ''}`, `- ${currency(order.discountAmount)}`]] : []),
      [
        `GST${gstRate > 0 ? ` (${gstRate}% included)` : ' (not applicable)'}`,
        gstRate > 0 ? currency(gstAmount) : 'Rs 0.00'
      ],
      ['Total', currency(order.total)]
    ];

    totals.forEach(([label, value], index) => {
      const isTotal = index === totals.length - 1;
      if (isTotal) {
        doc.rect(totalsX - 10, y - 7, 230, 26).fill('#2b231f');
        doc.fillColor('#fffaf3');
      } else {
        doc.fillColor('#2b231f');
      }
      doc.font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(isTotal ? 11 : 9);
      doc.text(label, totalsX, y, { width: 100 });
      doc.text(value, totalsX + 115, y, { width: 95, align: 'right' });
      y += isTotal ? 34 : 22;
    });

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#6d625d')
      .text('This is a computer-generated invoice.', left, doc.page.height - 70, {
        width: pageWidth,
        align: 'center'
      });

    doc.end();
  });
}

module.exports = {
  ensureInvoice,
  generateInvoicePdf
};
