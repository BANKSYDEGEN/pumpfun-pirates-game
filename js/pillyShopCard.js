// A regular pet-store item card; the existing companion panel confirms buying
// through pilly_buy and manages treats/levels. Never use gear/shop_buy for Pilly.
export function pillyShopCard(pilly, doc = document) {
  const s = pilly.state || {}, card = doc.createElement('div');
  card.className = `ishop-card ishop-pilly-item ${s.owned ? 'owned' : s.avail === false ? 'soon' : 'buy'}`;
  card.dataset.id = 'companion:pilly';
  card.innerHTML = `<div class="ishop-thumb ishop-pilly-icon" role="img" aria-label="Pilly pill companion">💊</div><b class="ishop-name">PILLY</b><span class="ishop-badge">5,000 🪙${s.owned ? ` · LV ${Math.max(0, s.lv | 0)}` : ''}</span><span class="ishop-bst">Walks beside you · keep your parrot</span>`;
  const button = doc.createElement('button');
  button.type = 'button'; button.className = 'ishop-act big';
  button.textContent = s.avail === false ? 'COMING SOON' : s.avail == null ? 'LOADING…' : s.owned ? 'LEVEL UP' : 'BUY · 5,000 🪙';
  button.disabled = s.avail !== true;
  button.onclick = () => pilly.open();
  card.appendChild(button);
  return card;
}
