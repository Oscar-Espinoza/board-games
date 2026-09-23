<script lang="ts">
  let {
    guideLabel,
    settingsLabel,
    onguide,
    onsettings,
  }: {
    guideLabel: string;
    settingsLabel: string;
    onguide: () => void;
    onsettings: () => void;
  } = $props();
</script>

<div class="board-controls">
  <button class="board-control" aria-label={guideLabel} onclick={onguide}>
    <svg viewBox="0 0 36 32" aria-hidden="true">
      <path
        d="M3 5q8-4 15 0 8-4 15 0v23q-7-4-15 0-8-4-15 0Z"
        fill="#fff5d9"
        stroke="currentColor"
        stroke-width="2"
      />
      <path
        d="M18 5v23M8 11h6m-6 5h6m8-5h6m-6 5h6"
        stroke="#c58574"
        stroke-width="2"
      />
    </svg>
  </button>
  <button
    class="board-control settings-control"
    aria-label={settingsLabel}
    onclick={onsettings}
  >
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M13.2 3h5.6l.8 4a11 11 0 0 1 2.2 1.3l3.9-1.2 2.8 4.8-3.1 2.7a10 10 0 0 1 0 2.8l3.1 2.7-2.8 4.8-3.9-1.2a11 11 0 0 1-2.2 1.3l-.8 4h-5.6l-.8-4a11 11 0 0 1-2.2-1.3l-3.9 1.2-2.8-4.8 3.1-2.7a10 10 0 0 1 0-2.8l-3.1-2.7 2.8-4.8 3.9 1.2A11 11 0 0 1 12.4 7l.8-4Z"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <circle
        cx="16"
        cy="16"
        r="4"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      />
    </svg>
  </button>
</div>

<style>
  .board-controls {
    position: absolute;
    z-index: 10;
    top: max(12px, env(safe-area-inset-top));
    left: max(12px, env(safe-area-inset-left));
    right: max(12px, env(safe-area-inset-right));
    display: flex;
    justify-content: space-between;
    pointer-events: none;
  }
  .board-control {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    min-height: 44px;
    padding: 8px;
    border: 2px solid #b6966d;
    border-radius: 50%;
    background: linear-gradient(#fff8e4, #ead2a5);
    color: #31544b;
    box-shadow:
      inset 0 2px 0 #fff8e5,
      0 3px 0 #8c6d50,
      0 5px 8px #203d3544;
    pointer-events: auto;
    cursor: pointer;
  }
  .board-control svg {
    width: 100%;
    height: 100%;
  }
  .board-control:hover {
    filter: brightness(1.05);
    transform: translateY(-1px);
  }
  .board-control:focus-visible {
    outline: 3px solid #fff4ba;
    outline-offset: 3px;
  }
  .settings-control {
    padding: 9px;
  }
</style>
