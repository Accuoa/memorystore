import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { pathToFileURL } from 'node:url';
import { createStorage } from './storage.mjs';
import { createEmbedder } from './embedder.mjs';
import { createRetrieval } from './retrieval.mjs';
import { createAuditedFetch } from './audit.mjs';
import { loadConfig } from './config.mjs';

export function buildMcpServer({ config, embedder: embedderOverride } = {}) {
  if (!config) {
    const path = process.env.CONFIG_PATH;
    if (!path) throw new Error('CONFIG_PATH required');
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

  const server = new Server(
    { name: 'memorystore', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'store_memory',
        description: 'Store a piece of long-term memory with optional metadata.',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'The memory text to store.' },
            metadata: { type: 'object', description: 'Optional metadata.' },
          },
          required: ['text'],
        },
      },
      {
        name: 'recall_memory',
        description: 'Retrieve memories most relevant to a query.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            k: { type: 'integer', minimum: 1, maximum: 50 },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_memories',
        description: 'List stored memories, most recent first.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 200 },
            offset: { type: 'integer', minimum: 0 },
          },
        },
      },
      {
        name: 'delete_memory',
        description: 'Delete a memory by id.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'integer' } },
          required: ['id'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    switch (name) {
      case 'store_memory': {
        const m = await retrieval.store(args.text, args.metadata ?? {});
        return { content: [{ type: 'text', text: JSON.stringify(m, null, 2) }] };
      }
      case 'recall_memory': {
        const results = await retrieval.recall(args.query, args.k ?? config.retrieval.default_k);
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      }
      case 'list_memories': {
        const rows = storage.list({ limit: args.limit ?? 50, offset: args.offset ?? 0 });
        return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
      }
      case 'delete_memory': {
        if (!storage.getById(args.id)) {
          return { content: [{ type: 'text', text: `not found: ${args.id}` }], isError: true };
        }
        storage.deleteById(args.id);
        return { content: [{ type: 'text', text: `deleted ${args.id}` }] };
      }
      default:
        return { content: [{ type: 'text', text: `unknown tool: ${name}` }], isError: true };
    }
  });

  return { server, close: () => storage.close() };
}

const invokedAsScript = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (invokedAsScript) {
  const { server } = buildMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
