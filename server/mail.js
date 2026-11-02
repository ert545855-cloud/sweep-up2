// E-posta gönderimi (şifre sıfırlama). Gmail için GMAIL_USER + GMAIL_APP_PASSWORD,
// diğer sağlayıcılar için SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM.
const nodemailer = require('nodemailer');

let transport = null;
function get() {
  if (transport) return transport;
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transport = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '') } });
  } else if (process.env.SMTP_HOST) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: +(process.env.SMTP_PORT || 587), secure: +(process.env.SMTP_PORT || 587) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

module.exports = {
  enabled: () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) || !!process.env.SMTP_HOST,
  async send(to, subject, text) {
    const t = get();
    if (!t) throw new Error('E-posta ayarlı değil');
    const from = process.env.MAIL_FROM || `SwipeUp <${process.env.GMAIL_USER || process.env.SMTP_USER}>`;
    await t.sendMail({ from, to, subject, text });
  },
};
