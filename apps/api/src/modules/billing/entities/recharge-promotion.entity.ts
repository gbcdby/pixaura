import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum BonusType {
  PERCENT = "percent",
  FIXED = "fixed",
}

@Entity("recharge_promotion")
@Index(["isActive", "startAt", "endAt"])
export class RechargePromotion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 100 })
  name: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  description: string | null;

  @Column({ type: "decimal", precision: 10, scale: 2, name: "min_amount" })
  minAmount: number;

  @Column({
    type: "varchar",
    length: 20,
    enum: BonusType,
    name: "bonus_type",
  })
  bonusType: BonusType;

  @Column({ type: "decimal", precision: 10, scale: 2, name: "bonus_value" })
  bonusValue: number;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    name: "max_bonus",
    nullable: true,
  })
  maxBonus: number | null;

  @Column({ type: "boolean", name: "is_active", default: true })
  isActive: boolean;

  @Column({ type: "timestamptz", name: "start_at", nullable: true })
  startAt: Date | null;

  @Column({ type: "timestamptz", name: "end_at", nullable: true })
  endAt: Date | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt: Date;
}
