---
title: SDK 调用
order: 2
---

# SDK 调用

官方 SDK 会在 Base URL 后面拼接 `/chat/completions`，所以 Base URL 需要带上 `/v1`。

- Base URL：`{{server_address}}/v1`
- Python：`pip install openai`
- Node.js：`npm install openai`

```python
from openai import OpenAI

client = OpenAI(
    base_url="{{server_address}}/v1",
    api_key="YOUR_API_KEY",
)

completion = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello"}],
)
print(completion.choices[0].message.content)
```

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "{{server_address}}/v1",
  apiKey: process.env.API_KEY,
});

const completion = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});
console.log(completion.choices[0]?.message.content);
```
