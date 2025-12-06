import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

// Using existing table 'notification_subscriptions' in Supabase
@Entity('notification_subscriptions')
export class PushSubscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  endpoint: string;

  @Column({ type: 'varchar' })
  p256dh: string;

  @Column({ type: 'varchar' })
  auth: string;

  @Column({ name: 'userId', nullable: true })
  userId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;
}
