// Kamera yardımcıları: ön ve arka kamera arasında güvenli geçiş.
// Telefonların çoğunda iki kamera aynı anda açılamaz: önce açık olan kapatılır, sonra diğeri istenir.
const WANT = { width: { ideal: 720 }, height: { ideal: 1280 } };
const BACK = /back|rear|arka|environment|world/i;
const FRONT = /front|ön|user|face|selfie/i;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// İstenen yöndeki kameradan tek bir görüntü izi açar. avoidId: az önce kapatılan kameranın kimliği.
export async function openCamera(facing = 'user', avoidId = '') {
  const md = navigator.mediaDevices; let err = null;
  const take = async (video) => {
    const s = await md.getUserMedia({ video }); const t = s.getVideoTracks()[0]; if (!t) throw new Error('Kamera bulunamadı');
    const got = t.getSettings?.().facingMode; // cihaz yönü bildiriyorsa ve yanlış kamera geldiyse kabul etme
    if (got && got !== facing) { t.stop(); throw new Error('Yanlış kamera'); }
    return t;
  };
  for (const video of [{ ...WANT, facingMode: { exact: facing } }, { facingMode: { exact: facing } }]) {
    for (let n = 0; n < 2; n++) {
      try { return await take(video); } catch (e) {
        err = e; if (e.name === 'NotAllowedError' || e.name === 'SecurityError') throw e;
        if (e.name !== 'NotReadableError' && e.name !== 'AbortError') break; // kamera henüz serbest kalmadıysa kısa bir bekleyip yeniden dene
        await wait(350);
      }
    }
  }
  // Yön bildirmeyen cihazlar: kamera listesinden adına bakarak ya da "öncekinden farklı olanı" seç
  try {
    const cams = (await md.enumerateDevices()).filter((d) => d.kind === 'videoinput' && d.deviceId);
    const named = cams.find((d) => (facing === 'environment' ? BACK : FRONT).test(d.label));
    const pick = named || (cams.length > 1 ? cams.find((d) => d.deviceId !== avoidId) : null);
    if (pick && pick.deviceId !== avoidId) { const s = await md.getUserMedia({ video: { ...WANT, deviceId: { exact: pick.deviceId } } }); const t = s.getVideoTracks()[0]; if (t) return t; }
  } catch (e) { err = e; }
  if (facing === 'user') { try { return (await md.getUserMedia({ video: WANT })).getVideoTracks()[0]; } catch (e) { err = e; } } // masaüstü: tek kamera
  throw err || new Error('Kamera açılamadı');
}

// Yayındaki akışın görüntü izini diğer kamerayla değiştirir. Dönen: { track, facing, ok }
// Diğer kamera açılamazsa eskisi geri açılır (ok: false), görüntü kaybolmaz.
export async function switchCamera(stream, to) {
  const old = stream.getVideoTracks()[0]; const from = to === 'user' ? 'environment' : 'user';
  const oldId = old?.getSettings?.().deviceId || '';
  if (old) { stream.removeTrack(old); old.stop(); await wait(120); }
  try { const track = await openCamera(to, oldId); stream.addTrack(track); return { track, facing: to, ok: true }; } catch {
    try { const track = await openCamera(from); stream.addTrack(track); return { track, facing: from, ok: false }; } catch { return { track: null, facing: from, ok: false }; }
  }
}
