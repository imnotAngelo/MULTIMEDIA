const brevoApiKey = process.env.BREVO_API_KEY;
const fromEmail = process.env.BREVO_FROM_EMAIL || '';
const fromName = process.env.BREVO_FROM_NAME || 'Multimedia Learning';
const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();

export class EmailServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailServiceError';
  }
}

export function isEmailServiceConfigured(): boolean {
  return Boolean(brevoApiKey && fromEmail);
}

export async function sendVerificationEmail(to: string, fullName: string, token: string, code: string): Promise<void> {
  const verifyUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

  if (!isEmailServiceConfigured()) {
    // No provider configured (e.g. local dev) - log the link/code so it can still be tested manually.
    console.warn(`⚠️ BREVO_API_KEY/BREVO_FROM_EMAIL not set. Verification code for ${to}: ${code} (link: ${verifyUrl})`);
    return;
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': brevoApiKey as string,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: fromEmail, name: fromName },
      to: [{ email: to, name: fullName || undefined }],
      subject: 'Verify your email address',
      htmlContent: `
        <p>Hi ${fullName || 'there'},</p>
        <p>Thanks for signing up. Enter this code in the app to confirm it's you:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">${code}</p>
        <p>Or click this link instead:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>This code and link expire in 24 hours.</p>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('❌ Failed to send verification email:', response.status, body);
    throw new EmailServiceError(`Verification email provider rejected the request (${response.status})`);
  }
}

export async function sendPasswordResetEmail(to: string, fullName: string, token: string, code: string): Promise<void> {
  const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

  if (!isEmailServiceConfigured()) {
    console.warn(`BREVO_API_KEY/BREVO_FROM_EMAIL not set. Password reset link for ${to}: ${resetUrl}`);
    return;
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': brevoApiKey as string,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: fromEmail, name: fromName },
      to: [{ email: to, name: fullName || undefined }],
      subject: 'Reset your Multimedia Learning password',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
          <h2 style="color: #6d28d9;">Multimedia Learning</h2>
          <p>Hi ${fullName || 'there'},</p>
          <p>We received a request to reset your password. Confirm this request using the button below:</p>
          <p style="margin: 28px 0;"><a href="${resetUrl}" style="background: #7c3aed; color: #ffffff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Reset your password</a></p>
          <p>Or enter this confirmation code in the reset screen:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #6d28d9;">${code}</p>
          <p>This link and code expire in 30 minutes. If you did not request this, you can ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('Failed to send password reset email:', response.status, body);
    throw new EmailServiceError(`Password reset email provider rejected the request (${response.status})`);
  }
}

