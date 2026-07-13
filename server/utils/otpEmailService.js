const nodemailer = require('nodemailer');

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

async function sendOtpEmail({ toEmail, otp, purpose }) {
  const smtp = getSmtpConfig();
  if (!smtp) {
    throw new Error('SMTP configuration is incomplete. OTP email cannot be sent.');
  }

  const safePurpose = String(purpose || 'verification').toLowerCase();
  const subject = `Nehal Express OTP - ${safePurpose}`;

  const html = `
    <p>Hello,</p>
    <p>Your OTP for <strong>${safePurpose}</strong> is:</p>
    <h2 style="letter-spacing: 4px;">${otp}</h2>
    <p>This OTP will expire in <strong>10 minutes</strong>.</p>
    <p>If you did not request this, please ignore this email.</p>
    <p>— Nehal Express</p>
  `;

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth
  });

  await transporter.sendMail({
    from: smtp.from,
    to: toEmail,
    subject,
    text: `Your Nehal Express OTP is: ${otp}. It expires in 10 minutes.`,
    html
  });
}

async function sendOtpEmailSafe({ toEmail, otp, purpose }) {
  try {
    await sendOtpEmail({ toEmail, otp, purpose });
    return { sent: true };
  } catch (err) {
    // Do not leak sensitive info to clients; log server-side.
    console.error('OTP email failed:', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = {
  sendOtpEmailSafe
};

