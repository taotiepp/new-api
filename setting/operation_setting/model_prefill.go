package operation_setting

import (
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// ModelPrefillOptionKey stores per-model prefill speeds as a JSON object.
// Values are input tokens per second. Models omitted from the object use the
// global first-progress divisor.
const ModelPrefillOptionKey = "ModelPrefillTokensPerSecond"

var (
	modelPrefillMu     sync.RWMutex
	modelPrefillTokens = map[string]int{}
)

// LoadModelPrefillTokensPerSecond replaces the in-memory per-model speeds.
func LoadModelPrefillTokensPerSecond(raw string) error {
	var entries map[string]any
	if err := common.UnmarshalJsonStr(raw, &entries); err != nil || entries == nil {
		if err != nil {
			return err
		}
		return errInvalidPrefill
	}
	next := make(map[string]int, len(entries))
	for name, value := range entries {
		speed, ok := prefillSpeedValue(value)
		if !ok {
			return errInvalidPrefill
		}
		next[name] = speed
	}
	modelPrefillMu.Lock()
	modelPrefillTokens = next
	modelPrefillMu.Unlock()
	return nil
}

// ModelPrefillTokensPerSecond returns a model's prefill speed when an
// administrator set one. The second result is false when the global speed applies.
func ModelPrefillTokensPerSecond(model string) (int, bool) {
	if model == "" {
		return 0, false
	}
	modelPrefillMu.RLock()
	speed, ok := modelPrefillTokens[model]
	modelPrefillMu.RUnlock()
	return speed, ok
}

var errInvalidPrefill = invalidPrefillError{}

type invalidPrefillError struct{}

func (invalidPrefillError) Error() string {
	return "预填每秒 token 数必须是正整数"
}

func prefillSpeedValue(value any) (int, bool) {
	number, ok := value.(float64)
	if !ok || number < 1 || number != float64(int(number)) {
		return 0, false
	}
	return int(number), true
}
