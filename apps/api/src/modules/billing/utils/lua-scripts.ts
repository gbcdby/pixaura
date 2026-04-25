/**
 * Redis Lua 脚本 - 额度扣减原子操作
 *
 * 原理: 在 Redis 服务端原子执行检查+扣减逻辑
 * 脚本内同时检查小周期、大周期、功能类别额度
 * 三项均充足时同时扣减，任一不足时返回错误
 */

/**
 * 额度扣减 Lua 脚本
 *
 * KEYS:
 *   [1] 小周期模型额度 key
 *   [2] 大周期模型额度 key
 *   [3] 小周期类别额度 key
 *   [4] 大周期类别额度 key
 *   [5] 分布式锁 key
 *
 * ARGV:
 *   [1] 锁标识（用于验证锁所有权）
 *   [2] 模型ID
 *   [3] 扣减数量
 *   [4] 功能类别ID
 *
 * 返回值:
 *   JSON 字符串，包含:
 *   - success: boolean
 *   - smallRemaining: number (小周期剩余额度)
 *   - largeRemaining: number (大周期剩余额度)
 *   - categorySmallRemaining: number (类别小周期剩余)
 *   - categoryLargeRemaining: number (类别大周期剩余)
 *   - err?: string (错误码)
 */
export const DEDUCT_QUOTA_LUA_SCRIPT = `
local function deductQuota()
  -- 1. 检查分布式锁
  local lockValue = redis.call('GET', KEYS[5])
  if lockValue ~= ARGV[1] then
    return cjson.encode({ err = 'lock_not_held' })
  end

  -- 判断是否跳过模型级别额度检查
  local skipModelQuota = (ARGV[2] == '' or ARGV[2] == '_CATEGORY_ONLY_')
  local required = tonumber(ARGV[3])

  -- 读取所有额度
  local smallQuota = 0
  local largeQuota = 0
  if not skipModelQuota then
    smallQuota = tonumber(redis.call('HGET', KEYS[1], ARGV[2])) or 0
    largeQuota = tonumber(redis.call('HGET', KEYS[2], ARGV[2])) or 0
  end
  local categorySmallQuota = tonumber(redis.call('HGET', KEYS[3], ARGV[4])) or 0
  local categoryLargeQuota = tonumber(redis.call('HGET', KEYS[4], ARGV[4])) or 0

  -- 逐个检查额度（AND 逻辑：所有额度必须同时充足）
  if not skipModelQuota and smallQuota < required then
    return cjson.encode({
      err = 'small_quota_insufficient',
      remaining = smallQuota,
      required = required
    })
  end

  if not skipModelQuota and largeQuota < required then
    return cjson.encode({
      err = 'large_quota_insufficient',
      remaining = largeQuota,
      required = required
    })
  end

  if categorySmallQuota < required then
    return cjson.encode({
      err = 'category_small_quota_insufficient',
      remaining = categorySmallQuota,
      required = required
    })
  end

  if categoryLargeQuota < required then
    return cjson.encode({
      err = 'category_large_quota_insufficient',
      remaining = categoryLargeQuota,
      required = required
    })
  end

  -- 所有额度充足，同时扣减四个额度
  local smallRemaining = 0
  local largeRemaining = 0
  if not skipModelQuota then
    redis.call('HINCRBY', KEYS[1], ARGV[2], -required)
    redis.call('HINCRBY', KEYS[2], ARGV[2], -required)
    smallRemaining = smallQuota - required
    largeRemaining = largeQuota - required
  end

  redis.call('HINCRBY', KEYS[3], ARGV[4], -required)
  redis.call('HINCRBY', KEYS[4], ARGV[4], -required)

  return cjson.encode({
    success = true,
    smallRemaining = smallRemaining,
    largeRemaining = largeRemaining,
    categorySmallRemaining = categorySmallQuota - required,
    categoryLargeRemaining = categoryLargeQuota - required
  })
end

return deductQuota()
`;

/**
 * 检查额度 Lua 脚本（只检查不扣减）
 *
 * KEYS:
 *   [1] 小周期模型额度 key
 *   [2] 大周期模型额度 key
 *   [3] 小周期类别额度 key
 *   [4] 大周期类别额度 key
 *
 * ARGV:
 *   [1] 模型ID
 *   [2] 扣减数量
 *   [3] 功能类别ID
 *
 * 返回值:
 *   JSON 字符串，包含各额度信息
 */
export const CHECK_QUOTA_LUA_SCRIPT = `
local function checkQuota()
  -- 判断是否跳过模型级别额度检查（modelId 为空时）
  local skipModelQuota = (ARGV[1] == '' or ARGV[1] == '_CATEGORY_ONLY_')

  -- 1. 读取小周期模型额度（跳过时设为足够）
  local smallQuota = 0
  if not skipModelQuota then
    smallQuota = tonumber(redis.call('HGET', KEYS[1], ARGV[1])) or 0
  else
    smallQuota = tonumber(ARGV[2]) -- 设为足够
  end

  -- 2. 读取大周期模型额度（跳过时设为足够）
  local largeQuota = 0
  if not skipModelQuota then
    largeQuota = tonumber(redis.call('HGET', KEYS[2], ARGV[1])) or 0
  else
    largeQuota = tonumber(ARGV[2]) -- 设为足够
  end

  -- 3. 读取小周期类别额度
  local categorySmallQuota = tonumber(redis.call('HGET', KEYS[3], ARGV[3])) or 0

  -- 4. 读取大周期类别额度
  local categoryLargeQuota = tonumber(redis.call('HGET', KEYS[4], ARGV[3])) or 0

  -- 5. 判断是否足够（AND 逻辑：所有额度必须同时充足才能通过）
  local required = tonumber(ARGV[2])
  local sufficient = smallQuota >= required and
                     largeQuota >= required and
                     categorySmallQuota >= required and
                     categoryLargeQuota >= required

  return cjson.encode({
    sufficient = sufficient,
    smallQuota = smallQuota,
    largeQuota = largeQuota,
    categorySmallQuota = categorySmallQuota,
    categoryLargeQuota = categoryLargeQuota,
    required = required
  })
end

return checkQuota()
`;

/**
 * 初始化额度 Lua 脚本
 * 用于周期切换时重置额度
 *
 * KEYS:
 *   [1] 小周期模型额度 key
 *   [2] 大周期模型额度 key
 *   [3] 小周期类别额度 key
 *   [4] 大周期类别额度 key
 *   [5] 周期信息 key
 *
 * ARGV:
 *   [1] 模型ID
 *   [2] 模型额度值
 *   [3] 功能类别ID
 *   [4] 类别额度值
 *   [5] 小周期编号
 *   [6] 大周期编号
 *   [7] 小周期结束时间戳
 *   [8] 大周期结束时间戳
 */
export const INIT_QUOTA_LUA_SCRIPT = `
local function initQuota()
  -- 1. 设置模型额度
  redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
  redis.call('HSET', KEYS[2], ARGV[1], ARGV[2])

  -- 2. 设置类别额度
  redis.call('HSET', KEYS[3], ARGV[3], ARGV[4])
  redis.call('HSET', KEYS[4], ARGV[3], ARGV[4])

  -- 3. 更新周期信息
  redis.call('HMSET', KEYS[5],
    'small_cycle', ARGV[5],
    'large_cycle', ARGV[6],
    'small_cycle_end', ARGV[7],
    'large_cycle_end', ARGV[8]
  )

  -- 4. 设置过期时间（7天后自动清理）
  local expireSeconds = 7 * 24 * 60 * 60
  redis.call('EXPIRE', KEYS[1], expireSeconds)
  redis.call('EXPIRE', KEYS[2], expireSeconds)
  redis.call('EXPIRE', KEYS[3], expireSeconds)
  redis.call('EXPIRE', KEYS[4], expireSeconds)
  redis.call('EXPIRE', KEYS[5], expireSeconds)

  return cjson.encode({ success = true })
end

return initQuota()
`;

/**
 * 释放分布式锁 Lua 脚本
 * 确保原子性释放（只有锁持有者才能释放）
 *
 * KEYS:
 *   [1] 锁 key
 * ARGV:
 *   [1] 锁标识
 * 返回值:
 *   1: 成功释放
 *   0: 未持有锁
 */
export const RELEASE_LOCK_LUA_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
`;

/**
 * Lua 脚本执行参数接口
 */
export interface LuaScriptParams {
  keys: string[];
  argv: string[];
}

/**
 * Lua 脚本返回值类型
 */
export interface DeductQuotaResult {
  success?: boolean;
  err?: string;
  remaining?: number;
  required?: number;
  smallRemaining?: number;
  largeRemaining?: number;
  categorySmallRemaining?: number;
  categoryLargeRemaining?: number;
}

/**
 * Lua 脚本返回值类型（检查额度）
 */
export interface CheckQuotaResult {
  sufficient: boolean;
  smallQuota: number;
  largeQuota: number;
  categorySmallQuota: number;
  categoryLargeQuota: number;
  required: number;
}

/**
 * 解析 Lua 脚本返回值
 * @param result Lua 脚本返回的字符串
 * @returns 解析后的对象
 */
export function parseLuaResult<T>(result: string): T {
  try {
    return JSON.parse(result) as T;
  } catch {
    return {} as T;
  }
}
