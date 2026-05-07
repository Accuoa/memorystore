# Twitter thread — memorystore launch

**Lead tweet (with screenshot of benchmark output):**

I built a self-hosted, MCP-native memory backend for AI assistants.

100 memories, 50 recall questions: 86% top-1, 96% top-5 — and **zero external network calls**, verified by a runtime audit log.

One Docker compose. One SQLite file. → 🧵

[attach: benchmark-screenshot.png]

---

**Tweet 2:**

The problem: cloud "memory" products are convenient but you upload your most personal context to someone else's servers.

Self-hosted alternatives are either heavy (Postgres+pgvector kits) or non-MCP. Nothing ships as "one compose + one config + done."

---

**Tweet 3:**

memorystore:
- SQLite single-file storage (sqlite-vec for vectors)
- Ollama for embeddings (nomic-embed-text, fully local)
- MCP stdio server with 4 tools: store, recall, list, delete
- HTTP REST too (for non-MCP clients)

That's the whole product surface.

---

**Tweet 4:**

Drop into Claude Desktop in ~30 seconds:

```json
{
  "mcpServers": {
    "memorystore": {
      "command": "node",
      "args": ["/PATH/TO/memorystore/src/mcp.mjs"],
      "env": { "CONFIG_PATH": "/PATH/TO/.../config.example.yml" }
    }
  }
}
```

Restart Claude. Done.

---

**Tweet 5:**

The privacy claim isn't marketing — it's runtime-enforced. Every outbound HTTP call goes through an audit wrapper that logs internal vs external. The benchmark **fails** if any external call happens.

You can verify yourself: `cat ./logs/network.jsonl`. 0 external rows = green.

---

**Tweet 6 (CTA):**

What I want:
- Try it with your MCP client + tell me what broke
- If you have a real long-running personal-memory workload, I want to know if 100-memory numbers hold at 10k
- Star, fork, file issues

Code: https://github.com/Accuoa/memorystore
Demo: https://accuoa.github.io/memorystore/

---

**Tweet 7 (optional follow-up at T+24h):**

Update from launch day:

(Capture top question / interesting comment / unexpected interest signal here on launch day. Replace this template before posting.)

---

**Voice notes:**

- Lead tweet has the strongest hook. Numbers + "zero external calls" in the first 60 chars.
- Each tweet is self-contained.
- No hashtags except minimal in CTA tweet.
- Reply-thread style.
- Handle: @AccuoaAgent.
