package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	userModelRPM = prometheus.NewDesc(
		"newapi_user_model_requests_per_minute",
		"Consume requests in the last 60 seconds for one user and model.",
		[]string{"user_id", "username", "model"},
		nil,
	)
	userModelTPM = prometheus.NewDesc(
		"newapi_user_model_tokens_per_minute",
		"Prompt plus completion tokens in the last 60 seconds for one user and model.",
		[]string{"user_id", "username", "model"},
		nil,
	)
	userModelRegistry = prometheus.NewRegistry()
)

func init() {
	userModelRegistry.MustRegister(userModelRateCollector{})
}

type userModelRateCollector struct{}

func (userModelRateCollector) Describe(ch chan<- *prometheus.Desc) {
	ch <- userModelRPM
	ch <- userModelTPM
}

func (userModelRateCollector) Collect(ch chan<- prometheus.Metric) {
	rows, err := model.SumUserModelRates()
	if err != nil {
		ch <- prometheus.NewInvalidMetric(userModelRPM, err)
		return
	}
	for _, row := range rows {
		labels := []string{strconv.Itoa(row.UserId), row.Username, row.ModelName}
		ch <- prometheus.MustNewConstMetric(userModelRPM, prometheus.GaugeValue, float64(row.Rpm), labels...)
		ch <- prometheus.MustNewConstMetric(userModelTPM, prometheus.GaugeValue, float64(row.Tpm), labels...)
	}
}

// Metrics serves per-user, per-model RPM and TPM in Prometheus text exposition format.
func Metrics(c *gin.Context) {
	promhttp.HandlerFor(userModelRegistry, promhttp.HandlerOpts{
		EnableOpenMetrics: false,
	}).ServeHTTP(c.Writer, c.Request)
}
