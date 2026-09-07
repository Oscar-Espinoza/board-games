const invite = new URLSearchParams(location.hash.slice(1)).get('room');
if (invite) location.replace('/games/color-match/' + location.search + location.hash);
else {
  async function load() {
    document.getElementById('retry').hidden = true;
    try {
      const response = await fetch('/catalog.json');
      if (!response.ok) throw new Error('Catalog unavailable');
      const entries = await response.json();
      const cards = entries.map((game) => {
        const card = document.createElement('a');
        card.href = game.route;
        card.className = 'game ' + game.id;
        const preview = document.createElement('div');
        preview.className = 'preview';
        preview.setAttribute('aria-hidden', 'true');
        preview.textContent = game.preview;
        const title = document.createElement('h2');
        title.textContent = game.name;
        const info = document.createElement('p');
        info.textContent = game.modes
          .map((mode) =>
            mode.kind === 'solo' ? 'Solo' : `${mode.min_players}–${mode.max_players} players`,
          )
          .join(' · ');
        const action = document.createElement('span');
        action.className = 'action';
        action.textContent = 'Play →';
        card.append(preview, title, info, action);
        return card;
      });
      document.getElementById('catalog').replaceChildren(...cards);
      document.getElementById('error').textContent = '';
    } catch {
      document.getElementById('error').textContent = 'The catalog could not load. Try again.';
      document.getElementById('retry').hidden = false;
    }
  }
  document.getElementById('retry').addEventListener('click', load);
  await load();
}
