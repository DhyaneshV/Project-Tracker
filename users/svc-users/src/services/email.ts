import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { FunctionalRole } from '@project-tracker/shared-types';

// ─── CONFIG ─────────────────────────────────────────────────────

const SES_REGION = process.env.SES_REGION || process.env.AWS_REGION || 'ap-south-1';
const FROM_EMAIL = process.env.SES_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@projecttracker.com';
const FROM_NAME = 'Project Tracker';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ─── SES CLIENT ─────────────────────────────────────────────────

const sesClient = new SESClient({ region: SES_REGION });

// ─── TYPES ──────────────────────────────────────────────────────

export interface EmailPayload {
  to: string;
  template: 'invitation' | '2fa_otp' | 'security_otp' | 'password_reset';
  data: {
    email?: string;
    fullName?: string;
    password?: string;
    inviteLink?: string;
    expiresAt?: string;
    otp?: string;
    role?: FunctionalRole;
    organizationName?: string;
    resetLink?: string;
  };
}

// ─── EMAIL SERVICE ──────────────────────────────────────────────

export class EmailService {
  /**
   * Send an email. Uses SMTP (nodemailer) if SMTP_HOST is set, otherwise AWS SES.
   * Falls back to console logging if neither is configured.
   */
  private static async sendViaSES(to: string, subject: string, htmlBody: string, textBody: string): Promise<boolean> {
    // Priority 1: Use SMTP if configured (local dev with Gmail)
    if (process.env.SMTP_HOST) {
      return this.sendViaSMTP(to, subject, htmlBody, textBody);
    }

    // Priority 2: Use SES if AWS credentials exist
    if (process.env.AWS_ACCESS_KEY_ID && process.env.NODE_ENV !== 'test') {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await sesClient.send(new SendEmailCommand({
            Source: `"${FROM_NAME}" <${FROM_EMAIL}>`,
            Destination: { ToAddresses: [to] },
            Message: {
              Subject: { Data: subject, Charset: 'UTF-8' },
              Body: {
                Html: { Data: htmlBody, Charset: 'UTF-8' },
                Text: { Data: textBody, Charset: 'UTF-8' },
              },
            },
          }));
          console.log(`[EMAIL] Sent "${subject}" to ${to} (attempt ${attempt})`);
          return true;
        } catch (error: any) {
          console.error(`[EMAIL] Attempt ${attempt}/${MAX_RETRIES} failed for ${to}:`, error.message);
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
          }
        }
      }
      console.error(`[EMAIL] All ${MAX_RETRIES} attempts failed for ${to}`);
      return false;
    }

    // Never log email bodies: they can contain passwords, OTPs, or reset links.
    // Console delivery is allowed only for explicit local development use.
    if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_TRANSPORT === 'console') {
      console.info(`[EMAIL] Console delivery requested for ${to}; sensitive message content is redacted.`);
      return true;
    }

    console.error('[EMAIL] Delivery is not configured. Refusing to log sensitive message content.');
    return false;
  }

  /** Send via SMTP (nodemailer) - for local dev with Gmail app password */
  private static async sendViaSMTP(to: string, subject: string, htmlBody: string, textBody: string): Promise<boolean> {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"${FROM_NAME}" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html: htmlBody,
        text: textBody,
      });
      console.log(`[EMAIL-SMTP] Sent "${subject}" to ${to}`);
      return true;
    } catch (error: any) {
      console.error(`[EMAIL-SMTP] Failed to send to ${to}:`, error.message);
      return false;
    }
  }

  // ─── PUBLIC API ─────────────────────────────────────────────────

  static async sendEmail(payload: EmailPayload): Promise<boolean> {
    switch (payload.template) {
      case 'invitation':
        return this.sendInvitationEmail(payload);
      case '2fa_otp':
        return this.sendOTPEmail(payload.to, payload.data.otp || '', 'Login Verification');
      case 'security_otp':
        return this.sendOTPEmail(payload.to, payload.data.otp || '', 'Security Action Verification');
      case 'password_reset':
        return this.sendPasswordResetEmail(payload);
      default:
        console.warn(`[EMAIL] Unknown template: ${payload.template}`);
        return false;
    }
  }

  // ─── INVITATION EMAIL ───────────────────────────────────────────

  static async sendInvitationEmail(payload: EmailPayload): Promise<boolean> {
    const { to, data } = payload;
    const name = data.fullName || 'Team Member';
    const org = data.organizationName || 'Project Tracker';
    const role = (data.role || 'Member').replace(/_/g, ' ');

    const subject = `You've been invited to join ${org}`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <div style="background:#161619;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:40px 32px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:48px;height:48px;background:#5a5af0;border-radius:12px;line-height:48px;text-align:center;color:#fff;font-weight:700;font-size:18px;">P</div>
    </div>
    <h1 style="color:#e8e8eb;font-size:22px;font-weight:700;text-align:center;margin:0 0 8px;">Welcome to ${org}</h1>
    <p style="color:#8b8b96;font-size:14px;text-align:center;margin:0 0 32px;line-height:1.5;">You've been invited as <strong style="color:#e8e8eb;">${role}</strong></p>
    
    <div style="background:#1c1c20;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="color:#8b8b96;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">Your Credentials</p>
      <table style="width:100%;font-size:14px;">
        <tr><td style="color:#8b8b96;padding:4px 0;">Email</td><td style="color:#e8e8eb;font-weight:600;">${data.email || to}</td></tr>
        <tr><td style="color:#8b8b96;padding:4px 0;">Temporary Password</td><td style="color:#5a5af0;font-weight:600;font-family:monospace;">${data.password || '—'}</td></tr>
      </table>
    </div>

    <a href="${FRONTEND_URL}" style="display:block;background:#5a5af0;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;text-align:center;font-weight:600;font-size:14px;margin-bottom:24px;">Sign In to Get Started</a>
    
    <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
      <p style="color:#55555e;font-size:12px;margin:0;line-height:1.5;">
        This invitation expires on ${data.expiresAt || '7 days from now'}. 
        You must change your password on first login.
      </p>
    </div>
  </div>
  <p style="color:#55555e;font-size:11px;text-align:center;margin-top:24px;">
    If you didn't expect this invitation, you can safely ignore this email.
  </p>
</div>
</body>
</html>`;

    const text = `Welcome to ${org}!\n\nYou've been invited as ${role}.\n\nCredentials:\nEmail: ${data.email || to}\nPassword: ${data.password}\n\nLogin: ${FRONTEND_URL}\nExpires: ${data.expiresAt || '7 days'}\n\nPlease change your password on first login.`;

    return this.sendViaSES(to, subject, html, text);
  }

  // ─── OTP EMAIL ──────────────────────────────────────────────────

  static async sendOTPEmail(to: string, otp: string, purpose: string): Promise<boolean> {
    const subject = `${otp} — Your Verification Code`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <div style="background:#161619;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:40px 32px;text-align:center;">
    <div style="margin-bottom:24px;">
      <div style="display:inline-block;width:48px;height:48px;background:#5a5af0;border-radius:12px;line-height:48px;text-align:center;color:#fff;font-weight:700;font-size:18px;">P</div>
    </div>
    <h1 style="color:#e8e8eb;font-size:18px;font-weight:600;margin:0 0 8px;">${purpose}</h1>
    <p style="color:#8b8b96;font-size:14px;margin:0 0 32px;">Use the code below to verify your identity</p>
    
    <div style="background:#1c1c20;border:2px solid #5a5af0;border-radius:12px;padding:24px;margin-bottom:24px;display:inline-block;min-width:200px;">
      <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#e8e8eb;font-family:monospace;">${otp}</span>
    </div>
    
    <p style="color:#55555e;font-size:12px;margin:0;line-height:1.5;">
      This code expires in <strong style="color:#f59e0b;">5 minutes</strong>.<br>
      If you didn't request this, please secure your account immediately.
    </p>
  </div>
</div>
</body>
</html>`;

    const text = `Your verification code: ${otp}\n\nPurpose: ${purpose}\nExpires in 5 minutes.\n\nIf you didn't request this, please secure your account.`;

    return this.sendViaSES(to, subject, html, text);
  }

  // ─── PASSWORD RESET EMAIL ───────────────────────────────────────

  static async sendPasswordResetEmail(payload: EmailPayload): Promise<boolean> {
    const { to, data } = payload;
    const name = data.fullName || 'there';
    const resetLink = data.resetLink || `${FRONTEND_URL}/reset-password`;

    const subject = 'Reset Your Password';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <div style="background:#161619;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:40px 32px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:48px;height:48px;background:#5a5af0;border-radius:12px;line-height:48px;text-align:center;color:#fff;font-weight:700;font-size:18px;">P</div>
    </div>
    <h1 style="color:#e8e8eb;font-size:20px;font-weight:700;text-align:center;margin:0 0 8px;">Password Reset</h1>
    <p style="color:#8b8b96;font-size:14px;text-align:center;margin:0 0 32px;line-height:1.5;">Hi ${name}, we received a request to reset your password.</p>
    
    <a href="${resetLink}" style="display:block;background:#5a5af0;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;text-align:center;font-weight:600;font-size:14px;margin-bottom:24px;">Reset Password</a>
    
    <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
      <p style="color:#55555e;font-size:12px;margin:0;line-height:1.5;">
        This link expires in ${data.expiresAt || '1 hour'}.<br>
        If you didn't request this, you can safely ignore this email. Your password will not change.
      </p>
    </div>
  </div>
</div>
</body>
</html>`;

    const text = `Hi ${name},\n\nWe received a request to reset your password.\n\nReset link: ${resetLink}\nExpires: ${data.expiresAt || '1 hour'}\n\nIf you didn't request this, ignore this email.`;

    return this.sendViaSES(to, subject, html, text);
  }

  // ─── LEGACY COMPAT ──────────────────────────────────────────────

  /** @deprecated Use sendOTPEmail directly */
  static async send2FAOTP(email: string, otp: string): Promise<boolean> {
    return this.sendOTPEmail(email, otp, 'Login Verification');
  }
}
