// #/oyun/<oyun>/<masa>: ilgili oyunun görünümünü yükler
import { leaveTo } from '../nav.js';
const VIEWS = new Set(['tavla', 'pisti', 'batak', 'kizma', 'renk', 'okey101', 'casus', 'isimsehir', 'yasakli', 'sarki', 'bilgi', 'vampir']);
export default async function play(view, game, id) {
  if (!VIEWS.has(game)) { leaveTo('#/oyunlar'); return null; }
  const m = await import(`./${game}.js`);
  return m.default(view, id);
}
