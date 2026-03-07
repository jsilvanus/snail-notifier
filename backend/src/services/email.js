/**
 * Email delivery adapter using nodemailer.
 * Falls back to console logging when SMTP is not configured (useful in dev/test).
 */

import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  } else {
    // No SMTP configured — use a logger stub so the app still runs
    transporter = {
      sendMail(opts) {
        console.log('[email stub] Would send email:', JSON.stringify(opts, null, 2));
        return Promise.resolve({ messageId: 'stub' });
      },
    };
  }

  return transporter;
}

/**
 * Send a plain-text + HTML email.
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.text   Plain-text body
 * @param {string} [opts.html] HTML body (optional)
 */
async function sendEmail({ to, subject, text, html }) {
  const from = process.env.EMAIL_FROM || process.env.VAPID_EMAIL?.replace('mailto:', '') || 'noreply@snail-notifier.local';
  return getTransporter().sendMail({ from, to, subject, text, html });
}

/**
 * Send the GDPR consent invitation email.
 */
async function sendConsentEmail({ toEmail, orgName, tokenName, acceptUrl, declineUrl }) {
  const subject = `[${orgName}] Permission request: mail notification for "${tokenName}"`;
  const text = [
    `Hello,`,
    ``,
    `${orgName} would like to send you mail arrival notifications for the token named "${tokenName}".`,
    ``,
    `What data is stored:`,
    `  • Your email address`,
    `  • A log of when notifications were sent to you`,
    ``,
    `To give your consent and activate notifications, click the link below:`,
    `  ${acceptUrl}`,
    ``,
    `To decline and remove your address from this token:`,
    `  ${declineUrl}`,
    ``,
    `This invitation expires in 7 days.`,
    ``,
    `If you did not expect this email, you can safely ignore it.`,
  ].join('\n');

  const html = `
    <p>Hello,</p>
    <p><strong>${orgName}</strong> would like to send you mail arrival notifications for the token named <strong>"${tokenName}"</strong>.</p>
    <h3>What data is stored</h3>
    <ul>
      <li>Your email address</li>
      <li>A log of when notifications were sent to you</li>
    </ul>
    <p>
      <a href="${acceptUrl}" style="display:inline-block;padding:10px 20px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;margin-right:8px">
        ✅ Accept &amp; activate notifications
      </a>
      <a href="${declineUrl}" style="display:inline-block;padding:10px 20px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px">
        ❌ Decline
      </a>
    </p>
    <p style="color:#6b7280;font-size:.875rem">This invitation expires in 7 days. If you did not expect this email, you can safely ignore it.</p>
  `;

  return sendEmail({ to: toEmail, subject, text, html });
}

/**
 * Send a plain notification email (channel: email).
 */
async function sendNotificationEmail({ toEmail, subject, body }) {
  return sendEmail({ to: toEmail, subject, text: body });
}

export { sendEmail, sendConsentEmail, sendNotificationEmail };
