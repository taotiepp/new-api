# Request archives

Optional JSONL archives are independent of consumption logs and databases.
Enable them with environment variables and restart the server:

```dotenv
REQUEST_ARCHIVE_ENABLED=true
REQUEST_ARCHIVE_DIR=./data/request-archives
REQUEST_ARCHIVE_MAX_BODY_BYTES=1048576
REQUEST_ARCHIVE_RETENTION_DAYS=0
```

- Disabled by default. `RETENTION_DAYS=0` keeps files indefinitely; a positive
  value enables hourly cleanup by UTC file date, retaining at least that many
  complete days. Cleanup only removes this feature's generated archive files.
- Files are named `requests-YYYY-MM-DD-<random-id>.jsonl` by the request's UTC
  start date. Each process uses separate files; restarts can produce several
  files for one day. Multiple instances may use a shared persistent directory.
- New directories use mode `0700`; files use `0600`. Mount the directory on a
  persistent volume for containers. The application exposes no archive HTTP API.
- Each line contains request ID, user/token/channel IDs, model, timestamp,
  method, path, status, elapsed milliseconds, stream flag, capture states and
  nested `request`/`response` JSON values. Bodies are objects/arrays rather than
  double-encoded JSON strings. The schema's `version` is currently `1`.
- JSON request bodies are captured before distribution/conversion. Responses
  are what the gateway writes to the client. OpenAI Chat/Completions, Claude,
  Gemini and Responses SSE streams are reconstructed into their corresponding
  non-stream JSON shapes, including text and tool calls. Partial streams carry
  `response_state: "incomplete"`; unsupported streams never fall back to raw SSE.
- Collection runs on authenticated relay submissions, including playground,
  Gemini and Midjourney. GET requests and WebSocket upgrades are skipped.
  Binary/multipart bodies are omitted (`unsupported`); malformed JSON is omitted
  (`invalid_json`). Requests rejected before their body is read may have
  `request_state: "not_read"`. Empty bodies carry `empty`.
- The body limit applies separately to each direction (default 1 MiB, maximum
  16 MiB), including collected SSE bytes and the resulting JSON. Oversized bodies
  are omitted with `too_large`; relay delivery continues unchanged.
- Headers and URL query strings are excluded. Common credential field names
  inside JSON are redacted. Conversation content is retained and may itself
  contain sensitive information; this is not general-purpose content redaction.
- Complete lines are appended under a per-process lock after handling each
  request. Files are synced on orderly close; there is no per-request `fsync`
  guarantee against machine failure. Write failures are logged with the request
  ID and do not change the response or fall back to consumption logs.

For example, inspect the reconstructed response with:

```sh
jq 'select(.request_id == "REQUEST_ID") | .response' data/request-archives/*.jsonl
```
