import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';
import { Favorite } from '../favorites/entities/favorite.entity';
import { Match } from '../matches/entities/match.entity';
import { PushSubscriptionsModule } from '../push-subscriptions/push-subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, Favorite, Match]),
    PushSubscriptionsModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
