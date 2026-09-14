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
const newCharacters = {
  robot: {label:'로봇',head:['..........a..........','..........a..........','......hhhhhhhhh......','.....hHHHHHHHHHh.....','.....hHggHHHggHh.....','.....hHggHHHggHh.....','.....hHHHHHHHHHh.....','.....hHHmmmmmHHh.....','......hhhhhhhhh......','.......HHHHHHH.......','........HHHHH........'],palette:{h:'#3d5969',H:'#a0c5d2',S:'#a0c5d2',b:'#304754',g:'#8effcd',m:'#3d5969',c:'#3d5969',C:'#a0c5d2',a:'#ff9e62'}},
  cat: {label:'고양이',head:['....hh.........hh....','....hHh.......hHh....','....hHHhhhhhhhHHh....','....hHHHHHHHHHHHh....','....hHHHHHHHHHHHh....','.....HHgHHHHHgHH.....','.....HHgHHHHHgHH.....','.....SSSSmSSSSSS.....','......SSmmmSSSS......','.......SSSSSSS.......','........SSSSS........'],palette:{h:'#8b5941',H:'#efbd87',S:'#ffe0b1',b:'#4b3e35',g:'#3d6355',m:'#b37865',c:'#846649',C:'#e6be7e',a:'#fff1d2'}},
  astronaut: {label:'우주비행사',head:['.......hhhhhhh.......','.....hhHHHHHHHhh.....','....hHHHHHHHHHHHh....','....hHbbbbbbbbbHh....','....hHbgggggggbHh....','....hHbgggggggbHh....','....hHbgggggggbHh....','....hHbbbbbbbbbHh....','.....hHHHHHHHHHh.....','......hhhhhhhhh......','.......HHHHHHH.......'],palette:{h:'#7b899b',H:'#edf0e4',S:'#edf0e4',b:'#324759',g:'#78c7d0',m:'#afbfc8',c:'#7b899b',C:'#edf0e4',a:'#e39b6a'}},
  bunny: {label:'토끼',head:['.....hh.....hh.......','.....hHh...hHh.......','.....hHh...hHh.......','.....hHh...hHh.......','.....hHHhhhHHh.......','....hHHHHHHHHHh......','....HHgHHHHHgHH......','....HHgHHHHHgHH......','.....HHHHmHHHH.......','......HHmmmHH........','.......HHHHH.........'],palette:{h:'#b992a0',H:'#fff1e8',S:'#fff1e8',b:'#664d60',g:'#714c62',m:'#ee9bb1',c:'#a56c8c',C:'#e9a6c7',a:'#fff1e8'}},
  knight: {label:'기사',head:['........aaaaa........','.........aaa.........','......hhhhhhhhh......','.....hHHHHHHHHHh.....','.....hHHHHHHHHHh.....','.....hHbbbbbbbHh.....','.....hHbgbgbgbHh.....','.....hHbbbbbbbHh.....','......hHHHHHHHh......','.......hhhhhhh.......','........HHHHH........'],palette:{h:'#596478',H:'#b6c3d6',S:'#b6c3d6',b:'#3c465e',g:'#e2edee',m:'#65758f',c:'#596478',C:'#b6c3d6',a:'#d16f74'}},
  witch: {label:'마녀',head:['..........p..........','.........pPp.........','........pPPPp........','.......pPPaPPp.......','......pPPPaPPPp......','....ppPPPPPPPPPpp....','...ppppppppppppppp...','.....hSSgSSSgSSh.....','.....hSSSSSSSSSh.....','......hSSmmSSSh......','.......SSSSSSS.......'],palette:{p:'#343553',P:'#656ba3',h:'#b5caca',S:'#ebc3a2',b:'#36344d',g:'#56527a',m:'#b17876',c:'#343553',C:'#777bae',a:'#e9c77c'}},
};
Object.assign(newCharacters, {
  "ninja": {
    "label": "닌자",
    "head": [
      ".......hhhhhhh.......",
      ".....hhHHHHHHHhh.....",
      "....hHHHHHHHHHHHh....",
      "....hHHHHHHHHHHHh....",
      "....aaaaaaaaaaaaa....",
      ".....SSgSSSSSgSS.....",
      ".....SSSSSSSSSSS.....",
      ".....hHHHHHHHHHh.....",
      "......hHHHHHHHh......",
      ".......hhhhhhh.......",
      "........HHHHH........"
    ],
    "palette": {
      "h": "#292f47",
      "H": "#4c526e",
      "S": "#e6bd98",
      "b": "#292f47",
      "g": "#253b38",
      "m": "#ad775e",
      "c": "#292f47",
      "C": "#4c526e",
      "a": "#e06772"
    }
  },
  "pirate": {
    "label": "해적",
    "head": [
      ".......hhhhhhh.......",
      ".....hhHHHHHHHhh.....",
      "....hHHHHaaaHHHHh....",
      "...hHHHHaHaHHHHHHh...",
      "...hhhhhhhhhhhhhhh...",
      ".....SSSSSSSSSSS.....",
      ".....SSgSSbbbbSS.....",
      ".....SSSSSbbbbSS.....",
      "......SSSSSSSSS......",
      ".......SSmmmSS.......",
      "........SSSSS........"
    ],
    "palette": {
      "h": "#473b43",
      "H": "#62505a",
      "S": "#e5b78d",
      "b": "#473b43",
      "g": "#253b38",
      "m": "#ad775e",
      "c": "#473b43",
      "C": "#62505a",
      "a": "#efcf89"
    }
  },
  "chef": {
    "label": "요리사",
    "head": [
      ".....hhh...hhh.......",
      "....hHHHhhhHHHh......",
      "...hHHHHHHHHHHHh.....",
      "...hHHHHHHHHHHHh.....",
      "....hHHHHHHHHHh......",
      "....hhhhhhhhhhh......",
      ".....SSgSSSSgSS......",
      ".....SSSSSSSSSS......",
      "......SSSSSSSS.......",
      ".......SSmmSS........",
      "........SSSS........."
    ],
    "palette": {
      "h": "#919c98",
      "H": "#faf3df",
      "S": "#edc29f",
      "b": "#919c98",
      "g": "#253b38",
      "m": "#ad775e",
      "c": "#919c98",
      "C": "#faf3df",
      "a": "#bc7771"
    }
  },
  "doctor": {
    "label": "의사",
    "head": [
      ".......hhhhhhh.......",
      ".....hhHHHHHHHhh.....",
      "....hHHHaaaHHHHHh....",
      "....hHHaaaaaHHHHh....",
      "....hHHHaaaHHHHHh....",
      ".....SSSSSSSSSSS.....",
      ".....SSgSSSSSgSS.....",
      ".....aaaaaaaaaaa.....",
      "......aHHHHHHHa......",
      ".......aaaaaaa.......",
      "........SSSSS........"
    ],
    "palette": {
      "h": "#6a9e9b",
      "H": "#d4eee5",
      "S": "#e9be99",
      "b": "#6a9e9b",
      "g": "#253b38",
      "m": "#ad775e",
      "c": "#6a9e9b",
      "C": "#d4eee5",
      "a": "#5dbeb8"
    }
  },
  "firefighter": {
    "label": "소방관",
    "head": [
      ".......hhhhhhh.......",
      ".....hhHHHHHHHhh.....",
      "....hHHHHaaaHHHHh....",
      "....hHHHHaaaHHHHh....",
      "...hhhhhhhhhhhhhhh...",
      "...HHHHHHHHHHHHHHH...",
      ".....SSgSSSSSgSS.....",
      ".....SSSSSSSSSSS.....",
      "......SSSSSSSSS......",
      ".......SSmmmSS.......",
      "........SSSSS........"
    ],
    "palette": {
      "h": "#a16d33",
      "H": "#f3c664",
      "S": "#e8b992",
      "b": "#a16d33",
      "g": "#253b38",
      "m": "#ad775e",
      "c": "#a16d33",
      "C": "#f3c664",
      "a": "#e46f44"
    }
  },
  "explorer": {
    "label": "탐험가",
    "head": [
      ".......hhhhhhh.......",
      ".....hhHHHHHHHhh.....",
      ".....hHHHHHHHHHh.....",
      ".....haaaaaaaaah.....",
      "...hhhhhhhhhhhhhhh...",
      ".....SSSSSSSSSSS.....",
      ".....SSgSSSSSgSS.....",
      ".....SSSSSSSSSSS.....",
      "......SSSSSSSSS......",
      ".......SSmmmSS.......",
      "........SSSSS........"
    ],
    "palette": {
      "h": "#806544",
      "H": "#c1a577",
      "S": "#edc299",
      "b": "#806544",
      "g": "#253b38",
      "m": "#ad775e",
      "c": "#806544",
      "C": "#c1a577",
      "a": "#879b71"
    }
  },
  "elf": {
    "label": "엘프",
    "head": [
      "..........h..........",
      ".........hHh.........",
      "........hHHHh........",
      ".......hHHHHHh.......",
      "......hHHHHHHHh......",
      ".....hhhhhhhhhhh.....",
      "..SS.SSgSSSSSgSS.SS..",
      "...SSSSSSSSSSSSSSS...",
      "......SSSSSSSSS......",
      ".......SSmmmSS.......",
      "........SSSSS........"
    ],
    "palette": {
      "h": "#466b52",
      "H": "#90b987",
      "S": "#e4c4a2",
      "b": "#466b52",
      "g": "#253b38",
      "m": "#ad775e",
      "c": "#466b52",
      "C": "#90b987",
      "a": "#e3c98d"
    }
  },
  "vampire": {
    "label": "뱀파이어",
    "head": [
      ".......hhhhhhh.......",
      ".....hhHHHHHHHhh.....",
      "....hHHHHHHHHHHHh....",
      "....hHHHhHHHhHHHh....",
      ".....hSSShSSShSS.....",
      ".....SSgSSSSSgSS.....",
      ".....SSgSSSSSgSS.....",
      ".....SSSSSSSSSSS.....",
      "......SSmaamSSS......",
      ".......SaSSaSS.......",
      "........SSSSS........"
    ],
    "palette": {
      "h": "#3a304c",
      "H": "#756182",
      "S": "#dac8cf",
      "b": "#3a304c",
      "g": "#253b38",
      "m": "#ad775e",
      "c": "#3a304c",
      "C": "#756182",
      "a": "#b95070"
    }
  },
  "bear": {
    "label": "곰",
    "head": [
      "....hhh.......hhh....",
      "...hHHHh.....hHHHh...",
      "...hHHHhhhhhhhHHHh...",
      "....hHHHHHHHHHHHh....",
      "....hHHHHHHHHHHHh....",
      ".....HHgHHHHHgHH.....",
      ".....HHHHHHHHHHH.....",
      ".....HHSSmmmSSHH.....",
      "......HSSSmSSSH......",
      ".......HHHHHHH.......",
      "........HHHHH........"
    ],
    "palette": {
      "h": "#6c4e3b",
      "H": "#ba8e64",
      "S": "#e8c396",
      "b": "#6c4e3b",
      "g": "#253b38",
      "m": "#ad775e",
      "c": "#6c4e3b",
      "C": "#ba8e64",
      "a": "#a66b45"
    },
    "body": [
      ".....ccCCCCCCCcc.....",
      "....cCCCCCCCCCCCc....",
      "...cCCCaaaaaaaCCCc...",
      "...cCCaaaaaaaaaCCc...",
      "...cCCaaaaaaaaaCCc...",
      "....cCCaaaaaaaCCc....",
      ".....cCCCCCCCCCc.....",
      "......ccccccccc......",
      "......bb.....bb......",
      ".....bbb.....bbb....."
    ]
  },
  "fox": {
    "label": "여우",
    "head": [
      "....hh.........hh....",
      "....hHh.......hHh....",
      "....hHHh.....hHHh....",
      "....hHHHhhhhhHHHh....",
      "....hHHHHHHHHHHHh....",
      ".....HHgHHHHHgHH.....",
      ".....HHSSHHHSSHH.....",
      "......SSSSmSSSS......",
      ".......SSmmmSS.......",
      "........SSSSS........",
      ".........SSS........."
    ],
    "palette": {
      "h": "#995336",
      "H": "#e79a56",
      "S": "#ffe3bd",
      "b": "#995336",
      "g": "#253b38",
      "m": "#ad775e",
      "c": "#995336",
      "C": "#e79a56",
      "a": "#86a89b"
    },
    "body": [
      ".....ccCCCCCCCcc.....",
      "....cCCCCCCCCCCCc....",
      "...cCCCaaaaaaaCCCc...",
      "...cCCaaaaaaaaaCCc...",
      "...cCCaaaaaaaaaCCc...",
      "....cCCaaaaaaaCCc....",
      ".....cCCCCCCCCCc.....",
      "......ccccccccc......",
      "......bb.....bb......",
      ".....bbb.....bbb....."
    ]
  },
  "penguin": {
    "label": "펭귄",
    "head": [
      ".......hhhhhhh.......",
      ".....hhHHHHHHHhh.....",
      "....hHHHHHHHHHHHh....",
      "....hHHSSSHSSSHHh....",
      "....hHSSgSSSgSSHh....",
      ".....HSSSSSSSSSH.....",
      ".....HSSaaaaaSSH.....",
      ".....HHSSaaaSSHH.....",
      "......HHSSSSSHH......",
      ".......HHHHHHH.......",
      "........HHHHH........"
    ],
    "palette": {
      "h": "#293b4a",
      "H": "#496170",
      "S": "#eaf0df",
      "b": "#293b4a",
      "g": "#253b38",
      "m": "#ad775e",
      "c": "#293b4a",
      "C": "#496170",
      "a": "#f3ba5f"
    },
    "body": [
      ".....ccCCCCCCCcc.....",
      "....cCCCCCCCCCCCc....",
      "...cCCCaaaaaaaCCCc...",
      "...cCCaaaaaaaaaCCc...",
      "...cCCaaaaaaaaaCCc...",
      "....cCCaaaaaaaCCc....",
      ".....cCCCCCCCCCc.....",
      "......ccccccccc......",
      "......bb.....bb......",
      ".....bbb.....bbb....."
    ]
  },
  "alien": {
    "label": "외계인",
    "head": [
      "....a...........a....",
      ".....h.........h.....",
      "......hhhhhhhhh......",
      ".....hHHHHHHHHHh.....",
      "....hHHHHHHHHHHHh....",
      "....hHggHHHHHggHh....",
      "....hHgggHHHgggHh....",
      ".....HggHHHHHggH.....",
      "......HHHHHHHHH......",
      ".......HHmmmHH.......",
      "........HHHHH........"
    ],
    "palette": {
      "h": "#4c7861",
      "H": "#a3d0a0",
      "S": "#b5deb3",
      "b": "#4c7861",
      "g": "#253b38",
      "m": "#ad775e",
      "c": "#4c7861",
      "C": "#a3d0a0",
      "a": "#b0a2df"
    },
    "body": [
      ".....ccCCCCCCCcc.....",
      "....cCCCCCCCCCCCc....",
      "...cCCCaaaaaaaCCCc...",
      "...cCCaaaaaaaaaCCc...",
      "...cCCaaaaaaaaaCCc...",
      "....cCCaaaaaaaCCc....",
      ".....cCCCCCCCCCc.....",
      "......ccccccccc......",
      "......bb.....bb......",
      ".....bbb.....bbb....."
    ]
  },
  "mushroom": {
    "label": "버섯 요정",
    "head": [
      ".......hhhhhhh.......",
      ".....hhHHaaaHHhh.....",
      "....hHaaaHHHHHHHh....",
      "...hHHaaaHHHHaaaHh...",
      "..hHHHHHHHHHHaaaHHh..",
      "..hhhhhhhhhhhhhhhhh..",
      ".....SSSSSSSSSSS.....",
      ".....SSgSSSSSgSS.....",
      "......SSSSSSSSS......",
      ".......SSmmmSS.......",
      "........SSSSS........"
    ],
    "palette": {
      "h": "#a04e51",
      "H": "#df8181",
      "S": "#f5e6c4",
      "b": "#a04e51",
      "g": "#253b38",
      "m": "#ad775e",
      "c": "#a04e51",
      "C": "#df8181",
      "a": "#faf0da"
    },
    "body": [
      ".....ccCCCCCCCcc.....",
      "....cCCCCCCCCCCCc....",
      "...cCCCaaaaaaaCCCc...",
      "...cCCaaaaaaaaaCCc...",
      "...cCCaaaaaaaaaCCc...",
      "....cCCaaaaaaaCCc....",
      ".....cCCCCCCCCCc.....",
      "......ccccccccc......",
      "......bb.....bb......",
      ".....bbb.....bbb....."
    ]
  }
});
for(const [id,character] of Object.entries(newCharacters)) {
  maps[id]=[...character.head,...(character.body || maps.dev.slice(11).map(row=>row.replaceAll('d','a')))];
  palettes[id]=character.palette;
}
export const CHARACTER_CATALOG = {
  chief:'마법사',dev:'개발자',junior:'초록 개발자',writer:'베레모',format:'안경 편집자',misc:'줄무늬',secretary:'비서',
  ...Object.fromEntries(Object.entries(newCharacters).map(([id,c])=>[id,c.label])),
};
export function sprite(id, x = 0, y = 0, scale = 2, extra = '') {
  if(!Object.hasOwn(maps,id)) id="chief";
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
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    pencil: '<path d="m15 4 5 5M4 16l-1 5 5-1L21 7l-5-5Z"/>',
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
