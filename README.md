# memorystore

> **Self-hosted, MCP-native memory for AI assistants.** SQLite + sqlite-vec under the hood, Ollama for embeddings, zero external network calls.

[![alpha demo](https://img.shields.io/badge/status-alpha%20demo-orange)](https://accuoa.github.io/memorystore/)

## Headline numbers (from a 50-question recall benchmark)

On 100 hand-built memories, 50 recall questions:

- **86% top-1 recall** (correct memory at #1)
- **96% top-5 recall** (correct memory in top 5)
- **0 external network calls** (verified by audit log committed to repo)
- **58ms p95 query latency**

Reproduce these numbers yourself in <90s — see [Quickstart](#quickstart). Methodology in [`calibration.md`](./calibration.md).

## Quickstart (native-host Ollama, recommended)

Requires: Ollama installed natively on the host (`brew install ollama` / [download](https://ollama.com/download)), `nomic-embed-text` pulled, Node 20+.

```bash
ollama pull nomic-embed-text
ollama serve &

git clone https://github.com/Accuoa/memorystore.git
cd memorystore
npm install
mkdir -p data/logs
cp config.example.yml config.local.yml
# Edit config.local.yml: change embedding.base_url to http://localhost:11434
# and storage paths to ./data/...
CONFIG_PATH=./config.local.yml node src/server.mjs
```

In a second terminal:

```bash
CONFIG_PATH=./config.local.yml node benchmark/run.mjs
```

Or use the all-Docker path:

```bash
git clone https://github.com/Accuoa/memorystore.git
cd memorystore
docker compose up -d
npm install
npm run benchmark
```

## How to use it from Claude Desktop

Drop this into your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "memorystore": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/memorystore/src/mcp.mjs"],
      "env": { "CONFIG_PATH": "/ABSOLUTE/PATH/TO/memorystore/config.example.yml" }
    }
  }
}
```

Restart Claude Desktop. You'll see four new tools: `store_memory`, `recall_memory`, `list_memories`, `delete_memory`. Now Claude can save things across sessions and recall them later — and the data never leaves your machine.

## How retrieval works

Every stored memory gets an embedding via local Ollama (`nomic-embed-text`, 768-dim). On recall, the query is embedded and the top-k nearest neighbors come back via `sqlite-vec`'s cosine-similarity index. No reranking, no LLM-based scoring, no learned classifier — just deterministic embed + cosine + sort.

Privacy is enforced at runtime: every outbound HTTP request flows through an audit wrapper that logs to `./logs/network.jsonl`. The benchmark runner asserts no `internal: false` calls were made. If memorystore phones home, the benchmark fails. You can verify yourself.

See [USAGE.md](./USAGE.md) for the config reference, [ARCHITECTURE.md](./ARCHITECTURE.md) for how it works internally, and [ROADMAP.md](./ROADMAP.md) for what's next.

## Status

`alpha demo` — store / recall / list / delete work, both REST and MCP transports work, the benchmark numbers are calibrated. Production hardening (auth, multi-tenant, sync, edits) is intentionally out of scope for this alpha. See [ROADMAP.md](./ROADMAP.md).

## License

MIT — see [LICENSE](./LICENSE).
