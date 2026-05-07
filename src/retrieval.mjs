export function createRetrieval({ embedder, storage, defaultK }) {
  return {
    async recall(query, k = defaultK) {
      const embedding = await embedder(query);
      return storage.searchTopK(embedding, k);
    },

    async store(text, metadata = {}) {
      const embedding = await embedder(text);
      const id = storage.insert({ text, metadata, embedding });
      return storage.getById(id);
    },
  };
}
