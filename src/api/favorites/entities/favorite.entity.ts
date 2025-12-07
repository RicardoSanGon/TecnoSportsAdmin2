import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

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

  // Removed user and match relations to avoid type mismatch issues
  // The userId and matchId fields are used directly instead
}
