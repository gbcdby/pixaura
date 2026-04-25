import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("file_reference")
@Index(["refCount", "updatedAt"])
export class FileReferenceEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("varchar", { length: 500, unique: true, name: "file_url" })
  fileUrl: string;

  @Column("varchar", { length: 500, name: "file_key" })
  fileKey: string;

  @Column("int", { default: 1, name: "ref_count" })
  refCount: number;

  @Column("uuid", { name: "first_created_by" })
  firstCreatedBy: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
