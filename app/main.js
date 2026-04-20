// ============================================================================
//  app/main.js — bootstrap: init defaults after all modules load
//  ---------------------------------------------------------------------------
//  All other modules are pure declarations (functions, data). This file wires
//  up the one-time init calls that must run after DOM is ready AND after all
//  other module globals are defined.
// ============================================================================

// Paint One UI "ai-colour" star (Figma 449:385) into every <span class="ai-star-slot">
// Each slot can override size via data-size and force monochrome via data-mono.
function paintAiStars() {
  if (!window.IconLibrary || typeof window.IconLibrary.aiStar !== 'function') return;
  document.querySelectorAll('.ai-star-slot').forEach(slot => {
    if (slot.dataset.aiStarPainted === '1') return;
    const size = parseInt(slot.dataset.size || '16', 10);
    const monochrome = slot.dataset.mono === '1';
    slot.innerHTML = window.IconLibrary.aiStar({ size, monochrome });
    slot.dataset.aiStarPainted = '1';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Motion duration slider default
  if (typeof onDurSlider === 'function') onDurSlider(300);
  // Paint AI star icons into all reserved slots
  paintAiStars();
});
