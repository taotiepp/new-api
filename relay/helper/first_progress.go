package helper

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// StreamStatusTimeoutError reports that a streaming upstream produced no HTTP
// status before the first-progress allowance. The same allowance starts again
// for the first packet only after a status arrives.
func StreamStatusTimeoutError() *types.NewAPIError {
	return types.NewOpenAIError(
		fmt.Errorf("upstream stream produced no HTTP status before the first-progress timeout"),
		types.ErrorCodeBadResponse,
		http.StatusBadGateway,
	)
}

// ArmStreamStatusTimeout bounds the wait for a streaming upstream's HTTP
// status. The returned stop func reports whether the allowance already fired.
// Calling stop after the status arrives does not cancel the response body, so
// the first-packet wait can use a fresh allowance.
func ArmStreamStatusTimeout(parent context.Context, info *relaycommon.RelayInfo) (context.Context, func() bool) {
	timeout, ok := streamFirstProgressTimeout(info)
	if !ok {
		return parent, func() bool { return false }
	}
	if parent == nil {
		parent = context.Background()
	}
	ctx, cancel := context.WithCancel(parent)
	watch := &streamStatusWatch{cancel: cancel}
	watch.timer = time.AfterFunc(timeout, watch.expire)
	return ctx, watch.stop
}

func streamFirstProgressTimeout(info *relaycommon.RelayInfo) (time.Duration, bool) {
	if info == nil || !info.IsStream {
		return 0, false
	}
	if override, ok := info.FirstProgressTimeoutOverride(); ok {
		return override, true
	}
	return operation_setting.FirstProgressTimeoutForModel(info.GetFirstProgressPromptTokens(), info.GetReasoningEffort(), info.GetBillingModelName())
}

type streamStatusWatch struct {
	mu       sync.Mutex
	timer    *time.Timer
	cancel   context.CancelFunc
	stopped  bool
	timedOut bool
}

func (w *streamStatusWatch) expire() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.stopped {
		return
	}
	w.stopped = true
	w.timedOut = true
	w.cancel()
}

func (w *streamStatusWatch) stop() bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.stopped {
		return w.timedOut
	}
	w.stopped = true
	w.timer.Stop()
	return false
}

// FirstProgressTimeoutError reports that the upstream stream produced no text,
// reasoning, or tool output before the configured first-progress deadline.
func FirstProgressTimeoutError(info *relaycommon.RelayInfo) *types.NewAPIError {
	if info == nil || info.StreamStatus == nil {
		return nil
	}
	if info.StreamStatus.EndReason != relaycommon.StreamEndReasonFirstProgressTimeout {
		return nil
	}
	if info.StreamProgressSeen() {
		return nil
	}
	return types.NewOpenAIError(
		fmt.Errorf("upstream stream produced no progress before the first-progress timeout"),
		types.ErrorCodeBadResponse,
		http.StatusBadGateway,
	)
}
