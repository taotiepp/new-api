---
title: SDK 调用
order: 2
---

# SDK 调用

官方 SDK 会自己拼接 `/v1beta/models/{model}:generateContent`，所以 Base URL 填写网站地址。

- Base URL：`{{server_address}}`
- Python：`pip install google-genai`
- Node.js：`npm install @google/genai`

```python
from google import genai
from google.genai import types

client = genai.Client(
    api_key="YOUR_API_KEY",
    http_options=types.HttpOptions(base_url="{{server_address}}"),
)

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Hello",
)
print(response.text)
```

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.API_KEY,
  httpOptions: { baseUrl: "{{server_address}}" },
});

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Hello",
});
console.log(response.text);
```
