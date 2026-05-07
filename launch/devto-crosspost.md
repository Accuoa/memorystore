---
title: "Self-hosted memory for AI assistants — local-first, MCP-native, zero external calls"
published: false
description: "Single-file SQLite + sqlite-vec + Ollama. Drop into Claude Desktop. Verifiable privacy at runtime."
tags: ai, opensource, mcp, selfhosted
canonical_url: https://accuoa.github.io/memorystore/launch
cover_image: https://asciinema.org/a/<id>.svg
---

*Alpha release. One Docker compose. One SQLite file. Zero external network calls — verified at runtime.*

---

## Why I built this

> *(Draft note: this section is a fictional placeholder; rewriting with the real story before hitting publish.)*

Last summer I was migrating from ChatGPT to Claude Desktop, and I realized something uncomfortable: a year of preferences, project context, half-finished side-quest threads, and the model's sense of how I actually think — all of it was locked inside ChatGPT. There was no export, no migration tool, no clean way to bring "the part of the assistant that knows me" with me. I could copy out a few summaries, but the actual memory layer was someone else's database row.

That bugged me more the longer I sat with it. We've spent twenty years learning that data portability matters. Then we handed our most personal working context — the stuff a model uses to understand who you are and what you're working on — to whichever cloud assistant we picked first. And every "AI memory" startup that pitched me afterward wanted me to upload that context to *their* servers, in exchange for a UI and a feature roadmap.

AI memory should be mine. It should live in a file I own, on a disk I control, that I can grep, back up, delete, or move between assistants. memorystore is my attempt at that primitive.

## What's broken today

The current "personal AI memory" landscape splits cleanly into two camps, and neither one fits the user who wants sovereignty by default:

**Cloud memory products** — Mem0, Letta, Zep, and a long tail of similar SaaS — are convenient and feature-rich, but the price of admission is uploading your most personal working context to someone else's infrastructure. That's the right trade for many teams. It's the wrong trade for the user who wanted self-hosted in the first place.

**Self-hosted kits** — Postgres + pgvector, or chromadb / qdrant / weaviate paired with a homemade ingestion script — are production-grade but operationally heavy for a single human. You're configuring a database, an embedding pipeline, an indexing strategy, and a retrieval surface before you can store your first memory. None of them speak MCP, so connecting them to Claude Desktop or Cursor is yet another layer of glue.

The gap I kept hitting: nothing ships as *one Docker compose, plus one MCP config, plus done*. That's the primitive missing from the market.

## Why existing solutions fall short (the honest version)

To be fair to the prior art:

- **Mem0, Letta, Zep are good products.** If you don't care about data residency and you want a polished memory layer that scales to teams, they're a reasonable pick. They're solving a different problem than I am.
- **Postgres + pgvector is the right answer at scale.** If you're building a multi-tenant product, that stack is battle-tested and will outlive whatever I ship. It's just heavy when "the multi-tenant product" is a single human and their laptop.
- **Existing self-hosted vector DBs are well-engineered.** chromadb, qdrant, weaviate are all good projects. They just don't compose into "drop into Claude Desktop in 30 seconds" out of the box.

The honest gap is a missing combination, not a missing component: MCP-native + single-binary + runtime-verifiable-privacy + drop-in for desktop assistants. memorystore is the smallest viable thing I could build that fills that combination.

## The proposal in plain English

memorystore is one process that does one thing: it stores text memories with vector embeddings on your local disk and serves them back via retrieval. It's an MCP server first (so Claude Desktop, Cursor, and other MCP clients pick it up natively) and an HTTP REST server second (so anything that can hit localhost can use it).

- Storage is one SQLite file — `memorystore.db` — with the `sqlite-vec` extension for vector search.
- Embeddings come from Ollama running locally. Default model is `nomic-embed-text`, swappable in config.
- The MCP surface is four tools: `store_memory`, `recall_memory`, `list_memories`, `delete_memory`.
- Privacy is runtime-enforced, not marketed. Every outbound HTTP call from the server flows through an audit wrapper that classifies it internal vs external and writes to `./logs/network.jsonl`. The benchmark fails if any external call is logged during a run.

Drop the MCP config into Claude Desktop, restart the app, and your assistant has a memory backend that lives in a file you can move, back up, delete, or inspect. The whole thing is a couple thousand lines of Node.

### Claude Desktop config

```json
{
  "mcpServers": {
    "memorystore": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/memorystore/src/mcp.mjs"],
      "env": {
        "CONFIG_PATH": "/ABSOLUTE/PATH/TO/memorystore/config.example.yml"
      }
    }
  }
}
```

Restart Claude Desktop. Done.

## The numbers

Recall numbers come from a 100-memory ingest plus 50 hand-built recall questions covering direct lookups, paraphrased retrieval, distinguishing-detail probes, and decoy-resistance items. Run it yourself with `node benchmark/run.mjs` after pointing `CONFIG_PATH` at your config. Three consecutive runs landed identical recall (deterministic given a fixed embedding model, dataset, and `default_k`); see `calibration.md` for the full audit log.

```
RECALL:
  top-1 hit rate:  43 / 50 (86.0%)
  top-5 hit rate:  48 / 50 (96.0%)

LATENCY (per query):
  p50:  49ms
  p95:  58ms
  max:  61ms

NETWORK FOOTPRINT:
  external calls:  0
  audit log:       ./data/logs/network.jsonl

STATUS: Strong band
```

Watch a fresh run: [asciinema.org/a/&lt;id&gt;](https://asciinema.org/a/<id>).

The honest caveat: the workload is biased. It's hand-built by me, single-user, English-only, and tuned to the kind of personal-memory questions I expect a Claude Desktop user to ask. The numbers don't tell you anything about multi-language recall, adversarial probes, or what happens at 10,000 memories — they tell you what the alpha looks like on the workload it was designed for. Treat the band classifier (`Strong` / `Acceptable` / `Weak`) as the durable signal, not the exact percentages.

## What I want from you

Three specific asks, in priority order:

1. **Try it with your own MCP client and tell me what broke.** Claude Desktop is the primary integration target, but Cursor, Continue, and any other MCP-stdio client should work. If you get a cryptic error, a config that doesn't load, or a tool call that hangs, file an issue with the OS, the client, and the exact steps. This is the highest-value feedback I can get right now.
2. **Threat-model gaps.** The audit-log approach catches HTTP traffic going through Node's `fetch`. It does *not* catch DNS lookups, and it doesn't catch traffic from native bindings that bypass the wrapper. If you can think of an attack surface I haven't covered, tell me — that's the kind of feedback that makes the privacy claim defensible.
3. **Long-running personal-memory workload data.** The 100-memory benchmark is a calibration set, not a real workload. If you have a year of journal entries, a multi-year chat history, or another long-running personal-memory dataset, I want to know whether the 86%-top-1 number holds at 10,000 memories or whether it falls off a cliff around 1,000.

## Where to find me

GitHub: [@Accuoa](https://github.com/Accuoa). Twitter: [@AccuoaAgent](https://twitter.com/AccuoaAgent). dev.to: [@accuoa](https://dev.to/accuoa). Comment here, file GitHub issues, or DM me on Twitter — whichever channel is most convenient. Issues with reproducible repro steps will get the most attention.
