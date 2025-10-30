import crypto from 'crypto';

export class CryptoUtils {
  /**
   * Generate a secure random token
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a random verification code (numeric)
   */
  static generateVerificationCode(length: number = 6): string {
    const digits = '0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += digits[crypto.randomInt(0, digits.length)];
    }
    
    return result;
  }

  /**
   * Generate a secure password reset token with expiration
   */
  static generatePasswordResetToken(): { token: string; expiresAt: Date } {
    const token = this.generateSecureToken(32);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiration
    
    return { token, expiresAt };
  }

  /**
   * Generate an email verification token with expiration
   */
  static generateEmailVerificationToken(): { token: string; expiresAt: Date } {
    const token = this.generateSecureToken(32);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration
    
    return { token, expiresAt };
  }

  /**
   * Hash a string using SHA-256
   */
  static hashString(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Create HMAC signature
   */
  static createHMAC(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  static verifyHMAC(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.createHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
}