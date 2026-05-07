import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadConfig } from '../src/config.mjs';
import { createStorage } from '../src/storage.mjs';
import { createEmbedder } from '../src/embedder.mjs';
import { createRetrieval } from '../src/retrieval.mjs';
import { createAuditedFetch, truncateAuditLog, countExternalCalls } from '../src/audit.mjs';
import { scoreRun } from './score.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadJsonl(p) {
  return readFileSync(p, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function pct(x) {
  return (x * 100).toFixed(1) + '%';
}

async function main() {
  const configPath = process.env.CONFIG_PATH;
  if (!configPath) {
    console.error('CONFIG_PATH env var required');
    process.exit(1);
  }
  const config = loadConfig(configPath);

  // Truncate audit log so this run's count is clean.
  truncateAuditLog(config.audit.log_path);

  const memories = loadJsonl(join(__dirname, 'data', 'memories.jsonl'));
  const questions = loadJsonl(join(__dirname, 'data', 'questions.jsonl'));

  const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;
  const memSlice = limit ? memories.slice(0, Math.min(limit, memories.length)) : memories;
  const qSlice = limit ? questions.slice(0, Math.min(limit, questions.length)) : questions;

  console.log(
    `[memorystore] running benchmark — ${memSlice.length} memories, ${qSlice.length} recall questions`,
  );

  // Wipe the storage file for a clean run.
  if (existsSync(config.storage.db_path)) unlinkSync(config.storage.db_path);

  const storage = createStorage({ dbPath: config.storage.db_path, dim: config.embedding.dim });
  const auditedFetch = createAuditedFetch({
    logPath: config.audit.log_path,
    internalHosts: config.audit.internal_hosts,
  });
  const embedder = createEmbedder({
    baseUrl: config.embedding.base_url,
    model: config.embedding.model,
    dim: config.embedding.dim,
    fetchImpl: auditedFetch,
  });
  const retrieval = createRetrieval({
    embedder,
    storage,
    defaultK: config.retrieval.default_k,
  });

  // Ingest
  console.log('  ingesting memories...');
  const idMap = new Map(); // dataset id -> stored DB id
  const ingestStart = Date.now();
  for (const m of memSlice) {
    const stored = await retrieval.store(m.text, m.metadata ?? {});
    idMap.set(m.id, stored.id);
  }
  const ingestMs = Date.now() - ingestStart;
  console.log(
    `     ${memSlice.length}/${memSlice.length} OK  (avg ${Math.round(ingestMs / memSlice.length)}ms/memory)`,
  );

  // Query
  console.log('  asking questions...');
  const queryStart = Date.now();
  const latencies = [];
  const results = [];
  for (const q of qSlice) {
    const t0 = Date.now();
    const top = await retrieval.recall(q.query, 5);
    latencies.push(Date.now() - t0);
    // Map stored DB ids back to dataset ids for scoring.
    const top_k_with_dataset_ids = top.map((row) => {
      const datasetId = [...idMap.entries()].find(([, dbId]) => dbId === row.id)?.[0];
      return { id: datasetId };
    });
    results.push({
      question_id: q.id,
      expected_memory_id: q.expected_memory_id,
      top_k_results: top_k_with_dataset_ids,
    });
  }
  const queryMs = Date.now() - queryStart;
  console.log(
    `     ${qSlice.length}/${qSlice.length} OK  (avg ${Math.round(queryMs / qSlice.length)}ms/query)`,
  );

  // Score
  const summary = scoreRun(results);
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const max = latencies[latencies.length - 1] ?? 0;

  // Network audit
  const externalCalls = countExternalCalls(config.audit.log_path);

  // Print
  console.log('');
  console.log('RECALL:');
  console.log(`  top-1 hit rate:  ${summary.top1.hits} / ${summary.top1.total} (${pct(summary.top1.rate)})`);
  console.log(`  top-5 hit rate:  ${summary.top5.hits} / ${summary.top5.total} (${pct(summary.top5.rate)})`);
  console.log('');
  console.log('LATENCY (per query):');
  console.log(`  p50:  ${p50}ms`);
  console.log(`  p95:  ${p95}ms`);
  console.log(`  max:  ${max}ms`);
  console.log('');
  console.log('NETWORK FOOTPRINT:');
  console.log(`  external calls:  ${externalCalls}`);
  console.log(`  audit log:       ${config.audit.log_path}`);
  console.log('');

  // Acceptance band
  let band;
  if (summary.top1.rate >= 0.75 && summary.top5.rate >= 0.9 && externalCalls === 0) band = 'Strong';
  else if (summary.top1.rate >= 0.6 && summary.top5.rate >= 0.8 && externalCalls === 0) band = 'Acceptable';
  else band = 'Weak';
  console.log(`STATUS: ${band} band`);

  // Hard fail if external calls happened (privacy claim violated)
  if (externalCalls > 0) {
    console.error('');
    console.error('FAIL: benchmark detected external network calls. Privacy claim broken.');
    console.error('Inspect the audit log for details.');
    process.exit(2);
  }

  storage.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
