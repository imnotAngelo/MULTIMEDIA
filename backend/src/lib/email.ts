const brevoApiKey = process.env.BREVO_API_KEY;
const fromEmail = process.env.BREVO_FROM_EMAIL || '';
const fromName = process.env.BREVO_FROM_NAME || 'Multimedia Learning';
const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();

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
    throw new Error('Could not send verification email');
  }
}

