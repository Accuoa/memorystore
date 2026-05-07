# Architecture

## Big picture

```
                         ┌─────────────────────────┐
                         │  MCP-aware AI client    │
                         │ (Claude Desktop, Cursor,│
                         │  custom Python script)  │
                         └────────────┬────────────┘
                                      │ MCP stdio
                                      ▼
              ┌──────────────────────────────────────────────┐
              │            memorystore (Fastify)             │
              │   localhost:8787  ───────  MCP stdio bridge  │
              │                                              │
              │   ┌──────────────┐    ┌────────────────────┐ │
              │   │  REST API    │    │   MCP server        │ │
              │   │  /memories   │    │   store_memory      │ │
              │   │              │    │   recall_memory     │ │
              │   └──────┬───────┘    └──────────┬─────────┘ │
              │          │                       │           │
              │          └────────┬──────────────┘           │
              │                   ▼                          │
              │          ┌─────────────────┐                 │
              │          │ retrieval core  │                 │
              │          │  embed + topK   │                 │
              │          └────────┬────────┘                 │
              │                   │                          │
              │      ┌────────────┴────────────┐             │
              │      ▼                         ▼             │
              │ ┌──────────┐          ┌─────────────────┐    │
              │ │ Ollama    │          │ SQLite +        │    │
              │ │ embed via │          │  sqlite-vec     │    │
              │ │ nomic-    │          │ memorystore.db  │    │
              │ │ embed-    │          │ (single file)   │    │
              │ │ text      │          └─────────────────┘    │
              │ └──────────┘                                 │
              │                                              │
              │  every external request → logged to          │
              │  ./logs/network.jsonl                        │
              └──────────────────────────────────────────────┘
```

## Data layer

A single SQLite file holds two tables:

```sql
CREATE TABLE memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE memories_vec USING vec0(
  embedding float[768]
);
```

`sqlite-vec`'s `vec0` virtual table stores embeddings keyed to `memories.id` (via `rowid`). On query, we issue a cosine-distance `MATCH` query and `JOIN memories ON id = rowid` to return enriched rows.

The whole DB is one file. Backups are `cp`. Resets are `rm`. Audit is `sqlite3 memorystore.db .schema`.

## Retrieval path

```
recall(query, k):
  embedding   = await ollama.embed(query)        ← 768-dim Float32Array
  rows        = sqlite_vec.match(embedding, k)   ← top-k by cosine distance
  return rows mapped { id, text, metadata, similarity = 1 - distance }
```

No reranker, no LLM-based scorer, no learned classifier. The retrieval is fully deterministic given the same DB state and the same query embedding (modulo floating-point).

## Privacy at runtime

The audit wrapper sits in front of every `fetch()` call from `src/`. It classifies the destination host as `internal` (in the configured allowlist: localhost, ollama, etc.) or external. Both cases are logged with timestamp, method, URL, and HTTP status.

The benchmark runner truncates the audit log at the start of each run, so the assertion at the end ("no external calls happened") measures only that run. If memorystore makes an external call — anywhere, for any reason — the benchmark fails with exit code 2.

This converts "we don't phone home" from a marketing claim into a runtime contract.

## Why SQLite + sqlite-vec instead of Postgres + pgvector?

A single-file backup, a single-process boot, and a single Docker service are all worth more than the production-readiness of Postgres at the alpha stage. The whole point of memorystore is sovereignty — the user owns their data and the cost of running this should be zero. SQLite delivers that.

We may revisit at v1.0 if multi-tenant or remote-sync features land. For now, one file.

## Why Ollama for embeddings instead of OpenAI?

The "zero external network calls" headline only works if embeddings are local. OpenAI embeddings are cheap, accurate, and fast — but they require a network call per memory. That's a non-starter for the privacy-first framing.

`nomic-embed-text` (137M params, 768-dim, MIT license) is the closest practical alternative. Recall in calibration was Strong (86% top-1 / 96% top-5) — see [`calibration.md`](./calibration.md).

## Module map

| File                  | Responsibility                                             |
| --------------------- | ---------------------------------------------------------- |
| `src/server.mjs`      | Fastify HTTP app, REST routes, CLI entrypoint              |
| `src/mcp.mjs`         | MCP server (stdio transport), tool handlers                |
| `src/retrieval.mjs`   | embed + topK orchestrator (`store`, `recall`)              |
| `src/storage.mjs`     | SQLite + sqlite-vec wrapper (insert, search, list, delete) |
| `src/embedder.mjs`    | Ollama embedding client                                    |
| `src/audit.mjs`       | outbound-fetch wrapper + audit log writer                  |
| `src/config.mjs`      | YAML config loader                                         |
| `src/schema.sql`      | DDL applied on first DB boot                               |
| `benchmark/run.mjs`   | end-to-end harness                                         |
| `benchmark/score.mjs` | top-1 / top-5 hit-rate scorer                              |

## Threat model (alpha)

- **In scope:** unauthorized data exfiltration over the network. Audit log + benchmark assertion guard against this.
- **Out of scope:** local file-system access by other processes on the same machine (memorystore writes its DB to a known path; standard OS perms apply). Out of scope: multi-user environments, untrusted network, untrusted clients.

This alpha is designed for a single user on a trusted machine. Multi-tenant and untrusted-network deployments are v0.2+ work.
