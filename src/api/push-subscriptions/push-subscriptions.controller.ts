import { Controller, Post, Delete, Body, Query, Get} from '@nestjs/common';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';

// Note: This controller doesn't use AuthGuard to allow anonymous subscriptions
@Controller('notification-subscription')
export class PushSubscriptionsController {
  constructor(private readonly pushSubscriptionsService: PushSubscriptionsService) {}

  @Post('subscribe')
  subscribe(@Body() createPushSubscriptionDto: CreatePushSubscriptionDto) {
    return this.pushSubscriptionsService.subscribe(createPushSubscriptionDto);
  }

  @Delete('unsubscribe')
  unsubscribe(@Query('endpoint') endpoint: string) {
    return this.pushSubscriptionsService.unsubscribe(endpoint);
  }

  @Get('list')
  listAll() {
    return this.pushSubscriptionsService.findAll();
  }

  @Post('test')
  async testNotification(@Body() body: { userId?: number; title: string; message: string }) {
    if (body.userId) {
      return await this.pushSubscriptionsService.sendNotificationToUser(
        body.userId,
        body.title,
        body.message,
      );
    }
    return await this.pushSubscriptionsService.sendNotificationToAll(
      body.title,
      body.message,
    );
  }
}
