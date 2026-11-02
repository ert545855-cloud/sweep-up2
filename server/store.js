// Veri katmanı: tüm koleksiyonlar bellekte tutulur, her değişiklik kalıcı depoya yazılır.
// Öncelik: DATABASE_URL (PostgreSQL / Supabase) > REDIS_URL (Render Key Value) > yerel JSON dosyası.
// PostgreSQL ilk kez boşken açılırsa Key Value'daki tüm veri ve medya otomatik taşınır.
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

    const pgUrls = [process.env.DATABASE_URL, ...String(process.env.DATABASE_URL_FALLBACKS || '').split(/\s+/)].filter(Boolean);
    if (pgUrls.length) {
      try {
        await this.initPg(pgUrls);
        return;
      } catch (e) {
        // Veritabanına ulaşılamazsa uygulama kapanmasın: Key Value / dosya ile devam et
        console.error('[store] PostgreSQL kullanılamıyor, yedek depoya geçiliyor:', e.message);
        this.pg = null; this.pgError = e.message;
      }
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

  // PostgreSQL (Supabase): sırayla adresleri dene, ilk çalışana bağlan
  async initPg(urls) {
    const { Pool } = require('pg');
    const schema = (process.env.PG_SCHEMA || 'public').replace(/[^\w]/g, '');
    this.schema = schema;
    const T = (t) => `${schema}.${t}`;
    this.T = T;
    let lastErr = null;
    for (const url of urls) {
      const local = /localhost|127\.0\.0\.1/.test(url);
      const pool = new Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, keepAlive: true });
      pool.on('error', (e) => console.error('[store] pg', e.message));
      try {
        await pool.query('select 1');
        this.pg = pool;
        this.pgHost = new URL(url).hostname;
        break;
      } catch (e) {
        lastErr = e;
        console.error(`[store] PostgreSQL bağlanamadı (${new URL(url).hostname}): ${e.message}`);
        await pool.end().catch(() => {});
      }
    }
    if (!this.pg) throw lastErr || new Error('PostgreSQL bağlantısı yok');
    await this.pg.query(`CREATE TABLE IF NOT EXISTS ${T('docs')} (col TEXT NOT NULL, id TEXT NOT NULL, data JSONB NOT NULL, PRIMARY KEY (col, id))`);
    await this.pg.query(`CREATE TABLE IF NOT EXISTS ${T('media')} (id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMPTZ DEFAULT now())`);
    this.kind = 'postgres';
    const { rows: [{ n }] } = await this.pg.query(`SELECT count(*)::int AS n FROM ${T('docs')}`);
    if (!n && process.env.REDIS_URL && process.env.MIGRATE_FROM_REDIS !== '0') await this.migrateFromRedis();
    const { rows } = await this.pg.query(`SELECT col, id, data FROM ${T('docs')}`);
    for (const r of rows) this.col(r.col).set(r.id, r.data);
    const m = await this.pg.query(`SELECT count(*)::int AS n, coalesce(sum(length(data)),0)::bigint AS b FROM ${T('media')}`);
    this.mediaBytes = +m.rows[0].b; this.mediaCount = m.rows[0].n;
    setInterval(() => this.flushPg(), 400).unref();
    console.log(`[store] PostgreSQL (${this.pgHost}, şema ${schema}): ${rows.length} kayıt, ${this.mediaCount} medya (${(this.mediaBytes / 1048576).toFixed(1)} MB)`);
  }

  // Render Key Value'daki tüm veriyi ve medyayı PostgreSQL'e taşı (yalnızca ilk açılışta, tablo boşken)
  async migrateFromRedis() {
    const T = this.T;
    const { createClient, RESP_TYPES } = require('redis');
    const r = createClient({ url: process.env.REDIS_URL });
    r.on('error', (e) => console.error('[migrate] redis', e.message));
    await r.connect();
    const rb = r.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer });
    let docs = 0; let media = 0; let bytes = 0;
    try {
      const keys = await r.sMembers('su:cols');
      for (const c of new Set([...COLLECTIONS, ...keys])) {
        const h = await r.hGetAll(`su:c:${c}`);
        const entries = Object.entries(h);
        for (let i = 0; i < entries.length; i += 500) {
          const part = entries.slice(i, i + 500);
          await this.pg.query(`INSERT INTO ${T('docs')} (col, id, data) SELECT $1, x.id, x.data::jsonb FROM unnest($2::text[], $3::text[]) AS x(id, data) ON CONFLICT (col, id) DO UPDATE SET data = EXCLUDED.data`,
            [c, part.map((e) => e[0]), part.map((e) => e[1])]);
          docs += part.length;
        }
      }
      for await (const batch of r.scanIterator({ MATCH: 'su:m:*', COUNT: 100 })) {
        for (const key of (Array.isArray(batch) ? batch : [batch])) {
          const id = key.slice(5);
          const data = await rb.get(key);
          if (!data) continue;
          const mime = (await r.get(`su:mt:${id}`)) || 'application/octet-stream';
          await this.pg.query(`INSERT INTO ${T('media')} (id, mime, data) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [id, mime, data]);
          media++; bytes += data.length;
        }
      }
      // Sunucu diskindeki medya da varsa taşı
      try {
        for (const f of fs.readdirSync(path.join(this.dir, 'media'))) {
          if (f.endsWith('.mime')) continue;
          const p = path.join(this.dir, 'media', f);
          const mime = fs.existsSync(p + '.mime') ? fs.readFileSync(p + '.mime', 'utf8') : 'application/octet-stream';
          const data = fs.readFileSync(p);
          await this.pg.query(`INSERT INTO ${T('media')} (id, mime, data) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [f, mime, data]);
          media++; bytes += data.length;
        }
      } catch {}
      const info = { id: 'migration', from: 'redis', at: Date.now(), docs, media, mediaMB: +(bytes / 1048576).toFixed(1) };
      await this.pg.query(`INSERT INTO ${T('docs')} (col, id, data) VALUES ('meta', 'migration', $1) ON CONFLICT (col, id) DO UPDATE SET data = EXCLUDED.data`, [info]);
      console.log(`[migrate] Key Value → PostgreSQL tamam: ${docs} kayıt, ${media} medya (${info.mediaMB} MB)`);
    } finally { await r.quit().catch(() => {}); }
  }

  // Değişiklikleri toplu yaz (uzak veritabanında her yazmayı tek tek beklememek için)
  async flushPg() {
    if (!this.pg || this.flushing || !this.pending?.size) return;
    this.flushing = true;
    const batch = this.pending; this.pending = new Map();
    const T = this.T;
    try {
      const ups = []; const dels = [];
      for (const [k, doc] of batch) { const i = k.indexOf('\u0000'); const c = k.slice(0, i); const id = k.slice(i + 1); (doc ? ups : dels).push([c, id, doc]); }
      for (let i = 0; i < ups.length; i += 400) {
        const part = ups.slice(i, i + 400);
        await this.pg.query(`INSERT INTO ${T('docs')} (col, id, data) SELECT * FROM unnest($1::text[], $2::text[], $3::jsonb[]) ON CONFLICT (col, id) DO UPDATE SET data = EXCLUDED.data`,
          [part.map((x) => x[0]), part.map((x) => x[1]), part.map((x) => JSON.stringify(x[2]))]);
      }
      for (let i = 0; i < dels.length; i += 400) {
        const part = dels.slice(i, i + 400);
        await this.pg.query(`DELETE FROM ${T('docs')} d USING unnest($1::text[], $2::text[]) AS x(col, id) WHERE d.col = x.col AND d.id = x.id`, [part.map((x) => x[0]), part.map((x) => x[1])]);
      }
      this.lastWrite = Date.now(); this.lastError = null;
    } catch (e) {
      console.error('[store] yazma hatası', e.message);
      this.lastError = { at: Date.now(), message: e.message };
      // başarısız olanları tekrar sıraya koy (daha yenisi gelmediyse)
      for (const [k, v] of batch) if (!this.pending.has(k)) this.pending.set(k, v);
    } finally { this.flushing = false; }
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
      if (!this.pending) this.pending = new Map();
      // Belgenin o anki halini sakla (sonraki değişiklikler aynı anahtarı günceller)
      this.pending.set(`${c}\u0000${id}`, doc || null);
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
      await this.pg.query(`INSERT INTO ${this.T('media')} (id, mime, data) VALUES ($1,$2,$3)`, [id, mime, buffer]);
      this.mediaBytes = (this.mediaBytes || 0) + buffer.length; this.mediaCount = (this.mediaCount || 0) + 1;
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

  // Medyayı kalıcı olarak sil; boşalan bayt sayısını döndürür
  async deleteMedia(id) {
    if (!/^[\w-]+$/.test(id)) return 0;
    let freed = 0;
    if (this.pg) {
      const r = await this.pg.query(`DELETE FROM ${this.T('media')} WHERE id=$1 RETURNING length(data) AS n`, [id]);
      freed = +(r.rows[0]?.n || 0);
      if (freed) { this.mediaBytes = Math.max(0, (this.mediaBytes || 0) - freed); this.mediaCount = Math.max(0, (this.mediaCount || 1) - 1); }
    }
    if (this.redis) {
      const n = await this.redis.strLen(`su:m:${id}`);
      if (n) {
        await this.redis.multi().del(`su:m:${id}`).del(`su:mt:${id}`).decrBy('su:mediabytes', n).exec();
        this.mediaBytes = Math.max(0, this.mediaBytes - n);
        freed += n;
      }
    }
    const p = path.join(this.dir, 'media', id);
    try { if (fs.existsSync(p)) { freed += fs.statSync(p).size; fs.unlinkSync(p); fs.rmSync(p + '.mime', { force: true }); } } catch {}
    return freed;
  }

  async loadMedia(id) {
    if (!/^[\w-]+$/.test(id)) return null;
    if (this.pg) {
      const { rows } = await this.pg.query(`SELECT mime, data FROM ${this.T('media')} WHERE id=$1`, [id]);
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
    for (let i = 0; i < 20 && (this.flushing || this.pending?.size); i++) { await this.flushPg(); await new Promise((r) => setTimeout(r, 100)); }
    if (this.pg) await this.pg.end();
    if (this.redis) await this.redis.quit().catch(() => {});
  }
}

module.exports = new Store();
