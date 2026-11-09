// #/oyun/<oyun>/<masa>: ilgili oyunun görünümünü yükler
const VIEWS = new Set(['tavla', 'pisti', 'batak', 'kizma', 'renk', 'okey101', 'casus', 'isimsehir', 'yasakli', 'sarki', 'bilgi', 'vampir']);
export default async function play(view, game, id) {
  if (!VIEWS.has(game)) { location.hash = '#/oyunlar'; return null; }
  const m = await import(`./${game}.js`);
  return m.default(view, id);
}
