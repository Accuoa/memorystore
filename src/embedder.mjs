export function createEmbedder({ baseUrl, model, dim, fetchImpl = globalThis.fetch }) {
  return async function embed(text) {
    const url = `${baseUrl.replace(/\/$/, '')}/api/embeddings`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`embedding request failed: ${res.status} ${errText}`);
    }
    const data = await res.json();
    const arr = data.embedding;
    if (!Array.isArray(arr) || arr.length !== dim) {
      throw new Error(`embedding dim mismatch: expected ${dim}, got ${arr?.length}`);
    }
    return Float32Array.from(arr);
  };
}
