import { createHash, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import { z } from 'zod';

type EmailSettingsBase = {
  from: string;
  apiUrl: string;
};

type EmailSettings = EmailSettingsBase & ({
  provider: 'smtp';
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
} | {
  provider: 'resend';
  apiKey: string;
});

export class EmailConfigurationError extends Error {}
export class EmailDeliveryError extends Error {}

const htmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function getEmailSettings(): EmailSettings {
  const provider = (process.env.EMAIL_PROVIDER?.trim().toLowerCase() || 'smtp');
  if (provider !== 'smtp' && provider !== 'resend') {
    throw new EmailConfigurationError('EMAIL_PROVIDER must be smtp or resend.');
  }

  const from = (process.env.EMAIL_FROM ?? process.env.SMTP_FROM)?.trim();
  if (!from) {
    throw new EmailConfigurationError('EMAIL_FROM must be configured as an authorized sender address.');
  }
  if (!z.string().email().safeParse(from).success) {
    throw new EmailConfigurationError('EMAIL_FROM must be a valid email address verified with your email provider.');
  }

  const configuredApiUrl = process.env.API_PUBLIC_URL?.trim();
  if (!configuredApiUrl) {
    throw new EmailConfigurationError('API_PUBLIC_URL must be configured as the public base URL of this API.');
  }
  let apiUrl: URL;
  try {
    apiUrl = new URL(configuredApiUrl);
  } catch {
    throw new EmailConfigurationError('API_PUBLIC_URL must be an absolute HTTP or HTTPS URL.');
  }
  if (apiUrl.protocol !== 'https:' && apiUrl.protocol !== 'http:') {
    throw new EmailConfigurationError('API_PUBLIC_URL must use HTTP or HTTPS.');
  }
  if (process.env.NODE_ENV === 'production' && apiUrl.protocol !== 'https:') {
    throw new EmailConfigurationError('API_PUBLIC_URL must use HTTPS in production.');
  }

  const shared = { from, apiUrl: apiUrl.toString().replace(/\/$/, '') };
  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) throw new EmailConfigurationError('RESEND_API_KEY must be configured when EMAIL_PROVIDER is resend.');
    return { ...shared, provider, apiKey };
  }

  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST?.trim() || !SMTP_USER?.trim() || !SMTP_PASSWORD) {
    throw new EmailConfigurationError('SMTP_HOST, SMTP_USER, and SMTP_PASSWORD must be configured when EMAIL_PROVIDER is smtp.');
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EmailConfigurationError('SMTP_PORT must be a valid port number.');
  }
  const secureSetting = process.env.SMTP_SECURE?.toLowerCase();
  if (secureSetting && secureSetting !== 'true' && secureSetting !== 'false') {
    throw new EmailConfigurationError('SMTP_SECURE must be true or false.');
  }

  return {
    ...shared,
    provider,
    host: SMTP_HOST.trim(),
    port,
    secure: secureSetting ? secureSetting === 'true' : port === 465,
    user: SMTP_USER.trim(),
    password: SMTP_PASSWORD,
  };
}

function createTransport(settings: Extract<EmailSettings, { provider: 'smtp' }>) {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: { user: settings.user, pass: settings.password },
  });
}

export async function verifyEmailDelivery(): Promise<void> {
  const settings = getEmailSettings();
  if (settings.provider === 'resend') {
    let response: Response;
    try {
      response = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${settings.apiKey}` },
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      throw new EmailDeliveryError('Could not connect to the Resend email API.', { cause: error });
    }
    if (!response.ok) {
      throw new EmailDeliveryError(`Resend rejected the API credentials or domain check (HTTP ${response.status}).`);
    }
    const responseBody: unknown = await response.json();
    const parsed = z.object({
      data: z.array(z.object({ name: z.string(), status: z.string() })),
    }).safeParse(responseBody);
    if (!parsed.success) {
      throw new EmailDeliveryError('Resend returned an invalid domain verification response.');
    }
    const fromDomain = settings.from.slice(settings.from.lastIndexOf('@') + 1).toLowerCase();
    const senderDomainVerified = parsed.data.data.some((domain) =>
      domain.name.toLowerCase() === fromDomain && domain.status.toLowerCase() === 'verified');
    if (!senderDomainVerified) {
      throw new EmailConfigurationError('Verify the sender domain for EMAIL_FROM in Resend before creating accounts.');
    }
    return;
  }

  const transport = createTransport(settings);
  try {
    await transport.verify();
  } catch (error) {
    throw new EmailDeliveryError('Could not connect to the configured SMTP server or authenticate.', { cause: error });
  } finally {
    transport.close();
  }
}

export function createEmailVerificationToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => htmlEntities[character] ?? character);
}

async function sendEmail(settings: EmailSettings, to: string, subject: string, text: string, html: string): Promise<void> {
  if (settings.provider === 'resend') {
    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: settings.from, to: [to], subject, text, html }),
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      throw new EmailDeliveryError('Could not connect to the Resend email API to send the message.', { cause: error });
    }
    if (!response.ok) {
      throw new EmailDeliveryError(`Resend rejected the email message (HTTP ${response.status}).`);
    }
    return;
  }

  const transporter = createTransport(settings);
  try {
    await transporter.sendMail({ from: settings.from, to, subject, text, html });
  } finally {
    transporter.close();
  }
}

function getVerificationUrl(settings: EmailSettingsBase, token: string): string {
  const verificationUrl = new URL('/api/auth/verify-email', settings.apiUrl);
  verificationUrl.searchParams.set('token', token);
  return verificationUrl.toString();
}

export async function sendAccountCredentials({
  name,
  email,
  password,
  ministryTeam,
  verificationToken,
}: {
  name: string;
  email: string;
  password: string;
  ministryTeam: 'SINGERS' | 'BAND';
  verificationToken: string;
}): Promise<void> {
  const settings = getEmailSettings();
  const teamLabel = ministryTeam === 'BAND' ? 'Band' : 'Singers';
  const verificationLink = getVerificationUrl(settings, verificationToken);
  const safeName = escapeHtml(name);
  const safeTeamLabel = escapeHtml(teamLabel);

  await sendEmail(
    settings,
    email,
    'Confirm your Elayone email address',
    `Hello ${name},\n\nAn administrator created your Elayone account for the ${teamLabel} team.\n\nEmail: ${email}\nTemporary password: ${password}\n\nConfirm that you own this email address before signing in. The confirmation link expires in 24 hours:\n${verificationLink}\n\nIf you did not expect this account, you can ignore this message.`,
    `<p>Hello ${safeName},</p><p>An administrator created your Elayone account for the ${safeTeamLabel} team.</p><p><strong>Email:</strong> ${escapeHtml(email)}<br><strong>Temporary password:</strong> ${escapeHtml(password)}</p><p>Confirm that you own this email address before signing in. This link expires in 24 hours:</p><p><a href="${escapeHtml(verificationLink)}">Confirm my email address</a></p><p>If you did not expect this account, you can ignore this message.</p>`,
  );
}

export async function sendEmailVerification({
  name,
  email,
  ministryTeam,
  verificationToken,
}: {
  name: string;
  email: string;
  ministryTeam: 'SINGERS' | 'BAND';
  verificationToken: string;
}): Promise<void> {
  const settings = getEmailSettings();
  const teamLabel = ministryTeam === 'BAND' ? 'Band' : 'Singers';
  const verificationLink = getVerificationUrl(settings, verificationToken);

  await sendEmail(
    settings,
    email,
    'Confirm your Elayone email address',
    `Hello ${name},\n\nPlease confirm that you own this email address for your Elayone ${teamLabel} account. This link expires in 24 hours:\n${verificationLink}\n\nIf you did not expect this message, you can ignore it.`,
    `<p>Hello ${escapeHtml(name)},</p><p>Please confirm that you own this email address for your Elayone ${escapeHtml(teamLabel)} account. This link expires in 24 hours:</p><p><a href="${escapeHtml(verificationLink)}">Confirm my email address</a></p><p>If you did not expect this message, you can ignore it.</p>`,
  );
}
