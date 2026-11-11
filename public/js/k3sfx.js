// Parti Kupası ses efektleri: dosya indirmeden, tarayıcının ses motoruyla (Web Audio) anında üretilir.
// Ses tercihi cihazda saklanır (k3snd). Tarayıcılar sesi ancak ilk dokunuştan sonra açar: unlock().

export function makeSfx() {
  let ctx = null; let master = null; let noiseBuf = null; let on = true;
  try { on = localStorage.getItem('k3snd') !== '0'; } catch { /* gizli sekme */ }
  const last = new Map();
  const ready = () => {
    if (!on) return false;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      try { ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch { ctx = null; return false; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx.state === 'running';
  };
  // Tek ton: f0'dan f1'e kayar, kısa zarfla söner
  const tone = (type, f0, f1, dur, vol, delay = 0) => {
    const t = ctx.currentTime + delay; const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
  };
  // Gürültü: darbe, patlama, hışırtı
  const noise = (kind, f0, f1, dur, vol, delay = 0) => {
    const t = ctx.currentTime + delay; const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); const g = ctx.createGain(); f.type = kind;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.03);
  };
  const SOUNDS = {
    jump: (k) => tone('sine', 300, 640, 0.13, 0.16 * k),
    land: (k) => { noise('lowpass', 520, 120, 0.1, 0.28 * k); tone('sine', 130, 60, 0.11, 0.2 * k); },
    bump: (k) => { tone('triangle', 260, 150, 0.09, 0.2 * k); noise('lowpass', 900, 300, 0.05, 0.12 * k); },
    hit: (k) => { noise('bandpass', 1100, 300, 0.14, 0.4 * k); tone('square', 170, 60, 0.2, 0.16 * k); },
    dash: (k) => noise('bandpass', 500, 2600, 0.2, 0.22 * k),
    thud: (k) => tone('sine', 190, 95, 0.08, 0.18 * k),
    boing: (k) => tone('sine', 220, 470, 0.14, 0.16 * k),
    pop: (k) => tone('sine', 900, 380, 0.07, 0.2 * k),
    tick: (k) => tone('square', 660, 660, 0.07, 0.1 * k),
    go: (k) => { tone('square', 990, 990, 0.2, 0.12 * k); tone('sine', 1480, 1480, 0.26, 0.1 * k); },
    out: (k) => { tone('sine', 520, 110, 0.4, 0.22 * k); tone('triangle', 400, 80, 0.44, 0.1 * k, 0.04); },
    boom: (k) => { noise('lowpass', 900, 60, 0.6, 0.7 * k); tone('sine', 110, 36, 0.5, 0.4 * k); },
    crack: (k) => noise('highpass', 2400, 900, 0.07, 0.16 * k),
    kick: (k) => { tone('sine', 160, 70, 0.12, 0.3 * k); noise('lowpass', 700, 200, 0.06, 0.16 * k); },
    whistle: (k) => { tone('sine', 2300, 2100, 0.16, 0.12 * k); tone('sine', 2350, 2000, 0.34, 0.12 * k, 0.2); },
    good: (k) => [523, 659, 784].forEach((f, i) => tone('triangle', f, f, 0.16, 0.16 * k, i * 0.09)),
    bad: (k) => [392, 311].forEach((f, i) => tone('triangle', f, f * 0.96, 0.22, 0.16 * k, i * 0.14)),
    win: (k) => [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, i === 4 ? 0.5 : 0.15, 0.18 * k, i * 0.11)),
    warn: (k) => { tone('square', 880, 880, 0.08, 0.1 * k); tone('square', 880, 880, 0.08, 0.1 * k, 0.14); },
  };
  return {
    get on() { return on; },
    set on(x) { on = !!x; try { localStorage.setItem('k3snd', on ? '1' : '0'); } catch { /* yok */ } if (on) ready(); },
    unlock() { ready(); },
    // name: ses adı, k: şiddet (0–1.5), gap: aynı sesin en erken tekrar süresi (ms)
    play(name, k = 1, gap = 60) {
      const f = SOUNDS[name]; if (!f || !ready()) return;
      const now = performance.now(); if (now - (last.get(name) || 0) < gap) return; last.set(name, now);
      try { f(Math.max(0.15, Math.min(1.5, k))); } catch { /* ses üretilemedi: oyun sürsün */ }
    },
    close() { ctx?.close().catch(() => {}); ctx = null; },
  };
}
