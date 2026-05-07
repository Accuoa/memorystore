import Fastify from 'fastify';
import { pathToFileURL } from 'node:url';
import { createStorage } from './storage.mjs';
import { createEmbedder } from './embedder.mjs';
import { createRetrieval } from './retrieval.mjs';
import { createAuditedFetch } from './audit.mjs';
import { loadConfig } from './config.mjs';

export async function buildApp({ config, embedder: embedderOverride } = {}) {
  if (!config) {
    const path = process.env.CONFIG_PATH;
    if (!path) throw new Error('CONFIG_PATH env var required when buildApp called with no config');
    config = loadConfig(path);
  }

  const storage = createStorage({ dbPath: config.storage.db_path, dim: config.embedding.dim });

  let embedder = embedderOverride;
  if (!embedder) {
    const auditedFetch = createAuditedFetch({
      logPath: config.audit.log_path,
      internalHosts: config.audit.internal_hosts,
    });
    embedder = createEmbedder({
      baseUrl: config.embedding.base_url,
      model: config.embedding.model,
      dim: config.embedding.dim,
      fetchImpl: auditedFetch,
    });
  }

  const retrieval = createRetrieval({ embedder, storage, defaultK: config.retrieval.default_k });

  const app = Fastify({ logger: false });

  app.addHook('onClose', async () => {
    storage.close();
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/stats', async () => ({
    count: storage.count(),
    embedding_model: config.embedding.model,
    embedding_dim: config.embedding.dim,
  }));

  app.post('/memories', async (req, reply) => {
    const { text, metadata } = req.body ?? {};
    if (typeof text !== 'string' || text.length === 0) {
      return reply.code(400).send({ error: 'text (string) is required' });
    }
    const memory = await retrieval.store(text, metadata);
    reply.code(201);
    return memory;
  });

  app.get('/memories', async (req) => {
    const { q, k } = req.query;
    if (typeof q !== 'string' || q.length === 0) {
      const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 200);
      const offset = parseInt(req.query.offset ?? '0', 10);
      return { results: storage.list({ limit, offset }) };
    }
    const kNum = k ? parseInt(k, 10) : config.retrieval.default_k;
    const results = await retrieval.recall(q, kNum);
    return { results };
  });

  app.get('/memories/:id', async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const m = storage.getById(id);
    if (!m) return reply.code(404).send({ error: 'not found' });
    return m;
  });

  app.delete('/memories/:id', async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (!storage.getById(id)) return reply.code(404).send({ error: 'not found' });
    storage.deleteById(id);
    return reply.code(204).send();
  });

  return app;
}

// CLI entrypoint guard — pathToFileURL needed on Windows (lesson from Plan 3).
const invokedAsScript = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (invokedAsScript) {
  const app = await buildApp();
  const config = loadConfig(process.env.CONFIG_PATH);
  const port = config.server.http_port ?? 8787;
  app.listen({ port, host: '0.0.0.0' }, (err, addr) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`memorystore HTTP listening on ${addr}`);
  });
}
