import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyRecaptchaDto {
  @IsNotEmpty()
  @IsString()
  token: string;
}
