import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 初始数据库架构
 * 包含所有核心表的完整创建语句，基于当前 Entity 定义生成
 * 生成时间: 2026-04-23T16:01:48.871Z
 */
export class InitialSchema1776960108871 implements MigrationInterface {
  name = "InitialSchema1776960108871";

  // 禁用事务：DDL 语句（CREATE TABLE / CREATE INDEX 等）在 PostgreSQL 中会隐式提交，
  // 在事务中执行会导致不可预期的行为
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
--
-- PostgreSQL database dump
--


-- Dumped from database version 18.1 (Debian 18.1-1.pgdg13+2)
-- Dumped by pg_dump version 18.1 (Debian 18.1-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
--



--
--



--
--

DO $$ BEGIN
    CREATE TYPE public.system_notices_priority_enum AS ENUM ('high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN
    null;
END $$;



--
--

DO $$ BEGIN
    CREATE TYPE public.system_notices_status_enum AS ENUM ('draft', 'published', 'unpublished');
EXCEPTION WHEN duplicate_object THEN
    null;
END $$;



--
--

DO $$ BEGIN
    CREATE TYPE public.system_notices_type_enum AS ENUM ('maintenance', 'feature', 'important', 'other');
EXCEPTION WHEN duplicate_object THEN
    null;
END $$;



SET default_tablespace = '';

SET default_table_access_method = heap;

--
--

CREATE TABLE public.admin_operation_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    admin_id uuid NOT NULL,
    operation_type character varying(50) NOT NULL,
    target_type character varying(20),
    target_id uuid,
    details jsonb NOT NULL,
    ip_address inet NOT NULL,
    user_agent character varying(500),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.admin_operation_log.operation_type IS '操作类型：user_ban, user_unban, config_update, balance_adjust 等';


--
--

COMMENT ON COLUMN public.admin_operation_log.target_type IS '操作对象类型：user, config, billing 等';


--
--

COMMENT ON COLUMN public.admin_operation_log.target_id IS '操作对象ID';


--
--

COMMENT ON COLUMN public.admin_operation_log.details IS '操作详情（变更前后的值）';


--
--

COMMENT ON COLUMN public.admin_operation_log.ip_address IS '操作者IP';


--
--

COMMENT ON COLUMN public.admin_operation_log.user_agent IS '浏览器UA';


--
--

CREATE TABLE public.ai_models (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    model_id character varying(100) NOT NULL,
    model_name character varying(200) NOT NULL,
    category character varying(50) NOT NULL,
    description text,
    min_tier character varying(20) DEFAULT 'free'::character varying NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    status character varying(20) DEFAULT 'enabled'::character varying NOT NULL,
    default_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    custom_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    cost_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    supported_features jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.ai_provider_config (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider character varying(50) NOT NULL,
    api_base_url character varying(500) NOT NULL,
    api_key_encrypted text NOT NULL,
    config jsonb,
    rate_limits jsonb NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.ai_provider_config.provider IS '提供商名称';


--
--

COMMENT ON COLUMN public.ai_provider_config.api_base_url IS 'API 基础地址';


--
--

COMMENT ON COLUMN public.ai_provider_config.api_key_encrypted IS '加密存储的 API Key';


--
--

COMMENT ON COLUMN public.ai_provider_config.config IS '额外配置参数';


--
--

COMMENT ON COLUMN public.ai_provider_config.rate_limits IS '速率限制配置';


--
--

COMMENT ON COLUMN public.ai_provider_config.status IS '状态';


--
--

CREATE TABLE public.ai_task (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_id character varying(50) NOT NULL,
    type character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    user_id uuid NOT NULL,
    project_id character varying(50),
    request_data jsonb NOT NULL,
    model_provider character varying(50) NOT NULL,
    model_id character varying(100) NOT NULL,
    priority integer DEFAULT 50 NOT NULL,
    estimated_tokens integer,
    actual_tokens integer,
    estimated_cost numeric(10,4),
    actual_cost numeric(10,4),
    retry_count integer DEFAULT 0 NOT NULL,
    max_retries integer DEFAULT 3 NOT NULL,
    error_message text,
    error_code character varying(50),
    queue_name character varying(50) NOT NULL,
    worker_id character varying(100),
    submitted_at timestamp without time zone NOT NULL,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.ai_task.task_id IS '任务唯一标识，如：task_abc123';


--
--

COMMENT ON COLUMN public.ai_task.type IS '任务类型';


--
--

COMMENT ON COLUMN public.ai_task.status IS '任务状态';


--
--

COMMENT ON COLUMN public.ai_task.user_id IS '用户ID';


--
--

COMMENT ON COLUMN public.ai_task.project_id IS '项目ID（可选）';


--
--

COMMENT ON COLUMN public.ai_task.request_data IS '请求参数';


--
--

COMMENT ON COLUMN public.ai_task.model_provider IS '模型提供商';


--
--

COMMENT ON COLUMN public.ai_task.model_id IS '模型ID';


--
--

COMMENT ON COLUMN public.ai_task.priority IS '优先级（1-100，数字越小优先级越高）';


--
--

COMMENT ON COLUMN public.ai_task.estimated_tokens IS '预估token数';


--
--

COMMENT ON COLUMN public.ai_task.actual_tokens IS '实际token数';


--
--

COMMENT ON COLUMN public.ai_task.estimated_cost IS '预估费用';


--
--

COMMENT ON COLUMN public.ai_task.actual_cost IS '实际费用';


--
--

COMMENT ON COLUMN public.ai_task.retry_count IS '重试次数';


--
--

COMMENT ON COLUMN public.ai_task.max_retries IS '最大重试次数';


--
--

COMMENT ON COLUMN public.ai_task.error_message IS '错误信息';


--
--

COMMENT ON COLUMN public.ai_task.error_code IS '错误码';


--
--

COMMENT ON COLUMN public.ai_task.queue_name IS '所属队列名称';


--
--

COMMENT ON COLUMN public.ai_task.worker_id IS '执行Worker标识';


--
--

COMMENT ON COLUMN public.ai_task.submitted_at IS '提交时间';


--
--

COMMENT ON COLUMN public.ai_task.started_at IS '开始执行时间';


--
--

COMMENT ON COLUMN public.ai_task.completed_at IS '完成时间';


--
--

CREATE TABLE public.ai_task_models (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    model_id character varying(100) NOT NULL,
    name character varying(100) NOT NULL,
    provider character varying(50) NOT NULL,
    category character varying(50) NOT NULL,
    capabilities jsonb NOT NULL,
    config jsonb NOT NULL,
    pricing jsonb NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.ai_task_models.model_id IS '模型唯一标识';


--
--

COMMENT ON COLUMN public.ai_task_models.name IS '模型显示名称';


--
--

COMMENT ON COLUMN public.ai_task_models.provider IS '提供商';


--
--

COMMENT ON COLUMN public.ai_task_models.category IS '类别';


--
--

COMMENT ON COLUMN public.ai_task_models.capabilities IS '能力列表';


--
--

COMMENT ON COLUMN public.ai_task_models.config IS '模型配置参数';


--
--

COMMENT ON COLUMN public.ai_task_models.pricing IS '计费配置';


--
--

COMMENT ON COLUMN public.ai_task_models.status IS '状态';


--
--

COMMENT ON COLUMN public.ai_task_models.is_default IS '是否默认模型';


--
--

COMMENT ON COLUMN public.ai_task_models.description IS '模型描述';


--
--

CREATE TABLE public.ai_task_result (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_id character varying(50) NOT NULL,
    result_data jsonb,
    raw_response text,
    stream_chunks jsonb,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.ai_task_result.task_id IS '任务ID';


--
--

COMMENT ON COLUMN public.ai_task_result.result_data IS '执行结果数据';


--
--

COMMENT ON COLUMN public.ai_task_result.raw_response IS '原始响应（用于调试）';


--
--

COMMENT ON COLUMN public.ai_task_result.stream_chunks IS '流式输出片段记录';


--
--

COMMENT ON COLUMN public.ai_task_result.metadata IS '额外元数据';


--
--

CREATE TABLE public.ai_tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    script_id uuid NOT NULL,
    type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    config jsonb NOT NULL,
    result jsonb,
    error text,
    progress integer,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    started_at timestamp without time zone,
    completed_at timestamp without time zone
);



--
--

COMMENT ON COLUMN public.ai_tasks.script_id IS '关联剧本ID';


--
--

COMMENT ON COLUMN public.ai_tasks.type IS '任务类型：generate/continue/rewrite/expand/condense';


--
--

COMMENT ON COLUMN public.ai_tasks.status IS '状态：pending/processing/completed/failed/cancelled';


--
--

COMMENT ON COLUMN public.ai_tasks.config IS '任务配置参数';


--
--

COMMENT ON COLUMN public.ai_tasks.result IS '任务结果';


--
--

COMMENT ON COLUMN public.ai_tasks.error IS '错误信息';


--
--

COMMENT ON COLUMN public.ai_tasks.progress IS '进度 0-100（流式输出时更新）';


--
--

COMMENT ON COLUMN public.ai_tasks.created_by IS '创建者用户ID';


--
--

COMMENT ON COLUMN public.ai_tasks.started_at IS '开始处理时间';


--
--

COMMENT ON COLUMN public.ai_tasks.completed_at IS '完成时间';


--
--

CREATE TABLE public.asset_cross_project_refs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    source_project_id character varying(50) NOT NULL,
    source_asset_id character varying(50) NOT NULL,
    source_asset_type character varying(20) NOT NULL,
    target_project_id character varying(50) NOT NULL,
    target_asset_id character varying(50) NOT NULL,
    target_asset_type character varying(20) NOT NULL,
    script_id uuid,
    copied_at timestamp without time zone DEFAULT now() NOT NULL,
    copied_by uuid NOT NULL
);



--
--

COMMENT ON COLUMN public.asset_cross_project_refs.source_project_id IS '源项目ID';


--
--

COMMENT ON COLUMN public.asset_cross_project_refs.source_asset_id IS '源资产ID';


--
--

COMMENT ON COLUMN public.asset_cross_project_refs.source_asset_type IS '源资产类型：character/scene/prop';


--
--

COMMENT ON COLUMN public.asset_cross_project_refs.target_project_id IS '目标项目ID';


--
--

COMMENT ON COLUMN public.asset_cross_project_refs.target_asset_id IS '目标资产ID（复制后的新资产）';


--
--

COMMENT ON COLUMN public.asset_cross_project_refs.target_asset_type IS '目标资产类型';


--
--

COMMENT ON COLUMN public.asset_cross_project_refs.script_id IS '关联的剧本ID';


--
--

COMMENT ON COLUMN public.asset_cross_project_refs.copied_by IS '操作者用户ID';


--
--

CREATE TABLE public.asset_import_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    source_asset_type character varying(20) NOT NULL,
    source_asset_id uuid NOT NULL,
    source_project_id character varying(20) NOT NULL,
    target_asset_id uuid NOT NULL,
    target_project_id character varying(20) NOT NULL,
    imported_by uuid NOT NULL,
    imported_at timestamp with time zone NOT NULL,
    import_method character varying(20) NOT NULL,
    conflict_handling character varying(20),
    original_name character varying(100),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.asset_stats (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    asset_type character varying(20) NOT NULL,
    asset_id uuid NOT NULL,
    project_id character varying(20) NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    import_count integer DEFAULT 0 NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    first_used_at timestamp with time zone,
    last_used_at timestamp with time zone,
    last_imported_at timestamp with time zone,
    heat_score double precision DEFAULT '0'::double precision NOT NULL,
    heat_rank integer,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.audio_generation_output (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_id uuid NOT NULL,
    type character varying(32) NOT NULL,
    file jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb,
    moderation jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.audio_generation_task (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    generation_task_id uuid,
    project_id character varying(50) NOT NULL,
    created_by uuid NOT NULL,
    type character varying(32) NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    progress jsonb DEFAULT '{"percentage": 0, "currentStep": ""}'::jsonb NOT NULL,
    cost jsonb DEFAULT '{"currency": "CNY", "actualCost": 0, "estimatedCost": 0}'::jsonb NOT NULL,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    error jsonb,
    callback_url character varying(512),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    deleted_at timestamp with time zone
);



--
--

CREATE TABLE public.balance_record (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    change_amount numeric(10,2) NOT NULL,
    balance_after numeric(10,2) NOT NULL,
    type character varying(20) NOT NULL,
    reference_id character varying(255),
    description character varying(200),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.character_images (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    character_id uuid NOT NULL,
    type character varying(20) NOT NULL,
    url character varying(500) NOT NULL,
    thumbnail_url character varying(500),
    generation_info jsonb,
    upload_info jsonb,
    version integer DEFAULT 1 NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.character_images.character_id IS '关联角色ID';


--
--

COMMENT ON COLUMN public.character_images.type IS '图片类型：front_view/side_view/back_view/angle_view/additional';


--
--

COMMENT ON COLUMN public.character_images.url IS '图片URL';


--
--

COMMENT ON COLUMN public.character_images.thumbnail_url IS '缩略图URL';


--
--

COMMENT ON COLUMN public.character_images.generation_info IS '生成信息（prompt, negative_prompt, model_id, seed, created_at）';


--
--

COMMENT ON COLUMN public.character_images.upload_info IS '上传信息（original_filename, file_size, mime_type, uploaded_at）';


--
--

COMMENT ON COLUMN public.character_images.version IS '版本号';


--
--

COMMENT ON COLUMN public.character_images.is_current IS '是否为当前版本';


--
--

CREATE TABLE public.characters (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    personality character varying(500),
    age character varying(20),
    gender character varying(10),
    occupation character varying(50),
    background text,
    appearance jsonb,
    importance character varying(20) DEFAULT 'minor'::character varying NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    script_ref jsonb,
    import_info jsonb,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);



--
--

COMMENT ON COLUMN public.characters.project_id IS '所属项目ID';


--
--

COMMENT ON COLUMN public.characters.name IS '角色名称（项目内唯一）';


--
--

COMMENT ON COLUMN public.characters.description IS '角色描述（外貌、性格等）';


--
--

COMMENT ON COLUMN public.characters.personality IS '性格特征';


--
--

COMMENT ON COLUMN public.characters.age IS '年龄描述';


--
--

COMMENT ON COLUMN public.characters.gender IS '性别：male/female/other/unknown';


--
--

COMMENT ON COLUMN public.characters.occupation IS '职业';


--
--

COMMENT ON COLUMN public.characters.background IS '背景故事';


--
--

COMMENT ON COLUMN public.characters.appearance IS '外观细节（身高、体型、发色、眼色等）';


--
--

COMMENT ON COLUMN public.characters.importance IS '重要性：protagonist/supporting/minor';


--
--

COMMENT ON COLUMN public.characters.status IS '状态：draft/active/archived';


--
--

COMMENT ON COLUMN public.characters.script_ref IS '剧本关联信息（script_id, extracted_at, importance）';


--
--

COMMENT ON COLUMN public.characters.import_info IS '跨项目导入信息';


--
--

COMMENT ON COLUMN public.characters.created_by IS '创建者用户ID';


--
--

CREATE TABLE public.cleanup_queue (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id character varying(50) NOT NULL,
    project_id character varying(50) NOT NULL,
    action character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    scheduled_at timestamp without time zone NOT NULL,
    processed_at timestamp without time zone,
    error_message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.cleanup_queue.resource_type IS '资源类型：project/character/scene/prop/script/storyboard';


--
--

COMMENT ON COLUMN public.cleanup_queue.resource_id IS '资源ID';


--
--

COMMENT ON COLUMN public.cleanup_queue.project_id IS '所属项目ID';


--
--

COMMENT ON COLUMN public.cleanup_queue.action IS '操作类型：delete/archive';


--
--

COMMENT ON COLUMN public.cleanup_queue.status IS '状态：pending/processing/completed/failed';


--
--

COMMENT ON COLUMN public.cleanup_queue.retry_count IS '重试次数';


--
--

COMMENT ON COLUMN public.cleanup_queue.scheduled_at IS '计划执行时间（软删除30天后）';


--
--

COMMENT ON COLUMN public.cleanup_queue.processed_at IS '实际处理时间';


--
--

COMMENT ON COLUMN public.cleanup_queue.error_message IS '错误信息（失败时记录）';


--
--

CREATE TABLE public.collaborator (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id character varying(50) NOT NULL,
    user_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    invited_by uuid NOT NULL,
    joined_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.collaborator.project_id IS '项目ID';


--
--

COMMENT ON COLUMN public.collaborator.user_id IS '用户ID';


--
--

COMMENT ON COLUMN public.collaborator.role IS '角色：owner/editor/viewer';


--
--

COMMENT ON COLUMN public.collaborator.invited_by IS '邀请人ID';


--
--

COMMENT ON COLUMN public.collaborator.joined_at IS '加入时间';


--
--

CREATE TABLE public.file_reference (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    file_url character varying(500) NOT NULL,
    file_key character varying(500) NOT NULL,
    ref_count integer DEFAULT 1 NOT NULL,
    first_created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.image_generation_result (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_id uuid NOT NULL,
    index integer DEFAULT 0 NOT NULL,
    type character varying(32) NOT NULL,
    image jsonb DEFAULT '{}'::jsonb NOT NULL,
    generation_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    error jsonb,
    moderation jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);



--
--

CREATE TABLE public.image_generation_task (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    generation_task_id uuid,
    project_id character varying(50) NOT NULL,
    created_by uuid NOT NULL,
    type character varying(32) NOT NULL,
    scene_type character varying(32) NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    progress jsonb DEFAULT '{"total": 0, "failed": 0, "completed": 0, "percentage": 0, "currentStep": ""}'::jsonb NOT NULL,
    cost jsonb DEFAULT '{"currency": "CNY", "actualCost": 0, "estimatedCost": 0}'::jsonb NOT NULL,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    error jsonb,
    callback_url character varying(512),
    callback_payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    deleted_at timestamp with time zone
);



--
--

CREATE TABLE public.login_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    ip character varying(45) NOT NULL,
    user_agent text NOT NULL,
    device_type character varying(20) NOT NULL,
    login_type character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    fail_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--




--
--



--
--



--
--

CREATE TABLE public.model_adapter_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    model_id character varying(100) NOT NULL,
    provider_id character varying(50) NOT NULL,
    provider_model_id character varying(200) NOT NULL,
    api_path character varying(200) NOT NULL,
    request_method character varying(10) DEFAULT 'POST'::character varying NOT NULL,
    allowed_paths jsonb DEFAULT '[]'::jsonb NOT NULL,
    auth_type character varying(20) NOT NULL,
    auth_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_mapping jsonb NOT NULL,
    response_mapping jsonb NOT NULL,
    error_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    supports_streaming boolean DEFAULT false NOT NULL,
    supports_async boolean DEFAULT false NOT NULL,
    timeout_ms integer DEFAULT 30000 NOT NULL,
    retry_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'enabled'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.model_call_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    model_id character varying(100) NOT NULL,
    provider_id character varying(50) NOT NULL,
    request_id character varying(100) NOT NULL,
    status character varying(20) NOT NULL,
    response_time_ms integer,
    error_code character varying(50),
    error_message text,
    category character varying(50),
    token_usage jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.model_providers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    model_id character varying(100) NOT NULL,
    provider_id character varying(50) NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    provider_model_id character varying(200),
    status character varying(20) DEFAULT 'enabled'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.pricing_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pricing_id uuid NOT NULL,
    operator_id uuid NOT NULL,
    old_price numeric(10,2) NOT NULL,
    new_price numeric(10,2) NOT NULL,
    change_reason character varying(500),
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.project (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    cover_url character varying(500),
    owner_id uuid NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    previous_status character varying(20),
    version integer DEFAULT 1 NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp without time zone,
    deleted_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.project.project_id IS '项目唯一标识，如：proj_abc123';


--
--

COMMENT ON COLUMN public.project.name IS '项目名称（2-50字符）';


--
--

COMMENT ON COLUMN public.project.description IS '项目描述（最多500字符）';


--
--

COMMENT ON COLUMN public.project.cover_url IS '封面图URL';


--
--

COMMENT ON COLUMN public.project.owner_id IS '所有者用户ID';


--
--

COMMENT ON COLUMN public.project.status IS '状态：draft/active/completed/archived';


--
--

COMMENT ON COLUMN public.project.previous_status IS '归档前的状态，用于恢复';


--
--

COMMENT ON COLUMN public.project.version IS '乐观锁版本号';


--
--

COMMENT ON COLUMN public.project.is_deleted IS '是否软删除';


--
--

COMMENT ON COLUMN public.project.deleted_at IS '删除时间';


--
--

COMMENT ON COLUMN public.project.deleted_by IS '删除操作者ID';


--
--

CREATE TABLE public.project_invite_link (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id character varying(50) NOT NULL,
    invite_code character varying(32) NOT NULL,
    role character varying(20) NOT NULL,
    max_uses integer DEFAULT 1 NOT NULL,
    used_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    revoked_at timestamp without time zone,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.project_invite_link.project_id IS '项目ID';


--
--

COMMENT ON COLUMN public.project_invite_link.invite_code IS '邀请码';


--
--

COMMENT ON COLUMN public.project_invite_link.role IS '邀请角色：editor/viewer';


--
--

COMMENT ON COLUMN public.project_invite_link.max_uses IS '最大使用次数';


--
--

COMMENT ON COLUMN public.project_invite_link.used_count IS '已使用次数';


--
--

COMMENT ON COLUMN public.project_invite_link.expires_at IS '过期时间';


--
--

COMMENT ON COLUMN public.project_invite_link.revoked_at IS '撤销时间';


--
--

COMMENT ON COLUMN public.project_invite_link.created_by IS '创建者ID';


--
--

CREATE TABLE public.project_model_config (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id character varying(50) NOT NULL,
    category character varying(50) NOT NULL,
    model_id character varying(100),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.project_model_config.project_id IS '项目ID';


--
--

COMMENT ON COLUMN public.project_model_config.category IS '功能类别：TEXT_GENERATION/IMAGE_GENERATION/VIDEO_GENERATION/AUDIO_GENERATION';


--
--

COMMENT ON COLUMN public.project_model_config.model_id IS '模型ID，NULL表示使用用户默认';


--
--

CREATE TABLE public.project_template (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    template_id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    type character varying(20) NOT NULL,
    creator_id uuid,
    content jsonb NOT NULL,
    model_configs jsonb,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    status character varying(20) DEFAULT 'enabled'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.project_template.template_id IS '模板唯一标识';


--
--

COMMENT ON COLUMN public.project_template.name IS '模板名称';


--
--

COMMENT ON COLUMN public.project_template.description IS '模板描述';


--
--

COMMENT ON COLUMN public.project_template.type IS '类型：system/user';


--
--

COMMENT ON COLUMN public.project_template.creator_id IS '创建者ID，系统模板为NULL';


--
--

COMMENT ON COLUMN public.project_template.content IS '模板内容（角色、场景、剧本大纲等）';


--
--

COMMENT ON COLUMN public.project_template.model_configs IS '默认模型配置';


--
--

COMMENT ON COLUMN public.project_template.tags IS '标签列表';


--
--

COMMENT ON COLUMN public.project_template.usage_count IS '使用次数';


--
--

COMMENT ON COLUMN public.project_template.is_public IS '是否公开（仅用户模板有效）';


--
--

COMMENT ON COLUMN public.project_template.status IS '状态：enabled/disabled';


--
--

CREATE TABLE public.prop_images (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    prop_id uuid NOT NULL,
    type character varying(20) NOT NULL,
    url character varying(500) NOT NULL,
    thumbnail_url character varying(500),
    generation_info jsonb,
    upload_info jsonb,
    version integer DEFAULT 1 NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.prop_images.prop_id IS '关联道具ID';


--
--

COMMENT ON COLUMN public.prop_images.type IS '图片类型：front_view/side_view/top_view/additional';


--
--

COMMENT ON COLUMN public.prop_images.url IS '图片URL';


--
--

COMMENT ON COLUMN public.prop_images.thumbnail_url IS '缩略图URL';


--
--

COMMENT ON COLUMN public.prop_images.generation_info IS '生成信息（prompt, negative_prompt, model_id, seed, created_at）';


--
--

COMMENT ON COLUMN public.prop_images.upload_info IS '上传信息（original_filename, file_size, mime_type, uploaded_at）';


--
--

COMMENT ON COLUMN public.prop_images.version IS '版本号';


--
--

COMMENT ON COLUMN public.prop_images.is_current IS '是否为当前版本';


--
--

CREATE TABLE public.props (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    appearance jsonb,
    function character varying(200),
    importance character varying(20) DEFAULT 'background'::character varying NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    script_ref jsonb,
    import_info jsonb,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);



--
--

COMMENT ON COLUMN public.props.project_id IS '所属项目ID';


--
--

COMMENT ON COLUMN public.props.name IS '道具名称（项目内唯一）';


--
--

COMMENT ON COLUMN public.props.description IS '道具描述';


--
--

COMMENT ON COLUMN public.props.appearance IS '外观细节（color, material, size, condition, distinctive_features）';


--
--

COMMENT ON COLUMN public.props.function IS '道具功能/用途';


--
--

COMMENT ON COLUMN public.props.importance IS '重要性：key/secondary/background';


--
--

COMMENT ON COLUMN public.props.status IS '状态：draft/active/archived';


--
--

COMMENT ON COLUMN public.props.script_ref IS '剧本关联信息（script_id, extracted_at, scene_ids）';


--
--

COMMENT ON COLUMN public.props.import_info IS '跨项目导入信息';


--
--

COMMENT ON COLUMN public.props.created_by IS '创建者用户ID';


--
--

CREATE TABLE public.provider_health_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id character varying(50) NOT NULL,
    check_status character varying(20) NOT NULL,
    response_time_ms integer,
    status_code integer,
    error_message text,
    checked_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.providers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    provider_id character varying(50) NOT NULL,
    provider_name character varying(100) NOT NULL,
    provider_type character varying(20) NOT NULL,
    base_url character varying(500) NOT NULL,
    auth_type character varying(20) NOT NULL,
    api_key_enc text,
    api_secret_enc text,
    status character varying(20) DEFAULT 'enabled'::character varying NOT NULL,
    health_status character varying(20) DEFAULT 'unknown'::character varying NOT NULL,
    check_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    rate_limit_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    api_key_expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.quota_config (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tier character varying(20) NOT NULL,
    cycle_type character varying(10) NOT NULL,
    target_type character varying(20) NOT NULL,
    target_id character varying(50) NOT NULL,
    quota_value integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.quota_usage (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    quota_type character varying(10) NOT NULL,
    target_type character varying(20) NOT NULL,
    target_id character varying(50) NOT NULL,
    cycle_number bigint NOT NULL,
    amount integer NOT NULL,
    balance_after integer NOT NULL,
    reason character varying(50) NOT NULL,
    reference_id character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.recharge_order (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    credits integer NOT NULL,
    payment_method character varying(20) NOT NULL,
    payment_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    transaction_no character varying(100),
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.recharge_promotion (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(255),
    min_amount numeric(10,2) NOT NULL,
    bonus_type character varying(20) NOT NULL,
    bonus_value numeric(10,2) NOT NULL,
    max_bonus numeric(10,2),
    is_active boolean DEFAULT true NOT NULL,
    start_at timestamp with time zone,
    end_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.scene_images (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    scene_id uuid NOT NULL,
    type character varying(20) NOT NULL,
    variant_type character varying(20),
    variant_value character varying(20),
    url character varying(500) NOT NULL,
    thumbnail_url character varying(500),
    generation_info jsonb,
    upload_info jsonb,
    version integer DEFAULT 1 NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.scene_images.scene_id IS '关联场景ID';


--
--

COMMENT ON COLUMN public.scene_images.type IS '图片类型：panorama/wide_shot/detail/variant/additional';


--
--

COMMENT ON COLUMN public.scene_images.variant_type IS '变体类型：time_of_day/weather';


--
--

COMMENT ON COLUMN public.scene_images.variant_value IS '变体值';


--
--

COMMENT ON COLUMN public.scene_images.url IS '图片URL';


--
--

COMMENT ON COLUMN public.scene_images.thumbnail_url IS '缩略图URL';


--
--

COMMENT ON COLUMN public.scene_images.generation_info IS '生成信息（prompt, negative_prompt, model_id, seed, created_at）';


--
--

COMMENT ON COLUMN public.scene_images.upload_info IS '上传信息（original_filename, file_size, mime_type, uploaded_at）';


--
--

COMMENT ON COLUMN public.scene_images.version IS '版本号';


--
--

COMMENT ON COLUMN public.scene_images.is_current IS '是否为当前版本';


--
--

CREATE TABLE public.scenes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    type character varying(20) DEFAULT 'interior'::character varying NOT NULL,
    space jsonb,
    visuals jsonb,
    atmosphere jsonb,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    script_ref jsonb,
    import_info jsonb,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);



--
--

COMMENT ON COLUMN public.scenes.project_id IS '所属项目ID';


--
--

COMMENT ON COLUMN public.scenes.name IS '场景名称（项目内唯一）';


--
--

COMMENT ON COLUMN public.scenes.description IS '场景描述';


--
--

COMMENT ON COLUMN public.scenes.type IS '场景类型：interior/exterior/both';


--
--

COMMENT ON COLUMN public.scenes.space IS '空间属性（size, layout, key_areas）';


--
--

COMMENT ON COLUMN public.scenes.visuals IS '视觉属性（primary_color, lighting, lighting_mood）';


--
--

COMMENT ON COLUMN public.scenes.atmosphere IS '氛围属性（time_of_day, weather, mood）';


--
--

COMMENT ON COLUMN public.scenes.status IS '状态：draft/active/archived';


--
--

COMMENT ON COLUMN public.scenes.script_ref IS '剧本关联信息（script_id, extracted_at）';


--
--

COMMENT ON COLUMN public.scenes.import_info IS '跨项目导入信息';


--
--

COMMENT ON COLUMN public.scenes.created_by IS '创建者用户ID';


--
--

CREATE TABLE public.scripts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id character varying(50) NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    title character varying(100) NOT NULL,
    description text,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    content jsonb NOT NULL,
    metadata jsonb NOT NULL,
    confirmed_at timestamp without time zone,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);



--
--

COMMENT ON COLUMN public.scripts.project_id IS '所属项目ID';


--
--

COMMENT ON COLUMN public.scripts.version IS '乐观锁版本号';


--
--

COMMENT ON COLUMN public.scripts.title IS '剧本标题';


--
--

COMMENT ON COLUMN public.scripts.description IS '剧本描述';


--
--

COMMENT ON COLUMN public.scripts.status IS '状态：draft/editing/ai_generating/confirmed';


--
--

COMMENT ON COLUMN public.scripts.content IS '剧本内容（acts, characters, scenes, props, summary）';


--
--

COMMENT ON COLUMN public.scripts.metadata IS '元数据（genre, tone, word_count, asset_summary 等）';


--
--

COMMENT ON COLUMN public.scripts.confirmed_at IS '确认时间';


--
--

COMMENT ON COLUMN public.scripts.created_by IS '创建者用户ID';


--
--

CREATE TABLE public.subscription (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    tier character varying(20) DEFAULT 'free'::character varying NOT NULL,
    period character varying(10) DEFAULT 'monthly'::character varying NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    started_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    auto_renew boolean DEFAULT true NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.subscription_pricing (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tier character varying(20) NOT NULL,
    period character varying(10) NOT NULL,
    price numeric(10,2) NOT NULL,
    original_price numeric(10,2),
    is_active boolean DEFAULT true NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid NOT NULL
);



--
--

CREATE TABLE public.system_config (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    config_key character varying(100) NOT NULL,
    config_value jsonb NOT NULL,
    description character varying(255),
    updated_by uuid,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.system_config.config_key IS '配置键';


--
--

COMMENT ON COLUMN public.system_config.config_value IS '配置值（JSON格式）';


--
--

COMMENT ON COLUMN public.system_config.description IS '配置说明';


--
--

CREATE TABLE public.system_notices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(200) NOT NULL,
    content text NOT NULL,
    type public.system_notices_type_enum DEFAULT 'other'::public.system_notices_type_enum NOT NULL,
    priority public.system_notices_priority_enum DEFAULT 'medium'::public.system_notices_priority_enum NOT NULL,
    status public.system_notices_status_enum DEFAULT 'draft'::public.system_notices_status_enum NOT NULL,
    start_at timestamp without time zone NOT NULL,
    end_at timestamp without time zone,
    is_top boolean DEFAULT false NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);



--
--

CREATE TABLE public.text_gen_quota_record (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    task_id uuid NOT NULL,
    estimated_tokens integer NOT NULL,
    actual_tokens integer DEFAULT 0 NOT NULL,
    estimated_amount numeric(10,4) NOT NULL,
    actual_amount numeric(10,4) DEFAULT '0'::numeric NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    deducted_from character varying(20),
    quota_usage_id uuid,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone,
    refunded_at timestamp with time zone,
    refund_reason character varying(500)
);



--
--

CREATE TABLE public.tts_instruction_template (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    category character varying(50),
    content text NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.tts_instruction_template.name IS '模板名称';


--
--

COMMENT ON COLUMN public.tts_instruction_template.description IS '模板描述';


--
--

COMMENT ON COLUMN public.tts_instruction_template.category IS '分类：emotion, style, scene, speed';


--
--

COMMENT ON COLUMN public.tts_instruction_template.content IS '指令内容';


--
--

COMMENT ON COLUMN public.tts_instruction_template.is_system IS '是否系统模板（不可删除）';


--
--

COMMENT ON COLUMN public.tts_instruction_template.is_active IS '是否启用';


--
--

CREATE TABLE public.tts_voice (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    voice_id character varying(100) NOT NULL,
    name character varying(100) NOT NULL,
    gender character varying(20) NOT NULL,
    category character varying(50),
    style character varying(100),
    preview_audio_url text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.tts_voice.voice_id IS '千问 TTS 音色 ID，如 Cherry, Ethan';


--
--

COMMENT ON COLUMN public.tts_voice.name IS '显示名称，如 芊悦, 晨煦';


--
--

COMMENT ON COLUMN public.tts_voice.gender IS '性别：female, male, child';


--
--

COMMENT ON COLUMN public.tts_voice.category IS '分类：standard, dialect';


--
--

COMMENT ON COLUMN public.tts_voice.style IS '风格描述';


--
--

COMMENT ON COLUMN public.tts_voice.preview_audio_url IS '试听音频 URL';


--
--

COMMENT ON COLUMN public.tts_voice.is_active IS '是否启用';


--
--

COMMENT ON COLUMN public.tts_voice.sort_order IS '排序';


--
--

CREATE TABLE public.user_ban_record (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    banned_by uuid NOT NULL,
    reason character varying(255) NOT NULL,
    duration_days integer NOT NULL,
    banned_at timestamp without time zone DEFAULT now() NOT NULL,
    unbanned_by uuid,
    unbanned_at timestamp without time zone,
    unban_reason character varying(255)
);



--
--

COMMENT ON COLUMN public.user_ban_record.user_id IS '被封禁用户ID';


--
--

COMMENT ON COLUMN public.user_ban_record.banned_by IS '操作管理员ID';


--
--

COMMENT ON COLUMN public.user_ban_record.reason IS '封禁原因';


--
--

COMMENT ON COLUMN public.user_ban_record.duration_days IS '封禁时长（-1表示永久）';


--
--

COMMENT ON COLUMN public.user_ban_record.unbanned_by IS '解封操作人';


--
--

COMMENT ON COLUMN public.user_ban_record.unbanned_at IS '解封时间';


--
--

COMMENT ON COLUMN public.user_ban_record.unban_reason IS '解封原因';


--
--

CREATE TABLE public.user_favorite (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    asset_type character varying(20) NOT NULL,
    asset_id uuid NOT NULL,
    asset_snapshot jsonb NOT NULL,
    tags character varying[] DEFAULT '{}'::character varying[] NOT NULL,
    favorited_at timestamp with time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.user_recent (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    asset_type character varying(20) NOT NULL,
    asset_id uuid NOT NULL,
    action character varying(20) NOT NULL,
    context jsonb,
    used_at timestamp with time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(20) NOT NULL,
    phone character varying(11) NOT NULL,
    email character varying(255),
    email_verified boolean DEFAULT false NOT NULL,
    password_hash character varying(255) NOT NULL,
    avatar character varying(500),
    avatar_key character varying(255),
    bio text,
    perms integer DEFAULT 0 NOT NULL,
    subscription_tier character varying(20) DEFAULT 'free'::character varying NOT NULL,
    subscription_expires_at timestamp without time zone,
    subscription_quota jsonb DEFAULT '{}'::jsonb NOT NULL,
    default_models jsonb DEFAULT '{}'::jsonb NOT NULL,
    balance numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    balance_limit numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    is_banned boolean DEFAULT false NOT NULL,
    banned_reason text,
    banned_at timestamp without time zone,
    phone_changed_at timestamp without time zone,
    last_login_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

CREATE TABLE public.video_gen_quota_record (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    task_id uuid NOT NULL,
    batch_id uuid,
    estimated_amount integer NOT NULL,
    actual_amount integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    deducted_from character varying(20),
    quota_usage_id uuid,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone,
    refunded_at timestamp with time zone,
    refund_reason character varying(500)
);



--
--

CREATE TABLE public.video_generation_batch (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id character varying(50) NOT NULL,
    created_by uuid NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    stats jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone
);



--
--

COMMENT ON COLUMN public.video_generation_batch.project_id IS '所属项目ID';


--
--

COMMENT ON COLUMN public.video_generation_batch.created_by IS '创建者用户ID';


--
--

COMMENT ON COLUMN public.video_generation_batch.config IS '批次配置（total_count, common_config）';


--
--

COMMENT ON COLUMN public.video_generation_batch.stats IS '进度统计（total, completed, failed, pending）';


--
--

COMMENT ON COLUMN public.video_generation_batch.status IS '批次状态：pending / processing / completed / partial_failed / failed';


--
--

COMMENT ON COLUMN public.video_generation_batch.completed_at IS '完成时间';


--
--

CREATE TABLE public.video_generation_output (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_id uuid NOT NULL,
    type character varying(20) NOT NULL,
    file jsonb DEFAULT '{}'::jsonb NOT NULL,
    generation_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    moderation jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);



--
--

COMMENT ON COLUMN public.video_generation_output.task_id IS '关联任务ID';


--
--

COMMENT ON COLUMN public.video_generation_output.type IS '输出类型：video / audio / preview';


--
--

COMMENT ON COLUMN public.video_generation_output.file IS '文件信息（url, thumbnail_url, format, resolution, duration, size）';


--
--

COMMENT ON COLUMN public.video_generation_output.generation_params IS '生成参数快照（model_id, reference_mode, video_mode, resolution）';


--
--

COMMENT ON COLUMN public.video_generation_output.moderation IS '审核状态（status, checked_at, reject_reason）';


--
--

CREATE TABLE public.video_generation_task (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    generation_task_id uuid,
    project_id character varying(50) NOT NULL,
    shot_id character varying(50) NOT NULL,
    created_by uuid NOT NULL,
    type character varying(20) DEFAULT 'single'::character varying NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    progress jsonb DEFAULT '{}'::jsonb NOT NULL,
    cost jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    error jsonb,
    callback_url character varying(512),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    deleted_at timestamp without time zone,
    quota_record_id uuid
);



--
--

COMMENT ON COLUMN public.video_generation_task.generation_task_id IS '关联 generation 模块的任务ID';


--
--

COMMENT ON COLUMN public.video_generation_task.project_id IS '所属项目ID';


--
--

COMMENT ON COLUMN public.video_generation_task.shot_id IS '关联分镜ID（如 shot_0, shot_1）';


--
--

COMMENT ON COLUMN public.video_generation_task.created_by IS '创建者用户ID';


--
--

COMMENT ON COLUMN public.video_generation_task.type IS '任务类型：single / batch';


--
--

COMMENT ON COLUMN public.video_generation_task.config IS '生成配置（reference_mode, video_mode, model_id, shot_data, output_config）';


--
--

COMMENT ON COLUMN public.video_generation_task.progress IS '进度信息（current_step, percentage, steps）';


--
--

COMMENT ON COLUMN public.video_generation_task.cost IS '成本信息（estimated_cost, actual_cost, currency）';


--
--

COMMENT ON COLUMN public.video_generation_task.status IS '任务状态：pending / queued / generating / completed / failed / cancelled';


--
--

COMMENT ON COLUMN public.video_generation_task.error IS '错误信息（code, message, step, details）';


--
--

COMMENT ON COLUMN public.video_generation_task.callback_url IS '回调地址';


--
--

COMMENT ON COLUMN public.video_generation_task.started_at IS '开始时间';


--
--

COMMENT ON COLUMN public.video_generation_task.completed_at IS '完成时间';


--
--

COMMENT ON COLUMN public.video_generation_task.quota_record_id IS '关联额度扣减记录ID';


--
--



--
--

ALTER TABLE ONLY public.ai_provider_config
    ADD CONSTRAINT "PK_0137ac10761a3fcc762e538dad2" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.video_gen_quota_record
    ADD CONSTRAINT "PK_0470f67da87c9ad8489b4e9e4cb" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.video_generation_output
    ADD CONSTRAINT "PK_0589dab555fbc832c1ed106a2da" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.scenes
    ADD CONSTRAINT "PK_071fd0f410cbb449feebafd46ac" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.pricing_history
    ADD CONSTRAINT "PK_07a306b951b2edd2dd01101aeb8" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.props
    ADD CONSTRAINT "PK_0c393da1e53e9ad733b617d951d" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.ai_task
    ADD CONSTRAINT "PK_0f3c66f4209ef2366df516eb232" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.text_gen_quota_record
    ADD CONSTRAINT "PK_129e00396adaae077270d97dcd9" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.login_logs
    ADD CONSTRAINT "PK_15f7b02ad55d5ba905b2962ebab" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.ai_task_models
    ADD CONSTRAINT "PK_1a767af570f46213fed4609320a" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.quota_usage
    ADD CONSTRAINT "PK_1bc1fffc9cecf83b76be9b4b51a" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.video_generation_task
    ADD CONSTRAINT "PK_25c0ce7b8293958005425dce01c" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.tts_voice
    ADD CONSTRAINT "PK_27400c184da24eeef6f846350d4" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.scene_images
    ADD CONSTRAINT "PK_36a8f5a663d703e036e891cba86" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.balance_record
    ADD CONSTRAINT "PK_36a9433f9617021402ede6dbd09" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.cleanup_queue
    ADD CONSTRAINT "PK_3843e406838a54b3b26f8402138" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.scripts
    ADD CONSTRAINT "PK_399d1c469ffd6bac4e061e5fd8c" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.recharge_promotion
    ADD CONSTRAINT "PK_3cb0ab82777cc5728cd7b1a5df7" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT "PK_3d254744f0bcf6f35be5826e25e" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.project_template
    ADD CONSTRAINT "PK_41cf7a5f5e816a0c36f494283b4" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.character_images
    ADD CONSTRAINT "PK_48655edbbdea8b22930ebc9098f" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.recharge_order
    ADD CONSTRAINT "PK_491ed5b79879124207d20834a80" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT "PK_4d68b1358bb5b766d3e78f32f57" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.project_model_config
    ADD CONSTRAINT "PK_0036de28666b0b32cc11236d188" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.video_generation_batch
    ADD CONSTRAINT "PK_53910267d1d647c0a8587bd783e" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.model_providers
    ADD CONSTRAINT "PK_5620fd1368e2e8c95bc1a6c3337" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.project_invite_link
    ADD CONSTRAINT "PK_56ac0e22e7e8e48686ad8a4dfa1" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.audio_generation_task
    ADD CONSTRAINT "PK_5d7d606c3c45df1445f576590d3" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.subscription_pricing
    ADD CONSTRAINT "PK_616fb39163fbc2b0b9a366f9a3f" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.ai_task_result
    ADD CONSTRAINT "PK_6e7ac009285446344628fd2238a" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.model_adapter_configs
    ADD CONSTRAINT "PK_84bc56bf04d94c00163aacaf799" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT "PK_8c3e00ebd02103caa1174cd5d9d" PRIMARY KEY (id);


--
--



--
--

ALTER TABLE ONLY public.prop_images
    ADD CONSTRAINT "PK_92220e40f251b363d20a31b6af0" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.asset_import_log
    ADD CONSTRAINT "PK_92b82fb99e22835fd0214a26207" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.system_notices
    ADD CONSTRAINT "PK_94d3659ff6794c6d255d89b610a" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.quota_config
    ADD CONSTRAINT "PK_992ac4a2a4879abc6021a9a151b" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.provider_health_logs
    ADD CONSTRAINT "PK_9a27259d6aac4c67055736ba191" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT "PK_9d731e05758f26b9315dac5e378" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.admin_operation_log
    ADD CONSTRAINT "PK_a12854d776b3734e3eaaf76f298" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.file_reference
    ADD CONSTRAINT "PK_a2245d83c292eed119f2c41e07b" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.collaborator
    ADD CONSTRAINT "PK_aa48142926d7bdb485d21ad2696" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.model_call_logs
    ADD CONSTRAINT "PK_ad44dc79436d13184417468a56e" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT "PK_af13fc2ebf382fe0dad2e4793aa" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.audio_generation_output
    ADD CONSTRAINT "PK_b10993ecf55b0667b8bc6595569" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.asset_cross_project_refs
    ADD CONSTRAINT "PK_c79c61d6dbe0738918044061f14" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.user_recent
    ADD CONSTRAINT "PK_cb9295b298f92d8b7de2d6fff64" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.tts_instruction_template
    ADD CONSTRAINT "PK_d1c0ff37f93f9f47d534fc5f3c4" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.ai_tasks
    ADD CONSTRAINT "PK_d5885f99508841410eeaeb87163" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT "PK_db4e70ac0d27e588176e9bb44a0" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.user_favorite
    ADD CONSTRAINT "PK_e161413fbdd7d2592f727858739" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.user_ban_record
    ADD CONSTRAINT "PK_e2277418d69dcaad0e1bdebcb34" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.image_generation_task
    ADD CONSTRAINT "PK_f048b0fd94ffe9a1929cbb17551" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.asset_stats
    ADD CONSTRAINT "PK_f6e2765aea8c9cbfe8f59551b74" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.image_generation_result
    ADD CONSTRAINT "PK_f97297c2f986c00bcc72e549bdc" PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT "UQ_0a3aa499a85ecda140aa103ff27" UNIQUE (model_id);


--
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT "UQ_1a480c5734c5aacb9cef7b1499d" UNIQUE (project_id);


--
--

ALTER TABLE ONLY public.project_template
    ADD CONSTRAINT "UQ_43311b56a05e202679f5847606c" UNIQUE (template_id);


--
--

ALTER TABLE ONLY public.file_reference
    ADD CONSTRAINT "UQ_5af7b229f51745d38c89829a3dd" UNIQUE (file_url);


--
--

ALTER TABLE ONLY public.project_invite_link
    ADD CONSTRAINT "UQ_68d572ebf5990eb39178695a40d" UNIQUE (invite_code);


--
--

ALTER TABLE ONLY public.ai_task_result
    ADD CONSTRAINT "UQ_87c2eec1cd58100c6b8a6f1a261" UNIQUE (task_id);


--
--

ALTER TABLE ONLY public.ai_task
    ADD CONSTRAINT "UQ_921692516bceba61833e5753345" UNIQUE (task_id);


--
--

ALTER TABLE ONLY public.ai_task_models
    ADD CONSTRAINT "UQ_9301d86bc8d01e0698196f9eeeb" UNIQUE (model_id);


--
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);


--
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE (phone);


--
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT "UQ_c54d4e3d5a246ef29601e48d751" UNIQUE (config_key);


--
--

ALTER TABLE ONLY public.ai_provider_config
    ADD CONSTRAINT "UQ_e358a73d48f0550e6ad8f2d8a62" UNIQUE (provider);


--
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT "UQ_e5f817b362ee59803255e347fae" UNIQUE (provider_id);


--
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE (username);


--
--

ALTER TABLE ONLY public.subscription_pricing
    ADD CONSTRAINT idx_subscription_pricing_tier_period UNIQUE (tier, period);


--
--

CREATE INDEX "IDX_06c927befe0b4354dadb94fa47" ON public.ai_models USING btree (category);


--
--

CREATE INDEX "IDX_07809f1f68271a7dde947dec4e" ON public.user_recent USING btree (user_id, action, used_at);


--
--

CREATE INDEX "IDX_078394cac46d63df7607eb2f8a" ON public.login_logs USING btree (created_at);


--
--

CREATE UNIQUE INDEX "IDX_0a3aa499a85ecda140aa103ff2" ON public.ai_models USING btree (model_id);


--
--

CREATE INDEX "IDX_0ba2d40676506598e635b3cc2b" ON public.quota_config USING btree (tier, cycle_type, is_active);


--
--

CREATE INDEX "IDX_0c0b7323c2501d4395b3c8b602" ON public.recharge_order USING btree (user_id, created_at);


--
--

CREATE INDEX "IDX_13d9a61f3237599cf36154a381" ON public.video_gen_quota_record USING btree (task_id);


--
--

CREATE INDEX "IDX_144684d85ce96a94d139d40773" ON public.ai_models USING btree (min_tier);


--
--

CREATE INDEX "IDX_17193c01727941f98892e0a1e5" ON public.recharge_promotion USING btree (is_active, start_at, end_at);


--
--

CREATE INDEX "IDX_1b76d2a6df1af7f8646fce5e92" ON public.model_adapter_configs USING btree (status);


--
--

CREATE UNIQUE INDEX "IDX_1fb124e4b8582463bc9fbeef37" ON public.tts_voice USING btree (voice_id);


--
--

CREATE INDEX "IDX_28146efb53daaac82f496e4ab7" ON public.providers USING btree (health_status);


--
--

CREATE INDEX "IDX_2850ad294d7cefc31e633b2ff8" ON public.user_recent USING btree (asset_type, asset_id, used_at);


--
--

CREATE INDEX "IDX_2a738690b6acc4fbe30b169993" ON public.provider_health_logs USING btree (provider_id);


--
--

CREATE INDEX "IDX_3dceb9ebed5144e5b649cb295d" ON public.recharge_order USING btree (payment_status);


--
--

CREATE INDEX "IDX_571f75657eab6c68fcd3e0085a" ON public.asset_import_log USING btree (target_project_id, imported_at);


--
--

CREATE INDEX "IDX_5ede9efea00e6a4bfc64dcd7e7" ON public.model_providers USING btree (provider_id);


--
--

CREATE INDEX "IDX_61ad98856b9a9e88030d66a53d" ON public.model_call_logs USING btree (model_id, created_at);


--
--

CREATE INDEX "IDX_6213939e422ce5024fa80e462a" ON public.quota_config USING btree (target_type, target_id);


--
--

CREATE INDEX "IDX_62cf9a823e7a8f61a014a95a43" ON public.video_gen_quota_record USING btree (user_id, created_at);


--
--

CREATE INDEX "IDX_6593f0a29bc5f2d265e519e20c" ON public.subscription USING btree (expires_at);


--
--

CREATE UNIQUE INDEX "IDX_65cbf5fcb331619593ee334c7c" ON public.users USING btree (email) WHERE (email IS NOT NULL);


--
--

CREATE INDEX "IDX_6ee6ec932414aed107cfdf8917" ON public.text_gen_quota_record USING btree (task_id);


--
--

CREATE INDEX "IDX_724e3673bd40b774404262f14e" ON public.model_adapter_configs USING btree (provider_id);


--
--

CREATE INDEX "IDX_73c8f3e1319881c1227eb86687" ON public.model_call_logs USING btree (provider_id, created_at);


--
--

CREATE INDEX "IDX_75430b7ff8a2d64cb4cca2af90" ON public.model_call_logs USING btree (status);


--
--

CREATE INDEX "IDX_773cc55f341adda647a622b9f0" ON public.model_call_logs USING btree (created_at);


--
--

CREATE UNIQUE INDEX "IDX_78cbcdb913bab9b3ec7d9a3a1a" ON public.model_adapter_configs USING btree (model_id, provider_id);


--
--

CREATE INDEX "IDX_7a88e14929ac109f3d66f76b28" ON public.system_notices USING btree (status, start_at, end_at);


--
--

CREATE INDEX "IDX_7d576a1dc563494e7456d61278" ON public.ai_models USING btree (status);


--
--

CREATE INDEX "IDX_87220d2a0d0c6ddfceee48e928" ON public.asset_stats USING btree (project_id, asset_type);


--
--

CREATE INDEX "IDX_884a3b21df876e09ea2ae0fc8a" ON public.text_gen_quota_record USING btree (user_id, created_at);


--
--

CREATE INDEX "IDX_8e12374724d118f2574e636a45" ON public.file_reference USING btree (ref_count, updated_at);


--
--

CREATE INDEX "IDX_931138b7c34d7885579a74c716" ON public.video_gen_quota_record USING btree (status);


--
--

CREATE INDEX "IDX_940d49a105d50bbd616be54001" ON public.subscription USING btree (user_id);


--
--

CREATE INDEX "IDX_944f71468e89554380d6c0d197" ON public.subscription USING btree (status);


--
--

CREATE INDEX "IDX_94c77af47d4c43a5ffec4e86cc" ON public.text_gen_quota_record USING btree (status);


--
--

CREATE INDEX "IDX_9d4ba152b196d719c67a8e2940" ON public.model_providers USING btree (model_id, priority);


--
--

CREATE INDEX "IDX_9e05f5fb40a3346113b6bc5cc4" ON public.providers USING btree (provider_type);


--
--

CREATE UNIQUE INDEX "IDX_a000cca60bcf04454e72769949" ON public.users USING btree (phone);


--
--

CREATE INDEX "IDX_ad5e37d4fc3ce496c5c762aac0" ON public.recharge_order USING btree (transaction_no);


--
--

CREATE INDEX "IDX_aecbb18f82919642b396655204" ON public.provider_health_logs USING btree (provider_id, checked_at);


--
--

CREATE INDEX "IDX_afd4afbecdf050dddf0a34f2d3" ON public.model_providers USING btree (model_id);


--
--

CREATE INDEX "IDX_bf88011579ecf0b985e1fda1e6" ON public.asset_stats USING btree (heat_score);


--
--

CREATE INDEX "IDX_c0aac2e2302675a000eb0bc1be" ON public.ai_models USING btree (category, is_default);


--
--

CREATE INDEX "IDX_c2df851a112f2d78f061bc0411" ON public.quota_usage USING btree (user_id, cycle_number);


--
--

CREATE INDEX "IDX_c320db474b9a91230330b65895" ON public.system_notices USING btree (priority, start_at);


--
--

CREATE INDEX "IDX_c5a4b1bf2c6aedd90712fd438c" ON public.balance_record USING btree (user_id, created_at);


--
--

CREATE INDEX "IDX_d12c8bc22632b8953ac7074856" ON public.asset_import_log USING btree (source_project_id, source_asset_id);


--
--

CREATE INDEX "IDX_d1ae106343d4bc98bf59be8d01" ON public.asset_import_log USING btree (imported_by, imported_at);


--
--

CREATE INDEX "IDX_d1cd1ddb92f65d7a383df12666" ON public.user_recent USING btree (user_id, used_at);


--
--

CREATE UNIQUE INDEX "IDX_d7f51f7b0b0cb90cee94e3814c" ON public.user_favorite USING btree (user_id, asset_type, asset_id);


--
--

CREATE INDEX "IDX_d8b03cb9f1e6d7768eeeb145cb" ON public.model_adapter_configs USING btree (model_id);


--
--

CREATE INDEX "IDX_da3d2121687d25c9082cbb0477" ON public.quota_usage USING btree (target_type, target_id);


--
--

CREATE INDEX "IDX_deb0fefbfaf525586f18fef4c1" ON public.provider_health_logs USING btree (checked_at);


--
--

CREATE INDEX "IDX_e0fc818fbf9f1beca06f05f373" ON public.providers USING btree (status);


--
--

CREATE INDEX "IDX_e2dffa109d0d3dbd94a0a51669" ON public.login_logs USING btree (user_id);


--
--

CREATE INDEX "IDX_e3ec347484ea914a4ea5af93d8" ON public.balance_record USING btree (type);


--
--

CREATE UNIQUE INDEX "IDX_e5f817b362ee59803255e347fa" ON public.providers USING btree (provider_id);


--
--

CREATE INDEX "IDX_ebcc99f1d411372fd010d46e02" ON public.quota_usage USING btree (created_at);


--
--

CREATE UNIQUE INDEX "IDX_ee6444a2c4491258851d409f3d" ON public.asset_stats USING btree (asset_type, asset_id);


--
--

CREATE UNIQUE INDEX "IDX_f6792410adba147640eab87686" ON public.model_providers USING btree (model_id) WHERE (is_primary = true);


--
--

CREATE UNIQUE INDEX "IDX_fe0bb3f6520ee0469504521e71" ON public.users USING btree (username);


--
--

CREATE INDEX "IDX_fef235e9e3de3f0054eda9db07" ON public.asset_stats USING btree (last_used_at);


--
--

CREATE INDEX idx_pricing_history_changed_at ON public.pricing_history USING btree (changed_at);


--
--

CREATE INDEX idx_pricing_history_operator_id ON public.pricing_history USING btree (operator_id);


--
--

CREATE INDEX idx_pricing_history_pricing_id ON public.pricing_history USING btree (pricing_id);


--
--

CREATE INDEX idx_subscription_pricing_active ON public.subscription_pricing USING btree (is_active);


--
--

ALTER TABLE ONLY public.ai_tasks
    ADD CONSTRAINT "FK_142a21409c9cc93da9a6cd01414" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.ai_tasks
    ADD CONSTRAINT "FK_143542a660dac60875267346b70" FOREIGN KEY (script_id) REFERENCES public.scripts(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.user_ban_record
    ADD CONSTRAINT "FK_1b0de95ef7daf7ccfb9d3a05602" FOREIGN KEY (banned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
--

ALTER TABLE ONLY public.collaborator
    ADD CONSTRAINT "FK_2b516ff163b9e85cb9adecc76c8" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.project_invite_link
    ADD CONSTRAINT "FK_4aa4e2d09be1c4e52aa2beb2962" FOREIGN KEY (project_id) REFERENCES public.project(project_id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.user_ban_record
    ADD CONSTRAINT "FK_530382d06fc244e2c6430ffb0e3" FOREIGN KEY (unbanned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
--

ALTER TABLE ONLY public.scripts
    ADD CONSTRAINT "FK_57cc0b9c87f44686c1ee338a4a3" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT "FK_674473bbaa9859ba7e7d9f7ea9e" FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
--

ALTER TABLE ONLY public.cleanup_queue
    ADD CONSTRAINT "FK_750adc98483e110348e5f34ebcf" FOREIGN KEY (project_id) REFERENCES public.project(project_id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT "FK_87284666e889257bb112d64bff7" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.ai_task_result
    ADD CONSTRAINT "FK_87c2eec1cd58100c6b8a6f1a261" FOREIGN KEY (task_id) REFERENCES public.ai_task(task_id);


--
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT "FK_91847b6c2b347e7d4954fe82f1d" FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
--

ALTER TABLE ONLY public.user_ban_record
    ADD CONSTRAINT "FK_a512476e9fed25d9796d9cd3716" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.project_model_config
    ADD CONSTRAINT "FK_a5ca0ad5acd06774b7d4ad65a78" FOREIGN KEY (model_id) REFERENCES public.ai_models(model_id) ON DELETE SET NULL;


--
--

ALTER TABLE ONLY public.ai_task
    ADD CONSTRAINT "FK_a91372bb14a79404391fb1f8170" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.video_generation_batch
    ADD CONSTRAINT "FK_ac74bb3b51da794ebb2b9fbfe4c" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.project_model_config
    ADD CONSTRAINT "FK_b1c77796035b69da2fa6dbfb3ac" FOREIGN KEY (project_id) REFERENCES public.project(project_id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.character_images
    ADD CONSTRAINT "FK_b6fad460ddd6bf93af9edb9f124" FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.project_template
    ADD CONSTRAINT "FK_ba5bf44c9d9dca68b98bb013f5d" FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
--

ALTER TABLE ONLY public.image_generation_result
    ADD CONSTRAINT "FK_c00d4f9f0ba84e93f5c3c12e362" FOREIGN KEY (task_id) REFERENCES public.image_generation_task(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.pricing_history
    ADD CONSTRAINT "FK_c4b3de32c8ad7e805b8acae8e84" FOREIGN KEY (pricing_id) REFERENCES public.subscription_pricing(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.asset_cross_project_refs
    ADD CONSTRAINT "FK_c93c7467740ffbf0f9123cce3a7" FOREIGN KEY (script_id) REFERENCES public.scripts(id) ON DELETE SET NULL;


--
--

ALTER TABLE ONLY public.scene_images
    ADD CONSTRAINT "FK_cdcd835274e015f39a7a81a7650" FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.admin_operation_log
    ADD CONSTRAINT "FK_cffa582fa7965df8afeec214f90" FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT "FK_d40afe32d1d771bea7a5f468185" FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.collaborator
    ADD CONSTRAINT "FK_d807c29a28265cf9fe594bf0c14" FOREIGN KEY (project_id) REFERENCES public.project(project_id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.system_notices
    ADD CONSTRAINT "FK_d84f02f9997b80b089d3afbb96f" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
--

ALTER TABLE ONLY public.props
    ADD CONSTRAINT "FK_de8afe31b6cb5be6249b7d6bc82" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.scenes
    ADD CONSTRAINT "FK_e37841cec1f02d853ec81330072" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.asset_cross_project_refs
    ADD CONSTRAINT "FK_e62c16cf3003848fe183a59495e" FOREIGN KEY (copied_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.video_generation_output
    ADD CONSTRAINT "FK_ea764715e7f2e3e193262a836a4" FOREIGN KEY (task_id) REFERENCES public.video_generation_task(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.audio_generation_output
    ADD CONSTRAINT "FK_ec33504c46045add7bcd3c38028" FOREIGN KEY (task_id) REFERENCES public.audio_generation_task(id);


--
--

ALTER TABLE ONLY public.project_invite_link
    ADD CONSTRAINT "FK_ee60884e12733848ef4d0880fdd" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.collaborator
    ADD CONSTRAINT "FK_f52d4afafec0f290267320c9536" FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
--

ALTER TABLE ONLY public.prop_images
    ADD CONSTRAINT "FK_fa28dd7db8e54c7ced322b38338" FOREIGN KEY (prop_id) REFERENCES public.props(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.video_generation_task
    ADD CONSTRAINT "FK_fc3216b50c5d8ab5bedfa3e77ac" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--



    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 按依赖逆序删除所有表（CASCADE 自动处理外键依赖）
    await queryRunner.query(`
    DROP TABLE IF EXISTS "video_generation_task" CASCADE;
    DROP TABLE IF EXISTS "video_generation_output" CASCADE;
    DROP TABLE IF EXISTS "video_generation_batch" CASCADE;
    DROP TABLE IF EXISTS "video_gen_quota_record" CASCADE;
    DROP TABLE IF EXISTS "users" CASCADE;
    DROP TABLE IF EXISTS "user_recent" CASCADE;
    DROP TABLE IF EXISTS "user_favorite" CASCADE;
    DROP TABLE IF EXISTS "user_ban_record" CASCADE;
    DROP TABLE IF EXISTS "tts_voice" CASCADE;
    DROP TABLE IF EXISTS "tts_instruction_template" CASCADE;
    DROP TABLE IF EXISTS "text_gen_quota_record" CASCADE;
    DROP TABLE IF EXISTS "system_notices" CASCADE;
    DROP TABLE IF EXISTS "system_config" CASCADE;
    DROP TABLE IF EXISTS "subscription_pricing" CASCADE;
    DROP TABLE IF EXISTS "subscription" CASCADE;
    DROP TABLE IF EXISTS "scripts" CASCADE;
    DROP TABLE IF EXISTS "scenes" CASCADE;
    DROP TABLE IF EXISTS "scene_images" CASCADE;
    DROP TABLE IF EXISTS "recharge_promotion" CASCADE;
    DROP TABLE IF EXISTS "recharge_order" CASCADE;
    DROP TABLE IF EXISTS "quota_usage" CASCADE;
    DROP TABLE IF EXISTS "quota_config" CASCADE;
    DROP TABLE IF EXISTS "providers" CASCADE;
    DROP TABLE IF EXISTS "provider_health_logs" CASCADE;
    DROP TABLE IF EXISTS "props" CASCADE;
    DROP TABLE IF EXISTS "prop_images" CASCADE;
    DROP TABLE IF EXISTS "project_template" CASCADE;
    DROP TABLE IF EXISTS "project_model_config" CASCADE;
    DROP TABLE IF EXISTS "project_invite_link" CASCADE;
    DROP TABLE IF EXISTS "project" CASCADE;
    DROP TABLE IF EXISTS "pricing_history" CASCADE;
    DROP TABLE IF EXISTS "model_providers" CASCADE;
    DROP TABLE IF EXISTS "model_call_logs" CASCADE;
    DROP TABLE IF EXISTS "model_adapter_configs" CASCADE;
    DROP TABLE IF EXISTS "login_logs" CASCADE;
    DROP TABLE IF EXISTS "image_generation_task" CASCADE;
    DROP TABLE IF EXISTS "image_generation_result" CASCADE;
    DROP TABLE IF EXISTS "file_reference" CASCADE;
    DROP TABLE IF EXISTS "collaborator" CASCADE;
    DROP TABLE IF EXISTS "cleanup_queue" CASCADE;
    DROP TABLE IF EXISTS "characters" CASCADE;
    DROP TABLE IF EXISTS "character_images" CASCADE;
    DROP TABLE IF EXISTS "balance_record" CASCADE;
    DROP TABLE IF EXISTS "audio_generation_task" CASCADE;
    DROP TABLE IF EXISTS "audio_generation_output" CASCADE;
    DROP TABLE IF EXISTS "asset_stats" CASCADE;
    DROP TABLE IF EXISTS "asset_import_log" CASCADE;
    DROP TABLE IF EXISTS "asset_cross_project_refs" CASCADE;
    DROP TABLE IF EXISTS "ai_tasks" CASCADE;
    DROP TABLE IF EXISTS "ai_task_result" CASCADE;
    DROP TABLE IF EXISTS "ai_task_models" CASCADE;
    DROP TABLE IF EXISTS "ai_task" CASCADE;
    DROP TABLE IF EXISTS "ai_provider_config" CASCADE;
    DROP TABLE IF EXISTS "ai_models" CASCADE;
    DROP TABLE IF EXISTS "admin_operation_log" CASCADE;
    `);

    // 删除枚举类型
    await queryRunner.query(`
    DROP TYPE IF EXISTS "system_notices_type_enum";
    DROP TYPE IF EXISTS "system_notices_status_enum";
    DROP TYPE IF EXISTS "system_notices_priority_enum";
    `);
  }
}
