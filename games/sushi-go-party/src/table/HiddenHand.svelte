<script lang="ts">
  let { count, label }: { count: number; label: string } = $props();
</script>

<div class="hidden-hand" role="img" aria-label={label}>
  {#each Array.from({ length: Math.min(count, 3) }, (_, i) => i) as i}
    <div class="card-back" style:--i={i}><span>✿</span></div>
  {/each}
</div>

<style>
  .hidden-hand {
    display: flex;
    height: 85px;
    width: 137px;
    gap: 4px;
    flex-shrink: 0;
  }
  .card-back {
    position: relative;
    width: 51px;
    height: 82px;
    flex-shrink: 0;
    margin-right: -9px;
    display: grid;
    place-items: center;
    border: 2px solid #f9dfbc;
    border-radius: 6px;
    outline: 1px solid #9a594d;
    color: #f0b0a0;
    background:
      repeating-radial-gradient(
        ellipse at 50% 95%,
        transparent 0 3px,
        #f2aa9228 3.5px 4.5px,
        transparent 5px 8px
      ),
      #aa474a;
    background-size: 26px 27px;
    box-shadow:
      inset 0 0 0 3px #b25b55,
      inset 0 0 0 4px #edac8b88,
      1px 4px 3px #573d3f40;
    transform: rotate(calc(var(--i) * 1.5deg - 1deg));
  }
  span {
    font-size: 32px;
    text-shadow: 1px 1px #772f3b;
  }
</style>
