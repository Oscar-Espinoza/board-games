// Runtime startup only; integrations are optional and initialized inside the error boundary.
export async function loadGame({ gameName, initialize, integration }) {
  const element = (id) => {
    const value = document.getElementById(id);
    if (!value) throw Error(`Missing required element #${id}`);
    return value;
  };
  // Retry stays outside the inert application and works after failed imports.
  document.getElementById('retry-load')?.addEventListener('click', () => location.reload());
  try {
    for (const id of ['app', 'loading-controls', 'load-status', 'retry-load']) element(id);
    element('app').inert = true;
    const activate = await integration?.(element);
    element('load-status').textContent = `Loading ${gameName}…`;
    const hooks = await initialize((message) => {
      element('load-status').textContent = message;
    });
    activate?.(hooks);
    element('app').inert = false;
    element('loading-controls').hidden = true;
  } catch (error) {
    const message = `${gameName} could not load. ${String(error)}. Reload to try again.`;
    const status = document.getElementById('status');
    if (status) status.textContent = 'The game could not load.';
    for (const id of ['load-status', 'error']) {
      const target = document.getElementById(id);
      if (target) target.textContent = message;
    }
    const retry = document.getElementById('retry-load');
    if (retry) retry.hidden = false;
    console.warn(message);
  }
}
