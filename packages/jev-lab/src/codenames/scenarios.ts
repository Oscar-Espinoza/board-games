/** Hand-authored guesser positions. We are always the red team; the key never reaches Jev.
 * Board words come from the game's pack; each board is dealt like the game's: 9 ours / 8 theirs / 7 civilians / 1 assassin. */
import { deal } from '@board-games/codenames/setup';
import { words as pack } from '@board-games/codenames/words';
import type { PastClue } from './types.ts';

export type Identity = 'ours' | 'theirs' | 'civilian' | 'assassin';
export type Category =
  | 'clean'
  | 'assassin-trap'
  | 'opponent-trap'
  | 'polysemy'
  | 'compound'
  | 'leftover'
  | 'weak'
  /** Same board as a failing scenario, with a clue that avoids the competing words. */
  | 'fixed';

export interface Scenario {
  id: string;
  category: Category;
  lang: 'en' | 'es';
  clue: { word: string; count: number };
  /** Our words the spymaster meant, in no particular order. Empty for a clue that fits nothing. */
  intended: string[];
  /** Words the clue could wrongly pull a guesser toward. */
  traps: string[];
  key: Record<string, Identity>;
  revealed: string[];
  history: PastClue[];
  note: string;
}

interface Draft {
  category: Category;
  lang?: 'en' | 'es';
  clue: [string, number];
  intended: string[];
  traps?: string[];
  ours: string;
  theirs: string;
  civilians: string;
  assassin: string;
  revealed?: string;
  history?: PastClue[];
  note: string;
}

const drafts: Record<string, Draft> = {
  'clean-orchestra': {
    category: 'clean',
    clue: ['orchestra', 1],
    intended: ['cello'],
    ours: 'cello anchor candle desert hammer kite library pencil tunnel',
    theirs: 'bakery comet glove jaguar meadow pillow sheep tomato',
    civilians: 'barn bridge crown fern lemon rope statue',
    assassin: 'volcano',
    note: 'Only instrument on the board.',
  },
  'clean-hoof': {
    category: 'clean',
    clue: ['hoof', 1],
    intended: ['horse'],
    ours: 'horse bottle clock island lamp needle pepper school wing',
    theirs: 'bell cabin dragon forest jelly marble pond sword',
    civilians: 'attic carpet envelope grape mask ribbon submarine',
    assassin: 'tooth',
    note: 'Only hoofed animal.',
  },
  'clean-dairy': {
    category: 'clean',
    clue: ['dairy', 2],
    intended: ['cheese', 'yogurt'],
    ours: 'cheese yogurt arrow bridge captain fern kite lantern shovel',
    theirs: 'canyon dolphin hat iron orange pearl rabbit silk',
    civilians: 'bicycle chalk cloud drum gate paper tower',
    assassin: 'ghost',
    note: 'Two unambiguous dairy products.',
  },
  'clean-polar': {
    category: 'clean',
    clue: ['polar', 2],
    intended: ['bear', 'iceberg'],
    ours: 'bear iceberg apple book castle doctor mirror rocket violin',
    theirs: 'basket candle dragon fox harbor onion ribbon tent',
    civilians: 'button chimney garden jar magnet pirate statue',
    assassin: 'piano',
    note: 'Polar bear plus polar ice; magnet (magnetic pole) is a weak civilian pull.',
  },
  'clean-cutlery': {
    category: 'clean',
    clue: ['cutlery', 3],
    intended: ['fork', 'spoon', 'knife'],
    ours: 'fork spoon knife bamboo comet fountain hill radio wagon',
    theirs: 'badge cave coral eagle lock mushroom sail tiger',
    civilians: 'acorn blanket crown dream globe ladder velvet',
    assassin: 'soap',
    note: 'Three-card clue with no competing tableware.',
  },
  'clean-orbit': {
    category: 'clean',
    clue: ['orbit', 3],
    intended: ['planet', 'moon', 'satellite'],
    ours: 'planet moon satellite bone broom cherry desk flag owl',
    theirs: 'basket bucket cactus forest glove lemon net pillow',
    civilians: 'bottle castle fence honey ink rope tulip',
    assassin: 'jaguar',
    note: 'Three space bodies; nothing else orbits.',
  },
  'assassin-pod': {
    category: 'assassin-trap',
    clue: ['pod', 2],
    intended: ['whale', 'dolphin'],
    traps: ['shark'],
    ours: 'whale dolphin clock garden hammer kite pencil rose train',
    theirs: 'bank camera desert fox jacket lamp mountain violin',
    civilians: 'bakery button cloud fern lock sock wheel',
    assassin: 'shark',
    note: 'Pod picks the social sea mammals and steers away from the shark.',
  },
  'assassin-knight': {
    category: 'assassin-trap',
    clue: ['knight', 2],
    intended: ['sword', 'shield'],
    traps: ['knife', 'helmet'],
    ours: 'sword shield apple balloon bicycle candle map pond wolf',
    theirs: 'bottle cherry fish gold lemon owl piano tent',
    civilians: 'helmet chair drum feather jar leaf rope',
    assassin: 'knife',
    note: 'Knight gear rather than generic blades.',
  },
  'assassin-rumble': {
    category: 'assassin-trap',
    clue: ['rumble', 2],
    intended: ['thunder', 'drum'],
    traps: ['lightning'],
    ours: 'thunder drum basket cabin diamond frog mask pencil silk',
    theirs: 'anchor bridge crown lake mouse pepper ribbon tower',
    civilians: 'bone chalk envelope globe kettle olive tulip',
    assassin: 'lightning',
    note: 'A sound clue: thunder is heard, lightning is seen.',
  },
  'assassin-pie': {
    category: 'assassin-trap',
    clue: ['pie', 2],
    intended: ['apple', 'cherry'],
    traps: ['grape', 'pastry', 'melon'],
    ours: 'apple cherry boat cello eagle key ladder owl wall',
    theirs: 'melon bank fox hat kite map rain tree',
    civilians: 'pastry badge bell fence lamp rock shoe',
    assassin: 'grape',
    note: 'Classic pies; grape pie is not a thing.',
  },
  'opponent-pride': {
    category: 'opponent-trap',
    clue: ['pride', 1],
    intended: ['lion'],
    traps: ['tiger', 'jaguar', 'flag', 'wolf'],
    ours: 'lion bucket cabin dream kettle needle radio school sheep',
    theirs: 'tiger jaguar basket bridge cloud glass moon rope',
    civilians: 'flag bamboo comet fork globe onion tent',
    assassin: 'wolf',
    note: 'A pride is specifically lions; other big cats belong to the opponent.',
  },
  'opponent-eclipse': {
    category: 'opponent-trap',
    clue: ['eclipse', 2],
    intended: ['moon', 'sun'],
    traps: ['star', 'planet', 'shadow', 'night'],
    ours: 'moon sun boat button cheese fence jacket pond wing',
    theirs: 'star planet bell chimney dragon gold lamp pillow',
    civilians: 'shadow apple frog hammer marble rope sock',
    assassin: 'night',
    note: 'Only the sun and moon take part in an eclipse; night is a dark pull.',
  },
  'polysemy-bow': {
    category: 'polysemy',
    clue: ['bow', 2],
    intended: ['violin', 'cello'],
    traps: ['guitar', 'ribbon', 'arrow'],
    ours: 'violin cello apple bottle candle desert hill rabbit wheel',
    theirs: 'guitar ribbon bank cave coat forest nest sun',
    civilians: 'arrow chair jar lemon owl road sock',
    assassin: 'pencil',
    note: 'Bowed strings; archery and ribbon senses also on the board.',
  },
  'polysemy-trunk': {
    category: 'polysemy',
    clue: ['trunk', 2],
    intended: ['elephant', 'tree'],
    traps: ['suitcase'],
    ours: 'elephant tree bakery bottle comet feather lock pepper rain',
    theirs: 'suitcase anchor bicycle cave glove harbor onion silk',
    civilians: 'attic bone crown grass mask statue wave',
    assassin: 'violin',
    note: 'Two senses intended; the luggage sense belongs to the opponent.',
  },
  'polysemy-stamp': {
    category: 'polysemy',
    clue: ['stamp', 2],
    intended: ['envelope', 'postcard'],
    traps: ['letter', 'seal'],
    ours: 'envelope postcard cactus drum hat island kite needle tower',
    theirs: 'bear cloud fish gold jelly pearl sail window',
    civilians: 'letter bucket cherry fern mirror rope zipper',
    assassin: 'seal',
    note: 'Letter is a civilian pull; seal is both an animal and a stamp.',
  },
  'polysemy-pitch': {
    category: 'polysemy',
    clue: ['pitch', 2],
    intended: ['tent', 'stadium'],
    traps: ['opera'],
    ours: 'tent stadium apple bone broom key lemon owl rocket',
    theirs: 'bank candle desert fox globe lake ribbon tiger',
    civilians: 'opera badge cabin jar pillow sheep wall',
    assassin: 'salt',
    note: 'Pitch a tent, football pitch; musical pitch pulls to opera.',
  },
  'compound-sea': {
    category: 'compound',
    clue: ['sea', 3],
    intended: ['shell', 'lion', 'horse'],
    traps: ['salt'],
    ours: 'shell lion horse apple book clock dream fence kite',
    theirs: 'salt candle cave drum glove lemon map sock',
    civilians: 'bird bridge crown jar pencil rope tulip',
    assassin: 'gate',
    note: 'Seashell, sea lion, seahorse; sea salt is the opponent.',
  },
  'compound-star': {
    category: 'compound',
    clue: ['star', 2],
    intended: ['fish', 'light'],
    traps: ['galaxy'],
    ours: 'fish light badge anchor cello hammer kettle rabbit wagon',
    theirs: 'bottle desert eagle fern jar lock pencil rope',
    civilians: 'galaxy button cloud garden mask tower zebra',
    assassin: 'cheese',
    note: 'Starfish, starlight; a sheriff badge is a bonus friendly.',
  },
  'leftover-flock': {
    category: 'leftover',
    clue: ['flock', 2],
    intended: ['sheep', 'pigeon', 'wave'],
    traps: ['goose', 'beach', 'fish'],
    ours: 'sheep pigeon wave whale cabin clock desk glove kite',
    theirs: 'goose beach drum fork map shoe tower pearl',
    civilians: 'fish bell candle lemon mirror rope statue',
    assassin: 'pencil',
    revealed: 'whale drum bell',
    history: [
      { team: 'ours', word: 'ocean', count: 2, guessed: ['whale', 'bell'] },
      { team: 'theirs', word: 'music', count: 1, guessed: ['drum'] },
    ],
    note: 'Two flock animals, then the bonus guess can take WAVE left from "ocean 2".',
  },
  'leftover-hoot': {
    category: 'leftover',
    clue: ['hoot', 1],
    intended: ['owl', 'tulip'],
    traps: ['raven', 'daisy', 'flower', 'night'],
    ours: 'owl tulip rose bamboo bicycle cheese coat harbor pencil',
    theirs: 'raven daisy bank bridge cloud glove magnet wolf',
    civilians: 'flower bucket fence lamp rope silk train',
    assassin: 'night',
    revealed: 'rose bank',
    history: [
      { team: 'ours', word: 'garden', count: 2, guessed: ['rose'] },
      { team: 'theirs', word: 'money', count: 1, guessed: ['bank'] },
    ],
    note: 'Owl, then the bonus guess can take TULIP left from "garden 2".',
  },
  'weak-nature': {
    category: 'weak',
    clue: ['nature', 2],
    intended: ['fern', 'meadow'],
    traps: ['snake', 'river', 'tree', 'bird', 'flower', 'grass'],
    ours: 'fern meadow apple bell candle desk hat mirror rocket',
    theirs: 'river tree bird button glass key piano spoon',
    civilians: 'flower grass cloud jar lamp sock wheel',
    assassin: 'snake',
    note: 'Bad clue from our archive: many nature words on every side. Best play is one guess, then stop.',
  },
  'weak-spreadsheet': {
    category: 'weak',
    clue: ['spreadsheet', 1],
    intended: [],
    ours: 'apple arrow cabin cello dolphin fern kite owl rose',
    theirs: 'bridge candle crown drum glove lake moon sheep',
    civilians: 'basket chair feather grape mask rope tower',
    assassin: 'volcano',
    note: 'Fits nothing. Probabilities should all be low; guess once and stop.',
  },
  'es-granja': {
    category: 'clean',
    lang: 'es',
    clue: ['granja', 2],
    intended: ['vaca', 'gallina'],
    ours: 'vaca gallina ancla libro reloj faro globo piano túnel',
    theirs: 'águila barco campana cometa llave mapa nube rosa',
    civilians: 'arena botella cama espejo lápiz pluma torre',
    assassin: 'tigre',
    note: 'Spanish farm animals.',
  },
  'es-pico': {
    category: 'polysemy',
    lang: 'es',
    clue: ['pico', 2],
    intended: ['montaña', 'pájaro'],
    traps: ['pala', 'águila', 'volcán'],
    ours: 'montaña pájaro abeja cama dado hilo lana mesa sopa',
    theirs: 'águila avión bota carta flor lobo nube reloj',
    civilians: 'volcán camino faro jabón lluvia papel tren',
    assassin: 'pala',
    note: 'Peak and beak; "pico y pala" pulls to the assassin.',
  },
  'es-tesoro': {
    category: 'opponent-trap',
    lang: 'es',
    clue: ['tesoro', 2],
    intended: ['isla', 'mapa'],
    traps: ['moneda', 'joya', 'barco'],
    ours: 'isla mapa abuelo cebra gato lámpara nido pera silla',
    theirs: 'moneda arco caracol flauta hielo pan rana zorro',
    civilians: 'joya brújula cuerda escoba huevo oso tambor',
    assassin: 'barco',
    note: 'Treasure island and treasure map; coins and jewels are tempting.',
  },
};

/** Round 4: what a careful spymaster would have said on the same board. */
const fixes: Record<
  string,
  { clue: [string, number]; intended: string[]; note: string }
> = {
  'assassin-pie': {
    clue: ['orchard', 2],
    intended: ['apple', 'cherry'],
    note: 'Orchard fruit; grapes grow in vineyards, melons in patches, pastry is not grown.',
  },
  'assassin-knight': {
    clue: ['excalibur', 1],
    intended: ['sword'],
    note: 'Drop the count rather than share a clue with helmet and knife.',
  },
  'clean-polar': {
    clue: ['arctic', 2],
    intended: ['bear', 'iceberg'],
    note: 'Removes the magnetic-pole reading.',
  },
  'polysemy-bow': {
    clue: ['quartet', 2],
    intended: ['violin', 'cello'],
    note: 'String quartet has no guitar, ribbon or arrow.',
  },
  'polysemy-pitch': {
    clue: ['football', 1],
    intended: ['stadium'],
    note: 'One clean target instead of a pun that also means musical pitch.',
  },
  'compound-sea': {
    clue: ['mane', 2],
    intended: ['lion', 'horse'],
    note: 'Sea salt competed; mane has no rival on the board.',
  },
  'compound-star': {
    clue: ['sun', 2],
    intended: ['fish', 'light'],
    note: 'Sunfish, sunlight: still compounds, without galaxy as the obvious star word.',
  },
  'leftover-flock': {
    clue: ['wool', 1],
    intended: ['sheep', 'wave'],
    note: 'Flock also means geese; wool is only sheep. Bonus guess can still take WAVE.',
  },
  'es-tesoro': {
    clue: ['atlas', 1],
    intended: ['mapa'],
    note: 'Treasure pulled to coins and jewels; atlas only fits the map.',
  },
  'es-pico': {
    clue: ['everest', 1],
    intended: ['montaña'],
    note: 'Pico also meant beak (águila) and pickaxe (pala, the assassin).',
  },
};

/** Stable board order that doesn't group words by identity. */
export function shuffled<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const next = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 2 ** 32;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function build(id: string, d: Draft): Scenario {
  const lang = d.lang ?? 'en';
  const split = (s: string) => s.split(' ');
  const key: Record<string, Identity> = {};
  const groups: [Identity, string[], number][] = [
    ['ours', split(d.ours), deal.first],
    ['theirs', split(d.theirs), deal.second],
    ['civilian', split(d.civilians), deal.civilians],
    ['assassin', [d.assassin], deal.assassin],
  ];
  for (const [identity, list, size] of groups) {
    if (list.length !== size)
      throw new Error(`${id}: ${identity} needs ${size}`);
    for (const w of list) {
      if (key[w]) throw new Error(`${id}: duplicate ${w}`);
      if (!pack[lang].includes(w)) throw new Error(`${id}: ${w} not in pack`);
      key[w] = identity;
    }
  }
  const revealed = d.revealed ? split(d.revealed) : [];
  for (const w of [...d.intended, ...(d.traps ?? []), ...revealed])
    if (!key[w]) throw new Error(`${id}: unknown word ${w}`);
  for (const w of d.intended)
    if (key[w] !== 'ours') throw new Error(`${id}: ${w} is not ours`);
  if (key[d.clue[0]]) throw new Error(`${id}: clue is on the board`);
  return {
    id,
    category: d.category,
    lang,
    clue: { word: d.clue[0], count: d.clue[1] },
    intended: d.intended,
    traps: d.traps ?? [],
    key,
    revealed,
    history: d.history ?? [],
    note: d.note,
  };
}

export const scenarios = [
  ...Object.entries(drafts).map(([id, d]) => build(id, d)),
  ...Object.entries(fixes).map(([id, f]) =>
    build(`${id}+fix`, { ...drafts[id]!, ...f, category: 'fixed' }),
  ),
];
