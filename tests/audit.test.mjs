import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAuditedFetch } from '../src/audit.mjs';

let tmpDir;
let logPath;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'audit-'));
  logPath = join(tmpDir, 'network.jsonl');
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function readLog() {
  if (!existsSync(logPath)) return [];
  return readFileSync(logPath, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

describe('createAuditedFetch', () => {
  it('logs internal=true for localhost calls', async () => {
    const baseFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const fetch = createAuditedFetch({
      logPath,
      internalHosts: ['localhost', '127.0.0.1', 'ollama'],
      baseFetch,
    });
    await fetch('http://localhost:11434/api/embeddings');
    const entries = readLog();
    expect(entries).toHaveLength(1);
    expect(entries[0].internal).toBe(true);
    expect(entries[0].url).toBe('http://localhost:11434/api/embeddings');
    expect(entries[0].status).toBe(200);
  });

  it('logs internal=true for the configured ollama host', async () => {
    const baseFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const fetch = createAuditedFetch({
      logPath,
      internalHosts: ['localhost', 'ollama', 'host.docker.internal'],
      baseFetch,
    });
    await fetch('http://ollama:11434/api/embeddings');
    expect(readLog()[0].internal).toBe(true);
  });

  it('logs internal=false for any other host', async () => {
    const baseFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const fetch = createAuditedFetch({
      logPath,
      internalHosts: ['localhost'],
      baseFetch,
    });
    await fetch('https://api.openai.com/v1/embeddings');
    const entries = readLog();
    expect(entries).toHaveLength(1);
    expect(entries[0].internal).toBe(false);
    expect(entries[0].url).toBe('https://api.openai.com/v1/embeddings');
  });

  it('logs the timestamp and method per call', async () => {
    const baseFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const fetch = createAuditedFetch({
      logPath,
      internalHosts: ['localhost'],
      baseFetch,
    });
    await fetch('http://localhost/x', { method: 'POST' });
    const entry = readLog()[0];
    expect(entry.method).toBe('POST');
    expect(typeof entry.ts).toBe('string');
    expect(new Date(entry.ts).toString()).not.toBe('Invalid Date');
  });

  it('logs error responses with status', async () => {
    const baseFetch = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }));
    const fetch = createAuditedFetch({
      logPath,
      internalHosts: ['localhost'],
      baseFetch,
    });
    await fetch('http://localhost/x');
    expect(readLog()[0].status).toBe(500);
  });

  it('logs network failures with error=true', async () => {
    const baseFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const fetch = createAuditedFetch({
      logPath,
      internalHosts: ['localhost'],
      baseFetch,
    });
    await expect(fetch('http://localhost/x')).rejects.toThrow('ECONNREFUSED');
    const entry = readLog()[0];
    expect(entry.error).toBe(true);
    expect(entry.error_message).toContain('ECONNREFUSED');
  });

  it('appends across multiple calls (does not overwrite)', async () => {
    const baseFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const fetch = createAuditedFetch({
      logPath,
      internalHosts: ['localhost'],
      baseFetch,
    });
    await fetch('http://localhost/a');
    await fetch('http://localhost/b');
    expect(readLog()).toHaveLength(2);
  });
});
