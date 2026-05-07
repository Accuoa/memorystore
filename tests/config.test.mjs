import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.mjs';

let tmpFile;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'config-'));
  tmpFile = join(dir, 'config.yml');
});

describe('loadConfig', () => {
  it('parses a valid YAML config', () => {
    writeFileSync(
      tmpFile,
      `
storage:
  db_path: /tmp/test.db
embedding:
  base_url: http://localhost:11434
  model: nomic-embed-text
  dim: 768
server:
  http_port: 8787
  enable_mcp_stdio: true
retrieval:
  default_k: 5
audit:
  log_path: /tmp/audit.jsonl
  internal_hosts: [localhost, 127.0.0.1]
`,
      'utf-8',
    );
    const config = loadConfig(tmpFile);
    expect(config.storage.db_path).toBe('/tmp/test.db');
    expect(config.embedding.model).toBe('nomic-embed-text');
    expect(config.embedding.dim).toBe(768);
    expect(config.retrieval.default_k).toBe(5);
    expect(config.audit.internal_hosts).toEqual(['localhost', '127.0.0.1']);
  });

  it('throws when file does not exist', () => {
    expect(() => loadConfig('/nonexistent/path.yml')).toThrow(/config/i);
  });

  it('throws when YAML is malformed', () => {
    writeFileSync(tmpFile, 'storage: {invalid: yaml: here', 'utf-8');
    expect(() => loadConfig(tmpFile)).toThrow();
  });
});
