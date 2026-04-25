import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("user_recent")
@Index(["userId", "usedAt"])
@Index(["assetType", "assetId", "usedAt"])
@Index(["userId", "action", "usedAt"])
export class UserRecentEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid", { name: "user_id" })
  userId: string;

  @Column("varchar", { length: 20, name: "asset_type" })
  assetType: "character" | "scene" | "prop";

  @Column("uuid", { name: "asset_id" })
  assetId: string;

  @Column("varchar", { length: 20, name: "action" })
  action: "view" | "import" | "use_in_shot";

  @Column("jsonb", { nullable: true, name: "context" })
  context?: {
    sourceProjectId?: string;
    targetProjectId?: string;
    shotId?: string;
  };

  @Column("timestamptz", { name: "used_at" })
  usedAt: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
