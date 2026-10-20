package openai

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func OaiResponsesHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	// read response body
	var responsesResponse dto.OpenAIResponsesResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	err = common.Unmarshal(responseBody, &responsesResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if oaiError := responsesResponse.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
		return nil, types.WithOpenAIError(*oaiError, resp.StatusCode)
	}

	// 写入新的 response body
	service.IOCopyBytesGracefully(c, resp, responseBody)

	// compute usage
	usage := relayconvert.NormalizeResponsesUsage(responsesResponse.Usage)
	// Count actual tool invocations from Output (not tool declarations).
	for _, output := range responsesResponse.Output {
		switch output.Type {
		case dto.BuildInCallWebSearchCall:
			info.CountBillableToolCall(dto.BuildInCallWebSearchCall, "")
		case dto.BuildInCallFileSearchCall:
			info.CountBillableToolCall(dto.BuildInCallFileSearchCall, "")
		case dto.BuildInCallFunctionCall:
			info.CountBillableToolCall(dto.BuildInCallFunctionCall, output.Name)
		}
	}

	imageCounter := &relaycommon.ImageGenerationCallCounter{}
	if !relaycommon.IsNonBillableResponsesStatus(responsesResponse.Status) {
		for i := range responsesResponse.Output {
			idx := i
			imageCounter.Observe(&responsesResponse.Output[i], &idx)
		}
	}
	imageCounter.Commit(info)

	return usage, nil
}

func OaiResponsesStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		logger.LogError(c, "invalid response or response body")
		return nil, types.NewError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse)
	}

	defer service.CloseResponseBodyGracefully(resp)

	var usage = &dto.Usage{}
	var responseTextBuilder strings.Builder
	var terminalErr *types.NewAPIError
	var pendingResponses []dto.ResponsesStreamResponse
	var pendingData []string
	imageCounter := &relaycommon.ImageGenerationCallCounter{}
	imageCommitted := false
	sawCompleted := false
	committed := false
	common.SetContextKey(c, constant.ContextKeyRetryIncompleteResponsesStream, false)

	commitEvents := func() {
		if committed {
			return
		}
		committed = true
		for i, pending := range pendingResponses {
			sendResponsesStreamData(c, pending, pendingData[i])
		}
		pendingResponses = nil
		pendingData = nil
	}
	writeEvent := func(streamResponse dto.ResponsesStreamResponse, data string) {
		if committed {
			sendResponsesStreamData(c, streamResponse, data)
			return
		}
		pendingResponses = append(pendingResponses, streamResponse)
		pendingData = append(pendingData, data)
	}

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {

		// 检查当前数据是否包含 completed 状态和 usage 信息
		var streamResponse dto.ResponsesStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
			logger.LogError(c, "failed to unmarshal stream response: "+err.Error())
			sr.Error(err)
			return
		}
		writeEvent(streamResponse, data)
		switch streamResponse.Type {
		case "response.completed", "response.done":
			if streamResponse.Response != nil && relaycommon.IsNonBillableResponsesStatus(streamResponse.Response.Status) {
				if !imageCommitted {
					imageCounter.Reset()
					imageCounter.Commit(info)
					imageCommitted = true
				}
				if terminalErr == nil {
					terminalErr = responsesStreamFailure(streamResponse)
				}
				sr.Stop(terminalErr)
				return
			}
			sawCompleted = true
			if streamResponse.Response != nil {
				if streamResponse.Response.Usage != nil {
					incomingUsage := relayconvert.NormalizeResponsesUsage(streamResponse.Response.Usage)
					usage = dto.MergeUsageNonZero(usage, incomingUsage)
				}
				if !imageCommitted {
					for i := range streamResponse.Response.Output {
						idx := i
						imageCounter.Observe(&streamResponse.Response.Output[i], &idx)
					}
					imageCounter.Commit(info)
					imageCommitted = true
				}
			} else if !imageCommitted {
				imageCounter.Commit(info)
				imageCommitted = true
			}
		case "response.failed", "response.error", "response.incomplete", "response.cancelled", "response.canceled":
			if !imageCommitted {
				imageCounter.Reset()
				imageCounter.Commit(info)
				imageCommitted = true
			}
			if terminalErr == nil {
				terminalErr = responsesStreamFailure(streamResponse)
			}
			sr.Stop(terminalErr)
			return
		case "response.output_text.delta":
			// 处理输出文本
			responseTextBuilder.WriteString(streamResponse.Delta)
		case dto.ResponsesOutputTypeItemDone:
			if streamResponse.Item != nil {
				switch streamResponse.Item.Type {
				case dto.BuildInCallWebSearchCall:
					info.CountBillableToolCall(dto.BuildInCallWebSearchCall, "")
				case dto.BuildInCallFileSearchCall:
					info.CountBillableToolCall(dto.BuildInCallFileSearchCall, "")
				case dto.BuildInCallFunctionCall:
					info.CountBillableToolCall(dto.BuildInCallFunctionCall, streamResponse.Item.Name)
				case dto.ResponsesOutputTypeImageGenerationCall:
					if !imageCommitted {
						imageCounter.Observe(streamResponse.Item, streamResponse.OutputIndex)
					}
				}
			}
		}
		if terminalErr == nil && responsesStreamEventCommitsOutput(streamResponse) {
			commitEvents()
		}
	})

	if usage.CompletionTokens == 0 {
		// 计算输出文本的 token 数量
		tempStr := responseTextBuilder.String()
		if len(tempStr) > 0 {
			// 非正常结束，使用输出文本的 token 数量
			completionTokens := service.CountTextToken(tempStr, info.UpstreamModelName)
			usage.CompletionTokens = completionTokens
		}
	}

	if usage.PromptTokens == 0 && usage.CompletionTokens != 0 {
		usage.PromptTokens = info.GetPromptTokensForUsage()
	}

	usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	if usage.BillingUsage != nil {
		usage.BillingUsage = dto.CloneBillingUsageWithEstimatedCompletion(usage.BillingUsage, usage.CompletionTokens)
	}

	if terminalErr != nil {
		markIncompleteResponsesStreamForRetry(c, info, committed)
		return nil, terminalErr
	}
	if !sawCompleted || !responsesStreamHasBillableUsage(info, usage) {
		if sawCompleted && (info.PriceData.FreeModel || info.PriceData.UsePrice) {
			commitEvents()
			return usage, nil
		}
		message := "upstream responses stream ended without a completed response"
		if sawCompleted {
			message = "upstream responses stream completed without billable usage"
		}
		markIncompleteResponsesStreamForRetry(c, info, committed)
		return nil, types.NewOpenAIError(fmt.Errorf("%s", message), types.ErrorCodeBadResponse, http.StatusBadGateway)
	}

	commitEvents()
	return usage, nil
}

func markIncompleteResponsesStreamForRetry(c *gin.Context, info *relaycommon.RelayInfo, committed bool) {
	if committed {
		return
	}
	if info != nil && info.ResponsesUsageInfo != nil {
		for _, tool := range info.ResponsesUsageInfo.BuiltInTools {
			if tool != nil {
				tool.CallCount = 0
			}
		}
	}
	common.SetContextKey(c, constant.ContextKeyRetryIncompleteResponsesStream, true)
}

func responsesStreamEventCommitsOutput(streamResponse dto.ResponsesStreamResponse) bool {
	switch streamResponse.Type {
	case "response.output_text.delta":
		return streamResponse.Delta != ""
	case "response.output_text.done",
		"response.function_call_arguments.delta",
		"response.function_call_arguments.done",
		"response.content_part.added",
		"response.content_part.delta",
		"response.content_part.done":
		return true
	default:
		return false
	}
}

func responsesStreamFailure(streamResponse dto.ResponsesStreamResponse) *types.NewAPIError {
	if streamResponse.Response != nil {
		if oaiErr := streamResponse.Response.GetOpenAIError(); oaiErr != nil && (oaiErr.Message != "" || oaiErr.Type != "") {
			return types.WithOpenAIError(*oaiErr, http.StatusBadGateway)
		}
	}
	eventType := streamResponse.Type
	if eventType == "" {
		eventType = "eof"
	}
	return types.NewOpenAIError(fmt.Errorf("upstream responses stream failed: %s", eventType), types.ErrorCodeBadResponse, http.StatusBadGateway)
}

func responsesStreamHasBillableUsage(info *relaycommon.RelayInfo, usage *dto.Usage) bool {
	if info != nil && (info.PriceData.FreeModel || info.PriceData.UsePrice) {
		return true
	}
	if usage != nil && usage.TotalTokens > 0 {
		return true
	}
	if info == nil || info.ResponsesUsageInfo == nil {
		return false
	}
	for _, tool := range info.ResponsesUsageInfo.BuiltInTools {
		if tool != nil && tool.CallCount > 0 {
			return true
		}
	}
	return false
}
