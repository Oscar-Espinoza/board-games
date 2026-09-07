import { loadGame } from './loading-shell.js';
await loadGame({
  gameName: 'Color Match',
  async integration(element) {
    const { tableControls } = await import('./table-controls.js');
    return tableControls({ fullscreen: true })(element);
  },
  async initialize(status) {
    const [{ configure }, { cancel_motion }, module] = await Promise.all([
      import('./transport.js'),
      import('./color-match-motion.js'),
      import('./color_match_web.js'),
    ]);
    configure(module, { gameId: 'color-match', rulesVersion: 2, cancelMotion: cancel_motion });
    status('Starting the table…');
    await module.default();
  },
});
