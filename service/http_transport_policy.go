package service

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

// HTTPTransportPolicy is the runtime-normalized outbound HTTP transport policy
// for a channel. Unknown or out-of-range stored values are clamped safely.
type HTTPTransportPolicy struct {
	Protocol string // dto.HTTPProtocolHTTP1 or dto.HTTPProtocolHTTP2
	Shards   int    // 1..dto.MaxHTTP2ConnectionShards
}

var httpTransportPolicyWarnings sync.Map

func defaultHTTPTransportPolicy() HTTPTransportPolicy {
	return HTTPTransportPolicy{
		Protocol: dto.HTTPProtocolHTTP1,
		Shards:   1,
	}
}

// NormalizeHTTPTransportPolicy converts channel settings into a safe runtime policy.
// Invalid stored values never panic; they clamp to defaults and warn once per bad value.
func NormalizeHTTPTransportPolicy(settings dto.ChannelSettings) HTTPTransportPolicy {
	policy := defaultHTTPTransportPolicy()

	protocol := strings.ToLower(strings.TrimSpace(settings.HTTPProtocol))
	switch protocol {
	case dto.HTTPProtocolHTTP2:
		policy.Protocol = dto.HTTPProtocolHTTP2
	case "", dto.HTTPProtocolAuto, dto.HTTPProtocolHTTP1:
		// Auto is HTTP/1.1. HTTP/2 is used only when the channel selects it.
		policy.Protocol = dto.HTTPProtocolHTTP1
	default:
		warnHTTPTransportPolicyOnce("http_protocol", settings.HTTPProtocol)
		policy.Protocol = dto.HTTPProtocolHTTP1
	}

	shards := settings.HTTP2ConnectionShards
	switch {
	case shards == 0:
		policy.Shards = 1
	case shards < 1:
		warnHTTPTransportPolicyOnce("http2_connection_shards", fmt.Sprintf("%d", shards))
		policy.Shards = 1
	case shards > dto.MaxHTTP2ConnectionShards:
		warnHTTPTransportPolicyOnce("http2_connection_shards", fmt.Sprintf("%d", shards))
		policy.Shards = dto.MaxHTTP2ConnectionShards
	default:
		policy.Shards = shards
	}

	if policy.Protocol != dto.HTTPProtocolHTTP2 {
		if settings.HTTP2ConnectionShards > 1 {
			warnHTTPTransportPolicyOnce(
				"http_protocol+http2_connection_shards",
				fmt.Sprintf("%s+%d", protocol, settings.HTTP2ConnectionShards),
			)
		}
		policy.Shards = 1
	}
	if policy.Shards < 1 {
		policy.Shards = 1
	}
	return policy
}

func warnHTTPTransportPolicyOnce(field, value string) {
	key := field + "=" + value
	if _, loaded := httpTransportPolicyWarnings.LoadOrStore(key, struct{}{}); loaded {
		return
	}
	logger.LogWarn(
		context.Background(),
		fmt.Sprintf("invalid channel http transport setting clamped: %s=%q", field, value),
	)
}

func (p HTTPTransportPolicy) cacheKeyPart() string {
	return fmt.Sprintf("%s|%d", p.Protocol, p.Shards)
}

func (p HTTPTransportPolicy) String() string {
	return p.cacheKeyPart()
}
