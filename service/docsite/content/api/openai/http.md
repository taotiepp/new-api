---
title: API 调用
order: 1
---

# API 调用

- 方法：`POST`
- 地址：`{{server_address}}/v1/chat/completions`
- 认证：请求头 `Authorization: Bearer YOUR_API_KEY`

```bash
curl {{server_address}}/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```
