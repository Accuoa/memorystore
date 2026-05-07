# r/selfhosted post draft — memorystore

## Title

`I built a self-hosted, MCP-native memory backend for AI assistants — single SQLite file, zero external network calls, verifiable at runtime`

## Flair

`Release` (or whatever the equivalent is at posting time).

## Body text

```
Hey r/selfhosted,

I've been chewing on the "personal AI memory" problem for a while. Every cloud "memory" product wants me to upload my context to their servers. Every self-hosted alternative is either a heavy Postgres+pgvector setup or doesn't speak MCP. So I wrote memorystore.

What it is:
- One Docker compose (or run on host, your call)
- One SQLite file (sqlite-vec extension for vectors)
- Ollama for embeddings (nomic-embed-text, fully local)
- MCP stdio server (Claude Desktop, Cursor, etc.) with 4 tools: store_memory, recall_memory, list_memories, delete_memory
- HTTP REST API too, for non-MCP clients

The privacy claim is runtime-enforced, not marketing: every outbound HTTP call from the server flows through an audit wrapper that logs to ./logs/network.jsonl. The benchmark runner asserts no external calls were made during the run. If memorystore phones home, the benchmark fails. You can verify yourself by reading the audit log file after a run.

Numbers from the benchmark (100 memories, 50 recall questions):
- Top-1 recall: 86%
- Top-5 recall: 96%
- External calls: 0 (verified)
- p95 query latency: 58ms

What's NOT in this alpha: multi-user, auth, edits, hybrid retrieval, time-decay scoring, metadata-filtered queries via the API. ROADMAP has the full v0.2 list. The alpha runs on localhost; threat model is single-user trusted machine.

Code + benchmark methodology committed: https://github.com/Accuoa/memorystore
Demo + landing: https://accuoa.github.io/memorystore/

I'd love feedback on:
1. Privacy threat model — is the audit-log assertion enough, or are there ways memorystore could leak that I haven't covered? (e.g., DNS lookups don't go through the audit wrapper — that's a known gap.)
2. Real-world workloads — if you have a long-running personal-memory workload (a year of journaling, a year of chat history), I want to know whether the 100-memory recall numbers hold at 10k.
3. Drop-in suggestions — if you self-host other AI tooling, where would memorystore fit (or not fit) in your setup?

Happy to answer questions.
```

## When to submit

Post during r/selfhosted's daily peak (US morning ET / UTC 13:00-15:00). Don't post on a weekend.

## Engagement plan (first 2 hours)

- **T+0min:** Post submitted. Comment on your own post: "I'll be in the comments for the next 2 hours, ask me anything."
- **T+15min:** First comments arrive. Reply to all of them. Tone: factual, generous, concede where wrong.
- **T+30-60min:** Watch for "but how do I know it's not phoning home" — lead the answer with `grep '"internal":false' ./logs/network.jsonl | wc -l`.
- **T+60-120min:** Engagement should peak. Keep replying.

## What to NOT do

- Don't reply with "thanks!" to compliments.
- Don't argue with negative comments.
- Don't link to a sales page or pricing.
- Don't cross-post to r/LocalLLaMA on the same day (mod overlap).
- Don't ask people to upvote or share.
