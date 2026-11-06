package helper

import (
	"fmt"
	"net/http"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
)

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
