package operation_setting

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFirstProgressTimeoutDisabledByDefault(t *testing.T) {
	original := generalSetting
	t.Cleanup(func() { generalSetting = original })
	generalSetting.FirstProgressTimeoutEnabled = false

	timeout, ok := FirstProgressTimeout(200000, "high")
	assert.False(t, ok)
	assert.Equal(t, time.Duration(0), timeout)
}

func TestFirstProgressTimeoutFormula(t *testing.T) {
	original := generalSetting
	oldStreamingTimeout := constant.StreamingTimeout
	t.Cleanup(func() {
		generalSetting = original
		constant.StreamingTimeout = oldStreamingTimeout
	})
	constant.StreamingTimeout = 300
	generalSetting.FirstProgressTimeoutEnabled = true
	generalSetting.FirstProgressBaseSeconds = 20
	generalSetting.FirstProgressInputTokenDivisor = 20000
	generalSetting.FirstProgressCapSeconds = 60
	generalSetting.FirstProgressEffortLowSeconds = 0
	generalSetting.FirstProgressEffortMediumSeconds = 15
	generalSetting.FirstProgressEffortHighSeconds = 30

	timeout, ok := FirstProgressTimeout(0, "")
	require.True(t, ok)
	assert.Equal(t, 20*time.Second, timeout)

	timeout, ok = FirstProgressTimeout(19999, "none")
	require.True(t, ok)
	assert.Equal(t, 20*time.Second, timeout)

	timeout, ok = FirstProgressTimeout(40000, "low")
	require.True(t, ok)
	assert.Equal(t, 22*time.Second, timeout)

	timeout, ok = FirstProgressTimeout(40000, "medium")
	require.True(t, ok)
	assert.Equal(t, 37*time.Second, timeout)

	timeout, ok = FirstProgressTimeout(40000, "xhigh")
	require.True(t, ok)
	assert.Equal(t, 52*time.Second, timeout)

	timeout, ok = FirstProgressTimeout(2_000_000, "max")
	require.True(t, ok)
	assert.Equal(t, 60*time.Second, timeout)

	constant.StreamingTimeout = 30
	timeout, ok = FirstProgressTimeout(40000, "high")
	require.True(t, ok)
	assert.Equal(t, 30*time.Second, timeout)
}

func TestValidateFirstProgressOption(t *testing.T) {
	original := generalSetting
	oldStreamingTimeout := constant.StreamingTimeout
	t.Cleanup(func() {
		generalSetting = original
		constant.StreamingTimeout = oldStreamingTimeout
	})
	constant.StreamingTimeout = 300
	generalSetting.FirstProgressTimeoutEnabled = false
	generalSetting.FirstProgressBaseSeconds = 20
	generalSetting.FirstProgressInputTokenDivisor = 20000
	generalSetting.FirstProgressCapSeconds = 60
	generalSetting.FirstProgressEffortLowSeconds = 0
	generalSetting.FirstProgressEffortMediumSeconds = 15
	generalSetting.FirstProgressEffortHighSeconds = 30

	require.NoError(t, ValidateFirstProgressOption("RetryTimes", "1"))
	require.NoError(t, ValidateFirstProgressOption("general_setting.first_progress_timeout_enabled", "true"))

	generalSetting.FirstProgressTimeoutEnabled = true
	require.EqualError(t, ValidateFirstProgressOption("general_setting.first_progress_cap_seconds", "10"), "首个进展上限不能小于基础秒数")
	require.EqualError(t, ValidateFirstProgressOption("general_setting.first_progress_cap_seconds", "400"), "首个进展上限不能超过流式空闲超时（300 秒）")

	generalSetting.FirstProgressTimeoutEnabled = false
	require.NoError(t, ValidateFirstProgressOption("general_setting.first_progress_cap_seconds", "10"))
}
