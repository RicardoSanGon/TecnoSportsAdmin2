import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { PushSubscriptionsController } from './push-subscriptions.controller';
import { PushSubscription } from './entities/push-subscription.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscription])],
  controllers: [PushSubscriptionsController],
  providers: [PushSubscriptionsService],
  exports: [PushSubscriptionsService],
})
export class PushSubscriptionsModule {}
