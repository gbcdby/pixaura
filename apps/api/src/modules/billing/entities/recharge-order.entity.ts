import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum PaymentMethod {
  ALIPAY = "alipay",
  WECHAT = "wechat",
}

export enum PaymentStatus {
  PENDING = "pending",
  PAID = "paid",
  FAILED = "failed",
  REFUNDED = "refunded",
}

@Entity("recharge_order")
@Index(["userId", "createdAt"])
@Index(["paymentStatus"])
@Index(["transactionNo"])
export class RechargeOrder {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount: number;

  @Column({ type: "int", name: "credits" })
  credits: number;

  @Column({
    type: "varchar",
    length: 20,
    enum: PaymentMethod,
    name: "payment_method",
  })
  paymentMethod: PaymentMethod;

  @Column({
    type: "varchar",
    length: 20,
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
    name: "payment_status",
  })
  paymentStatus: PaymentStatus;

  @Column({
    type: "varchar",
    length: 100,
    name: "transaction_no",
    nullable: true,
  })
  transactionNo: string | null;

  @Column({ type: "timestamptz", name: "paid_at", nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt: Date;
}
