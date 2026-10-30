import nodemailer from 'nodemailer';

type MemberEmailConfig =
  | { provider: 'resend'; apiKey: string; from: string; loginUrl: string }
  | { provider: 'smtp'; host: string; port: number; secure: boolean; user: string; password: string; from: string; loginUrl: string };

function getMemberEmailConfig(): MemberEmailConfig {
  const frontendUrlValue = process.env.FRONTEND_URL?.trim();
  if (!frontendUrlValue) throw new Error('Member email is not configured. Set FRONTEND_URL in the backend environment.');

  let frontendUrl: URL;
  try {
    frontendUrl = new URL(frontendUrlValue);
  } catch {
    throw new Error('FRONTEND_URL must be an absolute HTTP or HTTPS URL.');
  }
  if (frontendUrl.protocol !== 'https:' && frontendUrl.protocol !== 'http:') {
    throw new Error('FRONTEND_URL must use HTTP or HTTPS.');
  }

  const loginUrl = new URL('/', frontendUrl).toString();
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const from = (process.env.EMAIL_FROM ?? process.env.SMTP_FROM)?.trim();
  if (resendApiKey) {
    if (!from) throw new Error('Member email is not configured. Set EMAIL_FROM for the Resend provider.');
    return { provider: 'resend', apiKey: resendApiKey, from, loginUrl };
  }

  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'FRONTEND_URL'] as const;
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Member email is not configured. Set RESEND_API_KEY and EMAIL_FROM (recommended for Render), or configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, and FRONTEND_URL in the backend environment.`);
  }

  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port number.');
  }

  return {
    provider: 'smtp',
    host: process.env.SMTP_HOST!.trim(),
    port,
    secure: process.env.SMTP_SECURE?.trim().toLowerCase() === 'true' || port === 465,
    user: process.env.SMTP_USER!.trim(),
    password: process.env.SMTP_PASSWORD!,
    from: process.env.SMTP_FROM!.trim(),
    loginUrl,
  };
}

export function validateMemberEmailConfiguration() {
  getMemberEmailConfig();
}

export function getMemberEmailStatus() {
  try {
    const config = getMemberEmailConfig();
    return { configured: true, provider: config.provider };
  } catch (error) {
    return {
      configured: false,
      provider: process.env.RESEND_API_KEY?.trim() ? 'resend' : 'smtp',
      error: error instanceof Error ? error.message : 'Member email is not configured.',
    };
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

export async function sendNewMemberCredentials({ email, name, password }: {
  email: string;
  name: string;
  password: string;
}) {
  const config = getMemberEmailConfig();
  const subject = 'Your Elayone Music account is ready';
  const text = `Hello ${name},\n\nAn administrator created an Elayone Music account for you.\n\nSign in: ${config.loginUrl}\nEmail: ${email}\nTemporary password: ${password}\n\nPlease sign in and change your password after your first login. If you did not expect this account, contact your ministry administrator.`;
  const html = `<div style="margin:0;padding:32px 16px;background:#f1f4ef;font-family:Arial,sans-serif;color:#20362c"><div style="max-width:560px;margin:0 auto;padding:32px;border:1px solid #dbe5dc;border-radius:18px;background:#fff"><p style="margin:0 0 8px;color:#52735d;font-size:12px;font-weight:bold;letter-spacing:2px">ELAYONE MUSIC MINISTRY</p><h1 style="margin:0 0 16px;font-size:26px">Your account is ready</h1><p>Hello ${escapeHtml(name)},</p><p>An administrator created an account for you. Use the details below to sign in.</p><p style="margin:24px 0"><a href="${escapeHtml(config.loginUrl)}" style="display:inline-block;padding:13px 20px;border-radius:10px;background:#3e6c51;color:#fff;text-decoration:none;font-weight:bold">Open Elayone Music</a></p><div style="padding:16px;border-radius:12px;background:#f3f6f1"><p style="margin:0 0 8px"><strong>Sign-in email</strong><br>${escapeHtml(email)}</p><p style="margin:0"><strong>Temporary password</strong><br><code style="font-size:15px">${escapeHtml(password)}</code></p></div><p style="margin:20px 0 0;color:#647268;font-size:13px">Please sign in and change your password after your first login. If you did not expect this account, contact your ministry administrator.</p></div></div>`;

  if (config.provider === 'resend') {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: config.from, to: [email], subject, text, html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const providerMessage = await response.text().catch(() => 'No provider details available.');
      throw new Error(`Resend rejected the email (${response.status}): ${providerMessage.slice(0, 500)}`);
    }
    return;
  }

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  try {
    await transport.sendMail({ from: config.from, to: email, subject, text, html });
  } finally {
    transport.close();
  }
}
