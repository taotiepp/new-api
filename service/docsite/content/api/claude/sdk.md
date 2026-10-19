---
title: SDK 调用
order: 2
---

# SDK 调用

官方 SDK 会在 Base URL 后面拼接 `/v1/messages`，所以 Base URL 填写网站地址，不要再加 `/v1`。

- Base URL：`{{server_address}}`
- Python：`pip install anthropic`
- Node.js：`npm install @anthropic-ai/sdk`

```python
import anthropic

client = anthropic.Anthropic(
    base_url="{{server_address}}",
    api_key="YOUR_API_KEY",
)

message = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
)
print(message.content[0].text)
```

```javascript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  baseURL: "{{server_address}}",
  apiKey: process.env.API_KEY,
});

const message = await client.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello" }],
});
console.log(message.content[0].text);
```
