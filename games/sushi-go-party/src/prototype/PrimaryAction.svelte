<script lang="ts">
  let {
    label = 'Keep this dish',
    onclick,
  }: { label?: string; onclick?: () => void } = $props();
</script>

<button class="primary-action" {onclick}>{label}</button>

<style>
  .primary-action {
    width: 180px;
    height: 83px;
    padding: 0 14px;
    border: 2px solid #ca6660;
    border-radius: 23px;
    background: linear-gradient(#f78b81, #eb665f 70%, #dd5958);
    color: #fff9eb;
    box-shadow:
      inset 0 2px 0 #ffe7c9,
      inset 2px 0 0 #ffa99b,
      0 5px 0 #ac6351,
      0 8px 7px #66503a33;
    font-size: 22px;
    font-weight: 780;
    text-shadow: 0 1px 1px #a34444;
  }
  .primary-action:hover:enabled {
    background: linear-gradient(#ff9b8c, #ef7468);
    transform: translateY(-1px);
  }
  .primary-action:active {
    transform: translateY(3px);
    box-shadow:
      inset 0 2px 0 #ffe7c9,
      0 2px 0 #ac6351;
  }
  .primary-action:focus-visible {
    outline: 4px solid #357b77;
    outline-offset: 5px;
  }
</style>
