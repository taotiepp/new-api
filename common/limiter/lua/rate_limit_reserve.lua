-- 令牌桶：原子预扣（refill + 判断 + 扣减，一次脚本完成）
-- KEYS[1]: 限流器唯一标识
-- ARGV[1]: 请求令牌数
-- ARGV[2]: 令牌生成速率 (每秒)
-- ARGV[3]: 桶容量
-- 返回: 实际扣减量 (>=0 表示放行)；-1 表示拒绝（桶状态仍会写入 refill）
--
-- requested <= capacity: 余量足够才扣 requested
-- requested > capacity: 余量 > 0 则放行，扣减并透支到 -capacity，避免超大单请求死锁

local key = KEYS[1]
local requested = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local capacity = tonumber(ARGV[3])

local now = redis.call('TIME')
local nowInSeconds = tonumber(now[1])

local bucket = redis.call('HMGET', key, 'tokens', 'last_time')
local tokens = tonumber(bucket[1])
local last_time = tonumber(bucket[2])

if not tokens or not last_time then
    tokens = capacity
    last_time = nowInSeconds
else
    local elapsed = nowInSeconds - last_time
    if elapsed < 0 then
        elapsed = 0
    end
    tokens = math.min(capacity, tokens + elapsed * rate)
    last_time = nowInSeconds
end

local deducted = -1
if requested > capacity then
    if tokens > 0 then
        local before = tokens
        tokens = tokens - requested
        if tokens < -capacity then
            tokens = -capacity
        end
        deducted = before - tokens
    end
elseif tokens >= requested then
    tokens = tokens - requested
    deducted = requested
end

redis.call('HMSET', key, 'tokens', tokens, 'last_time', last_time)

local ttl = 3600
if rate > 0 then
    ttl = math.ceil(capacity / rate) + 60
end
redis.call('EXPIRE', key, ttl)

if deducted < 0 then
    return -1
end
return math.floor(deducted)
