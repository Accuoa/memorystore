import { describe, it, expect, vi } from 'vitest';
import { createEmbedder } from '../src/embedder.mjs';

function mockFetch(responses) {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[i++];
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r.body), { status: r.status });
  });
}

describe('createEmbedder', () => {
  it('returns a Float32Array of the configured dim from Ollama', async () => {
    const fetch = mockFetch([
      { status: 200, body: { embedding: new Array(768).fill(0.1) } },
    ]);
    const embed = createEmbedder({
      baseUrl: 'http://ollama:11434',
      model: 'nomic-embed-text',
      dim: 768,
      fetchImpl: fetch,
    });
    const v = await embed('hello world');
    expect(v).toBeInstanceOf(Float32Array);
    expect(v.length).toBe(768);
    expect(v[0]).toBeCloseTo(0.1, 5);
  });

  it('POSTs to /api/embeddings with the right body', async () => {
    const fetch = mockFetch([
      { status: 200, body: { embedding: new Array(768).fill(0) } },
    ]);
    const embed = createEmbedder({
      baseUrl: 'http://ollama:11434',
      model: 'nomic-embed-text',
      dim: 768,
      fetchImpl: fetch,
    });
    await embed('hi');
    expect(fetch).toHaveBeenCalledWith(
      'http://ollama:11434/api/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'content-type': 'application/json' }),
        body: JSON.stringify({ model: 'nomic-embed-text', prompt: 'hi' }),
      }),
    );
  });

  it('throws a clear error when Ollama returns non-200', async () => {
    const fetch = mockFetch([{ status: 503, body: { error: 'overloaded' } }]);
    const embed = createEmbedder({
      baseUrl: 'http://ollama:11434',
      model: 'nomic-embed-text',
      dim: 768,
      fetchImpl: fetch,
    });
    await expect(embed('hi')).rejects.toThrow(/embedding request failed.*503/i);
  });

  it('throws when returned vector dim does not match config', async () => {
    const fetch = mockFetch([
      { status: 200, body: { embedding: new Array(512).fill(0) } },
    ]);
    const embed = createEmbedder({
      baseUrl: 'http://ollama:11434',
      model: 'nomic-embed-text',
      dim: 768,
      fetchImpl: fetch,
    });
    await expect(embed('hi')).rejects.toThrow(/dim.*expected 768.*got 512/i);
  });

  it('throws when network fails', async () => {
    const fetch = mockFetch([new Error('ECONNREFUSED')]);
    const embed = createEmbedder({
      baseUrl: 'http://ollama:11434',
      model: 'nomic-embed-text',
      dim: 768,
      fetchImpl: fetch,
    });
    await expect(embed('hi')).rejects.toThrow('ECONNREFUSED');
  });
});
