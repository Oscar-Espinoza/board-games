<script lang="ts">
  let { notes }: { notes?: string[] } = $props();
  const leaves = Array.from({ length: 24 }, (_, i) => ({
    x: 12 + ((i * 43) % 146),
    y: 5 + ((i * 61) % 145),
    angle: (i * 73) % 360,
    color: ['#4e714a', '#6b824b', '#315b46', '#869255'][i % 4],
  }));
</script>

<div class="table-decor" aria-hidden="true">
  <svg class="plant top-plant" viewBox="0 0 180 200">
    <ellipse cx="52" cy="85" rx="90" ry="102" fill="#765437" /><ellipse
      cx="48"
      cy="77"
      rx="82"
      ry="96"
      fill="#bb8c56"
      stroke="#d7a867"
      stroke-width="5"
    /><ellipse cx="44" cy="64" rx="67" ry="83" fill="#5f5c3b" />
    {#each leaves as leaf}<g
        transform={`translate(${leaf.x} ${leaf.y - 25}) rotate(${leaf.angle})`}
        ><path
          d="M0 0C-23-6-29-36-11-44C11-51 24-20 0 0"
          fill={leaf.color}
          stroke="#344c3938"
          stroke-width="1"
        /><path
          d="M-3-5Q2-20-8-35"
          stroke="#b5ac65"
          opacity=".3"
          fill="none"
        /><path
          d="M-11-38Q-24-25-14-13"
          stroke="#bcc279"
          stroke-width="4"
          stroke-linecap="round"
          opacity=".12"
          fill="none"
        /></g
      >{/each}
  </svg>
  <div class="note top-note">
    {#if notes}{#each notes[0].split('|') as line}{line}<br
        />{/each}{:else}Different<br />dishes<br />brighter<br />together{/if}
    <span>♥</span>
  </div>
  <div class="note right-note">
    {#if notes}{#each notes[1].split('|') as line}{line}<br
        />{/each}{:else}SAME<br />TABLE.<br />MORE<br />HAPPINESS{/if}
    <span>♥</span>
  </div>
  <div class="note bottom-note">
    {#if notes}{#each notes[2].split('|') as line}{line}<br
        />{/each}{:else}GOOD<br />GAMES<br />TASTY<br />PEOPLE{/if}
    <span>♥</span>
  </div>
  <div class="chopsticks"><i></i><i></i></div>
  <div class="sauce"><div><span>⌣</span><i></i><i></i></div></div>
  <div class="tea">
    <div></div>
    <span>• ◡ •</span>
  </div>
  <svg class="plant bottom-plant" viewBox="0 0 180 200">
    <path
      d="M44 201Q57 106 144 27M81 178Q22 97 31 4M72 201Q123 160 151 86"
      fill="none"
      stroke="#968a4d"
      stroke-width="4"
    />
    {#each leaves as leaf}<g
        transform={`translate(${leaf.x + 15} ${leaf.y + 34}) rotate(${leaf.angle})`}
        ><path
          d="M0 0C-23-6-29-36-11-44C11-51 24-20 0 0"
          fill={leaf.color}
          stroke="#344c3938"
        /><path
          d="M-3-5Q2-20-8-35"
          stroke="#b5ac65"
          opacity=".3"
          fill="none"
        /></g
      >{/each}
  </svg>
</div>

<style>
  .table-decor {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .plant {
    position: absolute;
    filter: drop-shadow(3px 9px 5px #173e393f);
  }
  .top-plant {
    width: 207px;
    height: 237px;
    left: -28px;
    top: -17px;
  }
  .bottom-plant {
    width: 220px;
    height: 270px;
    right: -4px;
    bottom: -49px;
  }
  .note {
    position: absolute;
    padding: 25px 31px;
    background:
      repeating-linear-gradient(35deg, #dfceb015 0 2px, transparent 2px 7px),
      linear-gradient(110deg, #ecd8b8, #f7e8cf 65%, #e7ccaa);
    color: #627569;
    font-size: 21px;
    line-height: 1.12;
    border: 1px solid #c8ad87;
    border-radius: 2px;
    box-shadow:
      3px 6px 1px #6e5d3d88,
      2px 12px 12px #21473755,
      inset 5px 0 1px #fff4d733;
    text-align: center;
  }
  .note span {
    display: block;
    margin-top: 9px;
    color: #c76f65;
    font-size: 25px;
  }
  .top-note {
    left: 162px;
    top: -25px;
    transform: rotate(-12deg);
    padding: 37px 27px 17px;
    text-align: left;
    font-style: italic;
  }
  .right-note {
    right: -19px;
    top: -34px;
    width: 194px;
    height: 208px;
    transform: rotate(18deg);
    font-weight: 750;
    letter-spacing: 1px;
    padding-top: 41px;
  }
  .bottom-note {
    left: -6px;
    bottom: 56px;
    transform: rotate(-13deg);
    width: 168px;
    height: 226px;
    padding-top: 43px;
    font-weight: 740;
    color: #a16859;
  }
  .chopsticks {
    position: absolute;
    left: 154px;
    bottom: 35px;
    width: 60px;
    height: 258px;
    transform: rotate(23deg);
  }
  .chopsticks i {
    position: absolute;
    height: 100%;
    width: 13px;
    border-radius: 7px 7px 2px 2px;
    background: linear-gradient(
      90deg,
      #865331,
      #e6ba7b 40%,
      #b8874f 80%,
      #774d30
    );
    box-shadow: 3px 3px 4px #233d3555;
  }
  .chopsticks i:last-child {
    left: 25px;
    transform: rotate(3deg);
  }
  .sauce {
    position: absolute;
    left: 28px;
    top: 470px;
    width: 146px;
    height: 108px;
    padding: 13px;
    border-radius: 50%;
    background: linear-gradient(135deg, #fff2d5, #d5bb92 70%, #f5e7ce);
    box-shadow:
      inset 3px 4px 2px #fff4db,
      0 8px 0 #a89472,
      2px 12px 10px #20403966;
    transform: rotate(-22deg);
  }
  .sauce > div {
    height: 100%;
    border: 5px solid #b49a75;
    border-radius: 50%;
    background: radial-gradient(
      ellipse at 60% 70%,
      #35251e,
      #251e18 60%,
      #926541 64%,
      #553b2b
    );
    position: relative;
    text-align: center;
  }
  .sauce span {
    position: absolute;
    color: #ddb889;
    left: 49%;
    top: 20%;
    font-size: 25px;
  }
  .sauce i {
    position: absolute;
    width: 11px;
    height: 7px;
    border: 2px solid #c9a178;
    border-bottom: 0;
    border-radius: 50% 50% 0 0;
    left: 27%;
    top: 45%;
  }
  .sauce i:last-child {
    left: 69%;
  }
  .tea {
    position: absolute;
    right: 203px;
    top: -46px;
    width: 125px;
    height: 132px;
    background: linear-gradient(90deg, #bca788, #f2e2c3 50%, #c5b497);
    border-radius: 20% 20% 47% 47%;
    box-shadow: 4px 9px 7px #25453855;
    transform: rotate(15deg);
  }
  .tea div {
    height: 94px;
    border: 10px solid #e4cfab;
    border-radius: 50%;
    background: radial-gradient(ellipse, #68714a, #3f4c32);
    box-shadow: inset 1px 4px 5px #243b2a;
  }
  .tea span {
    position: absolute;
    bottom: 9px;
    left: 34px;
    font-size: 21px;
    color: #394a35;
  }
</style>
