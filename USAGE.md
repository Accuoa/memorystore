# Usage

## Configuration

memorystore reads its config from a YAML file specified by `CONFIG_PATH`. Default template in [`config.example.yml`](./config.example.yml).

### Storage

```yaml
storage:
  db_path: /data/memorystore.db # single SQLite file (use ./data/... for native runs)
```

`memorystore.db` is the only stateful artifact. Back it up by copying the file. Delete it to wipe everything.

### Embedding

```yaml
embedding:
  base_url: http://ollama:11434 # http://localhost:11434 for native-host Ollama
  model: nomic-embed-text # any Ollama embedding model
  dim: 768 # MUST match the model's output dim
```

You can swap the embedding model by:

1. `ollama pull <new-model>`
2. Edit `model:` and `dim:` in this file
3. Edit `src/schema.sql` to match the new dim
4. Wipe `memorystore.db` (the existing vectors are the wrong dimensionality)

### Server

```yaml
server:
  http_port: 8787
  enable_mcp_stdio: true # set false for REST-only deployments
```

The MCP server runs from `src/mcp.mjs` and uses stdio. The HTTP server runs from `src/server.mjs`. They share the same storage and embedder.

### Retrieval

```yaml
retrieval:
  default_k: 5 # top-k when client doesn't specify
```

### Audit

```yaml
audit:
  log_path: /data/logs/network.jsonl
  internal_hosts:
    - localhost
    - 127.0.0.1
    - ollama
    - host.docker.internal
```

Every outbound HTTP request is logged here. `internal_hosts` are tagged `internal: true`. Anything else is `internal: false`. The benchmark fails if any `internal: false` rows exist.

## Connecting an MCP client

### Claude Desktop

Edit your `claude_desktop_config.json` (location varies by OS — see Claude Desktop docs):

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

Restart Claude Desktop. Use the four tools (`store_memory`, `recall_memory`, `list_memories`, `delete_memory`) directly in conversation.

### Other MCP clients

memorystore implements the standard MCP stdio transport. Any MCP-compatible client should work — point it at `node /ABSOLUTE/PATH/.../src/mcp.mjs` with `CONFIG_PATH` set.

## Reproducing the headline numbers

```bash
docker compose up -d
npm run benchmark
```

Or native-host Ollama:

```bash
CONFIG_PATH=./config.local.yml node benchmark/run.mjs
```

The benchmark uses 150 committed items (`benchmark/data/`). Anyone can rerun and verify.

## Limitations (alpha)

- Single-tenant. No auth, rate limiting, or per-user accounting.
- Memories are immutable except for delete (no edit).
- No metadata-filtered query in the API surface (storage layer supports it; v0.2).
- No hybrid keyword+vector retrieval (v0.2).
- No remote sync — that's [idea #3 (CRDT memory sync)](https://github.com/Accuoa/crdt-memory-sync), a separate alpha.
- No format-survives-upgrades export — that's [idea #2 (format surviving upgrades)](https://github.com/Accuoa/format-survives-upgrades), a separate alpha.
