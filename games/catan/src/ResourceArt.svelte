<script lang="ts">
  let { resource }: { resource: number } = $props();
</script>

<svg viewBox="0 0 100 100" aria-hidden="true" class="resource-art">
  {#if resource === 0}
    <path
      d="M12 63 60 36 91 49 44 80Z"
      fill="#663d22"
      stroke="#35271c"
      stroke-width="2"
    />
    <path
      d="M17 46 61 22 88 37 43 62Z"
      fill="#80502a"
      stroke="#35271c"
      stroke-width="2"
    />
    <path
      d="M28 46 68 25M49 48 82 31M52 66 83 49"
      stroke="#c29250"
      stroke-width="3"
    />
    <ellipse
      cx="32"
      cy="55"
      rx="16"
      ry="11"
      transform="rotate(30 32 55)"
      fill="#dcb77a"
      stroke="#513922"
      stroke-width="3"
    />
    <ellipse
      cx="32"
      cy="55"
      rx="9"
      ry="6"
      transform="rotate(30 32 55)"
      fill="none"
      stroke="#ab753f"
      stroke-width="2"
    />
    <ellipse
      cx="32"
      cy="74"
      rx="16"
      ry="11"
      transform="rotate(30 32 74)"
      fill="#e3c087"
      stroke="#513922"
      stroke-width="3"
    />
    <ellipse
      cx="32"
      cy="74"
      rx="9"
      ry="6"
      transform="rotate(30 32 74)"
      fill="none"
      stroke="#ab753f"
      stroke-width="2"
    />
  {:else if resource === 1}
    <path d="m27 65-2 19m39-20 4 20" stroke="#42392c" stroke-width="7" />
    <path
      d="M20 58c-16-9-4-27 7-23 0-17 20-20 26-10 11-10 28-3 25 11 14 7 6 25-7 25-8 17-25 12-29 5-12 9-26 2-22-8"
      fill="#fff6dc"
      stroke="#cbbd99"
      stroke-width="3"
    />
    <path d="M66 45q13-12 24 1l-4 23q-11 9-21-4Z" fill="#493c31" /><path
      d="m67 48-11-7m30 7 10-5"
      stroke="#493c31"
      stroke-width="6"
      stroke-linecap="round"
    /><circle cx="77" cy="51" r="2" fill="#fff" />
  {:else if resource === 2}
    <path
      d="m43 90 9-71m-9 71L24 37m19 53 35-58"
      fill="none"
      stroke="#735d26"
      stroke-width="3"
    />
    {#each [0, 1, 2, 3] as i}<ellipse
        cx={46 + i}
        cy={29 + i * 11}
        rx="4"
        ry="8"
        transform={'rotate(-35 ' + (46 + i) + ' ' + (29 + i * 11) + ')'}
        fill="#f8cc57"
        stroke="#b8892c"
      /><ellipse
        cx={57 - i}
        cy={25 + i * 11}
        rx="4"
        ry="8"
        transform={'rotate(35 ' + (57 - i) + ' ' + (25 + i * 11) + ')'}
        fill="#ffe38c"
        stroke="#b8892c"
      />{/each}
    <path
      d="m25 39-8-7 1 13 10 5-1-13m42 9 12-9-2 15-14 7"
      fill="#eabe4f"
      stroke="#a17b28"
    /><path d="m34 78 24 3-2 7-21-3Z" fill="#9a482a" />
  {:else if resource === 3}
    {#each [0, 1, 2] as row}<g
        transform={'translate(' + (row % 2 ? 10 : 0) + ' ' + row * 18 + ')'}
        ><path
          d="m10 35 24-13 30 10-25 15Z"
          fill="#e09765"
          stroke="#743e2d"
          stroke-width="2"
        /><path
          d="m10 35 29 12v15L10 50Z"
          fill="#bd6041"
          stroke="#743e2d"
          stroke-width="2"
        /><path
          d="m39 47 25-15v15L39 62Z"
          fill="#8e4636"
          stroke="#743e2d"
          stroke-width="2"
        /></g
      >{/each}
  {:else}
    <path
      d="m9 69 17-29 23 4 9-25 26 18 8 37-36 15Z"
      fill="#6d8190"
      stroke="#344654"
      stroke-width="3"
    /><path
      d="m26 40 7 27 16-23 9-25 5 38 21-20-1 33-27 19-23-22L9 69"
      fill="#abc1c6"
    /><path d="m33 67 23 22 7-32-14-13Z" fill="#4b606e" /><path
      d="m65 31 6 8-5 4-4-7m-36 9 4 8-6 2"
      fill="#e4edda"
    />
  {/if}
</svg>

<style>
  .resource-art {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
    filter: drop-shadow(0 3px 2px #18241355);
  }
</style>
