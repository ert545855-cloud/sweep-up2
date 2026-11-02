// Veri katmanı: tüm koleksiyonlar bellekte tutulur, her değişiklik kalıcı depoya yazılır.
// Öncelik: DATABASE_URL (PostgreSQL) > REDIS_URL (Render Key Value) > yerel JSON dosyası.
const fs = require('fs');
const path = require('path');

const COLLECTIONS = [
  'users', 'follows', 'posts', 'swipes', 'matches', 'chats', 'messages', 'notifications',
  'pushSubs', 'meta', 'stories', 'blocks', 'reports', 'resets',
];
// Key Value'da medya için ayrılan üst sınır (ücretsiz plan 25 MB; veriye yer kalsın)
const REDIS_MEDIA_BUDGET = +(process.env.REDIS_MEDIA_BUDGET_MB || 14) * 1024 * 1024;
const REDIS_MEDIA_MAX_FILE = 1.5 * 1024 * 1024;

class Store {
  constructor() {
    this.cols = new Map(COLLECTIONS.map((c) => [c, new Map()]));
    this.pg = null;
    this.redis = null;
    this.file = null;
    this.queue = Promise.resolve();
    this.dirty = false;
    this.kind = 'file';
  }

  async init() {
    const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
    fs.mkdirSync(path.join(dir, 'media'), { recursive: true });
    this.dir = dir;

    if (process.env.DATABASE_URL) {
      const { Pool } = require('pg');
      const local = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
      this.pg = new Pool({ connectionString: process.env.DATABASE_URL, ssl: local ? false : { rejectUnauthorized: false }, max: 5 });
      await this.pg.query(`CREATE TABLE IF NOT EXISTS docs (col TEXT NOT NULL, id TEXT NOT NULL, data JSONB NOT NULL, PRIMARY KEY (col, id))`);
      await this.pg.query(`CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMPTZ DEFAULT now())`);
      const { rows } = await this.pg.query('SELECT col, id, data FROM docs');
      for (const r of rows) this.col(r.col).set(r.id, r.data);
      this.kind = 'postgres';
      console.log(`[store] PostgreSQL: ${rows.length} kayıt yüklendi`);
      return;
    }

    if (process.env.REDIS_URL) {
      const { createClient, RESP_TYPES } = require('redis');
      this.redis = createClient({ url: process.env.REDIS_URL, socket: { reconnectStrategy: (n) => Math.min(n * 200, 3000) } });
      this.redis.on('error', (e) => console.error('[store] redis', e.message));
      await this.redis.connect();
      this.redisBuf = this.redis.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer });
      let n = 0;
      const keys = await this.redis.sMembers('su:cols');
      for (const c of new Set([...COLLECTIONS, ...keys])) {
        const h = await this.redis.hGetAll(`su:c:${c}`);
        for (const [id, json] of Object.entries(h)) { this.col(c).set(id, JSON.parse(json)); n++; }
      }
      this.mediaBytes = +(await this.redis.get('su:mediabytes')) || 0;
      this.kind = 'redis';
      console.log(`[store] Key Value: ${n} kayıt yüklendi, medya ${(this.mediaBytes / 1048576).toFixed(1)} MB`);
      return;
    }

    this.file = path.join(dir, 'db.json');
    if (fs.existsSync(this.file)) {
      const json = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      for (const [c, docs] of Object.entries(json)) for (const d of docs) this.col(c).set(d.id, d);
    }
    setInterval(() => this.flushFile(), 1500).unref();
    console.log(`[store] Dosya deposu: ${this.file}`);
  }

  col(name) {
    if (!this.cols.has(name)) this.cols.set(name, new Map());
    return this.cols.get(name);
  }

  get(c, id) { return this.col(c).get(id) || null; }
  all(c) { return [...this.col(c).values()]; }
  find(c, fn) { for (const d of this.col(c).values()) if (fn(d)) return d; return null; }
  filter(c, fn) { const out = []; for (const d of this.col(c).values()) if (fn(d)) out.push(d); return out; }

  put(c, doc) { this.col(c).set(doc.id, doc); this.persist(c, doc.id, doc); return doc; }

  update(c, id, patch) {
    const doc = this.get(c, id);
    if (!doc) return null;
    Object.assign(doc, typeof patch === 'function' ? patch(doc) || {} : patch);
    this.persist(c, id, doc);
    return doc;
  }

  del(c, id) { this.col(c).delete(id); this.persist(c, id, null); }

  persist(c, id, doc) {
    if (this.pg) {
      this.queue = this.queue.then(() => (doc
        ? this.pg.query('INSERT INTO docs (col, id, data) VALUES ($1,$2,$3) ON CONFLICT (col,id) DO UPDATE SET data = EXCLUDED.data', [c, id, doc])
        : this.pg.query('DELETE FROM docs WHERE col=$1 AND id=$2', [c, id])
      )).catch((e) => console.error('[store] yazma hatası', e.message));
    } else if (this.redis) {
      this.queue = this.queue.then(() => (doc
        ? Promise.all([this.redis.hSet(`su:c:${c}`, id, JSON.stringify(doc)), this.redis.sAdd('su:cols', c)])
        : this.redis.hDel(`su:c:${c}`, id)
      )).catch((e) => console.error('[store] yazma hatası', e.message));
    } else {
      this.dirty = true;
    }
  }

  flushFile() {
    if (!this.file || !this.dirty) return;
    this.dirty = false;
    const out = {};
    for (const [c, m] of this.cols) out[c] = [...m.values()];
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(out));
    fs.renameSync(tmp, this.file);
  }

  // --- Medya ---
  async saveMedia(id, mime, buffer) {
    if (this.pg) {
      await this.pg.query('INSERT INTO media (id, mime, data) VALUES ($1,$2,$3)', [id, mime, buffer]);
      return 'postgres';
    }
    if (this.redis && buffer.length <= REDIS_MEDIA_MAX_FILE && this.mediaBytes + buffer.length <= REDIS_MEDIA_BUDGET) {
      await this.redis.multi().set(`su:m:${id}`, buffer).set(`su:mt:${id}`, mime).incrBy('su:mediabytes', buffer.length).exec();
      this.mediaBytes += buffer.length;
      return 'redis';
    }
    fs.writeFileSync(path.join(this.dir, 'media', id), buffer);
    fs.writeFileSync(path.join(this.dir, 'media', id + '.mime'), mime);
    return 'disk';
  }

  async loadMedia(id) {
    if (!/^[\w-]+$/.test(id)) return null;
    if (this.pg) {
      const { rows } = await this.pg.query('SELECT mime, data FROM media WHERE id=$1', [id]);
      return rows[0] ? { mime: rows[0].mime, data: rows[0].data } : null;
    }
    if (this.redis) {
      const data = await this.redisBuf.get(`su:m:${id}`);
      if (data) return { mime: await this.redis.get(`su:mt:${id}`) || 'application/octet-stream', data };
    }
    const p = path.join(this.dir, 'media', id);
    if (!fs.existsSync(p)) return null;
    return { mime: fs.readFileSync(p + '.mime', 'utf8'), data: fs.readFileSync(p) };
  }

  async close() {
    this.flushFile();
    await this.queue;
    if (this.pg) await this.pg.end();
    if (this.redis) await this.redis.quit().catch(() => {});
  }
}

module.exports = new Store();
