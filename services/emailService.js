const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/**
 * Sends a password reset email to a user
 * Email contains a time-limited reset link that expires in 1 hour
 * @async
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient's email address
 * @param {string} params.resetUrl - Full password reset URL with token
 * @param {string} params.firstName - User's first name for personalization
 * @returns {Promise<void>}
 * @throws {Error} On email sending failure (network, SMTP, etc.)
 * 
 * @example
 * await sendPasswordResetEmail({
 *   to: 'user@example.com',
 *   resetUrl: 'https://app.com/reset-password?token=abc123',
 *   firstName: 'John'
 * });
 */
exports.sendPasswordResetEmail = async ({ to, resetUrl, firstName }) => {
  await transporter.sendMail({
    from: `"IntelliCRM" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Password Reset Request",
    html: `
      <p>Hi ${firstName},</p>
      <p>We received a request to reset your password. Click the link below — it expires in <strong>1 hour</strong>.</p>
      <p><a href="${resetUrl}" style="color:#B42318">Reset my password</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>— IntelliCRM Team</p>
    `,
  });
};
