# Calibration log

## Runs

### Run 1 (baseline, default config)

- Date: 2026-05-07
- Config: `nomic-embed-text` (768-dim), `default_k=5`
- Hardware: Windows 11 Home (10.0.26200), native-host Ollama on localhost:11434

RECALL:  top-1: 43/50 (86.0%), top-5: 48/50 (96.0%)
LATENCY: p50: 41ms, p95: 47ms, max: 48ms
NETWORK: external calls: 0
INGEST:  100/100 memories, avg 43ms/memory

### Run 2 (stability)

- Config: identical to Run 1
- RECALL:  top-1: 43/50 (86.0%), top-5: 48/50 (96.0%)
- LATENCY: p50: 49ms, p95: 58ms, max: 61ms
- NETWORK: external calls: 0
- INGEST:  100/100 memories, avg 47ms/memory

### Run 3 (stability)

- Config: identical to Run 1
- RECALL:  top-1: 43/50 (86.0%), top-5: 48/50 (96.0%)
- LATENCY: p50: 56ms, p95: 63ms, max: 73ms
- NETWORK: external calls: 0
- INGEST:  100/100 memories, avg 66ms/memory

### Tuning iteration 1

Not applicable — baseline numbers landed in the Strong band on the first run, and all three runs returned identical recall (top-1 fluctuation: 0pp, well under the 4pp re-run threshold). No tuning attempted.

## Final headline numbers (used in launch artifacts)

Median across the 3 stable runs:
- **Top-1 recall: 86%** (43/50, identical across all 3 runs)
- **Top-5 recall: 96%** (48/50, identical across all 3 runs)
- **External network calls: 0** (across all 3 runs; 150 internal calls per run to localhost:11434)
- **p95 query latency: 58ms** (median of 47 / 58 / 63)

Same misses on all 3 runs (recall is deterministic given the embedding model, dataset, and `default_k`), so the median equals every observation.

## Acceptance band

**Strong.** The Strong band threshold is top-1 >= 75%, top-5 >= 90%, and 0 external calls. We landed at 86% / 96% / 0 — comfortably above the floor on every dimension. The runner's built-in band classifier independently reported `STATUS: Strong band` on each run.

## Methodology notes

- Embedding model: `nomic-embed-text` (Nomic AI, 137M params, F16 quant) via Ollama
- Vector dim: 768
- Storage: SQLite + `sqlite-vec` extension (cosine distance)
- Workload: 100 seeded memories + 50 recall questions, mixed across direct lookups, paraphrased retrieval, distinguishing-detail probes, and decoy-resistance items
- Each run wipes `./data/memorystore.db` and truncates `./data/logs/network.jsonl` at the start, so per-run external-call counts are clean
- Wall clock per run: ~9-12s (ingest ~4-7s + query ~2-3s, plus startup overhead)
- All embedding calls hit `http://localhost:11434/api/embeddings` and were tagged `internal: true` by the audit-log classifier; final external-call count = 0 across all 3 runs
- `default_k=5` for retrieval; top-5 means the expected memory appeared in the first 5 returned by cosine similarity
