import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/server.mjs';

let tmpDir;
let app;

beforeEach(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'server-'));
  app = await buildApp({
    config: {
      storage: { db_path: join(tmpDir, 'test.db') },
      embedding: { base_url: 'http://stub', model: 'stub-model', dim: 4 },
      retrieval: { default_k: 3 },
      audit: { log_path: join(tmpDir, 'net.jsonl'), internal_hosts: ['stub'] },
    },
    embedder: vi.fn().mockImplementation(async (text) => {
      const v = new Float32Array(4);
      for (let i = 0; i < text.length; i++) v[i % 4] += text.charCodeAt(i) / 1000;
      return v;
    }),
  });
});

afterEach(async () => {
  await app.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('HTTP server', () => {
  it('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('POST /memories creates a memory', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/memories',
      payload: { text: 'my birthday is March 12', metadata: { tag: 'fact' } },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeTypeOf('number');
    expect(body.text).toBe('my birthday is March 12');
    expect(body.metadata).toEqual({ tag: 'fact' });
  });

  it('GET /memories?q=&k= returns top-k', async () => {
    await app.inject({ method: 'POST', url: '/memories', payload: { text: 'apples are red' } });
    await app.inject({ method: 'POST', url: '/memories', payload: { text: 'oranges are orange' } });

    const res = await app.inject({ method: 'GET', url: '/memories?q=apples&k=2' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results).toHaveLength(2);
    expect(body.results[0]).toMatchObject({
      id: expect.any(Number),
      text: expect.any(String),
      similarity: expect.any(Number),
    });
  });

  it('GET /memories/:id returns a single memory', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/memories',
      payload: { text: 'something' },
    });
    const id = created.json().id;
    const res = await app.inject({ method: 'GET', url: `/memories/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().text).toBe('something');
  });

  it('GET /memories/:id 404 for missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/memories/9999' });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /memories/:id removes', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/memories',
      payload: { text: 'x' },
    });
    const id = created.json().id;
    const del = await app.inject({ method: 'DELETE', url: `/memories/${id}` });
    expect(del.statusCode).toBe(204);
    const get = await app.inject({ method: 'GET', url: `/memories/${id}` });
    expect(get.statusCode).toBe(404);
  });

  it('GET /stats returns count + embedding info', async () => {
    await app.inject({ method: 'POST', url: '/memories', payload: { text: 'a' } });
    const res = await app.inject({ method: 'GET', url: '/stats' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBe(1);
    expect(body.embedding_model).toBe('stub-model');
    expect(body.embedding_dim).toBe(4);
  });
});
