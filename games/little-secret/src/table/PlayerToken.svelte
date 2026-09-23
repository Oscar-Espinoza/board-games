<script lang="ts">
  let {
    name,
    seat,
    active = false,
    muted = false,
  }: {
    name: string;
    seat: number;
    active?: boolean;
    muted?: boolean;
  } = $props();
</script>

<div class="player-token" class:lit={active} class:muted aria-hidden="true">
  <span
    >{name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')}</span
  >
  <small>{String(seat).padStart(2, '0')}</small>
</div>

<style>
  .player-token {
    position: relative;
    width: var(--token-size, 86px);
    aspect-ratio: 1;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 3px solid #b7945c;
    background:
      repeating-conic-gradient(
        from 10deg,
        #e5c78822 0deg 2deg,
        transparent 3deg 7deg
      ),
      radial-gradient(circle at 30% 20%, #f4d99d, #bf995b 65%, #785934);
    color: #45361f;
    box-shadow:
      inset 0 0 0 3px #efdab0,
      inset 0 0 0 6px #a5814844,
      inset -6px -8px 12px #5f3d3244,
      3px 7px 9px #071c1dc0;
  }
  span {
    font:
      italic calc(var(--token-size, 86px) * 0.42) Georgia,
      serif;
    text-shadow:
      0 1px 0 #fff0c6,
      0 -1px 0 #614724;
  }
  small {
    position: absolute;
    bottom: 8%;
    font:
      9px Georgia,
      serif;
    letter-spacing: 2px;
  }
  .lit {
    outline: 2px solid #f2c365;
    outline-offset: 5px;
    box-shadow:
      0 0 26px #e4b94d55,
      inset 0 0 0 3px #f9deb3,
      3px 7px 9px #071c1dc0;
  }
  .muted {
    filter: grayscale(0.9);
  }
</style>
