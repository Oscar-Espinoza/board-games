// Optional table UI integration. No room assumptions belong in the startup shell.
export function tableControls({ fullscreen = false } = {}) {
  return (element) => {
    let ready = false;
    let showPanel = (id) => element(id).showModal();
    function openInvite() {
      if (!ready) return;
      const invite = new URLSearchParams(location.hash.slice(1)).get('room');
      if (invite && element('room-details').hidden) {
        element('join-room').hidden = false;
        element('create-room').hidden = true;
        showPanel('room-panel');
      }
    }
    for (const id of ['room-details', 'join-room', 'create-room', 'room-panel', 'invite', 'error'])
      element(id);
    window.addEventListener('hashchange', openInvite);
    document.addEventListener('click', async ({ target }) => {
      if (!ready) return;
      const button = target.closest('button');
      if (!button) return;
      if (button.dataset.panel) showPanel(button.dataset.panel);
      if (button.hasAttribute('data-close')) button.closest('dialog').close();
      if (fullscreen && button.id === 'fullscreen') {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await document.documentElement.requestFullscreen();
        } catch {
          element('error').textContent = 'Fullscreen is unavailable in this browser.';
        }
      }
      if (button.id === 'copy-invite') {
        try {
          await navigator.clipboard.writeText(element('invite').value);
          button.textContent = 'Copied';
        } catch {
          element('invite').select();
        }
      }
    });
    return (hooks) => {
      if (hooks?.showPanel) showPanel = hooks.showPanel;
      ready = true;
      openInvite();
    };
  };
}
