const { sendEmail } = require('./emailService');

async function sendOtpEmail({ toEmail, otp, purpose }) {
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

  await sendEmail({
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

