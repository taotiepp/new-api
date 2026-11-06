package operation_setting

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/constant"
)

// FirstProgressTimeout is the deadline for the first text, reasoning, or tool
// output on a streaming response. It is disabled unless an administrator turns
// it on. promptTokens is a character scan of the prompt, not a tokenizer count.
// The divisor is the assumed prefill speed in input tokens per second.
// The result is also clamped to STREAMING_TIMEOUT.
func FirstProgressTimeout(promptTokens int, effort string) (time.Duration, bool) {
	setting := GetGeneralSetting()
	if setting == nil || !setting.firstProgressConfigured() {
		return 0, false
	}
	if promptTokens < 0 {
		promptTokens = 0
	}
	seconds := int64(setting.FirstProgressBaseSeconds) +
		int64(promptTokens)/int64(setting.FirstProgressInputTokenDivisor) +
		int64(setting.effortSeconds(effort))
	if seconds > int64(setting.FirstProgressCapSeconds) {
		seconds = int64(setting.FirstProgressCapSeconds)
	}
	if constant.StreamingTimeout > 0 && seconds > int64(constant.StreamingTimeout) {
		seconds = int64(constant.StreamingTimeout)
	}
	if seconds < 1 {
		return 0, false
	}
	return time.Duration(seconds) * time.Second, true
}

func (setting GeneralSetting) firstProgressConfigured() bool {
	if !setting.FirstProgressTimeoutEnabled {
		return false
	}
	if setting.FirstProgressBaseSeconds < 1 || setting.FirstProgressInputTokenDivisor < 1 || setting.FirstProgressCapSeconds < 1 {
		return false
	}
	if setting.FirstProgressCapSeconds < setting.FirstProgressBaseSeconds {
		return false
	}
	if setting.FirstProgressEffortLowSeconds < 0 || setting.FirstProgressEffortMediumSeconds < 0 || setting.FirstProgressEffortHighSeconds < 0 {
		return false
	}
	return true
}

func (setting GeneralSetting) effortSeconds(effort string) int {
	switch strings.ToLower(strings.TrimSpace(effort)) {
	case "low":
		return setting.FirstProgressEffortLowSeconds
	case "medium":
		return setting.FirstProgressEffortMediumSeconds
	case "high", "xhigh", "max":
		return setting.FirstProgressEffortHighSeconds
	default:
		return 0
	}
}

// ValidateFirstProgressOption checks one general_setting.first_progress_* update
// against the configuration that would result. Unrelated keys are ignored.
func ValidateFirstProgressOption(key, value string) error {
	const prefix = "general_setting."
	field, ok := strings.CutPrefix(key, prefix)
	if !ok || !strings.HasPrefix(field, "first_progress_") {
		return nil
	}
	next := *GetGeneralSetting()
	switch field {
	case "first_progress_timeout_enabled":
		enabled, err := strconv.ParseBool(strings.TrimSpace(value))
		if err != nil {
			return fmt.Errorf("首个进展时限开关必须是 true 或 false")
		}
		next.FirstProgressTimeoutEnabled = enabled
	case "first_progress_base_seconds":
		parsed, err := parsePositiveSeconds(value, "基础秒数")
		if err != nil {
			return err
		}
		next.FirstProgressBaseSeconds = parsed
	case "first_progress_input_token_divisor":
		parsed, err := parsePositiveSeconds(value, "预填每秒 token 数")
		if err != nil {
			return err
		}
		next.FirstProgressInputTokenDivisor = parsed
	case "first_progress_cap_seconds":
		parsed, err := parsePositiveSeconds(value, "上限秒数")
		if err != nil {
			return err
		}
		next.FirstProgressCapSeconds = parsed
	case "first_progress_effort_low_seconds":
		parsed, err := parseNonNegativeSeconds(value, "low effort 附加秒数")
		if err != nil {
			return err
		}
		next.FirstProgressEffortLowSeconds = parsed
	case "first_progress_effort_medium_seconds":
		parsed, err := parseNonNegativeSeconds(value, "medium effort 附加秒数")
		if err != nil {
			return err
		}
		next.FirstProgressEffortMediumSeconds = parsed
	case "first_progress_effort_high_seconds":
		parsed, err := parseNonNegativeSeconds(value, "high effort 附加秒数")
		if err != nil {
			return err
		}
		next.FirstProgressEffortHighSeconds = parsed
	default:
		return fmt.Errorf("未知的首个进展时限配置")
	}
	if !next.FirstProgressTimeoutEnabled {
		return nil
	}
	if next.FirstProgressBaseSeconds < 1 || next.FirstProgressInputTokenDivisor < 1 || next.FirstProgressCapSeconds < 1 {
		return fmt.Errorf("启用首个进展时限时，基础秒数、预填每秒 token 数和上限秒数都必须大于 0")
	}
	if next.FirstProgressCapSeconds < next.FirstProgressBaseSeconds {
		return fmt.Errorf("首个进展上限不能小于基础秒数")
	}
	if constant.StreamingTimeout > 0 && next.FirstProgressCapSeconds > constant.StreamingTimeout {
		return fmt.Errorf("首个进展上限不能超过流式空闲超时（%d 秒）", constant.StreamingTimeout)
	}
	return nil
}

func parsePositiveSeconds(value, name string) (int, error) {
	parsed, err := parseSeconds(value, name)
	if err != nil {
		return 0, err
	}
	if parsed < 1 {
		return 0, fmt.Errorf("首个进展%s必须是正整数", name)
	}
	return parsed, nil
}

func parseNonNegativeSeconds(value, name string) (int, error) {
	parsed, err := parseSeconds(value, name)
	if err != nil {
		return 0, err
	}
	if parsed < 0 {
		return 0, fmt.Errorf("首个进展%s不能为负数", name)
	}
	return parsed, nil
}

func parseSeconds(value, name string) (int, error) {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		floatValue, floatErr := strconv.ParseFloat(strings.TrimSpace(value), 64)
		if floatErr != nil || floatValue != float64(int(floatValue)) {
			return 0, fmt.Errorf("首个进展%s必须是整数", name)
		}
		parsed = int(floatValue)
	}
	return parsed, nil
}
