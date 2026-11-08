// A regular pet-store item card; the existing companion panel confirms buying
// through pilly_buy without exposing upgrades in the store. Never use gear/shop_buy for Pilly.
export function pillyShopCard(pilly, doc = document) {
  const s = pilly.state || {}, card = doc.createElement('div');
  card.className = `ishop-card ishop-pilly-item ${s.owned ? 'owned' : s.avail === false ? 'soon' : 'buy'}`;
  card.dataset.id = 'companion:pilly';
  card.innerHTML = `<div class="ishop-thumb ishop-pilly-icon" role="img" aria-label="Pilly pill companion">💊</div><b class="ishop-name">PILLY</b><span class="ishop-badge">5,000 🪙${s.owned ? ' · OWNED' : ''}</span><span class="ishop-bst">${s.owned ? 'Upgrade Pilly in your ship hull or inventory' : 'Walks beside you · keep your parrot'}</span>`;
  const button = doc.createElement('button');
  button.type = 'button'; button.className = 'ishop-act big';
  button.textContent = pilly.mobilePaused ? 'MOBILE · TEMPORARILY PAUSED' : s.owned ? 'OWNED' : s.avail === false ? 'COMING SOON' : s.avail == null ? 'LOADING…' : 'BUY PILLY · 5,000 🪙';
  button.disabled = s.avail !== true || !!s.owned;
  button.onclick = () => pilly.openStore();
  card.appendChild(button);
  return card;
}
