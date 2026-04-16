// ============================================================================
//  GENERATOR — Samsung One UI background & surface resolver
//  ---------------------------------------------------------------------------
//  Pure logic. No LLM. No DOM. Usable from Node + browser.
//  Takes a canonical uiState (baseSurface / overlayType / attentionMode / etc.)
//  and emits the 3-layer background + surface decision a renderer needs.
//
//  Guideline source (One UI 4+):
//  ---------------------------------------------------------------------------
//  ① Wallpaper layer — Home / Lock screen
//     - User's wallpaper is visible.
//     - Color extraction is mood-level only (low-saturation) — NOT direct
//       sampling — so content stays the visual focus.
//     - Quick Panel / Notification Shade sit on this layer with blur + dim.
//
//  ② App background layer — Settings / Messages / Contacts / Gallery / …
//     - Simple, calm colors. The surface should disappear.
//     - Light mode: off-white (near-white, not pure #FFFFFF).
//     - Dark mode: deep gray (NOT pure #000000), unless the device bezel is
//       black — in that case pure black is allowed to merge with the bezel
//       and make the screen feel larger.
//
//  ③ Focus block layer — setting rows / list items / widgets / cards
//     - Monotone palette. Three types:
//       Type 1 — standard monotone (most common; message list, setting rows,
//                functional content).
//       Type 2 — tinted from the app's brand color, low-saturation
//                (active toggle row, selected state; brighter in Light,
//                 deeper in Dark).
//       Type 3 — gradient. Use sparingly; complexity risk.
// ============================================================================

'use strict';

// ---------------------------------------------------------------------------
//  Token tables
// ---------------------------------------------------------------------------

const APP_BG_TOKENS = {
  light: {
    default:     '#F7F8FA',   // off-white
    edgeToBezel: '#FFFFFF'    // optional: merge w/ white bezel device
  },
  dark: {
    default:     '#121316',   // deep gray, not pure black
    edgeToBezel: '#000000'    // merge w/ black bezel (default on Galaxy)
  }
};

const FOCUS_BLOCK_TOKENS = {
  light: {
    type1_standard:  { background: '#FFFFFF', border: '#E8EAED', text: '#1A1C1E' },
    type2_tinted:    { background: '#E8F2FF', border: 'transparent', text: '#0A4DA6' },
    type3_gradient:  { background: 'linear-gradient(135deg,#E8F2FF 0%,#F5E8FF 100%)', border: 'transparent', text: '#1A1C1E' }
  },
  dark: {
    type1_standard:  { background: '#1E1F23', border: '#2A2C30', text: '#E3E4E7' },
    type2_tinted:    { background: '#1A2A44', border: 'transparent', text: '#7AB8FF' },
    type3_gradient:  { background: 'linear-gradient(135deg,#1A2A44 0%,#2A1A44 100%)', border: 'transparent', text: '#E3E4E7' }
  }
};

const WALLPAPER_LAYER = {
  // Mood extraction: sampled wallpaper hue is desaturated ~60% and darkened
  // ~30% before being applied as scrim / tint color. This object records the
  // transform parameters — the renderer does the actual extraction.
  moodExtraction: {
    saturationMultiplier: 0.4,   // 0 = fully desaturated
    lightnessMultiplier:  0.7,   // darken
    usage: ['scrim-tint', 'notification-shade-dim', 'quick-panel-blur-tint']
  },
  overlayScrim: {
    'quick-settings':     { blurPx: 24, dimAlpha: 0.45 },
    'notification-shade': { blurPx: 24, dimAlpha: 0.45 },
    'system-dialog':      { blurPx:  0, dimAlpha: 0.60 }
  }
};

// ---------------------------------------------------------------------------
//  Layer 1 — wallpaper layer decision
// ---------------------------------------------------------------------------
//  Active when baseSurface is 'lock' OR 'home' (with or without shade/QS
//  overlay). backgroundPolicy will be 'wallpaper' or 'scrim-over-wallpaper'.
// ---------------------------------------------------------------------------

function resolveWallpaperLayer(uiState) {
  const on = (uiState.baseSurface === 'lock' || uiState.baseSurface === 'home');
  if (!on) return null;

  const overlay = uiState.overlayType || 'none';
  const scrim   = WALLPAPER_LAYER.overlayScrim[overlay] || null;

  return {
    showUserWallpaper: true,
    moodExtraction:    WALLPAPER_LAYER.moodExtraction,
    overlayScrim:      scrim,                         // null when no overlay
    backgroundPolicy:  scrim ? 'scrim-over-wallpaper' : 'wallpaper'
  };
}

// ---------------------------------------------------------------------------
//  Layer 2 — app background decision
// ---------------------------------------------------------------------------
//  Active for baseSurface='app' (most system/third-party apps).
//  Also covers scrim-over-app when a shade/QS floats over an app surface.
// ---------------------------------------------------------------------------

function resolveAppBackground(uiState, opts) {
  const o = opts || {};
  const theme = (o.theme === 'light') ? 'light' : 'dark';
  const edgeToBezel = !!o.edgeToBezel;      // true → merge with bezel
  const tokens = APP_BG_TOKENS[theme];
  const color  = edgeToBezel ? tokens.edgeToBezel : tokens.default;

  const overlay = uiState.overlayType || 'none';
  let backgroundPolicy = 'solid-dark';
  if (theme === 'light') backgroundPolicy = 'solid-light';
  if (overlay === 'quick-settings' || overlay === 'notification-shade') {
    backgroundPolicy = 'scrim-over-app';
  }
  if (overlay === 'system-dialog') {
    backgroundPolicy = 'dialog-surface';
  }

  return {
    theme,
    color,
    edgeToBezel,
    backgroundPolicy,
    // scrim values only meaningful when backgroundPolicy === 'scrim-over-app'
    scrim: WALLPAPER_LAYER.overlayScrim[overlay] || null
  };
}

// ---------------------------------------------------------------------------
//  Layer 3 — focus block decision
// ---------------------------------------------------------------------------
//  Called per-component, not per-screen. Picks one of 3 focus-block types
//  based on the component's role:
//    - 'functional' (list row, setting row, message item)        → Type 1
//    - 'active'     (toggled on, selected, brand-tinted state)   → Type 2
//    - 'hero'       (feature card, onboarding highlight, promo)  → Type 3
//
//  The renderer passes (role, theme, brandHueCss?) — brandHueCss is only
//  used if you later replace the fixed Type-2 token with an app-specific tint.
// ---------------------------------------------------------------------------

function resolveFocusBlock(role, opts) {
  const o = opts || {};
  const theme = (o.theme === 'light') ? 'light' : 'dark';
  const table = FOCUS_BLOCK_TOKENS[theme];

  let key = 'type1_standard';
  if (role === 'active')  key = 'type2_tinted';
  if (role === 'hero')    key = 'type3_gradient';

  const token = table[key];
  return {
    type: key,
    background: token.background,
    border:     token.border,
    textColor:  token.text,
    // Gradient blocks carry caution flag so the composer can enforce
    // "use sparingly" — e.g. at most 1 type-3 block per screen.
    cautionUseSparingly: (key === 'type3_gradient')
  };
}

// ---------------------------------------------------------------------------
//  Top-level resolver
// ---------------------------------------------------------------------------
//  Given a canonical uiState + optional render opts, returns the layered
//  decision a renderer/composer needs. Exactly one of {wallpaper, app} is
//  non-null; focusBlockDefaults is always present (renderer picks type
//  per-component via resolveFocusBlock).
// ---------------------------------------------------------------------------

function resolveLayers(uiState, opts) {
  const o = opts || {};
  const theme = (o.theme === 'light') ? 'light' : 'dark';
  const edgeToBezel = !!o.edgeToBezel;

  const wallpaper = resolveWallpaperLayer(uiState);
  const app       = wallpaper ? null : resolveAppBackground(uiState, { theme, edgeToBezel });

  return {
    theme,
    wallpaperLayer: wallpaper,
    appLayer:       app,
    focusBlockDefaults: {
      type1: FOCUS_BLOCK_TOKENS[theme].type1_standard,
      type2: FOCUS_BLOCK_TOKENS[theme].type2_tinted,
      type3: FOCUS_BLOCK_TOKENS[theme].type3_gradient
    },
    // One convenient policy field for the canvas frame:
    backgroundPolicy: wallpaper ? wallpaper.backgroundPolicy : app.backgroundPolicy
  };
}

// ---------------------------------------------------------------------------
//  Soft validators — return violations (not exceptions). The pipeline's
//  rollup can fold these into the canonical violations[] output.
// ---------------------------------------------------------------------------

function validateBackgroundUsage(uiState, components, opts) {
  const o = opts || {};
  const theme = (o.theme === 'light') ? 'light' : 'dark';
  const out = [];

  // 1) pure #000 / #FFF only allowed in edge-to-bezel mode
  if (!o.edgeToBezel) {
    const bgColor = (resolveAppBackground(uiState, { theme, edgeToBezel: false }) || {}).color;
    if (bgColor === '#000000' || bgColor === '#FFFFFF') {
      out.push({
        ruleId: 'bg_calm_color',
        severity: 'medium',
        message: 'App background must be off-white / deep-gray, not pure black/white, unless edge-to-bezel is enabled.'
      });
    }
  }

  // 2) cap type-3 gradient usage at 1 per screen
  const comps = Array.isArray(components) ? components : [];
  const type3Count = comps.filter(c => c && c.focusBlockRole === 'hero').length;
  if (type3Count > 1) {
    out.push({
      ruleId: 'focus_block_type3_cap',
      severity: 'low',
      message: `Type-3 gradient focus block should appear at most once per screen; found ${type3Count}.`
    });
  }

  // 3) wallpaper layer must not coexist with a solid app-bg request
  if ((uiState.baseSurface === 'home' || uiState.baseSurface === 'lock') &&
      o.forceSolidBackground) {
    out.push({
      ruleId: 'wallpaper_layer_integrity',
      severity: 'high',
      message: 'Home/Lock scenarios must preserve the wallpaper layer; forceSolidBackground is disallowed here.'
    });
  }

  return out;
}

// ===========================================================================
//  DESIGN-MEMORY-DRIVEN RULES
//  ---------------------------------------------------------------------------
//  Below functions consult DesignMemory (design_memory.js barrel) to decide
//  component size, margin, position and ordering for a given ui_state.
//  They never improvise — every value is looked up from
//    • component_registry.json       (unified registry, adapted to array by design_memory.js)
//    • generator_memory.json         (screens, spacingRhythm, radiusRules, surfaceRules,
//                                     collapseRules, componentMappings)
//    • orchestration_rules.json      (pair-gap rules between component types)
//    • global_rules.json             (touch-target min, spacing scale enforcement)
//
//  All functions accept an explicit `memory` arg so they work in Node or in
//  the browser after `window.DesignMemory.ready` has resolved. If `memory`
//  is omitted, we fall back to window.DesignMemory (browser) or
//  require('./design_memory') (node) lazily.
//
//  ORPHAN RULE FILES (now consumed):
//    • orchestration_rules.json  →  pair-gap lookup in resolveSpacing / validatePairGaps
//    • global_rules.json         →  touch-target min + spacing scale in validateGlobalRules
// ===========================================================================

// ---------------------------------------------------------------------------
//  Load orphan rule files (Node sync / browser async via DesignMemory)
// ---------------------------------------------------------------------------
var _orchestrationRules = null;
var _globalRules = null;
(function _loadOrphanRules() {
  if (typeof require === 'function') {
    var fs, path;
    try {
      fs = require('fs'); path = require('path');
      var dir = (typeof __dirname !== 'undefined') ? __dirname : '.';
      _orchestrationRules = JSON.parse(fs.readFileSync(path.join(dir, 'figma-refs', 'orchestration_rules.json'), 'utf8'));
      _globalRules        = JSON.parse(fs.readFileSync(path.join(dir, 'figma-refs', 'global_rules.json'), 'utf8'));
    } catch (_) { /* browser or missing */ }
  }
  // Browser: loaded lazily via fetch if needed
})();

function _getOrchestrationRules() {
  if (_orchestrationRules) return _orchestrationRules.rules || [];
  if (typeof window !== 'undefined' && window._generatorOrchRules) return window._generatorOrchRules;
  return [];
}
function _getGlobalRules() {
  if (_globalRules) return _globalRules.rules || [];
  if (typeof window !== 'undefined' && window._generatorGlobalRules) return window._generatorGlobalRules;
  return [];
}

// ---------------------------------------------------------------------------
//  Refinement rules loader
// ---------------------------------------------------------------------------
var _refinementRules = null;
(function _loadRefinementRules() {
  if (typeof require === 'function') {
    try {
      var fs2 = require('fs'), path2 = require('path');
      var dir2 = (typeof __dirname !== 'undefined') ? __dirname : '.';
      _refinementRules = JSON.parse(fs2.readFileSync(path2.join(dir2, 'figma-refs', 'refinement_rules.json'), 'utf8'));
    } catch (_) { /* browser or missing */ }
  }
})();
function _getRefinementRules() {
  if (_refinementRules) return (_refinementRules.rules || []).filter(function (r) { return r.enabled !== false; });
  if (typeof window !== 'undefined' && window._generatorRefinementRules) return window._generatorRefinementRules;
  return [];
}

function _getMemory(memory) {
  if (memory && memory.generatorMemory) return memory;
  if (typeof window !== 'undefined' && window.DesignMemory &&
      window.DesignMemory.generatorMemory) {
    return window.DesignMemory;
  }
  if (typeof require === 'function') {
    try { return require('./design_memory'); } catch (_) { /* ignore */ }
  }
  return null;
}

function _ctxKey(uiState) {
  // overlay wins over baseSurface when choosing a screen spec
  if (uiState.overlayType === 'quick-settings')     return 'quick-settings';
  if (uiState.overlayType === 'notification-shade') return 'notification-shade';
  if (uiState.overlayType === 'system-dialog')      return 'system-dialog';
  if (uiState.baseSurface === 'lock') return 'lock';
  if (uiState.baseSurface === 'home') return 'home';
  return 'app';
}

// ---------------------------------------------------------------------------
//  SIZE — resolveComponentSize(id | role, memory?)
//     → { minWidth, minHeight, padding:{t,r,b,l}, gap }
// ---------------------------------------------------------------------------

function resolveComponentSize(ref, memory) {
  const mem = _getMemory(memory);
  if (!mem) return null;
  const reg = mem.componentRegistry || [];
  let entry = reg.find(c => c.id === ref);
  if (!entry) {
    const mapped = (mem.generatorMemory.componentMappings || {})['by-role'] || {};
    const id = mapped[ref];
    if (id) entry = reg.find(c => c.id === id);
  }
  if (!entry) return null;
  return {
    id:        entry.id,
    minWidth:  entry.layoutSpec.minWidth,
    minHeight: entry.layoutSpec.minHeight,
    padding:   entry.layoutSpec.padding,
    gap:       entry.layoutSpec.gap,
    radius:    entry.tokens.radius
  };
}

// ---------------------------------------------------------------------------
//  RADIUS — resolveRadius(roleOrId, memory?)
//     Consults radiusRules.byRole first, then component tokens.
// ---------------------------------------------------------------------------

function resolveRadius(ref, memory) {
  const mem = _getMemory(memory);
  if (!mem) return null;
  const byRole = (mem.generatorMemory.radiusRules || {}).byRole || {};
  if (byRole[ref] != null) return byRole[ref];
  const size = resolveComponentSize(ref, mem);
  return size ? size.radius : null;
}

// ---------------------------------------------------------------------------
//  SPACING — resolveSpacing(uiState, memory?)
//     → { outerPadding, gap, rhythm:{intraGroup,controlToText,betweenRows,…} }
// ---------------------------------------------------------------------------

function resolveSpacing(uiState, memory) {
  const mem = _getMemory(memory);
  if (!mem) return null;
  const gm  = mem.generatorMemory;
  const key = _ctxKey(uiState);
  const screen = (gm.screens || {})[key] || {};
  return {
    ctx:          key,
    outerPadding: screen.outerPadding || { top: 16, right: 18, bottom: 0, left: 18 },
    gap:          screen.gridGap != null ? screen.gridGap
                  : (gm.layoutPatterns[screen.preferredLayoutContainer] || {}).defaultGap || 10,
    container:    screen.preferredLayoutContainer || 'vertical-stack',
    rhythm:       gm.spacingRhythm || {}
  };
}

// ---------------------------------------------------------------------------
//  FILTER — filterAllowedComponents(uiState, refs, memory?)
//     Drops any component whose category is disallowed for this ui_state.
// ---------------------------------------------------------------------------

// Fuzzy lookup: exact ID first, then prefix match (e.g. "card.hero" → "card"),
// then role match via componentMappings.by-role.
function _findRegistryEntry(reg, id, gm) {
  // 1. Exact match
  var entry = reg.find(function (c) { return c.id === id; });
  if (entry) return entry;
  // 2. Prefix match: "card.hero" → try "card", "button.contained" → "button"
  var dotIdx = id.indexOf('.');
  if (dotIdx > 0) {
    var prefix = id.substring(0, dotIdx);
    entry = reg.find(function (c) { return c.id === prefix; });
    if (entry) return entry;
  }
  // 3. Role mapping: check by-role in componentMappings
  if (gm && gm.componentMappings && gm.componentMappings['by-role']) {
    var mapped = gm.componentMappings['by-role'][id];
    if (mapped) {
      entry = reg.find(function (c) { return c.id === mapped; });
      if (entry) return entry;
    }
  }
  return null;
}

function filterAllowedComponents(uiState, refs, memory) {
  const mem = _getMemory(memory);
  if (!mem) return refs || [];
  const reg  = mem.componentRegistry || [];
  const gm   = mem.generatorMemory || {};
  const key  = _ctxKey(uiState);
  const rule = (mem.generatorMemory.surfaceRules || {})[key] || {};
  const allowed    = new Set(rule.allowedCategories    || []);
  const disallowed = new Set(rule.disallowedCategories || []);

  return (refs || []).filter(r => {
    const entry = _findRegistryEntry(reg, r, gm);
    if (!entry) return false;
    if (disallowed.has(entry.category)) return false;
    if (allowed.size > 0 && !allowed.has(entry.category)) return false;
    // also enforce component's own allowedContexts if provided
    if (Array.isArray(entry.allowedContexts) &&
        entry.allowedContexts.length > 0 &&
        !entry.allowedContexts.includes(key) &&
        !entry.allowedContexts.includes(uiState.baseSurface)) {
      return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
//  ORDER — resolveOrder(uiState, requestedRefs, memory?)
//     Canonical ordering:
//       1) status-bar / chrome first (if present or mandatory)
//       2) mandatoryComponents for screen, in declared order
//       3) requested extras (deduped), preserving caller order
//       4) navigation / gesture bar last
//     Then applies collapseRules for compressed density.
// ---------------------------------------------------------------------------

function resolveOrder(uiState, requestedRefs, memory, opts) {
  const mem = _getMemory(memory);
  if (!mem) return requestedRefs || [];
  const gm  = mem.generatorMemory;
  const reg = mem.componentRegistry || [];
  const key = _ctxKey(uiState);
  const screen = (gm.screens || {})[key] || {};
  const options = opts || {};

  const mandatory = (screen.mandatoryComponents || []).slice();
  const requested = (requestedRefs || []).slice();

  // 1) Merge: mandatory first, then requested (dedup)
  const seen = new Set();
  const merged = [];
  [...mandatory, ...requested].forEach(id => {
    if (!seen.has(id)) { seen.add(id); merged.push(id); }
  });

  // 2) Filter by surface rules
  let ordered = filterAllowedComponents(uiState, merged, mem);

  // 3) Apply collapseRules (skip when building reference layout for LLM)
  const density = uiState.densityMode || 'normal';
  const collapse = (gm.collapseRules || {})[density] || {};
  const dropSet  = new Set(collapse.dropFirst || []);
  const preserve = new Set(collapse.preserveAlways || []);
  const cap = ((gm.collapseRules || {}).byOverlay || {})[uiState.overlayType || 'none'];
  const maxVisible = (cap && cap.maxVisibleGroups) || screen.maxVisibleGroups || 6;

  // Drop collapsible entries until we're under cap (preserve always stays)
  // When skipCollapse=true (used for reference layout), we keep all components
  // so the LLM sees the full design-system ordering and decides collapse itself.
  if (!options.skipCollapse && ordered.length > maxVisible) {
    const dropOrder = ordered.filter(id => dropSet.has(id) && !preserve.has(id));
    for (const id of dropOrder) {
      if (ordered.length <= maxVisible) break;
      ordered = ordered.filter(x => x !== id);
    }
    // fallback: drop by collapsePriority desc (larger priority → drop first)
    if (ordered.length > maxVisible) {
      ordered.sort((a, b) => {
        const pa = (_findRegistryEntry(reg, a, gm) || {}).behavior || {};
        const pb = (_findRegistryEntry(reg, b, gm) || {}).behavior || {};
        return (pb.collapsePriority || 0) - (pa.collapsePriority || 0);
      });
      while (ordered.length > maxVisible) {
        const id = ordered.shift();
        if (preserve.has(id)) { ordered.push(id); break; }
      }
    }
  }

  // 4) Re-sort: chrome (status-bar / section-label) → widgets/containers →
  //    primitives at the very end (page indicator, nav gesture bar).
  const weight = (id) => {
    const entry = _findRegistryEntry(reg, id, gm);
    if (!entry) return 50;
    // Bottom-anchored navigation (regardless of category) — always near end
    if (entry.id === 'bottomnav' || entry.id === 'pill-tab' || entry.id === 'tab-bar' ||
        entry.role === 'bottomnav' || entry.role === 'pill-tab' ||
        entry.id.includes('nav-gestures') || entry.id.includes('nav-buttons')) return 90;
    if (entry.id === 'status-bar.default' || entry.id === 'status-bar') return 0;
    if (entry.id === 'appbar' || entry.id.includes('app-bar')) return 5;
    if (entry.category === 'chrome')       return 10;
    if (entry.category === 'overlay')      return 15;
    if (entry.category === 'widget')       return 30;
    if (entry.category === 'media')        return 35;
    if (entry.category === 'container')    return 40;
    if (entry.category === 'notification') return 42;
    if (entry.category === 'selection')    return 45;
    if (entry.category === 'input')        return 46;
    if (entry.category === 'action')       return 55;
    if (entry.category === 'navigation') return 90;
    if (entry.category === 'primitive') {
      if (entry.role === 'home-gesture-bar' || entry.role === 'page-indicator') return 95;
      return 60;
    }
    return 50;
  };
  ordered.sort((a, b) => weight(a) - weight(b));

  return ordered;
}

// ---------------------------------------------------------------------------
//  POSITION — resolvePositions(uiState, orderedRefs, memory?)
//     Returns layout instructions per component:
//       - vertical-stack  → cumulative y with gap (+ anchor override)
//       - grid            → (row, col, span) via cell-width snap
//       - horizontal-stack→ x flow
//       - overlay-stack   → absolute anchor
// ---------------------------------------------------------------------------

function resolvePositions(uiState, orderedRefs, memory) {
  const mem = _getMemory(memory);
  if (!mem) return [];
  const gm  = mem.generatorMemory;
  const reg = mem.componentRegistry || [];
  const key = _ctxKey(uiState);
  const screen  = (gm.screens || {})[key] || {};
  const spacing = resolveSpacing(uiState, mem);
  const anchors = screen.anchorAreas || {};
  const container = spacing.container;
  const gap = spacing.gap;
  const pad = spacing.outerPadding;

  const entries = (orderedRefs || [])
    .map(id => _findRegistryEntry(reg, id, gm))
    .filter(Boolean);

  if (container === 'vertical-stack') {
    let y = pad.top;
    return entries.map(e => {
      // Anchor override for known roles (lock screen clock, shortcut row, …)
      let override = null;
      if (e.id === 'lock-screen.clock'       && anchors.clockBlock)  override = anchors.clockBlock;
      if (e.role === 'lock-shortcut'         && anchors.shortcutRow) override = anchors.shortcutRow;
      if (e.id === 'status-bar.default'      && anchors.topStatus)   override = anchors.topStatus;

      const row = override
        ? { top: override.top, left: override.left != null ? override.left : pad.left,
            width: override.width || (e.layoutSpec.minWidth) }
        : { top: y, left: pad.left, width: e.layoutSpec.minWidth };

      if (!override) y += e.layoutSpec.minHeight + gap;
      return {
        id: e.id, role: e.role, ...row,
        height: override && override.height ? override.height : e.layoutSpec.minHeight,
        margin: { top: override ? 0 : gap, right: 0, bottom: 0, left: 0 }
      };
    });
  }

  if (container === 'grid') {
    const cellWidths = (gm.layoutPatterns.grid || {}).cellWidths || [88, 199, 408];
    let x = pad.left, y = pad.top, rowH = 0;
    const contentWidth = 451 - pad.left - pad.right;  // frame width default
    return entries.map(e => {
      const w = e.layoutSpec.minWidth;
      const h = e.layoutSpec.minHeight;
      // Full-bleed rows bump to a fresh row
      if (w >= contentWidth - 10) {
        if (x > pad.left) { y += rowH + gap; x = pad.left; rowH = 0; }
        const out = { id: e.id, role: e.role, top: y, left: x, width: w, height: h,
                      margin: { top: gap, right: 0, bottom: 0, left: 0 } };
        y += h + gap; x = pad.left; rowH = 0;
        return out;
      }
      // Wrap to next row when no horizontal space
      if (x + w > pad.left + contentWidth) {
        y += rowH + gap; x = pad.left; rowH = 0;
      }
      const out = { id: e.id, role: e.role, top: y, left: x, width: w, height: h,
                    margin: { top: 0, right: gap, bottom: 0, left: 0 } };
      x += w + gap;
      if (h > rowH) rowH = h;
      return out;
    });
  }

  if (container === 'horizontal-stack') {
    let x = pad.left;
    return entries.map(e => {
      const out = { id: e.id, role: e.role, top: pad.top, left: x,
                    width: e.layoutSpec.minWidth, height: e.layoutSpec.minHeight,
                    margin: { top: 0, right: gap, bottom: 0, left: 0 } };
      x += e.layoutSpec.minWidth + gap;
      return out;
    });
  }

  // overlay-stack (system-dialog)
  return entries.map(e => ({
    id: e.id, role: e.role,
    top:    e.category === 'overlay' && e.role === 'modal-dim' ? 0 : pad.top + 120,
    left:   e.category === 'overlay' && e.role === 'modal-dim' ? 0 : pad.left,
    width:  e.category === 'overlay' && e.role === 'modal-dim' ? 451 : e.layoutSpec.minWidth,
    height: e.category === 'overlay' && e.role === 'modal-dim' ? 978 : e.layoutSpec.minHeight,
    margin: { top: gap, right: 0, bottom: 0, left: 0 }
  }));
}

// ---------------------------------------------------------------------------
//  PLAN — resolveScreenPlan(uiState, requestedRefs?, opts?)
//     Top-level convenience: background layers + spacing + ordered refs +
//     per-component positions. One call returns everything the composer needs.
// ---------------------------------------------------------------------------

function resolveScreenPlan(uiState, requestedRefs, opts) {
  const o = opts || {};
  const mem = _getMemory(o.memory);
  const layers  = resolveLayers(uiState, o);
  const spacing = resolveSpacing(uiState, mem);
  const ordered = resolveOrder(uiState, requestedRefs || [], mem);
  var positions = resolvePositions(uiState, ordered, mem);

  // --- AUTO-REFINE: analyze + patch before returning ---
  var refined = autoRefine(positions, uiState, mem);
  positions = refined.positions;

  return {
    ctx: spacing && spacing.ctx,
    layers,
    spacing,
    components: positions.map(function (pos) {
      var size = resolveComponentSize(pos.id, mem) || {};
      return {
        id: pos.id,
        size: size,
        radius: resolveRadius(pos.id, mem),
        position: pos,
        margin: pos.margin || null,
        _inserted: pos._inserted || false,
        _slots: pos._slots || null,
        _overflow: pos._overflow || false
      };
    }),
    refinements: refined.appliedPatches,
    violations: [].concat(
      validateBackgroundUsage(uiState, [], o),
      validatePairGaps(positions),
      validateGlobalRules(positions, mem)
    )
  };
}

// ---------------------------------------------------------------------------
//  PAIR-GAP — resolvePairGap(fromRole, toRole, context?)
//  Consults orchestration_rules.json for the expected gap between two
//  adjacent components. Falls back to the screen default gap.
// ---------------------------------------------------------------------------

function resolvePairGap(fromRole, toRole, context) {
  var ctx = context || 'default';
  var rules = _getOrchestrationRules();
  // Direct match
  var rule = rules.find(function (r) {
    return r.fromType === fromRole && r.toType === toRole &&
           (r.context === ctx || r.context === 'default');
  });
  // Try reverse
  if (!rule) {
    rule = rules.find(function (r) {
      return r.fromType === toRole && r.toType === fromRole &&
             (r.context === ctx || r.context === 'default');
    });
  }
  if (rule) return { gap: rule.expectedGap, tolerance: rule.tolerance, severity: rule.severity, ruleId: rule.id };
  return null;
}

// ---------------------------------------------------------------------------
//  validatePairGaps(orderedPositions)
//  Given the output of resolvePositions, checks adjacent pairs against
//  orchestration_rules and returns violations.
// ---------------------------------------------------------------------------

function validatePairGaps(orderedPositions) {
  var out = [];
  if (!Array.isArray(orderedPositions) || orderedPositions.length < 2) return out;
  for (var i = 0; i < orderedPositions.length - 1; i++) {
    var a = orderedPositions[i], b = orderedPositions[i + 1];
    var actualGap = b.top - (a.top + a.height);
    var rule = resolvePairGap(a.role, b.role);
    if (!rule) continue;
    var delta = Math.abs(actualGap - rule.gap);
    if (delta > rule.tolerance) {
      out.push({
        ruleId:   rule.ruleId,
        severity: rule.severity,
        from:     a.id,
        to:       b.id,
        expected: rule.gap,
        actual:   actualGap,
        delta:    delta,
        message:  a.id + ' → ' + b.id + ': gap ' + actualGap + 'px, expected ' + rule.gap + '±' + rule.tolerance + 'px'
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
//  validateGlobalRules(orderedPositions, memory?)
//  Checks global_rules.json constraints against resolved components:
//    - touch_target_min: interactive elements must be ≥ 48dp on both axes
//    - spacing_scale_rule: all gaps must land on the allowed scale
// ---------------------------------------------------------------------------

function validateGlobalRules(orderedPositions, memory) {
  var out = [];
  var rules = _getGlobalRules();
  var mem = _getMemory(memory);
  var reg = mem ? (mem.componentRegistry || []) : [];

  var touchRule = rules.find(function (r) { return r.id === 'touch_target_min'; });
  var scaleRule = rules.find(function (r) { return r.id === 'spacing_scale_rule'; });
  var allowedScale = scaleRule ? new Set(scaleRule.allowedValues) : null;
  var snapWithin = scaleRule ? scaleRule.snapWithin : 3;

  (orderedPositions || []).forEach(function (pos) {
    var entry = reg.find(function (c) { return c.id === pos.id; });
    var interactive = entry && entry.behavior && entry.behavior.interactive;

    // Touch target check
    if (touchRule && interactive) {
      var minDim = touchRule.min || 48;
      if (pos.width < minDim || pos.height < minDim) {
        out.push({
          ruleId:   'touch_target_min',
          severity: touchRule.severity || 'high',
          element:  pos.id,
          actual:   pos.width + 'x' + pos.height,
          expected: minDim + 'x' + minDim,
          message:  pos.id + ' is ' + pos.width + 'x' + pos.height + 'px but interactive elements need ≥' + minDim + 'dp'
        });
      }
    }

    // Spacing scale check on margins
    if (allowedScale && pos.margin) {
      ['top', 'right', 'bottom', 'left'].forEach(function (side) {
        var val = pos.margin[side];
        if (val === 0) return;
        if (!allowedScale.has(val)) {
          // Check snap tolerance
          var closest = null;
          allowedScale.forEach(function (s) { if (closest === null || Math.abs(s - val) < Math.abs(closest - val)) closest = s; });
          if (closest !== null && Math.abs(closest - val) <= snapWithin) return; // within snap
          out.push({
            ruleId:   'spacing_scale_rule',
            severity: scaleRule.severity || 'medium',
            element:  pos.id,
            property: 'margin.' + side,
            actual:   val,
            expected: 'one of [' + Array.from(allowedScale).join(',') + ']',
            message:  pos.id + ' margin.' + side + '=' + val + ' is off the 4dp spacing scale'
          });
        }
      });
    }
  });

  return out;
}

// ===========================================================================
//  AUTO-REFINE ENGINE
//  ---------------------------------------------------------------------------
//  Runs refinement_rules.json analyzers against a resolved plan, then applies
//  matching patchers. Called automatically at the end of resolveScreenPlan.
//  Each rule has: analyzer (detect pattern) + patcher (fix it).
//
//  Adding a new rule = adding JSON to refinement_rules.json. No code change.
//  The system improves every time a refine comment reveals a new pattern.
// ===========================================================================

// ---------------------------------------------------------------------------
//  ANALYZERS — each returns { matched: bool, targets: [...] }
// ---------------------------------------------------------------------------

var _analyzers = {
  // Detect N+ consecutive components of the same category
  'consecutive-same-category': function (positions, params, uiState, mem) {
    var cat = params.category;
    var minCount = params.minCount || 3;
    var area = params.area || 'any';
    var reg = mem ? (mem.componentRegistry || []) : [];
    var runs = [], current = [];

    (positions || []).forEach(function (pos, i) {
      var entry = reg.find(function (c) { return c.id === pos.id; });
      var match = entry && entry.category === cat;
      if (match) {
        current.push({ index: i, pos: pos });
      } else {
        if (current.length >= minCount) runs.push(current.slice());
        current = [];
      }
    });
    if (current.length >= minCount) runs.push(current.slice());

    // Area filter
    if (area === 'top-half') {
      var midY = 978 / 2;
      runs = runs.filter(function (run) { return run[0].pos.top < midY; });
    }
    return { matched: runs.length > 0, targets: runs };
  },

  // Detect missing component for a specific context
  'context-missing-component': function (positions, params, uiState) {
    var ctxMatch = params.contextMatch || {};
    var matches = Object.keys(ctxMatch).every(function (k) { return uiState[k] === ctxMatch[k]; });
    if (!matches) return { matched: false, targets: [] };
    var requiredRole = params.requiredRole;
    var has = (positions || []).some(function (p) { return p.role === requiredRole; });
    if (has) return { matched: false, targets: [] };
    return { matched: true, targets: [{ missingRole: requiredRole, fallbackId: params.fallbackComponentId }] };
  },

  // Detect attention mode overflow
  'attention-overflow': function (positions, params, uiState) {
    var mode = params.attentionMode;
    var max = params.maxComponents || 4;
    if (!uiState || uiState.attentionMode !== mode) return { matched: false, targets: [] };
    if ((positions || []).length <= max) return { matched: false, targets: [] };
    return { matched: true, targets: [{ currentCount: positions.length, maxAllowed: max }] };
  },

  // Detect interactive elements smaller than minimum
  'undersized-interactive': function (positions, params, uiState, mem) {
    var minSize = params.minSize || 48;
    var reg = mem ? (mem.componentRegistry || []) : [];
    var hits = [];
    (positions || []).forEach(function (pos) {
      var entry = reg.find(function (c) { return c.id === pos.id; });
      if (entry && entry.behavior && entry.behavior.interactive) {
        if (pos.width < minSize || pos.height < minSize) {
          hits.push(pos);
        }
      }
    });
    return { matched: hits.length > 0, targets: hits };
  },

  // Detect pair-gap violations
  'pair-gap-violation': function (positions) {
    var violations = validatePairGaps(positions);
    return { matched: violations.length > 0, targets: violations };
  }
};

// ---------------------------------------------------------------------------
//  PATCHERS — each mutates positions array and returns { applied: bool, patches: [...] }
// ---------------------------------------------------------------------------

var _patchers = {
  // Wrap consecutive items into a horizontal-scroll group
  'group-wrap': function (positions, targets, params) {
    var patches = [];
    targets.forEach(function (run) {
      var ids = run.map(function (t) { return t.pos.id; });
      var firstPos = run[0].pos;
      var groupHeight = Math.max.apply(null, run.map(function (t) { return t.pos.height; }));
      var wrapPad = params.wrapPadding || { top: 4, right: 8, bottom: 4, left: 8 };
      var gap = params.gap || 8;

      // Reposition items horizontally inside the group
      var x = firstPos.left + wrapPad.left;
      run.forEach(function (t, i) {
        t.pos.top = firstPos.top + wrapPad.top;
        t.pos.left = x;
        x += t.pos.width + gap;
        // Mark overflow items
        if (params.maxVisible && i >= params.maxVisible) {
          t.pos._overflow = true;
        }
      });

      patches.push({
        type: 'group-wrap',
        container: params.container || 'horizontal-scroll',
        groupIds: ids,
        groupRect: {
          top: firstPos.top,
          left: firstPos.left,
          width: x - firstPos.left - gap + wrapPad.right,
          height: groupHeight + wrapPad.top + wrapPad.bottom
        },
        radius: params.wrapRadius || 16,
        maxVisible: params.maxVisible || null,
        overflowIndicator: params.overflowIndicator || false
      });
    });
    return { applied: patches.length > 0, patches: patches };
  },

  // Increase gap between consecutive items
  'increase-gap': function (positions, targets, params) {
    var patches = [];
    var addGap = params.addGap || 8;
    var maxGap = params.maxGap || 24;
    targets.forEach(function (run) {
      for (var i = 1; i < run.length; i++) {
        var prev = run[i - 1].pos, curr = run[i].pos;
        var currentGap = curr.top - (prev.top + prev.height);
        var newGap = Math.min(currentGap + addGap, maxGap);
        var shift = newGap - currentGap;
        if (shift > 0) {
          // Shift this and all subsequent items down
          for (var j = run[i].index; j < positions.length; j++) {
            positions[j].top += shift;
          }
          patches.push({ type: 'increase-gap', from: prev.id, to: curr.id, oldGap: currentGap, newGap: newGap });
        }
      }
    });
    return { applied: patches.length > 0, patches: patches };
  },

  // Insert a component at a specific position
  'insert-component': function (positions, targets, params, mem) {
    var patches = [];
    var size = resolveComponentSize(params.componentId, mem);
    if (!size) return { applied: false, patches: [] };
    var insertIdx = positions.length; // default: end
    if (params.position === 'before-nav') {
      for (var i = positions.length - 1; i >= 0; i--) {
        if (positions[i].role === 'nav-bar-gestures' || positions[i].role === 'nav-bar-buttons' ||
            positions[i].role === 'home-gesture-bar') {
          insertIdx = i;
          break;
        }
      }
    }
    var prevPos = insertIdx > 0 ? positions[insertIdx - 1] : null;
    var top = prevPos ? (prevPos.top + prevPos.height + 12) : 10;
    var left = prevPos ? prevPos.left : 10;
    var newPos = {
      id: params.componentId,
      role: (targets[0] && targets[0].missingRole) || params.componentId,
      top: top,
      left: left,
      width: size.minWidth,
      height: size.minHeight,
      margin: { top: 12, right: 0, bottom: 0, left: 0 },
      _inserted: true,
      _slots: params.slots || {}
    };
    positions.splice(insertIdx, 0, newPos);

    // Shift subsequent items down
    var shift = size.minHeight + 12;
    for (var j = insertIdx + 1; j < positions.length; j++) {
      positions[j].top += shift;
    }
    patches.push({ type: 'insert-component', componentId: params.componentId, at: insertIdx, slots: params.slots });
    return { applied: true, patches: patches };
  },

  // Collapse lowest-priority components to meet target count
  'collapse-lowest': function (positions, targets, params, mem) {
    var patches = [];
    var targetCount = params.targetCount || 4;
    var reg = mem ? (mem.componentRegistry || []) : [];
    if (positions.length <= targetCount) return { applied: false, patches: [] };

    // Sort by collapsePriority desc — highest priority number = drop first
    var indexed = positions.map(function (p, i) {
      var entry = reg.find(function (c) { return c.id === p.id; });
      return { index: i, priority: (entry && entry.behavior && entry.behavior.collapsePriority) || 0 };
    });
    indexed.sort(function (a, b) { return b.priority - a.priority; });

    var toRemove = positions.length - targetCount;
    var removeIdxs = indexed.slice(0, toRemove).map(function (x) { return x.index; });
    removeIdxs.sort(function (a, b) { return b - a; }); // reverse to splice safely

    removeIdxs.forEach(function (idx) {
      patches.push({ type: 'collapse', removedId: positions[idx].id, priority: indexed.find(function (x) { return x.index === idx; }).priority });
      positions.splice(idx, 1);
    });
    return { applied: patches.length > 0, patches: patches };
  },

  // Expand undersized interactive elements to min touch target
  'expand-to-min': function (positions, targets, params) {
    var patches = [];
    var minW = params.minWidth || 48, minH = params.minHeight || 48;
    targets.forEach(function (pos) {
      var changed = false;
      if (pos.width < minW) { pos.width = minW; changed = true; }
      if (pos.height < minH) { pos.height = minH; changed = true; }
      if (changed) patches.push({ type: 'expand', id: pos.id, newSize: pos.width + 'x' + pos.height });
    });
    return { applied: patches.length > 0, patches: patches };
  },

  // Adjust gaps to match orchestration_rules
  'adjust-gap-to-rule': function (positions, targets) {
    var patches = [];
    targets.forEach(function (v) {
      // Find the 'to' component and shift it
      var toIdx = positions.findIndex(function (p) { return p.id === v.to; });
      if (toIdx < 0) return;
      var fromIdx = positions.findIndex(function (p) { return p.id === v.from; });
      if (fromIdx < 0) return;
      var fromBottom = positions[fromIdx].top + positions[fromIdx].height;
      var shift = v.expected - v.actual;
      for (var j = toIdx; j < positions.length; j++) {
        positions[j].top += shift;
      }
      patches.push({ type: 'adjust-gap', from: v.from, to: v.to, oldGap: v.actual, newGap: v.expected });
    });
    return { applied: patches.length > 0, patches: patches };
  }
};

// ---------------------------------------------------------------------------
//  autoRefine(positions, uiState, memory)
//  Runs all enabled refinement rules: analyze → patch → report.
//  Returns { positions, appliedPatches[], skipped[] }
// ---------------------------------------------------------------------------

function autoRefine(positions, uiState, memory) {
  var mem = _getMemory(memory);
  var rules = _getRefinementRules();
  var applied = [];
  var skipped = [];

  // Sort by priority (lower = more important = run first)
  rules.sort(function (a, b) { return (a.priority || 99) - (b.priority || 99); });

  rules.forEach(function (rule) {
    var analyzerFn = _analyzers[rule.analyzer.type];
    if (!analyzerFn) { skipped.push({ ruleId: rule.id, reason: 'unknown analyzer: ' + rule.analyzer.type }); return; }

    var result = analyzerFn(positions, rule.analyzer.params, uiState, mem);
    if (!result.matched) return;

    var patcherFn = _patchers[rule.patcher.type];
    if (!patcherFn) { skipped.push({ ruleId: rule.id, reason: 'unknown patcher: ' + rule.patcher.type }); return; }

    var patchResult = patcherFn(positions, result.targets, rule.patcher.params, mem);
    if (patchResult.applied) {
      applied.push({
        ruleId: rule.id,
        description: rule.description,
        patches: patchResult.patches
      });
    }
  });

  return { positions: positions, appliedPatches: applied, skipped: skipped };
}

// ---------------------------------------------------------------------------
//  Exports — usable from Node (require) and browser (window.Generator)
// ---------------------------------------------------------------------------

const Generator = {
  APP_BG_TOKENS,
  FOCUS_BLOCK_TOKENS,
  WALLPAPER_LAYER,
  resolveWallpaperLayer,
  resolveAppBackground,
  resolveFocusBlock,
  resolveLayers,
  validateBackgroundUsage,
  // design-memory-driven
  resolveComponentSize,
  resolveRadius,
  resolveSpacing,
  filterAllowedComponents,
  resolveOrder,
  resolvePositions,
  resolveScreenPlan,
  // orphan-rule consumers
  resolvePairGap,
  validatePairGaps,
  validateGlobalRules,
  // auto-refine engine
  autoRefine
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Generator;
}
if (typeof window !== 'undefined') {
  window.Generator = Generator;
}
