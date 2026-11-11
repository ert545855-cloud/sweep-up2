// Parti Kupası fizik katmanı (cannon-es fizik motoru): toplar ve sandıklar gerçek katı cisim fiziğiyle
// yuvarlanır, devrilir, çarpışır, platformdan düşer. Oyuncular ve dönen engeller kinematik gövdedir:
// nesneleri iter ve savurur; nesneler oyuncuyu engellemez (kimse bir sandığa sıkışıp elenmesin).
// Nesneler her oyuncunun kendi cihazında hesaplanır; sonucu (kim elendi, kim kazandı) etkilemez.

const BALLS = [0xff4d6d, 0x3a86ff, 0xffb703, 0x06d6a0, 0x9d4edd, 0xff7a3d];
const CRATES = [0xffc971, 0xff9b85, 0x8ecae6, 0xa8e6a1, 0xcdb4db];

export async function makePhys(T, scene) {
  const C = await import('/vendor/cannon/cannon-es.js');
  const world = new C.World({ gravity: new C.Vec3(0, -22, 0) });
  world.allowSleep = true; world.broadphase = new C.SAPBroadphase(world); world.solver.iterations = 7;
  const mBall = new C.Material('top'); const mGround = new C.Material('zemin'); const mBody = new C.Material('govde'); const mBox = new C.Material('sandik');
  world.defaultContactMaterial.friction = 0.4; world.defaultContactMaterial.restitution = 0.2;
  [[mBall, mGround, 0.35, 0.6], [mBall, mBody, 0.15, 0.55], [mBall, mBall, 0.1, 0.7], [mBall, mBox, 0.2, 0.45], [mBox, mGround, 0.55, 0.12], [mBox, mBody, 0.25, 0.25], [mBox, mBox, 0.5, 0.1]]
    .forEach(([a, b, friction, restitution]) => world.addContactMaterial(new C.ContactMaterial(a, b, { friction, restitution })));
  let statics = []; let props = []; let movers = new Map(); let players = new Map(); let group = new T.Group(); scene.add(group); let myBody = null;
  const api = { onHit: null, ready: true };

  // Sandık dokusu: çerçeve ve çapraz tahta; kopya rengiyle çarpılır
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g2 = cv.getContext('2d'); g2.fillStyle = '#fff'; g2.fillRect(0, 0, 64, 64);
  g2.strokeStyle = 'rgba(90,60,40,.5)'; g2.lineWidth = 7; g2.strokeRect(3.5, 3.5, 57, 57); g2.lineWidth = 5; g2.beginPath(); g2.moveTo(6, 6); g2.lineTo(58, 58); g2.moveTo(58, 6); g2.lineTo(6, 58); g2.stroke();
  const crateTex = new T.CanvasTexture(cv); crateTex.colorSpace = T.SRGBColorSpace;
  const ballGeo = (() => { const g = new T.SphereGeometry(1, 18, 12); const p = g.attributes.position; const c = new Float32Array(p.count * 3); g.userData.a = [];
    for (let i = 0; i < p.count; i++) g.userData.a.push(Math.floor(((Math.atan2(p.getZ(i), p.getX(i)) + Math.PI) / (Math.PI * 2)) * 6 + 0.0001) % 2); g.setAttribute('color', new T.BufferAttribute(c, 3)); return g; })();
  const boxGeo = new T.BoxGeometry(1, 1, 1); const shGeo = new T.CircleGeometry(1, 14); const shMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false });

  const stat = (shape, x, y, z, mat = mGround) => { const b = new C.Body({ type: C.Body.STATIC, material: mat }); b.addShape(shape); b.position.set(x, y, z); world.addBody(b); statics.push(b); return b; };
  const dynBody = (shape, mass, x, y, z, material) => { const b = new C.Body({ mass, material, linearDamping: 0.12, angularDamping: 0.2, allowSleep: true, sleepSpeedLimit: 0.2, sleepTimeLimit: 0.7 }); b.addShape(shape); b.position.set(x, y, z); world.addBody(b); return b; };
  const kineBody = (shape, material = mBody) => { const b = new C.Body({ type: C.Body.KINEMATIC, mass: 0, material }); b.addShape(shape); b.position.set(0, 60, 0); world.addBody(b); return b; };
  // Kinematik gövdeyi hedefe "hızla" taşı: fizik motoru çarptığı nesneye bu hızı aktarır
  const drive = (b, x, y, z, dt, ry) => {
    const dx = x - b.position.x; const dy = y - b.position.y; const dz = z - b.position.z; const inv = 1 / Math.max(dt, 1 / 120);
    if (dx * dx + dy * dy + dz * dz > 16) { b.position.set(x, y, z); b.velocity.set(0, 0, 0); } else b.velocity.set(dx * inv, dy * inv, dz * inv);
    if (ry === undefined) return;
    const cur = b.ry ?? ry; let d = ry - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); b.ry = ry;
    if (Math.abs(d) > 1.2) { b.quaternion.setFromEuler(0, ry, 0); b.angularVelocity.set(0, 0, 0); } else { b.quaternion.setFromEuler(0, cur, 0); b.angularVelocity.set(0, d * inv, 0); }
  };

  Object.defineProperty(api, 'count', { get: () => props.length }); // Object.assign getter'ı değere çevirir; bu yüzden ayrı tanımlanır
  Object.assign(api, {
    // Yeni tur: her şeyi kaldır
    reset() {
      [...statics, ...props.map((p) => p.b), ...movers.values(), ...players.values()].forEach((b) => world.removeBody(b));
      props.forEach((p) => { group.remove(p.m); if (p.sh) group.remove(p.sh); p.m.material.dispose?.(); if (p.own) p.m.geometry.dispose(); });
      statics = []; props = []; movers = new Map(); players = new Map(); myBody = null;
    },
    // Sabit zeminler ve duvarlar
    disc(r, top = 0, h = 1.2) { stat(new C.Cylinder(r, r, h, 24), 0, top - h / 2, 0); },
    box(x, y, z, hx, hy, hz) { stat(new C.Box(new C.Vec3(hx, hy, hz)), x, y, z); },
    post(x, z, r, h) { stat(new C.Cylinder(r, r, h, 10), x, h / 2, z); },
    // İtilebilir nesneler
    ball(x, y, z, r = 0.45, o = {}) {
      const col = new T.Color(BALLS[props.length % BALLS.length]); const g = ballGeo.clone(); const c = g.attributes.color; ballGeo.userData.a.forEach((s, i) => { if (s) c.setXYZ(i, col.r, col.g, col.b); else c.setXYZ(i, 1, 1, 1); });
      const m = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true })); m.scale.setScalar(r); group.add(m);
      const sh = new T.Mesh(shGeo, shMat); sh.rotation.x = -Math.PI / 2; sh.scale.setScalar(r * 0.95); group.add(sh);
      const b = dynBody(new C.Sphere(r), o.mass ?? 0.5, x, y, z, mBall); props.push({ b, m, sh, r, own: true, home: [x, y, z], respawn: o.respawn ?? 0, spread: o.spread ?? 4, floor: o.floor ?? 0 }); return b;
    },
    crate(x, y, z, s = 0.8, o = {}) {
      const m = new T.Mesh(boxGeo, new T.MeshLambertMaterial({ color: CRATES[props.length % CRATES.length], map: crateTex })); m.scale.setScalar(s); group.add(m);
      const b = dynBody(new C.Box(new C.Vec3(s / 2, s / 2, s / 2)), o.mass ?? 0.9, x, y, z, mBox); b.quaternion.setFromEuler(0, o.ry ?? Math.random() * 3, 0); props.push({ b, m, r: s / 2, home: [x, y, z], respawn: o.respawn ?? 0, spread: o.spread ?? 4 }); return b;
    },
    // Hareketli engel (dönen çubuk, kayan platform, sarkaç): her karede to() ile yeri bildirilir
    mover(key, kind, a, b2, c) { const b = kineBody(kind === 'ball' ? new C.Sphere(a) : new C.Box(new C.Vec3(a, b2, c)), mGround); movers.set(key, b); return b; },
    moveTo(key, x, y, z, dt, ry) { const b = movers.get(key); if (b) drive(b, x, y, z, dt, ry); },
    park(key) { const b = movers.get(key); if (b) { b.position.set(0, 80, 0); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0); } },
    // Oyuncular: karakter başına bir küre
    player(i, x, y, z, dt, on, mine) {
      let b = players.get(i);
      if (!b) { b = kineBody(new C.Sphere(0.5)); players.set(i, b); if (mine) { myBody = b; b.addEventListener('collide', (e) => { const sp = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (sp > 1.4 && e.body.type === C.Body.DYNAMIC) api.onHit?.(sp, e.body.material === mBall ? 'ball' : 'crate'); }); } }
      if (!on) { b.position.set(0, 90 + i, 0); b.velocity.set(0, 0, 0); return; }
      drive(b, x, y + 0.5, z, dt);
    },
    // Patlama: yakındaki nesneleri savurur
    blast(x, y, z, power = 9, radius = 7) {
      props.forEach(({ b }) => { const dx = b.position.x - x; const dy = b.position.y - y + 0.6; const dz = b.position.z - z; const d = Math.hypot(dx, dy, dz); if (d > radius) return; const k = (power * (1 - d / radius)) / Math.max(d, 0.4); b.wakeUp(); b.velocity.x += dx * k; b.velocity.y += Math.abs(dy) * k + power * 0.35; b.velocity.z += dz * k; b.angularVelocity.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12); });
    },
    step(dt, now) {
      world.step(1 / 60, dt, 3);
      for (const p of props) {
        const b = p.b; const q = b.position;
        const sp = b.velocity.length(); if (sp > 19) b.velocity.scale(19 / sp, b.velocity); // dönen çubuk nesneyi ışık hızına çıkarmasın
        if (q.y < -26) { // aşağı düştü: bazıları bir süre sonra gökten geri düşer
          if (p.respawn > 0) { if (!p.at) p.at = now + 1400 + Math.random() * 1600; else if (now > p.at) { p.at = 0; p.respawn -= 1; const a = Math.random() * Math.PI * 2; const r = Math.random() * (p.spread ?? 4); b.position.set(p.home[0] * 0.3 + Math.cos(a) * r, 9 + Math.random() * 3, p.home[2] * 0.3 + Math.sin(a) * r); b.velocity.set(0, 0, 0); b.angularVelocity.set(Math.random() * 4, 0, Math.random() * 4); b.wakeUp(); } }
          else if (b.sleepState !== C.Body.SLEEPING) { b.velocity.set(0, 0, 0); b.sleep(); }
          p.m.visible = false; if (p.sh) p.sh.visible = false; continue;
        }
        p.m.visible = true; p.m.position.set(q.x, q.y, q.z); p.m.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
        if (p.sh) { const h = q.y - p.r - p.floor; p.sh.visible = h > -0.2 && h < 7; if (p.sh.visible) { p.sh.position.set(q.x, p.floor + 0.02, q.z); p.sh.scale.setScalar(p.r * Math.max(0.45, 0.95 - h * 0.08)); } }
      }
    },
    dispose() { api.reset(); scene.remove(group); ballGeo.dispose(); boxGeo.dispose(); shGeo.dispose(); shMat.dispose(); crateTex.dispose(); },
  });
  return api;
}
