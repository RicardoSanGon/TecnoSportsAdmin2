import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RecaptchaVerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);
  private readonly secretKey: string;
  private readonly verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('RECAPTCHA_SECRET_KEY') || '6Lf8YCMsAAAAAGtYv9N23nqKrzvb6fYh48YUfGsH';
  }

  async verifyToken(token: string): Promise<{ success: boolean; score: number; action?: string }> {
    try {
      const params = new URLSearchParams();
      params.append('secret', this.secretKey);
      params.append('response', token);

      const response = await fetch(this.verifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data: RecaptchaVerifyResponse = await response.json();

      this.logger.log(`reCAPTCHA verification: success=${data.success}, score=${data.score}`);

      return {
        success: data.success,
        score: data.score || 0,
        action: data.action,
      };
    } catch (error) {
      this.logger.error('reCAPTCHA verification failed', error);
      return {
        success: false,
        score: 0,
      };
    }
  }

  async isHuman(token: string, minScore: number = 0.5): Promise<boolean> {
    const result = await this.verifyToken(token);
    return result.success && result.score >= minScore;
  }
}
