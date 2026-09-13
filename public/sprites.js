// Original PX OFFICE artwork. Integer-grid SVG; no external game sprites.
const maps = {
  chief: [
    '.........pppp.........', '.......ppPPPPpp.......', '......pPPPPPPPpp......',
    '.....pPPPPPPPPPpp.....', '....pPPPPPPPPPPPpp....', '....pppppppppppppp....',
    '.....pSSSSSSSSSSp.....', '.....pSgSSSSgSSSp.....', '.....pSgSSSSgSSSp.....',
    '......SSSSSSSSSS......', '.......SSmmSSS........', '......ppPPPPpp........',
    '.....pPPPPPPPPp.......', '....pPPPPPPPPPPp......', '....pPPPaaPPPPPp......',
    '....pPPPaaPPPPPp......', '....pPPPPPPPPPPp......', '.....pPPPPPPPPp.......',
    '......pppppppp........', '......bb....bb........', '.....bbb....bbb.......',
  ],
  dev: [
    '.......hhhhhhh........', '.....hhhhhhhhhhh......', '....hhHHHHHHHHhhh.....',
    '....hHHHHHHHHHHhh.....', '...dhhSSSSSSShhhd.....', '...ddSSSSSSSSSSdd.....',
    '...ddSSbSSSSbSSdd.....', '...ddSSbSSSSbSSdd.....', '....dSSSSSSSSSSd......',
    '.....SSSSmmSSSS.......', '......SSSSSSSS........', '.....ccCCCCCCcc.......',
    '....cCCCCCCCCCCc......', '...cCCCCCCCCCCCCc.....', '...cCCCCddCCCCCCc.....',
    '...cCCCCddCCCCCCc.....', '....cCCCCCCCCCCc......', '.....cccccccccc.......',
    '......bbbbbbbb........', '......bb....bb........', '.....bbb....bbb.......',
  ],
  writer: [
    '.......rrrrrrr........', '.....rrRRRRRRRrr......', '....rRRRRRRRRRRRr.....',
    '....rrrrrrrrrrrrr.....', '.....hSSSSSSSSh.......', '.....hSSSSSSSSh.......',
    '.....SSbSSSSbSS.......', '.....SSbSSSSbSS.......', '.....SSSSSSSSSS.......',
    '......SSSmmSSS........', '.......SSSSSS.........', '.....ccCCCCCCcc.......',
    '....cCCCCCCCCCCc......', '...cCCCaCCCCaCCCc.....', '...cCCCaCCCCaCCCc.....',
    '...cCCCCaaaaCCCCc.....', '....cCCCCCCCCCCc......', '.....cccccccccc.......',
    '......bbbbbbbb........', '......bb....bb........', '.....bbb....bbb.......',
  ],
  format: [
    '.......hhhhhhh........', '.....hhHHHHHHHhh......', '....hHHHHHHHHHHHh.....',
    '....hHHHHHHHHHHHh.....', '....hHSSSSSSSSHh......', '.....SSSSSSSSSS.......',
    '....bbbbbbbbbbbb......', '....bSgbSSSSbgSb......', '.....bbbbSSbbbb.......',
    '......SSSSSSSS........', '.......SSmmSS.........', '.....ccCCCCCCcc.......',
    '....cCCCCCCCCCCc......', '...cCCCCCCCCCCCCc.....', '...cCCCCaaCCCCCCc.....',
    '...cCCCCaaCCCCCCc.....', '....cCCCCCCCCCCc......', '.....cccccccccc.......',
    '......bbbbbbbb........', '......bb....bb........', '.....bbb....bbb.......',
  ],
  misc: [
    '.......hhhhhhh........', '.....hhhhhhhhhhh......', '....hhHHHHHHHHHhh.....',
    '....hHHHHHHHHHHHh.....', '....hSSSSSSSSSSh......', '.....SSSSSSSSSS.......',
    '.....SSbSSSSbSS.......', '.....SSbSSSSbSS.......', '.....SSSSSSSSSS.......',
    '......SSSmmSSS........', '.......SSSSSS.........', '.....ccCCCCCCcc.......',
    '....cCCCCCCCCCCc......', '...caaaaaaaaaaaac.....', '...cCCCCCCCCCCCCc.....',
    '...caaaaaaaaaaaac.....', '....cCCCCCCCCCCc......', '.....cccccccccc.......',
    '......bbbbbbbb........', '......bb....bb........', '.....bbb....bbb.......',
  ],
};
maps.junior = maps.dev;
maps.secretary = maps.format;
const palettes = {
  secretary: { h:'#59636e', H:'#939eac', S:'#edbe96', b:'#48525d', g:'#e4edf4', m:'#ad775e', c:'#728696', C:'#cbd4e1', a:'#e9eef4' },
  junior: { h:'#534532', H:'#90734d', S:'#edbe96', b:'#303d37', m:'#ad775e', c:'#497766', C:'#9fd7c2', d:'#31483d' },
  chief: { p:'#55406e', P:'#a591c7', S:'#d8ded0', g:'#a6ff9a', m:'#6e6a82', a:'#d8cf95', b:'#474051' },
  dev: { h:'#353c4b', H:'#555b67', S:'#edbe96', b:'#30333d', m:'#ad775e', c:'#3e677c', C:'#83b5cd', d:'#313e48' },
  writer: { r:'#7d4f48', R:'#c78670', h:'#604d3c', S:'#ecc19d', b:'#4b3c35', m:'#b5826c', c:'#80674e', C:'#d3ae86', a:'#ebe0c6' },
  format: { h:'#454637', H:'#737354', S:'#e5bd94', b:'#424535', g:'#e8e0b7', m:'#b07e63', c:'#5b724f', C:'#a4c184', a:'#e9e6c9' },
  misc: { h:'#574332', H:'#957253', S:'#deaf86', b:'#39322c', m:'#a37256', c:'#8f6840', C:'#daa461', a:'#f0ce91' },
};
export function sprite(id, x = 0, y = 0, scale = 2, extra = '') {
  const palette = palettes[id];
  return `<g transform="translate(${x} ${y}) scale(${scale})" ${extra}>${maps[id].map((row, j) => [...row].map((v, i) => v === '.' ? '' : `<rect x="${i}" y="${j}" width="1" height="1" fill="${palette[v]}"/>`).join('')).join('')}</g>`;
}
export function avatar(id, size = 42) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 26 26" aria-hidden="true" shape-rendering="crispEdges">${sprite(id, 2, 2, 1)}</svg>`;
}
export function icon(name, size = 18) {
  const paths = {
    office: '<path d="M3 20V6l9-3 9 3v14M8 20v-5h8v5M7 8h2m6 0h2M7 11h2m6 0h2M1 20h22"/>',
    tasks: '<rect x="4" y="4" width="16" height="17" rx="3"/><path d="M9 4V2h6v2M8 10l1 1 2-2m3 1h3M8 16l1 1 2-2m3 1h3"/>',
    mail: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="m3 6 9 7 9-7M3 18l6-6m12 6-6-6"/>',
    'mail-open': '<path d="m2 10 10-7 10 7v11H2ZM2 10l10 8 10-8M2 21l7-6m13 6-7-6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    logs: '<path d="m5 7 4 4-4 4m7 0h7"/><rect x="2" y="3" width="20" height="18" rx="3"/>',
    settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3h6l1 3 3 1 2 5-2 2v4l-5 3-3-1-3 1-5-3v-4l-2-2 2-5 3-1 1-3Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="m8 4 12 8-12 8Z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-2l2 7M4 12l2 7a8 8 0 0 0 13-2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    link: '<path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
    spark: '<path d="m12 3 2 6 7 3-7 3-2 6-3-6-6-3 6-3Z"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    volume: '<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    mute: '<path d="m11 4-6 5H2v6h3l6 5Zm5 5 6 6m0-6-6 6"/>',
    expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    moon: '<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
}
