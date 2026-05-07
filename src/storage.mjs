import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function applySchema(db, dim) {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8').replace(
    /__DIM__/g,
    String(dim),
  );
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    db.prepare(stmt).run();
  }
}

export function createStorage({ dbPath, dim }) {
  const db = new Database(dbPath);
  sqliteVec.load(db);
  db.pragma('journal_mode = WAL');

  applySchema(db, dim);

  const insertMem = db.prepare(
    'INSERT INTO memories (text, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?)',
  );
  const insertVec = db.prepare('INSERT INTO memories_vec (rowid, embedding) VALUES (?, ?)');
  const deleteMem = db.prepare('DELETE FROM memories WHERE id = ?');
  const deleteVec = db.prepare('DELETE FROM memories_vec WHERE rowid = ?');
  const getMem = db.prepare(
    'SELECT id, text, metadata_json, created_at, updated_at FROM memories WHERE id = ?',
  );
  const listMem = db.prepare(
    'SELECT id, text, metadata_json, created_at, updated_at FROM memories ORDER BY created_at DESC LIMIT ? OFFSET ?',
  );
  const countMem = db.prepare('SELECT COUNT(*) as n FROM memories');
  const searchVec = db.prepare(`
    SELECT m.id, m.text, m.metadata_json, m.created_at, v.distance
    FROM memories_vec v
    JOIN memories m ON m.id = v.rowid
    WHERE v.embedding MATCH ? AND k = ?
    ORDER BY v.distance ASC
    LIMIT ?
  `);

  function vecToBuffer(arr) {
    if (!(arr instanceof Float32Array)) {
      arr = Float32Array.from(arr);
    }
    if (arr.length !== dim) {
      throw new Error(`embedding dim mismatch: expected ${dim}, got ${arr.length}`);
    }
    return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  }

  function rowToMemory(r) {
    return {
      id: r.id,
      text: r.text,
      metadata: JSON.parse(r.metadata_json || '{}'),
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  return {
    insert({ text, metadata, embedding }) {
      const buf = vecToBuffer(embedding);
      const now = Date.now();
      const tx = db.transaction(() => {
        const info = insertMem.run(text, JSON.stringify(metadata ?? {}), now, now);
        // sqlite-vec's vec0 virtual table requires the rowid bound as a BigInt
        // (a regular JS number is rejected as "non-integer" by the extension).
        const rowidBig = BigInt(info.lastInsertRowid);
        insertVec.run(rowidBig, buf);
        return info.lastInsertRowid;
      });
      return Number(tx());
    },

    getById(id) {
      const r = getMem.get(id);
      return r ? rowToMemory(r) : null;
    },

    deleteById(id) {
      const tx = db.transaction(() => {
        // sqlite-vec vec0 virtual table requires rowid as BigInt (see insert).
        deleteVec.run(BigInt(id));
        deleteMem.run(id);
      });
      tx();
    },

    list({ limit = 50, offset = 0 } = {}) {
      return listMem.all(limit, offset).map(rowToMemory);
    },

    count() {
      return countMem.get().n;
    },

    searchTopK(queryEmbedding, k) {
      const buf = vecToBuffer(queryEmbedding);
      return searchVec.all(buf, k, k).map((r) => ({
        id: r.id,
        text: r.text,
        metadata: JSON.parse(r.metadata_json || '{}'),
        created_at: r.created_at,
        similarity: 1 - r.distance,
      }));
    },

    close() {
      db.close();
    },
  };
}
