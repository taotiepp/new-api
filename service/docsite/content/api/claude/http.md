---
title: API 调用
order: 1
---

# API 调用

- 方法：`POST`
- 地址：`{{server_address}}/v1/messages`
- 认证：请求头 `x-api-key: YOUR_API_KEY`
- 版本：请求头 `anthropic-version: 2023-06-01`

```bash
curl {{server_address}}/v1/messages \
  -H "x-api-key: YOUR_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```
