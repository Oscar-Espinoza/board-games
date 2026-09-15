<script lang="ts">
  let {
    color,
    label = '',
    marker = false,
  }: { color: string; label?: string; marker?: boolean } = $props();
</script>

<span
  class="pawn"
  class:marker
  style:--pawn-color={color}
  role={label ? 'img' : undefined}
  aria-label={label || undefined}
  aria-hidden={label ? undefined : 'true'}
>
  <svg viewBox="0 0 38 52">
    <ellipse cx="19" cy="46" rx="15" ry="4" fill="#213f3b" opacity=".26" />
    <path
      d="M12 21Q9 28 6 37Q2 47 19 47Q36 47 32 37L26 21Z"
      fill="currentColor"
      stroke="#29483d"
      stroke-width="1.8"
    />
    <path
      d="M12 25Q9 35 10 39Q15 43 27 40"
      fill="none"
      stroke="#fff4ca"
      stroke-opacity=".4"
      stroke-width="3"
      stroke-linecap="round"
    />
    <ellipse cx="19" cy="29" rx="9" ry="4" fill="#214f3b" opacity=".2" />
    <circle
      cx="19"
      cy="14"
      r="11.5"
      fill="currentColor"
      stroke="#29483d"
      stroke-width="1.8"
    />
    <ellipse
      cx="16"
      cy="10"
      rx="7"
      ry="5"
      fill="#fffbe8"
      opacity=".5"
      transform="rotate(-25 16 10)"
    />
    <path
      d="M12 21Q21 27 28 17"
      stroke="#214f3b"
      stroke-opacity=".3"
      stroke-width="2"
      fill="none"
    />
  </svg>
</span>

<style>
  .pawn {
    display: inline-block;
    width: 38px;
    height: 52px;
    color: var(--pawn-color);
    flex-shrink: 0;
    filter: drop-shadow(1px 3px 1px #24413733);
  }
  svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .marker {
    width: 35px;
    height: 49px;
  }
</style>
