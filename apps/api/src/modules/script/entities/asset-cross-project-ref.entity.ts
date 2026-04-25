import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";
import { Script } from "./script.entity";

export const AssetType = {
  CHARACTER: "character",
  SCENE: "scene",
  PROP: "prop",
} as const;

export type AssetTypeType = (typeof AssetType)[keyof typeof AssetType];

/**
 * 跨项目资产导入记录实体
 * 记录从其他项目导入资产的来源关系
 */
@Entity("asset_cross_project_refs")
export class AssetCrossProjectRef {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    name: "source_project_id",
    type: "varchar",
    length: 50,
    comment: "源项目ID",
  })
  sourceProjectId: string;

  @Column({
    name: "source_asset_id",
    type: "varchar",
    length: 50,
    comment: "源资产ID",
  })
  sourceAssetId: string;

  @Column({
    name: "source_asset_type",
    type: "varchar",
    length: 20,
    comment: "源资产类型：character/scene/prop",
  })
  sourceAssetType: AssetTypeType;

  @Column({
    name: "target_project_id",
    type: "varchar",
    length: 50,
    comment: "目标项目ID",
  })
  targetProjectId: string;

  @Column({
    name: "target_asset_id",
    type: "varchar",
    length: 50,
    comment: "目标资产ID（复制后的新资产）",
  })
  targetAssetId: string;

  @Column({
    name: "target_asset_type",
    type: "varchar",
    length: 20,
    comment: "目标资产类型",
  })
  targetAssetType: AssetTypeType;

  @Column({
    name: "script_id",
    type: "uuid",
    nullable: true,
    comment: "关联的剧本ID",
  })
  scriptId: string | null;

  @ManyToOne(() => Script, (script) => script.crossProjectRefs, {
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "script_id" })
  script: Script | null;

  @CreateDateColumn({ name: "copied_at" })
  copiedAt: Date;

  @Column({
    name: "copied_by",
    type: "uuid",
    comment: "操作者用户ID",
  })
  copiedBy: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "copied_by" })
  copier: User;
}
