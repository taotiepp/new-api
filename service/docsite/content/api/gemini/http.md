---
title: API 调用
order: 1
---

# API 调用

- 方法：`POST`
- 地址：`{{server_address}}/v1beta/models/gemini-2.5-flash:generateContent`
- 认证：请求头 `x-goog-api-key: YOUR_API_KEY`

```bash
curl {{server_address}}/v1beta/models/gemini-2.5-flash:generateContent \
  -H "x-goog-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{"parts": [{"text": "Hello"}]}]
  }'
```
