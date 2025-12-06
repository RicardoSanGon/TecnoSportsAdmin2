import { Controller, Post, Get, Query } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';

// Webhook controller for external cron services (no auth required)
// This should be called by an external cron service like cron-job.org
@Controller('webhook')
export class WebhookController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // Endpoint to trigger notification checks manually
  // Call this every minute from an external cron service
  @Post('check-matches')
  async checkMatches(@Query('secret') secret: string) {
    // Simple secret validation (should match CRON_SECRET env variable)
    const cronSecret = process.env.CRON_SECRET || 'tecnosports-cron-2024';
    
    if (secret !== cronSecret) {
      return { error: 'Invalid secret', status: 401 };
    }

    try {
      // Run both cron checks
      await this.notificationsService.checkUpcomingMatches();
      await this.notificationsService.checkStartingMatches();

      return {
        success: true,
        timestamp: new Date().toISOString(),
        message: 'Match checks completed successfully',
      };
    } catch (error) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Health check endpoint
  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
