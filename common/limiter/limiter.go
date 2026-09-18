package limiter

import (
	"context"
	_ "embed"
	"fmt"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/go-redis/redis/v8"
)

//go:embed lua/rate_limit.lua
var rateLimitScript string

//go:embed lua/rate_limit_reserve.lua
var rateLimitReserveScript string

//go:embed lua/rate_limit_consume.lua
var rateLimitConsumeScript string

type RedisLimiter struct {
	client           *redis.Client
	limitScriptSHA   string
	reserveScriptSHA string
	consumeScriptSHA string
}

var (
	instance *RedisLimiter
	once     sync.Once
)

func New(ctx context.Context, r *redis.Client) *RedisLimiter {
	once.Do(func() {
		// 预加载脚本
		limitSHA, err := r.ScriptLoad(ctx, rateLimitScript).Result()
		if err != nil {
			common.SysLog(fmt.Sprintf("Failed to load rate limit script: %v", err))
		}
		reserveSHA, err := r.ScriptLoad(ctx, rateLimitReserveScript).Result()
		if err != nil {
			common.SysLog(fmt.Sprintf("Failed to load rate limit reserve script: %v", err))
		}
		consumeSHA, err := r.ScriptLoad(ctx, rateLimitConsumeScript).Result()
		if err != nil {
			common.SysLog(fmt.Sprintf("Failed to load rate limit consume script: %v", err))
		}
		instance = &RedisLimiter{
			client:           r,
			limitScriptSHA:   limitSHA,
			reserveScriptSHA: reserveSHA,
			consumeScriptSHA: consumeSHA,
		}
	})

	return instance
}

func (rl *RedisLimiter) Allow(ctx context.Context, key string, opts ...Option) (bool, error) {
	// 默认配置
	config := &Config{
		Capacity:  10,
		Rate:      1,
		Requested: 1,
	}

	// 应用选项模式
	for _, opt := range opts {
		opt(config)
	}

	// 执行限流
	result, err := rl.client.EvalSha(
		ctx,
		rl.limitScriptSHA,
		[]string{key},
		config.Requested,
		config.Rate,
		config.Capacity,
	).Int()

	if err != nil {
		return false, fmt.Errorf("rate limit failed: %w", err)
	}
	return result == 1, nil
}

// Reserve 原子预扣 requested 个令牌（refill 后判断并扣减）。
// 成功返回实际扣减量（>=0）；拒绝时 reserved=0 且 allowed=false（桶仍会写入 refill）。
func (rl *RedisLimiter) Reserve(ctx context.Context, key string, opts ...Option) (reserved int64, allowed bool, err error) {
	config := &Config{
		Capacity:  10,
		Rate:      1,
		Requested: 1,
	}
	for _, opt := range opts {
		opt(config)
	}

	result, err := rl.client.EvalSha(
		ctx,
		rl.reserveScriptSHA,
		[]string{key},
		config.Requested,
		config.Rate,
		config.Capacity,
	).Int64()
	if err != nil {
		return 0, false, fmt.Errorf("rate limit reserve failed: %w", err)
	}
	if result < 0 {
		return 0, false, nil
	}
	return result, true, nil
}

// Adjust 按 delta 调账：正数继续扣减，负数退回预扣。余量钳制在 [-capacity, capacity]。
func (rl *RedisLimiter) Adjust(ctx context.Context, key string, delta int64, opts ...Option) (int64, error) {
	config := &Config{
		Capacity: 10,
		Rate:     1,
	}
	for _, opt := range opts {
		opt(config)
	}

	result, err := rl.client.EvalSha(
		ctx,
		rl.consumeScriptSHA,
		[]string{key},
		delta,
		config.Rate,
		config.Capacity,
	).Int64()

	if err != nil {
		return 0, fmt.Errorf("rate limit adjust failed: %w", err)
	}
	return result, nil
}

// Config 配置选项模式
type Config struct {
	Capacity  int64
	Rate      int64
	Requested int64
}

type Option func(*Config)

func WithCapacity(c int64) Option {
	return func(cfg *Config) { cfg.Capacity = c }
}

func WithRate(r int64) Option {
	return func(cfg *Config) { cfg.Rate = r }
}

func WithRequested(n int64) Option {
	return func(cfg *Config) { cfg.Requested = n }
}
