package limiter

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestLimiter(t *testing.T) (*RedisLimiter, *miniredis.Miniredis) {
	t.Helper()
	server := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	ctx := context.Background()
	load := func(src string) string {
		sha, err := rdb.ScriptLoad(ctx, src).Result()
		require.NoError(t, err)
		return sha
	}
	return &RedisLimiter{
		client:           rdb,
		limitScriptSHA:   load(rateLimitScript),
		reserveScriptSHA: load(rateLimitReserveScript),
		consumeScriptSHA: load(rateLimitConsumeScript),
	}, server
}

func TestAllowDeductsAndDeniesWhenExhausted(t *testing.T) {
	rl, _ := newTestLimiter(t)
	ctx := context.Background()
	key := "test:allow"

	// capacity 2, one token per request -> exactly two allowed, then denied.
	for range 2 {
		ok, err := rl.Allow(ctx, key, WithCapacity(2), WithRate(0), WithRequested(1))
		require.NoError(t, err)
		assert.True(t, ok)
	}
	ok, err := rl.Allow(ctx, key, WithCapacity(2), WithRate(0), WithRequested(1))
	require.NoError(t, err)
	assert.False(t, ok)
}

func TestAllowSetsKeyTTL(t *testing.T) {
	// Regression: the token-bucket script must EXPIRE the key so that the
	// user x model key space cannot grow without bound.
	rl, server := newTestLimiter(t)
	ctx := context.Background()
	key := "test:ttl"

	_, err := rl.Allow(ctx, key, WithCapacity(60), WithRate(1), WithRequested(1))
	require.NoError(t, err)
	assert.Positive(t, server.TTL(key), "Allow must set a positive TTL")
}

func TestReserveSetsKeyTTL(t *testing.T) {
	rl, server := newTestLimiter(t)
	ctx := context.Background()
	key := "test:reserve:ttl"

	_, allowed, err := rl.Reserve(ctx, key, WithCapacity(60), WithRate(1), WithRequested(1))
	require.NoError(t, err)
	assert.True(t, allowed)
	assert.Positive(t, server.TTL(key), "Reserve must set a positive TTL")
}

func TestAdjustSetsKeyTTL(t *testing.T) {
	rl, server := newTestLimiter(t)
	ctx := context.Background()
	key := "test:adjust:ttl"

	_, err := rl.Adjust(ctx, key, 5, WithCapacity(60), WithRate(1))
	require.NoError(t, err)
	assert.Positive(t, server.TTL(key), "Adjust must set a positive TTL")
}

func TestReserveDeductsAtomicallyAndDeniesWhenExhausted(t *testing.T) {
	rl, _ := newTestLimiter(t)
	ctx := context.Background()
	key := "test:reserve"

	reserved, allowed, err := rl.Reserve(ctx, key, WithCapacity(1000), WithRate(0), WithRequested(300))
	require.NoError(t, err)
	require.True(t, allowed)
	assert.EqualValues(t, 300, reserved)

	remaining, err := rl.Adjust(ctx, key, 0, WithCapacity(1000), WithRate(0))
	require.NoError(t, err)
	assert.EqualValues(t, 700, remaining)

	_, allowed, err = rl.Reserve(ctx, key, WithCapacity(1000), WithRate(0), WithRequested(800))
	require.NoError(t, err)
	assert.False(t, allowed, "second reserve must not over-admit against the same bucket")
}

func TestReserveThenAdjustSettlesDeltaAndRefunds(t *testing.T) {
	rl, server := newTestLimiter(t)
	ctx := context.Background()
	key := "test:reserve:adjust"
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	server.SetTime(base)

	reserved, allowed, err := rl.Reserve(ctx, key, WithCapacity(1000), WithRate(100), WithRequested(300))
	require.NoError(t, err)
	require.True(t, allowed)
	assert.EqualValues(t, 300, reserved)

	// actual 200: refund 100
	remaining, err := rl.Adjust(ctx, key, 200-reserved, WithCapacity(1000), WithRate(100))
	require.NoError(t, err)
	assert.EqualValues(t, 800, remaining)

	server.SetTime(base.Add(time.Second))
	remaining, err = rl.Adjust(ctx, key, 0, WithCapacity(1000), WithRate(100))
	require.NoError(t, err)
	assert.EqualValues(t, 900, remaining)
}

func TestAdjustOverdraftFloorsAtNegativeCapacityAndRefundCaps(t *testing.T) {
	rl, _ := newTestLimiter(t)
	ctx := context.Background()
	key := "test:overdraft"

	remaining, err := rl.Adjust(ctx, key, 5000, WithCapacity(1000), WithRate(0))
	require.NoError(t, err)
	assert.EqualValues(t, -1000, remaining)

	remaining, err = rl.Adjust(ctx, key, -10000, WithCapacity(1000), WithRate(0))
	require.NoError(t, err)
	assert.EqualValues(t, 1000, remaining, "refund must not exceed capacity")
}

func TestReserveOversizedRequestDeductsToNegativeCapacity(t *testing.T) {
	rl, _ := newTestLimiter(t)
	ctx := context.Background()
	key := "test:reserve:oversize"

	reserved, allowed, err := rl.Reserve(ctx, key, WithCapacity(1000), WithRate(0), WithRequested(5000))
	require.NoError(t, err)
	require.True(t, allowed)
	assert.EqualValues(t, 2000, reserved)

	remaining, err := rl.Adjust(ctx, key, 0, WithCapacity(1000), WithRate(0))
	require.NoError(t, err)
	assert.EqualValues(t, -1000, remaining)

	_, allowed, err = rl.Reserve(ctx, key, WithCapacity(1000), WithRate(0), WithRequested(5000))
	require.NoError(t, err)
	assert.False(t, allowed)
}

func TestConcurrentReserveDoesNotOverAdmit(t *testing.T) {
	rl, _ := newTestLimiter(t)
	ctx := context.Background()
	key := "test:reserve:concurrent"

	const n = 20
	allowed := make([]bool, n)
	var wg sync.WaitGroup
	wg.Add(n)
	for i := range n {
		go func(i int) {
			defer wg.Done()
			_, ok, err := rl.Reserve(ctx, key, WithCapacity(1000), WithRate(0), WithRequested(600))
			require.NoError(t, err)
			allowed[i] = ok
		}(i)
	}
	wg.Wait()

	okCount := 0
	for _, ok := range allowed {
		if ok {
			okCount++
		}
	}
	assert.Equal(t, 1, okCount, "only one 600-token reserve fits in a 1000 bucket")
}
