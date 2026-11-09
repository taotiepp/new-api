package common

import (
	"fmt"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

type StreamEndReason string

const (
	StreamEndReasonNone    StreamEndReason = ""
	StreamEndReasonDone    StreamEndReason = "done"
	StreamEndReasonTimeout StreamEndReason = "timeout"
	// StreamEndReasonFirstProgressTimeout means no text, reasoning, or tool
	// output arrived before the configured first-progress deadline.
	StreamEndReasonFirstProgressTimeout StreamEndReason = "first_progress_timeout"
	StreamEndReasonClientGone           StreamEndReason = "client_gone"
	StreamEndReasonScannerErr           StreamEndReason = "scanner_error"
	StreamEndReasonHandlerStop          StreamEndReason = "handler_stop"
	StreamEndReasonEOF                  StreamEndReason = "eof"
	StreamEndReasonPanic                StreamEndReason = "panic"
	StreamEndReasonPingFail             StreamEndReason = "ping_fail"
)

const maxStreamErrorEntries = 20

// maxStreamUpstreamBodyBytes bounds the upstream SSE payloads kept for a
// timeout or client-disconnect log. Further data is dropped, so the stored
// body is the start of the response.
const maxStreamUpstreamBodyBytes = 64 * 1024

type StreamErrorEntry struct {
	Message   string
	Timestamp time.Time
}

type StreamStatus struct {
	EndReason StreamEndReason
	EndError  error
	endOnce   sync.Once

	mu         sync.Mutex
	Errors     []StreamErrorEntry
	ErrorCount int

	upstreamBody      strings.Builder
	upstreamTruncated bool
}

func NewStreamStatus() *StreamStatus {
	return &StreamStatus{}
}

func (s *StreamStatus) SetEndReason(reason StreamEndReason, err error) {
	if s == nil {
		return
	}
	s.endOnce.Do(func() {
		s.EndReason = reason
		s.EndError = err
	})
}

// AppendUpstreamData keeps SSE payloads already read from upstream.
// Once the cap is reached, later payloads are dropped.
func (s *StreamStatus) AppendUpstreamData(line string) {
	if s == nil || line == "" {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.upstreamTruncated {
		return
	}
	extra := len(line)
	if s.upstreamBody.Len() > 0 {
		extra++
	}
	if s.upstreamBody.Len()+extra <= maxStreamUpstreamBodyBytes {
		if s.upstreamBody.Len() > 0 {
			s.upstreamBody.WriteByte('\n')
		}
		s.upstreamBody.WriteString(line)
		return
	}
	s.upstreamTruncated = true
	room := maxStreamUpstreamBodyBytes - s.upstreamBody.Len()
	if s.upstreamBody.Len() > 0 {
		if room <= 1 {
			return
		}
		s.upstreamBody.WriteByte('\n')
		room--
	}
	if len(line) > room {
		line = line[:room]
	}
	s.upstreamBody.WriteString(trimTrailingPartialRune(line))
}

// UpstreamBody returns the captured payloads. A truncated body ends with "..."
// so the log shows that later events were dropped.
func (s *StreamStatus) UpstreamBody() string {
	if s == nil {
		return ""
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	body := s.upstreamBody.String()
	if !s.upstreamTruncated {
		return body
	}
	if body == "" {
		return "..."
	}
	return body + "\n..."
}

func trimTrailingPartialRune(s string) string {
	for len(s) > 0 && !utf8.ValidString(s) {
		s = s[:len(s)-1]
	}
	return s
}

func (s *StreamStatus) RecordError(msg string) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ErrorCount++
	if len(s.Errors) < maxStreamErrorEntries {
		s.Errors = append(s.Errors, StreamErrorEntry{
			Message:   msg,
			Timestamp: time.Now(),
		})
	}
}

func (s *StreamStatus) HasErrors() bool {
	if s == nil {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.ErrorCount > 0
}

func (s *StreamStatus) TotalErrorCount() int {
	if s == nil {
		return 0
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.ErrorCount
}

func (s *StreamStatus) IsNormalEnd() bool {
	if s == nil {
		return true
	}
	return s.EndReason == StreamEndReasonDone ||
		s.EndReason == StreamEndReasonEOF ||
		s.EndReason == StreamEndReasonHandlerStop
}

func (s *StreamStatus) Summary() string {
	if s == nil {
		return "StreamStatus<nil>"
	}
	b := &strings.Builder{}
	fmt.Fprintf(b, "reason=%s", s.EndReason)
	if s.EndError != nil {
		fmt.Fprintf(b, " end_error=%q", s.EndError.Error())
	}
	s.mu.Lock()
	if s.ErrorCount > 0 {
		fmt.Fprintf(b, " soft_errors=%d", s.ErrorCount)
	}
	s.mu.Unlock()
	return b.String()
}
