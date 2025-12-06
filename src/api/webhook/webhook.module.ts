import { Module, forwardRef } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [forwardRef(() => NotificationsModule)],
  controllers: [WebhookController],
})
export class WebhookModule {}
