import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("login_logs")
@Index(["userId"])
@Index(["createdAt"])
export class LoginLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @Column({ type: "varchar", length: 45 })
  ip: string;

  @Column({ name: "user_agent", type: "text" })
  userAgent: string;

  @Column({ name: "device_type", type: "varchar", length: 20 })
  deviceType: string;

  @Column({ name: "login_type", type: "varchar", length: 20 })
  loginType: string;

  @Column({ type: "varchar", length: 20 })
  status: string;

  @Column({ name: "fail_reason", type: "text", nullable: true })
  failReason: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
