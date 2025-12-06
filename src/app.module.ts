import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './api/users/users.module';
import { RolesModule } from './api/roles/roles.module';
import { ConfederationsModule } from './api/confederations/confederations.module';
import { TeamsModule } from './api/teams/teams.module';
import { MatchesModule } from './api/matches/matches.module';
import { PoolsModule } from './api/pools/pools.module';
import { PredictionsModule } from './api/predictions/predictions.module';
import { LeaderboardModule } from './api/leaderboard/leaderboard.module';
import { MongooseModule } from '@nestjs/mongoose';
import { SupabaseModule } from './supabase/supabase.module';
import supabaseConfig from './config/supabase.config';
import { validationSchema } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin.module';
import { HomeModule } from './home.module';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from './api/notifications/notifications.module';
import { PushSubscriptionsModule } from './api/push-subscriptions/push-subscriptions.module';
import { FavoritesModule } from './api/favorites/favorites.module';
import { RecaptchaModule } from './api/recaptcha/recaptcha.module';
import { WebhookModule } from './api/webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [supabaseConfig],
      isGlobal: true,
      validationSchema,
    }),
    MongooseModule.forRoot(process.env.MONGO_URL ? process.env.MONGO_URL : ''),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: false, // 🔒 Desactivado - No crear tablas automáticamente
      dropSchema: false, // 🔒 Desactivado - No eliminar tablas
      logging: false, // 🔕 Sin logs detallados
      extra: {
        ssl: {
          rejectUnauthorized: false,
        },
      },
    }),
    UsersModule,
    RolesModule,
    ConfederationsModule,
    TeamsModule,
    MatchesModule,
    PoolsModule,
    PredictionsModule,
    LeaderboardModule,
    SupabaseModule,
    AuthModule,
    AdminModule,
    HomeModule,
    NotificationsModule,
    PushSubscriptionsModule,
    FavoritesModule,
    RecaptchaModule,
    WebhookModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
