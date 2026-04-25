import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("asset_stats")
@Index(["assetType", "assetId"], { unique: true })
@Index(["projectId", "assetType"])
@Index(["heatScore"])
@Index(["lastUsedAt"])
export class AssetStatsEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("varchar", { length: 20, name: "asset_type" })
  assetType: "character" | "scene" | "prop";

  @Column("uuid", { name: "asset_id" })
  assetId: string;

  @Column("varchar", { length: 20, name: "project_id" })
  projectId: string;

  @Column("int", { default: 0, name: "usage_count" })
  usageCount: number;

  @Column("int", { default: 0, name: "import_count" })
  importCount: number;

  @Column("int", { default: 0, name: "view_count" })
  viewCount: number;

  @Column("timestamptz", { nullable: true, name: "first_used_at" })
  firstUsedAt?: Date;

  @Column("timestamptz", { nullable: true, name: "last_used_at" })
  lastUsedAt?: Date;

  @Column("timestamptz", { nullable: true, name: "last_imported_at" })
  lastImportedAt?: Date;

  @Column("float", { default: 0, name: "heat_score" })
  heatScore: number;

  @Column("int", { nullable: true, name: "heat_rank" })
  heatRank?: number;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
