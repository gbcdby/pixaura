import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("user_favorite")
@Index(["userId", "assetType", "assetId"], { unique: true })
export class UserFavoriteEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid", { name: "user_id" })
  userId: string;

  @Column("varchar", { length: 20, name: "asset_type" })
  assetType: "character" | "scene" | "prop";

  @Column("uuid", { name: "asset_id" })
  assetId: string;

  @Column("jsonb", { name: "asset_snapshot" })
  assetSnapshot: {
    name: string;
    description: string;
    thumbnailUrl: string;
    projectName: string;
    projectId: string;
  };

  @Column("varchar", { array: true, default: "{}", name: "tags" })
  tags: string[];

  @Column("timestamptz", { name: "favorited_at" })
  favoritedAt: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
