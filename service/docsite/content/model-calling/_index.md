---
title: 模型调用
order: 2
---

# 模型调用

令牌在创建时属于一个分组。请求里只写模型名时，网关用这个分组里的渠道调用该分组下的模型。令牌没有单独指定分组时，使用账号自己的分组。

```bash
curl {{server_address}}/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-5-5",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

上面的令牌如果属于 `aws`，调用的就是 `aws` 分组下的 `claude-opus-5-5`。

## 跨分组调用

模型名也可以写成 `分组名/模型名`，和 OpenRouter 的写法一样。这样不用更换令牌所属分组，就能调用你有权使用的其他分组里的模型。

```bash
curl {{server_address}}/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "aws/claude-opus-5-5",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

`aws` 必须是你可以使用的分组，`claude-opus-5-5` 是这个分组下的模型。网关按 `aws` 分组选渠道和计费，发给上游的模型名是 `claude-opus-5-5`。

模型名本身带有 `/`，但第一段不是你可用的分组时，整段仍当作模型名。例如没有名为 `Qwen` 的分组时，`Qwen/Qwen3-235B` 不会被拆开。

## 虚拟分组

虚拟分组可以把不同分组里的模型收进同一个分组。例如让 `claude-opus-5-5` 走 `aws`，让 `gpt-6-luna` 走 `codex`。也可以给来源模型另起名称，把调用方写下的模型名替换成这个来源模型。

配置和调用方式见 [虚拟分组的使用](/app/docs/virtual-groups)。
