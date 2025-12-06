import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscription } from './entities/push-subscription.entity';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';
import * as webpush from 'web-push';

@Injectable()
export class PushSubscriptionsService {
  private readonly logger = new Logger(PushSubscriptionsService.name);

  constructor(
    @InjectRepository(PushSubscription)
    private readonly pushSubscriptionRepository: Repository<PushSubscription>,
  ) {
    // Initialize web-push with VAPID keys
    const vapidPublicKey =
      process.env.VAPID_PUBLIC_KEY ||
      'BPRmKpOvbaYBUSJEvemIrERUqnn3Mn_Bgo5o9Bjgq9YxK7CIRQr6i_lnXeDXEi9CX0cYsWC_cLPNuEYP1DbwabY';
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (vapidPrivateKey) {
      webpush.setVapidDetails(
        'mailto:tecnosports@example.com',
        vapidPublicKey,
        vapidPrivateKey,
      );
      this.logger.log('VAPID credentials configured successfully');
    } else {
      this.logger.warn(
        'VAPID_PRIVATE_KEY not configured. Web Push notifications will not work.',
      );
    }
  }

  async subscribe(createPushSubscriptionDto: CreatePushSubscriptionDto) {
    // Extract keys from the nested structure (browser sends { keys: { p256dh, auth } })
    const { endpoint, keys, userId } = createPushSubscriptionDto;
    const p256dh = keys?.p256dh || (createPushSubscriptionDto as any).p256dh;
    const auth = keys?.auth || (createPushSubscriptionDto as any).auth;

    // Check if subscription already exists
    const existingSubscription = await this.pushSubscriptionRepository.findOne({
      where: { endpoint },
    });

    if (existingSubscription) {
      // Update existing subscription
      existingSubscription.p256dh = p256dh;
      existingSubscription.auth = auth;
      if (userId) {
        existingSubscription.userId = userId;
      }
      this.logger.log(`Updated existing subscription for endpoint: ${endpoint.substring(0, 50)}...`);
      return await this.pushSubscriptionRepository.save(existingSubscription);
    }

    // Create new subscription with flattened structure
    const subscription = this.pushSubscriptionRepository.create({
      endpoint,
      p256dh,
      auth,
      userId,
    });
    this.logger.log(`Created new subscription for endpoint: ${endpoint.substring(0, 50)}...`);
    return await this.pushSubscriptionRepository.save(subscription);
  }

  async unsubscribe(endpoint: string) {
    const subscription = await this.pushSubscriptionRepository.findOne({
      where: { endpoint },
    });

    if (subscription) {
      await this.pushSubscriptionRepository.remove(subscription);
      return { message: 'Subscription removed successfully' };
    }

    return { message: 'Subscription not found' };
  }

  async findAllByUserId(userId: number): Promise<PushSubscription[]> {
    return await this.pushSubscriptionRepository.find({
      where: { userId },
    });
  }

  async findAll(): Promise<PushSubscription[]> {
    return await this.pushSubscriptionRepository.find();
  }

  async sendNotificationToUser(
    userId: number,
    title: string,
    body: string,
    data?: object,
  ) {
    const subscriptions = await this.findAllByUserId(userId);

    if (subscriptions.length === 0) {
      this.logger.log(`No subscriptions found for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    return await this.sendToSubscriptions(subscriptions, title, body, data);
  }

  async sendNotificationToAll(title: string, body: string, data?: object) {
    const subscriptions = await this.findAll();

    if (subscriptions.length === 0) {
      this.logger.log('No subscriptions found');
      return { sent: 0, failed: 0 };
    }

    return await this.sendToSubscriptions(subscriptions, title, body, data);
  }

  private async sendToSubscriptions(
    subscriptions: PushSubscription[],
    title: string,
    body: string,
    data?: object,
  ) {
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPrivateKey) {
      this.logger.warn(
        'VAPID_PRIVATE_KEY not configured. Skipping push notifications.',
      );
      return { sent: 0, failed: 0 };
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: '/favicon2.png',
      badge: '/favicon.png',
      data,
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        // Convert from flat structure to web-push format
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
        );
        sent++;
        this.logger.log(`Push notification sent to subscription ${sub.id}`);
      } catch (error: any) {
        failed++;
        this.logger.error(
          `Failed to send push to subscription ${sub.id}:`,
          error.message,
        );

        // Remove invalid subscriptions (gone or expired)
        if (error.statusCode === 410 || error.statusCode === 404) {
          await this.pushSubscriptionRepository.remove(sub);
          this.logger.log(`Removed expired subscription ${sub.id}`);
        }
      }
    }

    return { sent, failed };
  }
}
