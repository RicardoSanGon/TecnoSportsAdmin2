import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
  Inject,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { SupabaseAuthGuard } from 'src/supabase-auth/supabase-auth.guard';
import { env } from 'env';
import { UsersService } from '../users/users.service';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Controller(`${env.api_prefix}favorites`)
@UseGuards(SupabaseAuthGuard)
export class FavoritesController {
  constructor(
    private readonly favoritesService: FavoritesService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Post()
  async create(@Body() createFavoriteDto: CreateFavoriteDto, @Req() req) {
    // Retrieve the authenticated Supabase User ID
    const supabaseUserId = req.user.id;

    if (!supabaseUserId) {
        throw new InternalServerErrorException('User ID not found in request context');
    }

    // Find the internal User entity by authUserId
    const user = await this.userRepository.findOne({ where: { authUserId: supabaseUserId } });

    if (!user) {
      throw new NotFoundException(`Internal user not found for Supabase ID: ${supabaseUserId}`);
    }

    // Override the userId in the DTO with the secure, internal ID
    const secureDto = {
        ...createFavoriteDto,
        userId: user.id
    };

    return this.favoritesService.create(secureDto);
  }

  @Get('user/:userId')
  findAll(@Param('userId') userId: string) {
    return this.favoritesService.findAllByUser(+userId);
  }

  @Delete('user/:userId/match/:matchId')
  remove(@Param('userId') userId: string, @Param('matchId') matchId: string) {
    return this.favoritesService.remove(+userId, +matchId);
  }
}
