import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

interface OTPRecord {
  code: string;
  email: string;
  expiresAt: Date;
  attempts: number;
}

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private otpStore: Map<string, OTPRecord> = new Map();
  private resend: Resend | null = null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend email service configured');
    } else {
      this.logger.warn('RESEND_API_KEY not configured. OTP codes will only be shown in logs.');
    }
  }

  // Generate a 6-digit code
  generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Store OTP for a user
  createOTP(email: string): string {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    this.otpStore.set(email, {
      code,
      email,
      expiresAt,
      attempts: 0,
    });

    this.logger.log(`OTP created for ${email}`);
    return code;
  }

  // Verify OTP
  verifyOTP(email: string, code: string): { valid: boolean; message: string } {
    const record = this.otpStore.get(email);

    if (!record) {
      return { valid: false, message: 'No se encontró código de verificación' };
    }

    // Check if expired
    if (new Date() > record.expiresAt) {
      this.otpStore.delete(email);
      return { valid: false, message: 'El código ha expirado' };
    }

    // Check attempts
    if (record.attempts >= 3) {
      this.otpStore.delete(email);
      return {
        valid: false,
        message: 'Demasiados intentos. Solicita un nuevo código',
      };
    }

    // Verify code
    if (record.code !== code) {
      record.attempts++;
      return {
        valid: false,
        message: `Código incorrecto. Intentos restantes: ${3 - record.attempts}`,
      };
    }

    // Success - remove the OTP
    this.otpStore.delete(email);
    return { valid: true, message: 'Código verificado correctamente' };
  }

  // Send OTP via email
  async sendOTPEmail(email: string, code: string): Promise<boolean> {
    // Always log the code for development/debugging
    this.logger.log(`
========================================
🔐 CÓDIGO DE VERIFICACIÓN 2FA
========================================
Email: ${email}
Código: ${code}
Expira en: 5 minutos
========================================
    `);

    // If Resend is configured, send actual email
    if (this.resend) {
      try {
        const { error } = await this.resend.emails.send({
          from: 'TecnoSports <noreply@tecnoguard.site>', // Cambia esto a tu dominio verificado
          to: email,
          subject: '🔐 Código de Verificación - TecnoSports Admin',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #059669; margin: 0;">TecnoSports</h1>
                <p style="color: #666;">Panel de Administración</p>
              </div>
              
              <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 10px; padding: 30px; text-align: center; margin-bottom: 30px;">
                <p style="color: white; margin: 0 0 15px 0; font-size: 16px;">Tu código de verificación es:</p>
                <div style="background: white; border-radius: 8px; padding: 20px; display: inline-block;">
                  <span style="font-size: 36px; font-weight: bold; color: #059669; letter-spacing: 8px;">${code}</span>
                </div>
              </div>
              
              <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <p style="margin: 0; color: #666;">
                  <strong>⏱️ Este código expira en 5 minutos.</strong><br>
                  Si no solicitaste este código, puedes ignorar este correo.
                </p>
              </div>
              
              <div style="text-align: center; color: #999; font-size: 12px;">
                <p>© 2025 TecnoSports - Todos los derechos reservados</p>
              </div>
            </div>
          `,
        });

        if (error) {
          this.logger.error(`Error sending OTP email: ${error.message}`);
          return false;
        }

        this.logger.log(`OTP email sent successfully to ${email}`);
        return true;
      } catch (error) {
        this.logger.error(`Error sending OTP email: ${error}`);
        return false;
      }
    }

    // No Resend configured, but code is logged
    return true;
  }

  // Clean expired OTPs
  cleanExpiredOTPs() {
    const now = new Date();
    for (const [email, record] of this.otpStore.entries()) {
      if (now > record.expiresAt) {
        this.otpStore.delete(email);
      }
    }
  }
}
