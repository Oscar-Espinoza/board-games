import { configure } from './bridge.js';
function openInvite() {
  const invite = new URLSearchParams(location.hash.slice(1)).get('room');
  if (invite && document.getElementById('room-details').hidden) {
    document.getElementById('join-room').hidden = false;
    document.getElementById('create-room').hidden = true;
    document.getElementById('room-panel').showModal();
  }
}
window.addEventListener('hashchange', openInvite);
document.addEventListener('click', async ({ target }) => {
  const button = target.closest('button'); if (!button) return;
  if (button.dataset.panel) document.getElementById(button.dataset.panel).showModal();
  if (button.hasAttribute('data-close')) button.closest('dialog').close();
  if (button.id === 'fullscreen') { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { document.getElementById('error').textContent = 'Fullscreen is unavailable in this browser.'; } }
  if (button.id === 'copy-invite') { try { await navigator.clipboard.writeText(document.getElementById('invite').value); button.textContent = 'Copied'; } catch { document.getElementById('invite').select(); } }

});
try {
  const module = await import('./pkg/board_games_web.js'); configure(module); await module.default();
  openInvite();
} catch (error) {
  document.getElementById('status').textContent = 'The game could not load.';
  document.getElementById('error').textContent = 'Reload to try again.';
  console.error(error);
}
