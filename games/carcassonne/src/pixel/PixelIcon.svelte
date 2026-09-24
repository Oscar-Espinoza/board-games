<script lang="ts" module>
  // Hand-set 8-bit UI icons. 'x' is currentColor, 'g' the gold accent.
  const icons: Record<string, string[]> = {
    guide: [
      '.xxxx..xxxx.',
      'x....xx....x',
      'x.gg.xx.gg.x',
      'x....xx....x',
      'x.gg.xx.gg.x',
      'x....xx....x',
      'x.gg.xx.gg.x',
      'x....xx....x',
      'x....xx....x',
      '.xxxx..xxxx.',
    ],
    journal: [
      '.xxxxxxxxx..',
      'x.........x.',
      'x.ggggggg.x.',
      'x.........x.',
      'x.ggggggg.x.',
      'x.........x.',
      'x.gggg....x.',
      'x.........x.',
      'xxxxxxxxxxxx',
      '.x.........x',
      '..xxxxxxxxx.',
    ],
    overview: [
      '.........gg.',
      '.........gg.',
      '.....gg..gg.',
      '.....gg..gg.',
      '.gg..gg..gg.',
      '.gg..gg..gg.',
      '.gg..gg..gg.',
      '.gg..gg..gg.',
      '.gg..gg..gg.',
      'xxxxxxxxxxxx',
    ],
    settings: [
      '..ggg.......',
      'xxgggxxxxxxx',
      '..ggg.......',
      '............',
      '.......ggg..',
      'xxxxxxxgggxx',
      '.......ggg..',
      '............',
      '....ggg.....',
      'xxxxgggxxxxx',
      '....ggg.....',
    ],
    plus: [
      '....xx....',
      '....xx....',
      '....xx....',
      '....xx....',
      'xxxxxxxxxx',
      'xxxxxxxxxx',
      '....xx....',
      '....xx....',
      '....xx....',
      '....xx....',
    ],
    minus: [
      '..........',
      '..........',
      '..........',
      '..........',
      'xxxxxxxxxx',
      'xxxxxxxxxx',
      '..........',
      '..........',
      '..........',
      '..........',
    ],
    fit: [
      'xxxx..xxxx',
      'x........x',
      'x........x',
      'x........x',
      '..........',
      '..........',
      'x........x',
      'x........x',
      'x........x',
      'xxxx..xxxx',
    ],
    target: [
      '....xx....',
      '....xx....',
      '..xxxxxx..',
      '..x....x..',
      'xxx.xx.xxx',
      'xxx.xx.xxx',
      '..x....x..',
      '..xxxxxx..',
      '....xx....',
      '....xx....',
    ],
    pan: [
      '....xx....',
      '...xxxx...',
      '....xx....',
      '.x..xx..x.',
      'xxxxxxxxxx',
      'xxxxxxxxxx',
      '.x..xx..x.',
      '....xx....',
      '...xxxx...',
      '....xx....',
    ],
    rotate: [
      '....xxxxx.x.',
      '..xx.....xx.',
      '.x......xxx.',
      '.x..........',
      'x...........',
      'x...........',
      'x..........x',
      'x..........x',
      '.x........x.',
      '.x........x.',
      '..xx....xx..',
      '....xxxx....',
    ],
    check: [
      '..........xx',
      '.........xx.',
      '........xx..',
      '.......xx...',
      'xx....xx....',
      '.xx..xx.....',
      '..xxxx......',
      '...xx.......',
    ],
    cross: [
      'xx......xx',
      '.xx....xx.',
      '..xx..xx..',
      '...xxxx...',
      '....xx....',
      '...xxxx...',
      '..xx..xx..',
      '.xx....xx.',
      'xx......xx',
    ],
    castle: [
      'x.x.x..x.x.x',
      'xxxxx..xxxxx',
      '.xxx....xxx.',
      '.xxxxxxxxxx.',
      '.xxxxggxxxx.',
      '.xxxxggxxxx.',
      '.xxxxxxxxxx.',
      '.xxxx..xxxx.',
      '.xxx....xxx.',
      '.xxx....xxx.',
    ],
    meeple: [
      '....xx....',
      '...xxxx...',
      '...xxxx...',
      '.xxxxxxxx.',
      'xxxxxxxxxx',
      '..xxxxxx..',
      '..xxxxxx..',
      '.xxx..xxx.',
      '.xxx..xxx.',
    ],
  };
  icons['rotate-left'] = icons.rotate.map((r) => [...r].reverse().join(''));
  const colors: Record<string, string> = { x: 'currentColor', g: '#f2c14e' };
</script>

<script lang="ts">
  let { name }: { name: string } = $props();
  const rows = $derived(icons[name] ?? []);
  // One path per colour: every lit pixel is a 1×1 square.
  const paths = $derived(
    Object.keys(colors).map((c) => ({
      fill: colors[c],
      d: rows
        .flatMap((row, y) =>
          [...row].map((v, x) => (v === c ? `M${x} ${y}h1v1h-1z` : '')),
        )
        .join(''),
    })),
  );
</script>

<svg
  class="px-icon"
  viewBox={`0 0 ${rows[0]?.length ?? 1} ${rows.length || 1}`}
  shape-rendering="crispEdges"
  aria-hidden="true"
  >{#each paths as p}{#if p.d}<path d={p.d} fill={p.fill} />{/if}{/each}</svg
>
