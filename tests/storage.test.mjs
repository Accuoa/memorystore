import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStorage } from '../src/storage.mjs';

let tmpDir;
let dbPath;
let storage;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'storage-'));
  dbPath = join(tmpDir, 'test.db');
  storage = createStorage({ dbPath, dim: 768 });
});

afterEach(() => {
  storage.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

function vec(seed, dim = 768) {
  const v = new Float32Array(dim);
  for (let i = 0; i < dim; i++) v[i] = seed + i * 0.001;
  return v;
}

describe('storage', () => {
  it('insert returns an id and stores the text + metadata', () => {
    const id = storage.insert({ text: 'hello', metadata: { tag: 'greet' }, embedding: vec(0.1) });
    expect(typeof id).toBe('number');
    const row = storage.getById(id);
    expect(row.text).toBe('hello');
    expect(row.metadata).toEqual({ tag: 'greet' });
    expect(typeof row.created_at).toBe('number');
  });

  it('searchTopK returns nearest neighbors sorted by similarity desc', () => {
    const idA = storage.insert({ text: 'A', metadata: {}, embedding: vec(0.1) });
    const idB = storage.insert({ text: 'B', metadata: {}, embedding: vec(0.5) });
    const idC = storage.insert({ text: 'C', metadata: {}, embedding: vec(0.9) });

    const results = storage.searchTopK(vec(0.1), 3);
    expect(results).toHaveLength(3);
    expect(results[0].id).toBe(idA);
    expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
    expect(results[1].similarity).toBeGreaterThan(results[2].similarity);
  });

  it('searchTopK respects k', () => {
    storage.insert({ text: 'A', metadata: {}, embedding: vec(0.1) });
    storage.insert({ text: 'B', metadata: {}, embedding: vec(0.5) });
    storage.insert({ text: 'C', metadata: {}, embedding: vec(0.9) });

    const results = storage.searchTopK(vec(0.1), 2);
    expect(results).toHaveLength(2);
  });

  it('deleteById removes the memory and its vector', () => {
    const id = storage.insert({ text: 'X', metadata: {}, embedding: vec(0.1) });
    storage.deleteById(id);
    expect(storage.getById(id)).toBeNull();
    expect(storage.searchTopK(vec(0.1), 5)).toHaveLength(0);
  });

  it('list returns rows ordered by created_at desc', async () => {
    const a = storage.insert({ text: 'A', metadata: {}, embedding: vec(0.1) });
    await new Promise((r) => setTimeout(r, 5));
    const b = storage.insert({ text: 'B', metadata: {}, embedding: vec(0.2) });
    await new Promise((r) => setTimeout(r, 5));
    const c = storage.insert({ text: 'C', metadata: {}, embedding: vec(0.3) });

    const rows = storage.list({ limit: 10, offset: 0 });
    expect(rows.map((r) => r.id)).toEqual([c, b, a]);
  });

  it('count returns the total number of memories', () => {
    expect(storage.count()).toBe(0);
    storage.insert({ text: 'A', metadata: {}, embedding: vec(0.1) });
    storage.insert({ text: 'B', metadata: {}, embedding: vec(0.2) });
    expect(storage.count()).toBe(2);
  });

  it('insert throws when embedding dim does not match configured dim', () => {
    expect(() =>
      storage.insert({ text: 'X', metadata: {}, embedding: new Float32Array(512) }),
    ).toThrow(/dim/i);
  });
});
