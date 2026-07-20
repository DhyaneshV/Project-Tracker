import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { TwoFactorMethod } from '@project-tracker/shared-types';

export class SecurityService {
  private static readonly PASSWORD_LENGTH = 20;
  private static readonly BCRYPT_ROUNDS = 12;

  /**
   * Generates a cryptographically secure random password.
   * Includes uppercase, lowercase, numbers, and symbols.
   */
  static generateSecurePassword(): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()-_+=[]{}|;:,.<>?';
    const all = uppercase + lowercase + numbers + symbols;

    // Ensure at least one of each character type
    let password = '';
    password += uppercase[crypto.randomInt(uppercase.length)];
    password += lowercase[crypto.randomInt(lowercase.length)];
    password += numbers[crypto.randomInt(numbers.length)];
    password += symbols[crypto.randomInt(symbols.length)];

    // Fill the rest with random characters
    const remainingLength = this.PASSWORD_LENGTH - password.length;
    const randomBytes = crypto.randomBytes(remainingLength);
    for (let i = 0; i < remainingLength; i++) {
      password += all[randomBytes[i] % all.length];
    }

    // Shuffle the password
    return password.split('').sort(() => crypto.randomInt(-1, 2)).join('');
  }

  /**
   * Generates a secure random invitation token.
   */
  static generateInvitationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generates a 6-digit numeric OTP.
   */
  static generateOTP(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Hashes a password using bcryptjs.
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
  }

  /**
   * Compares a password with a hash.
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generates a TOTP secret and QR code.
   */
  static generateTOTPSecret(email: string) {
    const secret = speakeasy.generateSecret({
      name: `Project Tracker (${email})`,
      issuer: 'ProjectTracker'
    });

    return {
      otpauthUrl: secret.otpauth_url,
      base32: secret.base32,
      ascii: secret.ascii,
      hex: secret.hex
    };
  }

  /**
   * Generates a QR code Data URL for a given URL.
   */
  static async generateQRCode(url: string): Promise<string> {
    return QRCode.toDataURL(url);
  }

  /**
   * Verifies a TOTP token against a secret.
   */
  static verifyTOTP(token: string, secret: string): boolean {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 1 // ±30 seconds
    });
  }

  /**
   * Encrypts a string (e.g., TOTP secret).
   * Note: In a real production environment, use a robust KMS or managed secret store.
   */
  static encryptSecret(text: string, encryptionKey: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  /**
   * Decrypts a string.
   */
  static decryptSecret(text: string, encryptionKey: string): string {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }
}
