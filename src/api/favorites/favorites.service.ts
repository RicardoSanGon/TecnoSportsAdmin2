import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { Favorite } from './entities/favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepository: Repository<Favorite>,
  ) {}

  async create(createFavoriteDto: CreateFavoriteDto) {
    const { userId, matchId } = createFavoriteDto;

    const existingFavorite = await this.favoriteRepository.findOne({
      where: { userId, matchId },
    });

    if (existingFavorite) {
      throw new ConflictException('Match is already in favorites');
    }

    const favorite = this.favoriteRepository.create(createFavoriteDto);
    return await this.favoriteRepository.save(favorite);
  }

  async findAllByUser(userId: number) {
    return await this.favoriteRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async remove(userId: number, matchId: number) {
    const favorite = await this.favoriteRepository.findOne({
      where: { userId, matchId },
    });

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    return await this.favoriteRepository.remove(favorite);
  }
}
