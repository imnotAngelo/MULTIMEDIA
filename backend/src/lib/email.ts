const brevoApiKey = process.env.BREVO_API_KEY;
const brevoFromEmail = process.env.BREVO_FROM_EMAIL || '';
const brevoFromName = process.env.BREVO_FROM_NAME || 'Multimedia Learning';
const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL || '';
const resendFromName = process.env.RESEND_FROM_NAME || 'Multimedia Learning';
const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();

export class EmailServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailServiceError';
  }
}

function getEmailProvider(): 'resend' | 'brevo' | null {
  if (resendApiKey && resendFromEmail) return 'resend';
  if (brevoApiKey && brevoFromEmail) return 'brevo';
  return null;
}

export function isEmailServiceConfigured(): boolean {
  return getEmailProvider() !== null;
}

async function sendWithResend({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFromName ? `${resendFromName} <${resendFromEmail}>` : resendFromEmail,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('❌ Failed to send email with Resend:', response.status, body);
    throw new EmailServiceError(`Email provider rejected the request (${response.status})`);
  }
}

async function sendWithBrevo({
  to,
  fullName,
  subject,
  html,
}: {
  to: string;
  fullName: string;
  subject: string;
  html: string;
}) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': brevoApiKey as string,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: brevoFromEmail, name: brevoFromName },
      to: [{ email: to, name: fullName || undefined }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('❌ Failed to send email with Brevo:', response.status, body);
    throw new EmailServiceError(`Email provider rejected the request (${response.status})`);
  }
}

export async function sendVerificationEmail(to: string, fullName: string, token: string, code: string): Promise<void> {
  const verifyUrl = `${frontendUrl}/verify-email/${encodeURIComponent(token)}`;
  const html = `
    <p>Hi ${fullName || 'there'},</p>
    <p>Thanks for signing up. Enter this code in the app to confirm it's you:</p>
    <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">${code}</p>
    <p>Or click this link instead:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>This code and link expire in 24 hours.</p>
  `;

  const provider = getEmailProvider();
  if (!provider) {
    throw new EmailServiceError(
      'No email provider is configured. Set RESEND_API_KEY/RESEND_FROM_EMAIL or BREVO_API_KEY/BREVO_FROM_EMAIL in the backend .env file.'
    );
  }

  if (provider === 'resend') {
    await sendWithResend({ to, subject: 'Verify your email address', html });
    return;
  }

  await sendWithBrevo({ to, fullName, subject: 'Verify your email address', html });
}

export async function sendPasswordResetEmail(to: string, fullName: string, token: string, code: string): Promise<void> {
  const resetUrl = `${frontendUrl}/reset-password/${encodeURIComponent(token)}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
      <h2 style="color: #6d28d9;">Multimedia Learning</h2>
      <p>Hi ${fullName || 'there'},</p>
      <p>We received a request to reset your password. Confirm this request using the button below:</p>
      <p style="margin: 28px 0;"><a href="${resetUrl}" style="background: #7c3aed; color: #ffffff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Reset your password</a></p>
      <p>Or enter this confirmation code in the reset screen:</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #6d28d9;">${code}</p>
      <p>This link and code expire in 30 minutes. If you did not request this, you can ignore this email.</p>
    </div>
  `;

  const provider = getEmailProvider();
  if (!provider) {
    throw new EmailServiceError(
      'No email provider is configured. Set RESEND_API_KEY/RESEND_FROM_EMAIL or BREVO_API_KEY/BREVO_FROM_EMAIL in the backend .env file.'
    );
  }

  if (provider === 'resend') {
    await sendWithResend({ to, subject: 'Reset your Multimedia Learning password', html });
    return;
  }

  await sendWithBrevo({ to, fullName, subject: 'Reset your Multimedia Learning password', html });
}

