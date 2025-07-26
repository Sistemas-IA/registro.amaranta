import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function sendConfirmation(to, variables) {
  const subject = template(process.env.MAIL_SUBJECT, variables);
  const text    = template(process.env.MAIL_BODY,   variables);
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text
  });
}

function template(str, vars) {
  return str?.replace(/\{\{(\w+)}}/g, (_, k) => vars[k] ?? '');
}
