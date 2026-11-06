// [v350] A hint belongs to the start of a voyage, not the entire voyage.
// Independent of the renderer so timing and input dismissal can be tested.
export function createGameplayHint(root, now = () => performance.now()) {
  let startedAt = null, dismissed = false;
  function fade() { dismissed = true; root.classList.add('pfp-hint-faded'); }
  return {
    update(state) {
      if (state === 'title' || state === 'over') {
        startedAt = null; dismissed = false; root.classList.remove('pfp-hint-faded');
      } else if (state === 'playing') {
        if (startedAt === null) startedAt = now();
        if (!dismissed && now() - startedAt >= 4500) fade();
      }
    },
    input(state) { if (state === 'playing') fade(); },
  };
}
