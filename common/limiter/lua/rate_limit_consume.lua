-- 令牌桶：refill 后按 delta 调账（正数再扣，负数退回）
-- KEYS[1]: 限流器唯一标识
-- ARGV[1]: 调账量（正=继续扣减，负=退回预扣）
-- ARGV[2]: 令牌生成速率 (每秒)
-- ARGV[3]: 桶容量
-- 返回: 调账后剩余令牌数 (向下取整)
-- 余量钳制在 [-capacity, capacity]

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

tokens = tokens - requested
if tokens < -capacity then
    tokens = -capacity
elseif tokens > capacity then
    tokens = capacity
end

redis.call('HMSET', key, 'tokens', tokens, 'last_time', last_time)

local ttl = 3600
if rate > 0 then
    ttl = math.ceil(capacity / rate) + 60
end
redis.call('EXPIRE', key, ttl)

return math.floor(tokens)
