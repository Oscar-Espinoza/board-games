import { loadGame } from './loading-shell.js';
await loadGame({
  gameName: 'CATAN',
  async integration(element) {
    const { tableControls } = await import('./table-controls.js');
    return tableControls()(element);
  },
  async initialize(status) {
    const [{ configure }, presentation, wasm] = await Promise.all([
      import('./transport.js'),
      import('./catan-presentation.js'),
      import('./catan_web.js'),
    ]);
    const names = ['Wood', 'Wool', 'Wheat', 'Brick', 'Ore'];
    for (const group of document.querySelectorAll('[data-resources]'))
      for (const [i, name] of names.entries()) {
        const label = document.createElement('label');
        label.innerHTML = `<img class='resource-icon' src='${new URL(`icon-${i}.svg`, import.meta.url)}' alt=''>${name}`;
        const input = document.createElement('input');
        input.id = `${group.dataset.resources}-${i}`;
        input.type = 'number';
        input.min = '0';
        input.max = '24';
        input.value = '0';
        input.setAttribute('aria-label', `${group.dataset.resources} ${name}`);
        label.append(input);
        group.append(label);
      }

    configure(wasm, { gameId: 'catan', rulesVersion: 1, cancelMotion: presentation.cancel_motion });
    await wasm.default();
    // Resize callbacks may arrive while Wasm downloads; publish only the initialized module.
    presentation.configure(wasm);
    status('Preparing the tabletop…');
    await presentation.prepare_artwork();
    await presentation.restore_graphics();
    return { showPanel: presentation.show_panel };
  },
});
