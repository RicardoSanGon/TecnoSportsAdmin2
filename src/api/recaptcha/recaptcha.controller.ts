import { Controller, Post, Body } from '@nestjs/common';
import { RecaptchaService } from './recaptcha.service';
import { VerifyRecaptchaDto } from './dto/verify-recaptcha.dto';
import { env } from 'env';

@Controller(`${env.api_prefix}recaptcha`)
export class RecaptchaController {
  constructor(private readonly recaptchaService: RecaptchaService) {}

  @Post('verify')
  async verify(@Body() verifyRecaptchaDto: VerifyRecaptchaDto) {
    const result = await this.recaptchaService.verifyToken(verifyRecaptchaDto.token);
    return result;
  }
}
