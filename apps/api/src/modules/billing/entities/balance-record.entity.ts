import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
} from "typeorm";

export enum BalanceRecordType {
  RECHARGE = "recharge",
  CONSUMPTION = "consumption",
  REFUND = "refund",
}

@Entity("balance_record")
@Index(["userId", "createdAt"])
@Index(["type"])
export class BalanceRecord {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @Column({ type: "decimal", precision: 10, scale: 2, name: "change_amount" })
  changeAmount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, name: "balance_after" })
  balanceAfter: number;

  @Column({
    type: "varchar",
    length: 20,
    enum: BalanceRecordType,
  })
  type: BalanceRecordType;

  // referenceId 用于关联业务 ID（如 shot_0, script_xxx），不一定是 UUID 格式
  @Column({ type: "varchar", length: 255, name: "reference_id", nullable: true })
  referenceId: string | null;

  @Column({ type: "varchar", length: 200, nullable: true })
  description: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;
}
