import { describe, it, expect, vi } from 'vitest';
import { createRetrieval } from '../src/retrieval.mjs';

describe('createRetrieval', () => {
  it('embeds the query and asks storage for top-k', async () => {
    const embedder = vi.fn().mockResolvedValue(new Float32Array([0.1, 0.2, 0.3]));
    const storage = {
      searchTopK: vi.fn().mockReturnValue([{ id: 1, text: 'A', similarity: 0.9 }]),
    };
    const retrieval = createRetrieval({ embedder, storage, defaultK: 5 });

    const results = await retrieval.recall('what is X?');
    expect(embedder).toHaveBeenCalledWith('what is X?');
    expect(storage.searchTopK).toHaveBeenCalledWith(expect.any(Float32Array), 5);
    expect(results).toEqual([{ id: 1, text: 'A', similarity: 0.9 }]);
  });

  it('uses caller-provided k when supplied', async () => {
    const embedder = vi.fn().mockResolvedValue(new Float32Array([0.1]));
    const storage = { searchTopK: vi.fn().mockReturnValue([]) };
    const retrieval = createRetrieval({ embedder, storage, defaultK: 5 });

    await retrieval.recall('q', 10);
    expect(storage.searchTopK).toHaveBeenCalledWith(expect.any(Float32Array), 10);
  });

  it('embeds + inserts on store', async () => {
    const embedder = vi.fn().mockResolvedValue(new Float32Array([0.1]));
    const storage = {
      insert: vi.fn().mockReturnValue(42),
      getById: vi.fn().mockReturnValue({ id: 42, text: 'fact', metadata: {} }),
    };
    const retrieval = createRetrieval({ embedder, storage, defaultK: 5 });

    const memory = await retrieval.store('fact', { tag: 'x' });
    expect(embedder).toHaveBeenCalledWith('fact');
    expect(storage.insert).toHaveBeenCalledWith({
      text: 'fact',
      metadata: { tag: 'x' },
      embedding: expect.any(Float32Array),
    });
    expect(memory).toEqual({ id: 42, text: 'fact', metadata: {} });
  });

  it('store accepts undefined metadata and defaults to {}', async () => {
    const embedder = vi.fn().mockResolvedValue(new Float32Array([0.1]));
    const storage = {
      insert: vi.fn().mockReturnValue(1),
      getById: vi.fn().mockReturnValue({ id: 1, text: 'x', metadata: {} }),
    };
    const retrieval = createRetrieval({ embedder, storage, defaultK: 5 });

    await retrieval.store('x');
    expect(storage.insert).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: {} }),
    );
  });
});
