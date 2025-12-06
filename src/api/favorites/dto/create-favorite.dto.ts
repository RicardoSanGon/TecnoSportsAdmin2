import { IsInt, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateFavoriteDto {
  @IsInt()
  @IsOptional()
  userId?: number;

  @IsInt()
  @IsNotEmpty()
  matchId: number;
}
