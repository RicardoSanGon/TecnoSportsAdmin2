import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification } from './entities/notification.entity';
import { Favorite } from '../favorites/entities/favorite.entity';
import { Match } from '../matches/entities/match.entity';
import { PushSubscriptionsService } from '../push-subscriptions/push-subscriptions.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(Favorite)
    private readonly favoriteRepository: Repository<Favorite>,
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    private readonly pushSubscriptionsService: PushSubscriptionsService,
  ) {}

  async create(createNotificationDto: CreateNotificationDto) {
    const notification = this.notificationRepository.create(
      createNotificationDto,
    );
    return await this.notificationRepository.save(notification);
  }

  async findAllByUser(userId: number) {
    return await this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async markAsRead(id: number) {
    return await this.notificationRepository.update(id, { isRead: true });
  }

  // Check every minute for matches starting in 1 hour
  @Cron(CronExpression.EVERY_MINUTE)
  async checkUpcomingMatches() {
    const now = new Date();
    // Use a 5-minute window to catch matches more reliably
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const windowStart = new Date(oneHourLater.getTime() - 2 * 60 * 1000); // 58 minutes from now
    const windowEnd = new Date(oneHourLater.getTime() + 2 * 60 * 1000);   // 62 minutes from now

    this.logger.log(`[CRON-UPCOMING] Server time: ${now.toISOString()}`);
    this.logger.log(`[CRON-UPCOMING] Checking window: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);

    // Use raw query to avoid TypeORM relation issues
    const upcomingMatches = await this.matchRepository
      .createQueryBuilder('m')
      .select(['m.id', 'm."homeTeamId"', 'm."awayTeamId"', 'm."matchDate"', 'm.status'])
      .where('m."matchDate" >= :windowStart', { windowStart })
      .andWhere('m."matchDate" <= :windowEnd', { windowEnd })
      .andWhere('m.status = :status', { status: 'pending' })
      .getRawMany();

    this.logger.log(`[CRON-UPCOMING] Found ${upcomingMatches.length} upcoming matches`);

    for (const match of upcomingMatches) {
      const matchId = match.m_id;
      const homeTeamId = match.m_homeTeamId;
      const awayTeamId = match.m_awayTeamId;
      const matchInfo = `Equipo ${homeTeamId} vs Equipo ${awayTeamId}`;
      this.logger.log(`[CRON-UPCOMING] Processing match ${matchId}: ${matchInfo}`);
      
      await this.notifyFavoritesForMatch(
        matchId,
        '⏰ ¡Tu partido favorito comienza en 1 hora!',
        `${matchInfo} - Prepárate para ver el partido`,
      );
    }
  }

  // Check every minute for matches starting now
  @Cron(CronExpression.EVERY_MINUTE)
  async checkStartingMatches() {
    const now = new Date();
    // Use a 3-minute window to catch matches more reliably
    const windowStart = new Date(now.getTime() - 2 * 60 * 1000); // 2 minutes ago
    const windowEnd = new Date(now.getTime() + 1 * 60 * 1000);    // 1 minute from now

    this.logger.log(`[CRON-STARTING] Server time: ${now.toISOString()}`);
    this.logger.log(`[CRON-STARTING] Checking window: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);

    // Use raw query to avoid TypeORM relation issues
    const startingMatches = await this.matchRepository
      .createQueryBuilder('m')
      .select(['m.id', 'm."homeTeamId"', 'm."awayTeamId"', 'm."matchDate"', 'm.status'])
      .where('m."matchDate" >= :windowStart', { windowStart })
      .andWhere('m."matchDate" <= :windowEnd', { windowEnd })
      .andWhere('m.status = :status', { status: 'pending' })
      .getRawMany();

    this.logger.log(`[CRON-STARTING] Found ${startingMatches.length} starting matches`);

    for (const match of startingMatches) {
      const matchId = match.m_id;
      const homeTeamId = match.m_homeTeamId;
      const awayTeamId = match.m_awayTeamId;
      const matchInfo = `Equipo ${homeTeamId} vs Equipo ${awayTeamId}`;
      this.logger.log(`[CRON-STARTING] Processing match ${matchId}: ${matchInfo}`);
      
      await this.notifyFavoritesForMatch(
        matchId, 
        '🔴 ¡El partido ha comenzado!',
        `${matchInfo} - ¡Ya está en vivo!`,
      );

      // Update match status to 'live' to avoid duplicate notifications
      await this.matchRepository.update(matchId, { status: 'live' });
      this.logger.log(`[CRON-STARTING] Updated match ${matchId} status to 'live'`);
    }
  }

  private getMatchDescription(match: Match): string {
    const homeTeamName = match.homeTeam?.name || `Equipo ${match.homeTeamId}`;
    const awayTeamName = match.awayTeam?.name || `Equipo ${match.awayTeamId}`;
    return `${homeTeamName} vs ${awayTeamName}`;
  }

  private async notifyFavoritesForMatch(matchId: number, title: string, message: string) {
    const favorites = await this.favoriteRepository.find({
      where: { matchId },
    });

    this.logger.log(`Found ${favorites.length} favorites for match ${matchId}`);

    for (const favorite of favorites) {
      // Create DB notification for the user
      const notification = await this.create({
        userId: favorite.userId,
        title,
        message,
      });
      this.logger.log(
        `Notification created: ${notification.id} for user ${favorite.userId}`,
      );

      // Send Web Push notification
      if (favorite.userId) {
        const result = await this.pushSubscriptionsService.sendNotificationToUser(
          favorite.userId,
          title,
          message,
          { matchId },
        );
        this.logger.log(
          `Push notification result for user ${favorite.userId}: sent=${result.sent}, failed=${result.failed}`,
        );
      }
    }
  }

  private async notifyFavorites(match: Match, title: string, message: string) {
    const favorites = await this.favoriteRepository.find({
      where: { matchId: match.id },
      // Don't load relations to avoid type mismatch issues
    });

    this.logger.log(`Found ${favorites.length} favorites for match ${match.id}`);

    for (const favorite of favorites) {
      // Create DB notification for the user
      const notification = await this.create({
        userId: favorite.userId,
        title,
        message,
      });
      this.logger.log(
        `Notification created: ${notification.id} for user ${favorite.userId}`,
      );

      // Send Web Push notification
      if (favorite.userId) {
        const result = await this.pushSubscriptionsService.sendNotificationToUser(
          favorite.userId,
          title,
          message,
          { matchId: match.id },
        );
        this.logger.log(
          `Push notification result for user ${favorite.userId}: sent=${result.sent}, failed=${result.failed}`,
        );
      }
    }
  }

  /**
   * Sends a notification to all subscribed users about a new match
   */
  async notifyNewMatch(match: Match) {
    const matchInfo = this.getMatchDescription(match);
    const matchDate = new Date(match.matchDate);
    const formattedDate = matchDate.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const title = '🆕 Nuevo Partido Programado';
    const message = `${matchInfo} - ${formattedDate}`;

    this.logger.log(`Notifying all users about new match: ${matchInfo}`);

    // Send push notification to all subscribed users
    const result = await this.pushSubscriptionsService.sendNotificationToAll(
      title,
      message,
      { matchId: match.id },
    );

    this.logger.log(`New match notification sent: ${result.sent} success, ${result.failed} failed`);

    return result;
  }

  async debugCron() {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const oneHourLaterPlusOneMinute = new Date(oneHourLater.getTime() + 60 * 1000);
    
    const upcomingMatches = await this.matchRepository.find({
      where: {
        matchDate: Between(oneHourLater, oneHourLaterPlusOneMinute),
      },
      relations: ['homeTeam', 'awayTeam'],
    });

    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const startingMatches = await this.matchRepository.find({
      where: {
        matchDate: Between(oneMinuteAgo, now),
      },
      relations: ['homeTeam', 'awayTeam'],
    });

    return {
      serverTime: now.toISOString(),
      upcomingWindow: {
        start: oneHourLater.toISOString(),
        end: oneHourLaterPlusOneMinute.toISOString(),
        matchesFound: upcomingMatches.length,
        matches: upcomingMatches
      },
      startingWindow: {
        start: oneMinuteAgo.toISOString(),
        end: now.toISOString(),
        matchesFound: startingMatches.length,
        matches: startingMatches
      }
    };
  }

  async sendTestNotification(userId: number) {
    // Create DB notification
    const notification = await this.create({
      userId,
      title: 'Test Notification',
      message: 'Esta es una notificación de prueba para verificar el sistema.',
    });

    // Send Web Push notification
    const pushResult = await this.pushSubscriptionsService.sendNotificationToUser(
      userId,
      'Test Notification',
      'Esta es una notificación de prueba para verificar el sistema.',
    );

    return {
      dbNotification: notification,
      pushResult,
    };
  }
}
