/**
 * 错误码定义
 * 模块划分（每个模块 100 个）：
 * - 000-099: 通用错误
 * - 100-199: 用户模块 (user)
 * - 200-299: 计费模块 (billing)
 * - 300-399: 素材模块 (asset)
 * - 400-499: 生成任务模块 (generation)
 * - 500-599: WebSocket 模块 (websocket)
 * - 600-699: 系统管理模块 (system-admin)
 * - 700-799: 角色模块 (character)
 * - 800-899: 场景模块 (scene)
 * - 900-999: 道具模块 (prop)
 * - 1000-1099: 分镜模块 (storyboard)
 * - 1100-1199: 模型配置模块 (model-config)
 * - 1200-1299: 项目模块 (project)
 * - 1300-1399: 剧本模块 (script)
 * - 1400-1499: 图像生成模块 (image-gen)
 * - 1500-1599: 视频生成模块 (video-gen)
 * - 1600-1699: 音频生成模块 (audio-gen)
 * - 1700-1799: 视频编辑模块 (video-edit)
 * - 1800-1899: 导出模块 (export)
 */

export const ErrorCodes = {
  // 通用错误 (000-099)
  SUCCESS: { code: 0, message: "成功" },
  UNKNOWN_ERROR: { code: 1, message: "未知错误" },
  INVALID_PARAMS: { code: 2, message: "参数错误" },
  UNAUTHORIZED: { code: 3, message: "未授权" },
  FORBIDDEN: { code: 4, message: "禁止访问" },
  NOT_FOUND: { code: 5, message: "资源不存在" },
  INTERNAL_ERROR: { code: 6, message: "服务器内部错误" },
  RATE_LIMITED: { code: 7, message: "请求过于频繁，请稍后再试" },
  SERVICE_UNAVAILABLE: { code: 8, message: "服务暂不可用" },

  // 用户模块 (100-199)
  USER_NOT_FOUND: { code: 100, message: "用户不存在" },
  USER_ALREADY_EXISTS: { code: 101, message: "用户已存在" },
  USERNAME_ALREADY_EXISTS: { code: 102, message: "用户名已被使用" },
  PHONE_ALREADY_EXISTS: { code: 103, message: "手机号已被注册" },
  EMAIL_ALREADY_EXISTS: { code: 104, message: "邮箱已被使用" },
  INVALID_CREDENTIALS: { code: 105, message: "用户名或密码错误" },
  INVALID_PASSWORD: { code: 106, message: "密码错误" },
  PASSWORD_TOO_WEAK: { code: 107, message: "密码强度不足" },
  ACCOUNT_BANNED: { code: 108, message: "账号已被封禁" },
  INVALID_TOKEN: { code: 109, message: "无效的 Token" },
  TOKEN_EXPIRED: { code: 110, message: "Token 已过期" },
  REFRESH_TOKEN_EXPIRED: {
    code: 111,
    message: "Refresh Token 已过期，请重新登录",
  },
  INVALID_VERIFICATION_CODE: { code: 112, message: "验证码错误或已过期" },
  VERIFICATION_CODE_EXPIRED: { code: 113, message: "验证码已过期" },
  VERIFICATION_CODE_TOO_FREQUENT: { code: 114, message: "验证码发送过于频繁" },
  VERIFICATION_CODE_DAILY_LIMIT: {
    code: 115,
    message: "验证码发送次数已达日上限",
  },
  VERIFICATION_CODE_MAX_ATTEMPTS: {
    code: 116,
    message: "验证码错误次数过多，请重新获取",
  },
  INVALID_PHONE_FORMAT: { code: 117, message: "手机号格式不正确" },
  INVALID_EMAIL_FORMAT: { code: 118, message: "邮箱格式不正确" },
  EMAIL_NOT_VERIFIED: { code: 119, message: "邮箱未验证" },
  PHONE_CHANGE_TOO_FREQUENT: {
    code: 120,
    message: "手机号修改过于频繁，30天内只能修改一次",
  },
  SAME_PHONE_NUMBER: { code: 121, message: "新手机号不能与旧手机号相同" },
  INVALID_OLD_PHONE: { code: 122, message: "原手机号验证失败" },
  INVALID_EMAIL_TOKEN: { code: 123, message: "邮箱验证链接无效或已过期" },
  FILE_TOO_LARGE: { code: 124, message: "文件大小超过限制" },
  INVALID_FILE_TYPE: { code: 125, message: "不支持的文件类型" },
  AVATAR_UPLOAD_LIMIT: { code: 126, message: "今日头像上传次数已达上限" },
  USERNAME_CHANGE_NOT_ALLOWED: { code: 127, message: "用户名修改不被允许" },
  SAME_EMAIL: { code: 128, message: "新邮箱不能与旧邮箱相同" },
  INVALID_VERIFY_TOKEN: { code: 129, message: "验证令牌无效或已过期" },
  INVALID_MODEL_ID: { code: 130, message: "模型ID格式不正确" },

  // 模型配置模块 (1100-1199)
  MODEL_NOT_FOUND: { code: 1100, message: "模型不存在或已禁用" },
  PROVIDER_NOT_FOUND: { code: 1101, message: "供应商不存在或已禁用" },
  MODEL_PROVIDER_NOT_SET: { code: 1102, message: "模型未配置供应商" },
  HEALTH_CHECK_FAILED: { code: 1103, message: "健康检查失败" },
  FAILOVER_FAILED: { code: 1104, message: "故障转移失败" },
  NOT_IMPLEMENTED: { code: 1199, message: "功能尚未实现" },

  // 项目模块 (1200-1299)
  PROJECT_NOT_FOUND: { code: 1200, message: "项目不存在" },
  PROJECT_ACCESS_DENIED: { code: 1201, message: "没有权限访问此项目" },
  PROJECT_EDIT_DENIED: { code: 1202, message: "需要编辑权限才能执行此操作" },
  PROJECT_OWNER_DENIED: { code: 1203, message: "只有项目所有者才能执行此操作" },
  PROJECT_NAME_EXISTS: { code: 1204, message: "项目名称已存在" },
  PROJECT_ALREADY_DELETED: { code: 1205, message: "项目已被删除" },
  PROJECT_NOT_DELETED: { code: 1206, message: "项目未处于已删除状态" },
  PROJECT_DELETE_DENIED: { code: 1207, message: "只有项目所有者可以删除项目" },
  PROJECT_RESTORE_DENIED: { code: 1208, message: "只有项目所有者可以恢复项目" },
  INVITE_CODE_NOT_FOUND: { code: 1209, message: "邀请码不存在或已过期" },
  INVITE_CODE_USED: { code: 1210, message: "邀请码已被使用" },
  INVITE_CODE_REVOKED: { code: 1211, message: "邀请码已被撤销" },
  ALREADY_COLLABORATOR: { code: 1212, message: "已经是项目成员" },
  OWNER_CANNOT_LEAVE: {
    code: 1213,
    message: "项目所有者不能离开项目，请先转让所有权",
  },
  COLLABORATOR_NOT_FOUND: { code: 1214, message: "协作者不存在" },
  CANNOT_UPDATE_OWNER_ROLE: { code: 1215, message: "不能修改项目所有者的角色" },
  TEMPLATE_NOT_FOUND: { code: 1216, message: "模板不存在" },

  // 剧本模块 (1300-1399)
  SCRIPT_NOT_FOUND: { code: 1300, message: "剧本不存在" },
  SCRIPT_ACCESS_DENIED: { code: 1301, message: "没有权限访问此剧本" },
  SCRIPT_EDIT_DENIED: { code: 1302, message: "需要编辑权限才能修改剧本" },
  SCRIPT_ALREADY_CONFIRMED: { code: 1303, message: "剧本已确认，无法编辑" },
  SCRIPT_GENERATING: { code: 1304, message: "剧本正在生成中，请稍后再试" },
  AI_TASK_NOT_FOUND: { code: 1305, message: "AI 任务不存在" },
  AI_TASK_CANCEL_FAILED: { code: 1306, message: "AI 任务取消失败" },
  INVALID_SCRIPT_CONTENT: { code: 1307, message: "剧本内容格式不正确" },
  IMPORT_SCRIPT_FAILED: { code: 1308, message: "剧本导入失败" },
  IMPORT_FILE_TOO_LARGE: { code: 1309, message: "导入文件过大，最大支持 5MB" },
  IMPORT_FILE_EMPTY: { code: 1310, message: "导入文件内容为空" },
  ASSET_IMPORT_FAILED: { code: 1311, message: "资产导入失败" },
  SOURCE_PROJECT_ACCESS_DENIED: { code: 1312, message: "无权访问源项目" },
  SOURCE_ASSET_NOT_FOUND: { code: 1313, message: "源资产不存在" },
  CONFIRM_FAILED_UNPROCESSED_ASSETS: {
    code: 1314,
    message: "存在未处理的资产，请先处理",
  },
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

/**
 * 获取错误码信息
 */
export function getErrorInfo(code: ErrorCode): (typeof ErrorCodes)[ErrorCode] {
  return ErrorCodes[code];
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  code: ErrorCode,
  extra?: Record<string, unknown>,
) {
  const errorInfo = ErrorCodes[code];
  return {
    code: errorInfo.code,
    message: errorInfo.message,
    ...extra,
  };
}
