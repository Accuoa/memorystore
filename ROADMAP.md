# Roadmap

## Done — v0.1 alpha

- HTTP REST API (`POST /memories`, `GET /memories?q=`, `GET /memories/:id`, `DELETE /memories/:id`, `GET /stats`, `GET /health`)
- MCP stdio server with four tools (`store_memory`, `recall_memory`, `list_memories`, `delete_memory`)
- SQLite + sqlite-vec storage (single-file, cosine-similarity top-k)
- Ollama embedding client (`nomic-embed-text` default, swappable)
- Network audit wrapper + benchmark assertion (zero external calls verified)
- 100-memory / 50-question recall benchmark, calibrated headline numbers (86% top-1 / 96% top-5)
- `examples/claude-desktop-config.json` for drop-in Claude Desktop integration
- Docker compose + native-host quickstart paths

## In flight

- Validation period: 30-day signal-collection window per the [portfolio strategy](https://github.com/Accuoa). Don't expect a v0.2 commit until that closes — the v0.2 scope depends on what people actually do with the alpha.

## Planned (v0.2 candidates — pick from based on alpha signal)

- **Hybrid retrieval** — combine BM25 (full-text on `text`) with vector cosine. Helps recall on exact-name queries that embeddings paraphrase away.
- **Metadata-filtered queries** — `GET /memories?q=...&filter[tag]=work&filter[after]=2026-01-01`. Storage layer supports it; just exposed via API.
- **Memory edits** — `PATCH /memories/:id` with re-embed-on-text-change. Currently immutable except for delete.
- **LLM-based reranker** — second-stage rerank of top-20 → top-5 using a local LLM (qwen2.5:3b). Adds a generation call per query but should improve top-1 on ambiguous queries.
- **Time-decay scoring** — recency boost for ranking. Useful when user has many old preferences that have changed.
- **Web UI** — minimal dashboard for browsing / searching / pruning the store.

## Out of scope (probably never, or different repos)

- Multi-tenant / multi-user — adds complexity without a clear single-user benefit.
- Remote sync — that's [idea #3, CRDT memory sync](https://github.com/Accuoa/crdt-memory-sync), a separate alpha.
- Format-survives-upgrades export — that's [idea #2](https://github.com/Accuoa/format-survives-upgrades), a separate alpha.
- Production-grade auth, rate limiting — out of scope; the alpha runs on localhost.
