import nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text: string;
}

function getSmtpConfig() {
  const user = process.env.SMTP_USER ?? process.env.GMAIL_USER;
  const pass = (process.env.SMTP_PASS ?? process.env.GMAIL_APP_PASSWORD ?? '').replace(/\s/g, '');

  if (!user || !pass) {
    throw new Error(
      'Email is not configured. Set SMTP_USER and SMTP_PASS (Gmail app password) in environment variables.',
    );
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const appName = process.env.APP_NAME ?? 'Nestworth';

  return {
    user,
    pass,
    transport: nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user, pass },
    }),
    from: process.env.FROM_EMAIL ?? `${appName} <${user}>`,
    appName,
  };
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const { transport, from } = getSmtpConfig();
  const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;
  await transport.sendMail({ from, to, subject: options.subject, text: options.text });
}

export async function sendOtpEmail(
  to: string | string[],
  code: string,
  purpose: 'login' | 'password_reset' | 'email_verify',
): Promise<void> {
  const { appName } = getSmtpConfig();

  const actionMap = {
    login: `sign in to ${appName}`,
    password_reset: `reset your ${appName} password`,
    email_verify: `verify your ${appName} email address`,
  };
  const action = actionMap[purpose];

  await sendEmail({
    to,
    subject: `${appName} verification code: ${code}`,
    text: [
      `Your verification code to ${action} is:`,
      '',
      `  ${code}`,
      '',
      'This code expires in 10 minutes.',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
  });
}

export async function sendFamilyInviteEmail(
  to: string,
  inviterName: string,
  familyName: string,
  inviteCode: string,
): Promise<void> {
  const { appName } = getSmtpConfig();
  await sendEmail({
    to,
    subject: `${inviterName} invited you to join ${familyName} on ${appName}`,
    text: [
      `Hi there,`,
      '',
      `${inviterName} has invited you to join their family group "${familyName}" on ${appName}.`,
      '',
      `To join, open ${appName} and use this invite code:`,
      '',
      `  ${inviteCode}`,
      '',
      `Your join request will need to be approved by the family admin.`,
    ].join('\n'),
  });
}
