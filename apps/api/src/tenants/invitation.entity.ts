import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Tenant } from './tenant.entity';

@Entity('invitations')
export class Invitation {
  @ApiProperty({ example: '1', description: 'Unique identifier' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'Invited email address',
  })
  @Column()
  email: string;

  @ApiProperty({ example: 'pending', description: 'Invitation status' })
  @Column({ default: 'pending' })
  status: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'uuid' })
  inviterId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'inviterId' })
  inviter: User;

  @Column({ unique: true })
  token: string;

  @ApiProperty({ example: '2025-02-13', description: 'Invitation expiry date' })
  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @ApiProperty({ example: 'user', description: 'Role for the invited user' })
  @Column({ default: 'user' })
  role: 'admin' | 'user';

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  acceptedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'acceptedBy' })
  acceptedUser: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
