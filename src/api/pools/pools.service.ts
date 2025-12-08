import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreatePoolDto } from './dto/create-pool.dto';
import { UpdatePoolDto } from './dto/update-pool.dto';
import { JoinPoolDto } from './dto/join-pool.dto';
import { Pool } from './entities/pool.entity';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { found, notFound, saved, updated } from 'src/Utils/Responses';

const table = 'Pool';

@Injectable()
export class PoolsService {
  constructor(
    @InjectRepository(Pool) private readonly repo: Repository<Pool>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async create(createPoolDto: CreatePoolDto) {
    // Validar que el creador existe
    const creator = await this.userRepo.findOne({
      where: { id: createPoolDto.creatorId },
    });
    if (!creator) {
      throw new BadRequestException(
        `Creator with id ${createPoolDto.creatorId} does not exist`,
      );
    }

    // Generar código de invitación único
    let invitationCode: number = 0; // Inicializar con valor por defecto
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      invitationCode = Math.floor(100000 + Math.random() * 900000); // Código de 6 dígitos

      const existingPool = await this.repo.findOne({
        where: { invitationCode },
      });

      if (!existingPool) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new BadRequestException(
        'Unable to generate unique invitation code. Please try again.',
      );
    }

    // Asignar valores por defecto si no se proporcionan
    // Si no se proporciona endDate, calcular una fecha por defecto (1 año desde ahora)
    const defaultEndDate = createPoolDto.endDate
      ? new Date(createPoolDto.endDate)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 año en el futuro

    // Crear la pool con el creador como primer participante
    const pool = this.repo.create({
      ...createPoolDto,
      invitationCode,
      endDate: defaultEndDate,
      participants: [creator], // El creador es automáticamente el primer participante
    });

    console.log('🔍 DEBUG: Creating pool with data:', {
      name: pool.name,
      invitationCode: pool.invitationCode,
      creatorId: createPoolDto.creatorId,
      participants: [creator.id],
    });

    const savedPool = await this.repo.save(pool);
    
    return saved(table, savedPool);
  }

  async findAll() {
    return found(`${table}s`, await this.repo.find());
  }

  async findOne(id: number) {
    const pool = await this.repo.findOne({ where: { id } });
    if (!pool) {
      throw new NotFoundException(notFound(table, id));
    }
    return found(table, pool);
  }

  async update(id: number, updatePoolDto: UpdatePoolDto) {
    const pool = await this.repo.findOne({ where: { id } });

    if (!pool) {
      throw new NotFoundException(notFound(table, id));
    }

    Object.assign(pool, updatePoolDto);

    return updated(table, await this.repo.save(pool));
  }

  async remove(id: number) {
    const pool = await this.repo.findOne({ where: { id } });

    if (!pool) {
      throw new NotFoundException(notFound(table, id));
    }

    await this.repo.remove(pool);
    return { message: `${table} with id ${id} has been removed` };
  }

  async getUserPools(userId: number) {
    // Verificar que el usuario existe
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    // Obtener las pools donde el usuario es participante
    const pools = await this.repo.find({
      where: {
        participants: { id: userId },
      },
      relations: ['participants', 'creator'],
    });

    return found(`Pools for user ${user.name}`, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      pools: pools.map((pool) => ({
        id: pool.id,
        name: pool.name,
        description: pool.description,
        invitationCode: pool.invitationCode,
        maxParticipants: pool.maxParticipants,
        isActive: pool.isActive,
        isClose: pool.isClose,
        startDate: pool.startDate,
        endDate: pool.endDate,
        creator: {
          id: pool.creator.id,
          name: pool.creator.name,
        },
        participantCount: pool.participants.length,
      })),
    });
  }

  async getUserJoinedPools(userId: number) {
    // Verificar que el usuario existe
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    // Obtener las pools donde el usuario es participante (no creador)
    const pools = await this.repo.find({
      where: {
        participants: { id: userId },
      },
      relations: ['participants', 'creator'],
    });

    // Filtrar para excluir las pools donde el usuario es el creador
    const joinedPools = pools.filter((pool) => pool.creatorId !== userId);

    return found(`Pools joined by user ${user.name}`, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      totalJoined: joinedPools.length,
      pools: joinedPools.map((pool) => ({
        id: pool.id,
        name: pool.name,
        description: pool.description,
        invitationCode: pool.invitationCode,
        maxParticipants: pool.maxParticipants,
        currentParticipants: pool.participants.length,
        isActive: pool.isActive,
        isClose: pool.isClose,
        startDate: pool.startDate,
        endDate: pool.endDate,
        creator: {
          id: pool.creator.id,
          name: pool.creator.name,
          email: pool.creator.email,
        },
        participants: pool.participants.map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
        })),
        joinedAt: pool.created_at, // Fecha aproximada de unión
      })),
    });
  }

  async getUserOwnedPools(userId: number) {
    // Verificar que el usuario existe
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    // Obtener las pools donde el usuario es el creador
    const pools = await this.repo.find({
      where: {
        creatorId: userId,
      },
      relations: ['participants', 'creator'],
    });

    return found(`Pools owned by user ${user.name}`, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      totalOwned: pools.length,
      pools: pools.map((pool) => ({
        id: pool.id,
        name: pool.name,
        description: pool.description,
        invitationCode: pool.invitationCode,
        maxParticipants: pool.maxParticipants,
        currentParticipants: pool.participants.length,
        isActive: pool.isActive,
        isClose: pool.isClose,
        startDate: pool.startDate,
        endDate: pool.endDate,
        participants: pool.participants.map((participant) => ({
          id: participant.id,
          name: participant.name,
          email: participant.email,
        })),
      })),
    });
  }

  async getPoolParticipants(poolId: number, userId: number) {
    // Verificar que la pool existe
    const pool = await this.repo.findOne({
      where: { id: poolId },
      relations: ['participants', 'creator'],
    });

    if (!pool) {
      throw new NotFoundException(`Pool with id ${poolId} not found`);
    }

    // Verificar que el usuario sea el creador de la pool
    if (pool.creator.id !== userId) {
      throw new BadRequestException(
        `User with id ${userId} is not the creator of this pool`,
      );
    }

    return found(`Participants of pool "${pool.name}"`, {
      pool: {
        id: pool.id,
        name: pool.name,
        description: pool.description,
        invitationCode: pool.invitationCode,
        maxParticipants: pool.maxParticipants,
        currentParticipants: pool.participants.length,
        creator: {
          id: pool.creator.id,
          name: pool.creator.name,
          email: pool.creator.email,
        },
      },
      participants: pool.participants.map((participant) => ({
        id: participant.id,
        name: participant.name,
        email: participant.email,
        registeredAt: participant.created_at,
      })),
    });
  }

  async joinPool(joinPoolDto: JoinPoolDto) {
    // Buscar la pool por invitationCode
    const pool = await this.repo.findOne({
      where: { invitationCode: joinPoolDto.invitationCode },
      relations: ['participants'],
    });

    if (!pool) {
      throw new NotFoundException(
        `Pool with invitation code ${joinPoolDto.invitationCode} not found`,
      );
    }

    // Verificar que el usuario existe
    const user = await this.userRepo.findOne({
      where: { id: joinPoolDto.userId },
    });
    if (!user) {
      throw new BadRequestException(
        `User with id ${joinPoolDto.userId} does not exist`,
      );
    }

    // Verificar que el usuario no esté ya en la pool
    const isAlreadyParticipant = pool.participants.some(
      (participant) => participant.id === joinPoolDto.userId,
    );
    if (isAlreadyParticipant) {
      throw new BadRequestException(
        `User with id ${joinPoolDto.userId} is already a participant in this pool`,
      );
    }

    // Verificar límite de participantes
    if (pool.participants.length >= pool.maxParticipants) {
      throw new BadRequestException(
        `Pool has reached maximum participants limit (${pool.maxParticipants})`,
      );
    }

    // Verificar nuevamente que el usuario existe justo antes del save
    const userExists = await this.userRepo.findOne({
      where: { id: joinPoolDto.userId },
    });
    if (!userExists) {
      throw new BadRequestException(
        `User with id ${joinPoolDto.userId} does not exist (double-checked)`,
      );
    }

    // Agregar el usuario a la pool
    console.log('🔍 DEBUG: Pool object before push:', {
      poolId: pool.id,
      poolName: pool.name,
      participantsCount: pool.participants.length,
      poolObject: pool,
    });

    try {
      // Crear una copia del pool con el usuario agregado
      const updatedPool = {
        ...pool,
        participants: [...pool.participants, user],
      };

      console.log('🔍 DEBUG: Updated pool object:', {
        poolId: updatedPool.id,
        participantsCount: updatedPool.participants.length,
        participants: updatedPool.participants.map((p) => ({
          id: p.id,
          name: p.name,
        })),
      });

      const savedPool = await this.repo.save(updatedPool);
      console.log('✅ DEBUG: Pool saved successfully:', {
        poolId: savedPool.id,
        participantsCount: savedPool.participants?.length || 0,
      });

      return {
        message: `User ${user.name} has successfully joined the pool "${pool.name}"`,
        poolId: pool.id,
        poolName: pool.name,
        userId: user.id,
        userName: user.name,
      };
    } catch (error) {
      console.error('❌ DEBUG: Error during save:', {
        errorCode: error.code,
        errorMessage: error.message,
        errorDetail: error.detail,
        poolId: pool.id,
        userId: joinPoolDto.userId,
      });

      // Si hay error de foreign key, dar mensaje más claro
      if (error.code === '23503') {
        if (
          error.detail?.includes('userId') ||
          error.detail?.includes('userid')
        ) {
          throw new BadRequestException(
            `Failed to join pool: User with id ${joinPoolDto.userId} was not found during save operation. Please verify the user exists.`,
          );
        } else if (
          error.detail?.includes('poolId') ||
          error.detail?.includes('poolid')
        ) {
          throw new BadRequestException(
            `Failed to join pool: Pool with id ${pool.id} was not found during save operation. Please verify the pool exists.`,
          );
        } else {
          throw new BadRequestException(
            `Foreign key constraint violation: ${error.detail}`,
          );
        }
      }
      throw error;
    }
  }
}
