import { Module } from '@nestjs/common';
import { RecaptchaService } from './recaptcha.service';
import { RecaptchaController } from './recaptcha.controller';

@Module({
  controllers: [RecaptchaController],
  providers: [RecaptchaService],
  exports: [RecaptchaService],
})
export class RecaptchaModule {}
