import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("asset_import_log")
@Index(["targetProjectId", "importedAt"])
@Index(["sourceProjectId", "sourceAssetId"])
@Index(["importedBy", "importedAt"])
export class AssetImportLogEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("varchar", { length: 20, name: "source_asset_type" })
  sourceAssetType: "character" | "scene" | "prop";

  @Column("uuid", { name: "source_asset_id" })
  sourceAssetId: string;

  @Column("varchar", { length: 20, name: "source_project_id" })
  sourceProjectId: string;

  @Column("uuid", { name: "target_asset_id" })
  targetAssetId: string;

  @Column("varchar", { length: 20, name: "target_project_id" })
  targetProjectId: string;

  @Column("uuid", { name: "imported_by" })
  importedBy: string;

  @Column("timestamptz", { name: "imported_at" })
  importedAt: Date;

  @Column("varchar", { length: 20, name: "import_method" })
  importMethod: "single" | "batch";

  @Column("varchar", { length: 20, nullable: true, name: "conflict_handling" })
  conflictHandling?: "skip" | "rename" | "replace";

  @Column("varchar", { length: 100, nullable: true, name: "original_name" })
  originalName?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
