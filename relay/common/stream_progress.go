package common

import (
	"sync/atomic"
	"time"
)

// streamProgressGate tracks whether a streaming attempt has produced text,
// reasoning, or tool output. Responses streams defer that signal so a lone
// response.created event does not count.
type streamProgressGate struct {
	deferUntilMarked atomic.Bool
	seen             atomic.Bool
}

func (info *RelayInfo) ensureStreamProgress() *streamProgressGate {
	if info == nil {
		return nil
	}
	if info.streamProgress == nil {
		info.streamProgress = &streamProgressGate{}
	}
	return info.streamProgress
}

// HoldStreamProgressUntilMarked keeps the first-progress timer running until
// the handler reports real output. Call it before the stream scanner starts.
func (info *RelayInfo) HoldStreamProgressUntilMarked() {
	gate := info.ensureStreamProgress()
	if gate == nil {
		return
	}
	gate.deferUntilMarked.Store(true)
}

// BeginStreamProgressAttempt clears the previous attempt's progress bit.
// The hold flag set by HoldStreamProgressUntilMarked is preserved.
func (info *RelayInfo) BeginStreamProgressAttempt() {
	gate := info.ensureStreamProgress()
	if gate == nil {
		return
	}
	gate.seen.Store(false)
}

// FinishStreamProgressAttempt drops the hold so the next attempt does not
// inherit a responses-specific deferral.
func (info *RelayInfo) FinishStreamProgressAttempt() {
	if info == nil || info.streamProgress == nil {
		return
	}
	info.streamProgress.deferUntilMarked.Store(false)
}

// MarkStreamProgress records that the upstream stream has produced output.
func (info *RelayInfo) MarkStreamProgress() {
	gate := info.ensureStreamProgress()
	if gate == nil {
		return
	}
	gate.seen.Store(true)
}

// DefersStreamProgress reports whether the first data line should not count.
func (info *RelayInfo) DefersStreamProgress() bool {
	if info == nil || info.streamProgress == nil {
		return false
	}
	return info.streamProgress.deferUntilMarked.Load()
}

// SetFirstProgressTimeoutForTest overrides the administrator setting for one request.
func (info *RelayInfo) SetFirstProgressTimeoutForTest(timeout time.Duration) {
	if info == nil {
		return
	}
	info.firstProgressTimeout = timeout
}

func (info *RelayInfo) FirstProgressTimeoutOverride() (time.Duration, bool) {
	if info == nil || info.firstProgressTimeout <= 0 {
		return 0, false
	}
	return info.firstProgressTimeout, true
}
func (info *RelayInfo) StreamProgressSeen() bool {
	if info == nil || info.streamProgress == nil {
		return false
	}
	return info.streamProgress.seen.Load()
}
