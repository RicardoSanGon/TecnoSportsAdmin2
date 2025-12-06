import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Match } from '../../matches/entities/match.entity';

@Entity('favorites')
export class Favorite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'match_id' })
  matchId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Removed user relation to avoid type mismatch issues
  // The userId field is used directly instead

  @ManyToOne(() => Match)
  @JoinColumn({ name: 'match_id' })
  match: Match;
}

