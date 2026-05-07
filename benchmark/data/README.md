# Benchmark dataset

Hand-built dataset of 100 memories and 50 recall questions, designed to stress an embedding-based retrieval system.

## Files

- `memories.jsonl`: one JSON object per line. Schema: `{ id: number, text: string, metadata?: object }`.
- `questions.jsonl`: one JSON object per line. Schema: `{ id: number, query: string, expected_memory_id: number }`.

## Composition

The 100 memories cover four classes:

1. **Direct facts** (~40): "My birthday is March 12.", "I work at Acme Corp.", etc. — the easy retrieval cases.
2. **Preferences** (~25): "I prefer coffee over tea.", "Dark mode whenever possible." — same flavor as facts but more interpretation.
3. **Past-conversation snippets** (~20): "Last October I mentioned I was learning Rust." — paraphrased queries probe these.
4. **Decoys** (~15): facts that LOOK similar to the questions but should NOT match. e.g. memory: "My friend Anna was born in March." vs question "What month was I born?". Tests retrieval discrimination.

The 50 questions are split:

- **30 direct-recall** questions matching the direct-fact memories.
- **15 paraphrased** questions matching past-conversation snippets.
- **5 distinguishing** questions where a decoy memory is similar — top-1 should still be the correct memory.

## License

MIT (per portfolio convention for product alphas).
