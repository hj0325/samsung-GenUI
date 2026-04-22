const http = require('http');
const fs = require('fs');
const path = require('path');
const pipeline = require('./pipeline');           // genui_pipeline_v1 step_1 + step_3
const UIState = require('./ui-state.js') || (global.UIState);  // step_2 resolver (Node CJS export)
// layout_composer is consumed indirectly by pipeline.runComposeLayout

// --- Load .env ---
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  });
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const PORT = parseInt(process.env.PORT) || 3001;

if (!OPENAI_API_KEY) {
  console.error('\x1b[31m[ERROR]\x1b[0m OPENAI_API_KEY not set in .env file');
  console.log('  → Open .env and paste your key: OPENAI_API_KEY=sk-...');
  process.exit(1);
}

// --- MIME types for static files ---
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

// ============================================================================
// DESIGN KNOWLEDGE BASE — Constraint Extraction Pipeline
// ============================================================================
// DESIGN.md is parsed into indexed sections at startup.
// It is NEVER sent as raw payload. Instead, only relevant constraints
// are extracted per scenario (~2-3KB vs 25KB full document).
// ============================================================================

const designMdPath = path.join(__dirname, 'DESIGN.md');
const genuiMdPath = path.join(__dirname, 'GENUI-PRINCIPLES.md');
const orchMdPath = path.join(__dirname, 'ORCHESTRATION.md');
const evolveMdPath = path.join(__dirname, 'evolve.md');
const DESIGN_MD_RAW = fs.existsSync(designMdPath) ? fs.readFileSync(designMdPath, 'utf8') : '';
const GENUI_MD_RAW = fs.existsSync(genuiMdPath) ? fs.readFileSync(genuiMdPath, 'utf8') : '';
const ORCH_MD_RAW = fs.existsSync(orchMdPath) ? fs.readFileSync(orchMdPath, 'utf8') : '';

// --- Parse markdown documents into indexed sections ---
function parseSections(raw, regex) {
  if (!raw) return {};
  const sections = {};
  const matches = [...raw.matchAll(regex)];
  for (let i = 0; i < matches.length; i++) {
    const key = (matches[i][2] || matches[i][1]).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    sections[key] = raw.substring(start, end).trim();
  }
  return sections;
}

// --- Evolve.md: parse entries into constraint list ---
function parseEvolveEntries(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  const entries = [];
  const entryRegex = /### E(\d+):\s*(.+)\n([\s\S]*?)(?=\n### E\d+:|\n---|\n<!-- |$)/g;
  let match;
  while ((match = entryRegex.exec(raw)) !== null) {
    const body = match[3];
    const extract = (key) => {
      const m = body.match(new RegExp(`\\*\\*${key}\\*\\*:\\s*(.+)`, 'i'));
      return m ? m[1].trim() : '';
    };
    entries.push({
      id: 'E' + match[1],
      title: match[2].trim(),
      type: extract('Type'),
      severity: extract('Severity'),
      scenario: extract('Scenario'),
      issue: extract('Issue'),
      fix: extract('Fix'),
      constraint: extract('Constraint'),
      date: extract('Date')
    });
  }
  return entries;
}

function loadEvolveConstraints() {
  const entries = parseEvolveEntries(evolveMdPath);
  if (entries.length === 0) return null;
  // Compress entries to actionable constraints only
  return entries.map(e => ({
    id: e.id,
    type: e.type,
    scenario: e.scenario,
    constraint: e.constraint
  })).filter(e => e.constraint); // only entries with a constraint
}

function appendEvolveEntry(entry) {
  let raw = fs.existsSync(evolveMdPath) ? fs.readFileSync(evolveMdPath, 'utf8') : '';
  // Find next entry number
  const nums = [...raw.matchAll(/### E(\d+):/g)].map(m => parseInt(m[1]));
  const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  const today = new Date().toISOString().split('T')[0];

  const md = `
### E${nextNum}: ${entry.title || 'Untitled issue'}
- **Type**: ${entry.type || 'consistency'}
- **Severity**: ${entry.severity || 'medium'}
- **Scenario**: ${entry.scenario || 'general'}
- **Issue**: ${entry.issue || ''}
- **Fix**: ${entry.fix || ''}
- **Constraint**: ${entry.constraint || ''}
- **Date**: ${today}
`;

  // Append before the closing comment or at end
  if (raw.includes('<!-- New entries')) {
    raw = raw.replace('<!-- New entries are appended here by the refinement system -->', md.trim() + '\n\n<!-- New entries are appended here by the refinement system -->');
  } else {
    raw += '\n' + md;
  }
  fs.writeFileSync(evolveMdPath, raw, 'utf8');
  return { id: `E${nextNum}`, success: true };
}

const DESIGN_SECTIONS = parseSections(DESIGN_MD_RAW, /^## (\d+)\. (.+)$/gm);
const GENUI_SECTIONS = parseSections(GENUI_MD_RAW, /^## (\d+)\. (.+)$/gm);
const ORCH_SECTIONS = parseSections(ORCH_MD_RAW, /^## (\d+)\. (.+)$/gm);
let EVOLVE_CONSTRAINTS = loadEvolveConstraints();

const totalRawKB = ((DESIGN_MD_RAW.length + GENUI_MD_RAW.length + ORCH_MD_RAW.length) / 1024).toFixed(1);
console.log(`  \x1b[32m✓\x1b[0m DESIGN.md    ${DESIGN_MD_RAW ? (DESIGN_MD_RAW.length / 1024).toFixed(1) + 'KB → ' + Object.keys(DESIGN_SECTIONS).length + ' sections' : 'NOT FOUND'}`);
console.log(`  \x1b[32m✓\x1b[0m GENUI.md     ${GENUI_MD_RAW ? (GENUI_MD_RAW.length / 1024).toFixed(1) + 'KB → ' + Object.keys(GENUI_SECTIONS).length + ' sections' : 'NOT FOUND'}`);
console.log(`  \x1b[32m✓\x1b[0m ORCH.md      ${ORCH_MD_RAW ? (ORCH_MD_RAW.length / 1024).toFixed(1) + 'KB → ' + Object.keys(ORCH_SECTIONS).length + ' sections' : 'NOT FOUND'}`);
console.log(`  \x1b[32m✓\x1b[0m evolve.md    ${EVOLVE_CONSTRAINTS ? EVOLVE_CONSTRAINTS.length + ' learned constraints' : '0 entries (will grow from refinement)'}`);
console.log(`  \x1b[32m✓\x1b[0m Total raw    ${totalRawKB}KB (never sent to API)`);

// --- Pre-compressed constraint fragments (extracted from DESIGN.md at parse time) ---
// These are the minimal, actionable rules — NOT raw markdown copies.

const CONSTRAINT_FRAGMENTS = {

  // Core tokens always included (~600 bytes)
  core: {
    spacing: { base: 8, scale: [4, 8, 12, 16, 24, 32, 48], unit: 'dp' },
    radius: { micro: 4, standard: 11, large: 20, card: 26, pill: 999, button: 18, circle: '50%' },
    typography: {
      display: { family: 'SamsungSharpSans', weight: 700 },
      body: { family: 'SamsungOne', weights: [400, 500, 600, 700] },
      scale: { caption: 11, body: 13, subtitle: 15, title: 20, headline: 28, hero: 36 }
    },
    motion: {
      static: { easing: 'cubic-bezier(0.22,0.25,0,1)', duration: '200-300ms' },
      gen: { easing: 'cubic-bezier(0.05,0.7,0.1,1.0)', duration: '300-500ms' },
      spring: { stiffness: 300, damping: 25 }
    }
  },

  // Color tokens (~400 bytes)
  colors_dark: {
    base: '#171717', surface: 'rgba(255,255,255,0.06)', surface2: 'rgba(255,255,255,0.1)',
    text: '#FFFFFF', text2: 'rgba(255,255,255,0.7)', text3: 'rgba(255,255,255,0.45)',
    primary: '#3388E9', brand: '#1428A0', divider: 'rgba(255,255,255,0.08)',
    error: '#FF453A', glass_bg: 'rgba(255,255,255,0.08)', glass_border: 'rgba(255,255,255,0.12)'
  },
  colors_light: {
    base: '#FCFCFC', surface: '#F7F7F7', surface2: '#F0F0F0',
    text: '#1D1D1F', text2: '#313131', text3: '#6E6E73',
    primary: '#1428A0', brand: '#1428A0', divider: '#EAEAEA',
    error: '#FF3B30', glass_bg: 'rgba(0,0,0,0.04)', glass_border: 'rgba(0,0,0,0.08)'
  },
  semantic_colors: {
    connectivity: '#4A90D9', accessibility: '#4CAF50', ai: '#9C27B0',
    health: '#E91E63', battery: '#FF9800', system: '#009688', communication: '#FF5252'
  },

  // Glass UI system (~300 bytes)
  glass: {
    levels: {
      G0: { opacity: '5-15%', blur: 40 },
      G1: { opacity: '15-30%', blur: 24 },
      G2: { opacity: '30-50%', blur: 16 },
      G3: { opacity: '50-70%', blur: 12 }
    },
    border: '1px solid rgba(255,255,255,0.12)',
    rule: 'all glass surfaces have thin outline border + wallpaper-reactive tint'
  },

  // Component behaviors (~900 bytes — expanded for quality)
  components: {
    button_primary: { height: 48, padding: '6px 24px', radius: 36, font: '14px/700', bg: 'var(--primary)', color: '#fff' },
    button_outlined: { height: 48, padding: '6px 24px', radius: 36, font: '14px/600', bg: 'transparent', border: '1px solid var(--divider)' },
    button_flat: { height: 48, padding: '6px 16px', font: '14px/500', bg: 'transparent', color: 'var(--primary)' },
    card: { radius: 26, padding: '16px', bg: 'var(--surface)', border: '1px solid var(--divider)' },
    input: { height: 48, radius: 18, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.15)', bg: 'var(--surface)', label_above: true },
    search: { height: 44, radius: 999, padding: '10px 16px', position: 'bottom of screen for reachability', icon: 'left' },
    appbar: { height: 56, back_arrow: 'left', title: 'center or left', overflow: 'right', behavior: 'fades during scroll' },
    pill_tab: { height: 46, radius: 999, bg: 'frosted semi-transparent', border: '1px solid rgba(255,255,255,0.2)', active: 'circular highlight' },
    bottomnav: { height: 56, items: '4-5 icon+label', style: 'pill-shaped floating, glass bg', active_color: 'var(--primary)' },
    now_bar: { position: 'bottom of lock screen', shape: 'pill(999px)', bg: 'tinted glass', states: 'media|timer|delivery|charging' },
    dialog: { radius: 26, padding: '24px', max_width: 320, button_pair: 'Cancel(flat) + Confirm(contained)' },
    chip: { height: 32, radius: 999, padding: '0 12px', font: '13px/500' },
    switch_toggle: { width: 52, height: 32, radius: 999, active_color: 'var(--primary)' },
    list_item: { min_height: 56, padding: '12px 16px', icon_left: '40x40 circle', chevron_right: true, divider: '1px bottom' },
    notification_card: { radius: 999, material: 'glass G1', structure: 'icon+appName+content+timestamp+actions' },
    media_card: { radius: 26, structure: 'albumArt+title+artist+progress+controls', bg: 'extracted palette' },
    status_bar: { height: 24, layout: 'time(left) notif-pill(center) system-icons(right)' },
    fab: { size: 56, radius: '50%', bg: '#FF5252', shadow: '0 4px 12px rgba(0,0,0,0.3)', position: 'bottom-right' }
  },

  // Layout rules (~300 bytes)
  layout: {
    mobile_width: 360, tablet_width: 692, desktop_width: 988,
    mobile_padding: 24, grid_base: 8,
    density: {
      lock_screen: '3-5 components', notification: '10-15',
      qs_expanded: '30-40', full_app: '50+'
    },
    pill_morphology: {
      pill: '999px — Now Bar, chips, tabs',
      squircle: '26px — cards, widgets, dialogs',
      circle: '50% — toggles, FABs',
      rounded_rect: '18px — buttons, inputs'
    }
  },

  // Depth system (~200 bytes)
  depth: {
    blur: 'emphasis on foreground — primary depth tool in 8.5',
    dim: 'clarifies hierarchy — rgba(0,0,0,0.65) for modals',
    shadow: 'soft connection between layers — never combine with dim',
    rule: 'pick ONE of dim or shadow per layer, never both'
  },

  // Do/Don't rules (~400 bytes)
  rules: [
    'SamsungSharpSans=headlines ONLY, SamsungOne=body/UI ONLY — never mix roles',
    'No font weight 300 — system starts at 400, peaks at 700',
    'Never combine Dim+Shadow on same element',
    'Samsung Blue (#1428A0) is accent only — never use as bg fill',
    'No sharp corners (0px radius) on cards — rounded/pill is 8.5 signature',
    'Nav must fade during scroll (Ambient Design)',
    'Body text left-aligned — only hero headlines center',
    'Search bars at bottom for reachability',
    'Glass UI required for floating system elements — no opaque bgs',
    'Dark mode: #171717 base, glass materials, white text',
    'Light mode: #FCFCFC base, opaque fills, dark text'
  ],

  // ========================================================================
  // GENUI PRINCIPLES — extracted from GENUI-PRINCIPLES.md (48KB → ~1.5KB)
  // ========================================================================

  // P1-P2: Component classification & contextual assembly (~300 bytes)
  genui_classification: {
    model: 'Static (S) vs Generative (G) — binary classification for every element',
    renderOrder: 'Render S (chrome) first to establish frame, then G (content) into slots',
    rule: 'S elements must NEVER be displaced by G elements',
    contextVector: 'C = {time, activity, services, deviceState, notifications}',
    assembly: 'Each Gen slot has selection function f(C) → Component|null'
  },

  // P3: Semantic colors (already in semantic_colors fragment above)

  // P4: Progressive density (~200 bytes)
  genui_density: {
    D1_lockScreen: { components: '3-5', info: 'time, date, Now Bar, 1-2 widgets' },
    D2_notifShade: { components: '10-15', info: 'D1 + notif cards (top 3-5) + 6 QS toggles' },
    D3_qsExpanded: { components: '30-40', info: 'D2 + full QS grid (6x4) + brightness + media' },
    D4_fullApp: { components: '50+', info: 'app-specific content, full nav, all interactive' },
    rule: 'Density increases monotonically. Each layer D_n contains all of D_{n-1} plus more.'
  },

  // P5: Glass hierarchy (already in glass fragment above, enriched here)

  // P6: Pill morphology (~200 bytes)
  genui_shapes: {
    pill_999: 'Now Bar, notification pill, chips, Connected Tab, slide nav buttons',
    squircle_26: 'Cards, widgets, media player, dialogs, image containers',
    circle_50: 'QS toggle icons, browser top bar icons, FAB, page indicator dots',
    rounded_18: 'Contained buttons, text fields, snackbar actions',
    rule: 'Never use sharp corners (0px) on Gen components'
  },

  // P7: Grid quantization (~200 bytes)
  genui_grid: {
    base: '8dp',
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    widgetSizes: {
      compact: '2x1 (176x80dp)', standard: '2x2 (176x176dp)',
      wide: '4x2 (368x176dp)', full: '4x4 (368x368dp)'
    },
    rule: 'All spacing must be from {4,8,12,16,24,32,40,48,64}dp. Internal padding >= 16dp.'
  },

  // P8: Motion as meaning (~200 bytes)
  genui_motion: {
    static: { curve: 'cubic-bezier(0.22,0.25,0,1)', duration: '200-300ms', for: 'chrome transitions' },
    gen: { curve: 'cubic-bezier(0.05,0.7,0.1,1.0)', duration: '300-500ms', for: 'content entry/exit' },
    spring: { stiffness: 300, damping: 25, for: 'toggle activation, pull-to-refresh' },
    density_transition: { curve: 'cubic-bezier(0.05,0.7,0.1,1.0)', duration: '400-500ms', for: 'layer transitions' },
    rule: 'Motion encodes classification. Static=restrained, Gen=expressive. Not decorative.'
  },

  // P9: Notification stratification (~200 bytes)
  genui_notifications: {
    tiers: {
      live: { glass: 'G2', textOpacity: '100%', interactive: true, position: 'top' },
      other: { glass: 'G1', textOpacity: '90%', interactive: 'limited', position: 'middle' },
      silent: { glass: 'G0', textOpacity: '60%', interactive: 'minimal', position: 'bottom' }
    },
    order: 'Live > Other > Silent (fixed vertical order)',
    rule: 'Visual weight decreases per tier. Live includes inline controls.'
  },

  // P10: Ambient reactivity (~150 bytes)
  genui_ambient: {
    wallpaper: 'Extract 5-color palette → apply to glass tints + accent colors',
    timeOfDay: 'Shift color temperature warmer after sunset',
    activity: 'Refresh widget data when activity changes detected',
    rule: 'All ambient changes use Basic Path motion >= 500ms to avoid jumps'
  },

  // P11: Connected composition (~150 bytes)
  genui_connected: {
    rule: 'Two+ Gen components can connect (gap=0) in shared container',
    container: 'Squircle for multi-row, pill for single-row compounds',
    glass: 'Shared container glass level = max of children glass levels',
    examples: 'SmartThings card (header pill + action row), Snackbar (text + button)'
  },

  // P12: Dual-mode rendering (already in rules + colors fragments)

  // Composition grammar — surface structure rules (~300 bytes)
  genui_grammar: {
    lockScreen: 'chrome + widget-area?(0-4 widgets) + now-bar?',
    notifShade: 'chrome + qs-mini(6 toggles) + notification-list(live>other>silent)',
    qsPanel: 'chrome + qs-grid(6col x 1-4row) + brightness? + media-player? + device-control?',
    appSurface: 'chrome + app-content + bottom-nav?',
    homeScreen: 'chrome + widget-grid(0-8) + app-icon-grid + page-indicator?',
    constraints: [
      'Every surface has exactly one chrome (status-bar + nav-bar)',
      'Chrome (Static) renders before any Gen elements',
      'Now Bar on at most one surface at a time',
      'Notif sections in fixed order: live > other > silent',
      'QS grid: 6 columns fixed, 1-4 rows variable',
      'Widget sizes: {2x1, 2x2, 4x2, 4x4} only',
      'Button pairs must contrast: flat+contained or outlined+outlined'
    ]
  },

  // Implementation visual constants (~200 bytes)
  genui_constants: {
    statusBarHeight: '24dp', navBarHeight: '48dp (buttons) / 20dp (gesture)',
    nowBarHeight: '64dp', minTouchTarget: '48dp',
    qsToggleGrid: '6 columns', glassBlurRange: '12-40px',
    glassBorder: '1px solid rgba(255,255,255,0.08-0.15)',
    darkSurface: '#171717', lightSurface: '#FCFCFC',
    imageRadius: '26px', dashedPlaceholder: '1px dashed rgba(255,255,255,0.3)'
  },

  // ========================================================================
  // ORCHESTRATION — extracted from ORCHESTRATION.md (component composition)
  // ========================================================================

  // Vertical stacking rules (~400 bytes)
  orch_stacking: {
    statusbar_to_appbar: '0dp',
    statusbar_to_content: '0dp (lock/wallpaper screens)',
    appbar_to_content: '0dp (content scrolls under)',
    appbar_to_section_title: '16dp',
    section_title_to_item: '8dp',
    card_to_card: '12dp',
    card_to_card_grouped: '8dp',
    list_item_to_list_item: '0dp (divider separates)',
    list_item_to_section_header: '16dp',
    button_to_button_v: '8dp',
    input_to_input: '16dp',
    input_to_helper: '4dp',
    chip_row_to_content: '16dp',
    content_to_bottomnav_clear: '64dp',
    search_to_content: '16dp above and below'
  },

  // Container nesting rules (~300 bytes)
  orch_containers: {
    card: { radius: 26, padding: '16-20dp', header: 'icon(40dp)+gap(12dp)+title(15dp/600)', content_gap: '12dp', action_gap: '16dp', action_align: 'right' },
    dialog: { radius: '26dp top', padding: '24dp', title_desc_gap: '8dp', desc_buttons_gap: '24dp', buttons: 'flex:1 each, divider between, h:48dp' },
    notification: { radius: 999, padding: '16dp 20dp', icon: '20dp circle', structure: 'icon+appName+timestamp(row1) title+preview(row2)' },
    widget: { radius: 26, padding: '12-16dp', bg: 'semantic color or glass', sizes: '2x1(176x80) 2x2(176x176) 4x1(368x80) 4x2(368x160)' }
  },

  // Screen composition templates (~500 bytes)
  orch_screens: {
    login: 'statusbar(24) → content(center-v, pad:0 24dp): logo → gap32 → title(24dp/700) → gap8 → subtitle → gap32 → input(email) → gap16 → input(pw) → gap8 → forgot(right) → gap24 → btn(full,contained) → gap12 → divider("or") → gap12 → social-row → flex → signup-link(bottom 34dp)',
    home: 'statusbar(24) → wallpaper(bleed) → widgets(start ~140dp, pad:0 16dp, grid 2-col, gap 8dp) → search(full-32dp, h:48, r:999) → gap16 → app-grid(4col, pad:0 24dp, icon:60dp r:18dp, label:11dp, col-gap:~28dp, row-gap:24dp) → page-dots → gap12 → dock(4 icons, 60dp, no labels) → navbar(48dp)',
    home_widgets: 'statusbar(24) → widgets(start ~56dp, pad:0 16dp, up to 3-4 rows, full-width 4x2 + mixed 2x2/2x1, gap 8dp) → dock(4 icons) → navbar(48dp)',
    app_drawer: 'statusbar(24) → app-grid(4col, pad:24dp, icon:60dp r:18dp, col-gap:~28dp, row-gap:24dp, max 5 rows) → flex → page-dots → search(bottom, h:44, r:999, glass) → navbar(48dp)',
    lock: 'statusbar(24,transparent) → wallpaper(bleed) → clock(~25-35% from top, 64-96dp SamsungSharpSans) → gap4 → date(16dp) → gap16 → widgets(max 2 compact) → flex → nowbar-row([action 48dp][nowbar flex][action 48dp], gap:8dp, bottom 72dp) → navbar(20dp)',
    qs: 'statusbar(24) → actionbar(48dp, icons right) → qs-grid(4col x 2row, toggle:64dp circle, gap:12H 16V) → page-dots → gap16 → brightness(h:48) → gap16 → tile-cards(2col, gap:8, r:20) → gap12 → media-chips(2, r:999, h:36) → gap12 → shortcuts(2, r:20, h:56) → navbar(48dp)'
  },

  // Widget composition rules (~300 bytes)
  orch_widgets: {
    grid: { columns: 4, gap: 8, container_padding: '0 16dp', snap: 'grid-only, no free position' },
    sizes: { compact_2x1: '176x80dp', standard_2x2: '176x176dp', wide_4x1: '368x80dp', large_4x2: '368x160dp' },
    mixing: 'mixed heights OK: 2x2 left + two 2x1 stacked right. Top-aligned per row.',
    maxVisible: '3-4 rows above dock',
    colorRule: 'no two adjacent widgets same bg color',
    types: {
      weather_full: 'semantic bg, icon(48dp top-right), temp(36dp/700), condition+hilo+location',
      health_rings: 'rings(72dp centered), stats row bottom(3 items)',
      steps: 'title+value(28dp/700)+progress(h:8dp r:999)',
      calendar: 'header(16dp/600)+list(h:36dp each, color-bar 3dp left)',
      photo: 'image fills entire area, object-fit:cover, padding:0'
    }
  },

  // App icon grid & dock (~200 bytes)
  orch_icons: {
    icon: { size: 60, visual: 56, radius: 18, shadow: '0 2dp 8dp rgba(0,0,0,0.15)' },
    folder: { size: 60, radius: 18, bg: 'glass semi-transparent', miniIcons: '2x2 20dp each gap:4dp pad:8dp' },
    grid: { columns: 4, colGap: '~28dp (evenly fill)', rowGap: 24, padding: '0 24dp', label: '11dp/400 center gap:6dp' },
    dock: { items: 4, iconSize: 60, gap: '~28dp even', noLabels: true, position: '48dp above navbar' },
    pageIndicator: { dotSize: 6, gap: 6, activeOpacity: 1, inactiveOpacity: 0.35 },
    // CRITICAL: always render real PNG icons. NEVER use letter placeholders (e.g. <div>G</div>, <div>Y</div>) or coloured squares with initials.
    // Use <img src="app-icons/{name}.png" style="width:...;height:...;border-radius:...;"> with one of these canonical filenames (URL-encode Korean automatically in the browser):
    assets: [
      'Phone.png','Messages.png','Camera.png','Gallery.png','Settings.png','Internet.png','Contacts.png','Clock.png','Calculator.png','Weather.png','Health.png','Bixby.png','Cloud.png','Radio.png','Reminder.png','Studio.png','VoiceRecorder.png','MyFiles.png','DailyBoard.png','DeviceCare.png','DigitalWellbeing.png','SecureWifi.png','SecureFolder.png',
      'Find.png','Notes.png','Pass.png','SmartThings.png','Store.png','Wallet.png','Wearable.png'
    ],
    rule: 'MANDATORY <img src="app-icons/…"> for every app icon. No letter/emoji fallbacks. If an app has no asset, pick the closest match from the list.'
  },

  // Z-layer system (~200 bytes)
  orch_zlayers: {
    base: { z: 0, elements: 'content, lists, grids' },
    floating: { z: 10, elements: 'FAB, BottomNav, PillTab' },
    elevated: { z: 20, elements: 'snackbar, toast' },
    panel: { z: 50, elements: 'bottom sheet, QS panel' },
    modal: { z: 100, elements: 'dialog', dim: 'rgba(0,0,0,0.65)' },
    nowbar: { z: 150, elements: 'now bar' },
    system: { z: 200, elements: 'status bar, nav bar' },
    rule: 'only ONE overlay active at a time: Dialog > Sheet > Snackbar'
  },

  // Anti-patterns (~200 bytes)
  orch_antipatterns: [
    'No card-inside-card nesting',
    'Dialog max 2 buttons (use ActionSheet for 3+)',
    'FAB 16dp above BottomNav, never overlapping',
    'No full-width button inside narrow card',
    'No nested scroll (only horizontal-in-vertical)',
    'No opaque overlay on glass surface',
    'No mixed radius in same container',
    'Min 8dp gap between interactive elements',
    'No text on wallpaper without glass/scrim',
    'Max 5 items in BottomNav'
  ],

  // Component taxonomy — gen component specs (~300 bytes)
  genui_components: {
    notificationCard: { shape: 'pill(999px)', material: 'dark glass', structure: 'icon+appName+content+timestamp+actions' },
    nowBar: { shape: 'pill(999px)', material: 'tinted glass', states: ['media', 'timer', 'delivery', 'charging'] },
    lockWidget: { shape: 'squircle(26px)', layout: '2-col grid, 2x1 units', types: ['weather', 'health', 'clock'] },
    qsToggle: { shape: 'circle on colored circle', layout: '6col x 4row', interaction: 'tap=toggle, longpress=settings' },
    mediaPlayer: { shape: 'squircle(26px)', structure: 'albumArt+title+artist+progress+controls', material: 'extracted palette bg' },
    homeWidget: { shape: 'squircle(26px)', sizes: ['2x1', '2x2', '4x2'], material: 'opaque fill' },
    dialog: { shape: 'squircle(26px top)', structure: 'title+description+buttonPair', behavior: 'modal, blocks surface' },
    edgePanel: { structure: 'panel-content, glass tint', behavior: 'slide-in from edge' }
  }
};

// --- Scenario → relevant constraint keys mapping ---
// Each scenario pulls from DESIGN.md fragments + GENUI fragments as needed
const SCENARIO_CONSTRAINTS = {
  // Format: [DESIGN.md fragments, ...GENUI fragments, ...ORCH fragments]
  home:     ['layout', 'glass', 'depth', 'components', 'genui_classification', 'genui_grammar', 'genui_shapes', 'genui_grid', 'orch_stacking', 'orch_screens', 'orch_widgets', 'orch_icons'],
  login:    ['components', 'layout', 'genui_classification', 'genui_shapes', 'orch_stacking', 'orch_screens', 'orch_containers'],
  settings: ['components', 'layout', 'genui_classification', 'genui_shapes', 'orch_stacking', 'orch_containers'],
  chat:     ['components', 'layout', 'genui_classification', 'genui_shapes', 'genui_connected', 'orch_stacking', 'orch_containers'],
  feed:     ['components', 'layout', 'glass', 'genui_classification', 'genui_density', 'genui_shapes', 'orch_stacking'],
  profile:  ['components', 'layout', 'genui_classification', 'genui_shapes', 'orch_stacking', 'orch_containers'],
  gallery:  ['components', 'layout', 'glass', 'genui_classification', 'genui_grid', 'orch_stacking', 'orch_icons'],
  product:  ['components', 'layout', 'genui_classification', 'genui_shapes', 'orch_stacking', 'orch_containers'],
  lock:     ['glass', 'depth', 'layout', 'genui_classification', 'genui_grammar', 'genui_density', 'genui_ambient', 'genui_components', 'orch_stacking', 'orch_screens', 'orch_zlayers'],
  music:    ['components', 'glass', 'layout', 'genui_classification', 'genui_components', 'genui_connected', 'orch_stacking', 'orch_containers'],
  notif:    ['components', 'glass', 'depth', 'layout', 'genui_classification', 'genui_notifications', 'genui_density', 'genui_grammar', 'orch_stacking', 'orch_containers', 'orch_zlayers'],
  qs:       ['glass', 'depth', 'components', 'layout', 'genui_classification', 'genui_density', 'genui_grammar', 'genui_grid', 'genui_components', 'orch_stacking', 'orch_screens', 'orch_zlayers'],
  iot:      ['components', 'layout', 'glass', 'genui_classification', 'genui_connected', 'genui_shapes', 'orch_stacking', 'orch_containers'],
  dash:     ['components', 'layout', 'glass', 'genui_classification', 'genui_grid', 'genui_density', 'orch_stacking', 'orch_widgets'],
  onboard:  ['components', 'layout', 'genui_classification', 'genui_motion', 'genui_shapes', 'orch_stacking', 'orch_screens'],
  media:    ['components', 'layout', 'glass', 'genui_classification', 'genui_components', 'genui_connected', 'orch_stacking', 'orch_containers'],
  keyboard: ['components', 'layout', 'genui_classification', 'genui_components', 'orch_stacking'],
  default:  ['components', 'layout', 'genui_classification', 'genui_shapes', 'genui_grid', 'orch_stacking', 'orch_antipatterns']
};

// --- Extract constraints for a given prompt/scenario ---
function extractConstraints(prompt, scenario, mode) {
  // Always include core tokens
  const constraints = {
    core: CONSTRAINT_FRAGMENTS.core,
    colors: mode === 'light' ? CONSTRAINT_FRAGMENTS.colors_light : CONSTRAINT_FRAGMENTS.colors_dark,
    rules: CONSTRAINT_FRAGMENTS.rules
  };

  // Determine which extra fragments to include
  const scenarioKey = scenario || _detectScenario(prompt);
  const extraKeys = SCENARIO_CONSTRAINTS[scenarioKey] || SCENARIO_CONSTRAINTS.default;

  for (const key of extraKeys) {
    if (CONSTRAINT_FRAGMENTS[key]) {
      constraints[key] = CONSTRAINT_FRAGMENTS[key];
    }
  }

  // If prompt mentions specific topics, add relevant fragments dynamically
  const promptLower = (prompt || '').toLowerCase();

  // DESIGN.md fragment triggers
  if (promptLower.includes('glass') || promptLower.includes('blur') || promptLower.includes('transparent')) {
    constraints.glass = CONSTRAINT_FRAGMENTS.glass;
  }
  if (promptLower.includes('color') || promptLower.includes('theme') || promptLower.includes('palette')) {
    constraints.semantic_colors = CONSTRAINT_FRAGMENTS.semantic_colors;
  }
  if (promptLower.includes('depth') || promptLower.includes('shadow') || promptLower.includes('elevation')) {
    constraints.depth = CONSTRAINT_FRAGMENTS.depth;
  }

  // GENUI fragment triggers
  if (promptLower.includes('notification') || promptLower.includes('alert')) {
    constraints.genui_notifications = CONSTRAINT_FRAGMENTS.genui_notifications;
  }
  if (promptLower.includes('animation') || promptLower.includes('motion') || promptLower.includes('transition')) {
    constraints.genui_motion = CONSTRAINT_FRAGMENTS.genui_motion;
  }
  if (promptLower.includes('widget') || promptLower.includes('grid') || promptLower.includes('layout')) {
    constraints.genui_grid = CONSTRAINT_FRAGMENTS.genui_grid;
  }
  if (promptLower.includes('now bar') || promptLower.includes('lock') || promptLower.includes('ambient')) {
    constraints.genui_ambient = CONSTRAINT_FRAGMENTS.genui_ambient;
    constraints.genui_components = CONSTRAINT_FRAGMENTS.genui_components;
  }
  if (promptLower.includes('quick setting') || promptLower.includes('toggle') || promptLower.includes('control')) {
    constraints.genui_density = CONSTRAINT_FRAGMENTS.genui_density;
    constraints.genui_grammar = CONSTRAINT_FRAGMENTS.genui_grammar;
  }

  // ORCHESTRATION fragment triggers
  if (promptLower.includes('widget') || promptLower.includes('home')) {
    constraints.orch_widgets = CONSTRAINT_FRAGMENTS.orch_widgets;
    constraints.orch_icons = CONSTRAINT_FRAGMENTS.orch_icons;
  }
  if (promptLower.includes('card') || promptLower.includes('dialog') || promptLower.includes('list') || promptLower.includes('container')) {
    constraints.orch_containers = CONSTRAINT_FRAGMENTS.orch_containers;
  }
  if (promptLower.includes('stack') || promptLower.includes('spacing') || promptLower.includes('gap') || promptLower.includes('layout')) {
    constraints.orch_stacking = CONSTRAINT_FRAGMENTS.orch_stacking;
  }
  if (promptLower.includes('z-index') || promptLower.includes('overlay') || promptLower.includes('modal') || promptLower.includes('layer')) {
    constraints.orch_zlayers = CONSTRAINT_FRAGMENTS.orch_zlayers;
  }

  // --- Evolve.md: inject learned constraints ---
  // Reload from disk each time (file grows during session)
  EVOLVE_CONSTRAINTS = loadEvolveConstraints();
  if (EVOLVE_CONSTRAINTS && EVOLVE_CONSTRAINTS.length > 0) {
    // Filter: include all general constraints + scenario-specific ones
    const scenarioKey2 = scenario || _detectScenario(prompt);
    const relevant = EVOLVE_CONSTRAINTS.filter(e =>
      !e.scenario || e.scenario === 'general' || e.scenario === scenarioKey2
    );
    if (relevant.length > 0) {
      constraints.evolve = relevant.map(e => `[${e.id}] ${e.constraint}`);
    }
  }

  return constraints;
}

function _detectScenario(prompt) {
  if (!prompt) return 'default';
  const p = prompt.toLowerCase();
  const map = {
    home: ['home', 'homescreen', 'launcher', 'wallpaper'],
    login: ['login', 'sign in', 'sign up', 'register', 'account', 'auth'],
    settings: ['settings', 'preferences', 'configuration'],
    chat: ['chat', 'message', 'conversation', 'messenger'],
    feed: ['feed', 'social', 'timeline', 'news'],
    profile: ['profile', 'user', 'my page'],
    gallery: ['gallery', 'photo', 'album', 'image'],
    product: ['product', 'shop', 'store', 'ecommerce', 'cart'],
    lock: ['lock screen', 'lockscreen', 'aod', 'always on'],
    music: ['music', 'player', 'audio', 'spotify', 'playlist'],
    notif: ['notification', 'alert', 'notify'],
    qs: ['quick setting', 'quick panel', 'control center', 'toggle'],
    iot: ['iot', 'smart home', 'device', 'smartthings'],
    dash: ['dashboard', 'health', 'fitness', 'stats', 'analytics'],
    onboard: ['onboard', 'welcome', 'tutorial', 'intro'],
    media: ['media', 'video', 'streaming', 'youtube'],
    keyboard: ['keyboard', 'typing', 'input method']
  };
  for (const [key, keywords] of Object.entries(map)) {
    if (keywords.some(kw => p.includes(kw))) return key;
  }
  return 'default';
}

// --- Format constraints as compact system prompt injection ---
function formatConstraintsForPrompt(constraints) {
  return JSON.stringify(constraints, null, 0);
}

// ============================================================================
// OpenAI proxy
// ============================================================================

async function callOpenAI(systemPrompt, userMessage, temperature = 0.7) {
  const body = JSON.stringify({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature,
    response_format: { type: 'json_object' }
  });

  const url = new URL('https://api.openai.com/v1/chat/completions');
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Length': Buffer.byteLength(body)
    }
  };

  return new Promise((resolve, reject) => {
    const https = require('https');
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          try {
            const err = JSON.parse(data);
            reject(new Error(err.error?.message || `OpenAI ${res.statusCode}`));
          } catch { reject(new Error(`OpenAI ${res.statusCode}: ${data.substring(0, 200)}`)); }
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.message?.content;
          resolve(JSON.parse(content));
        } catch (e) { reject(new Error('Failed to parse OpenAI response: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('OpenAI request timeout')); });
    req.write(body);
    req.end();
  });
}

// ============================================================================
//  Streaming OpenAI call (SSE). Each token delta invokes onDelta(text, full);
//  resolves with the final parsed JSON object when the stream completes.
// ============================================================================
async function callOpenAIStream(systemPrompt, userMessage, temperature, onDelta) {
  const body = JSON.stringify({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature: temperature != null ? temperature : 0.7,
    response_format: { type: 'json_object' },
    stream: true
  });

  const url = new URL('https://api.openai.com/v1/chat/completions');
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Length': Buffer.byteLength(body)
    }
  };

  return new Promise((resolve, reject) => {
    const https = require('https');
    const req = https.request(url, options, (res) => {
      if (res.statusCode !== 200) {
        let err = '';
        res.on('data', c => err += c);
        res.on('end', () => reject(new Error(`OpenAI ${res.statusCode}: ${err.substring(0, 200)}`)));
        return;
      }
      let buffer = '';
      let fullText = '';
      res.on('data', chunk => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // last line may be incomplete
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            const delta = (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) || '';
            if (delta) {
              fullText += delta;
              try { onDelta(delta, fullText); } catch (e) { /* handler error, ignore */ }
            }
          } catch (e) { /* skip malformed SSE frames */ }
        }
      });
      res.on('end', () => {
        try {
          const finalJson = JSON.parse(fullText);
          resolve(finalJson);
        } catch (e) {
          reject(new Error('Failed to parse streamed JSON: ' + e.message + ' (text length: ' + fullText.length + ')'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('OpenAI stream timeout')); });
    req.write(body);
    req.end();
  });
}

// Scan accumulated (possibly incomplete) JSON text and extract every complete
// object from the `components` array. Uses a minimal brace-counting state
// machine — doesn't require valid JSON at the top level yet.
function extractStreamedComponents(fullText, alreadyEmitted) {
  const match = fullText.match(/"components"\s*:\s*\[/);
  if (!match) return [];
  const start = match.index + match[0].length;
  let depth = 0, inStr = false, esc = false;
  let objStart = -1;
  let foundIdx = 0;
  const out = [];
  for (let i = start; i < fullText.length; i++) {
    const c = fullText[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') { if (depth === 0) objStart = i; depth++; }
    else if (c === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        if (foundIdx >= alreadyEmitted) {
          try { out.push(JSON.parse(fullText.substring(objStart, i + 1))); }
          catch (e) { /* component still incomplete */ }
        }
        foundIdx++;
        objStart = -1;
      }
    }
    else if (c === ']' && depth === 0) break;
  }
  return out;
}

// ============================================================================
// System Prompt Builders (constraint-driven, NOT raw document injection)
// ============================================================================

function buildGenerateSystemPrompt() {
  return `
You are generating semantic UI plans for Samsung One UI 8.5 mobile surfaces.

Do not generate arbitrary freeform layouts.
Do not return absolute pixel coordinates.
Do not return generic vertical card stacks unless they are explicitly part of a role-aware surface plan.

You must think in surface grammar.

=== YOUR JOB ===
Propose semantic components. The frontend renderer owns spatial placement.

You will receive a "4+2+1 ORCHESTRATION BRIEF" in the user message. It
tells you the PURPOSE TYPE (one of 4), the body/environment modulation,
the multi-device modulation, and any governance triggers. READ THIS
BRIEF FIRST and let it drive what you include and what you suppress.

Decision order (always):
1. Read the orchestration brief → understand what purpose this UI serves.
2. Based on the purpose + modulation, decide which components MUST show
   and which must be SUPPRESSED or deferred.
3. Choose roles from ALLOWED_ROLES that match those decisions.
4. Fill content with SPECIFIC detail from the prompt (never placeholder).
5. Pick the surfaceType that best carries the resulting component set.

Always determine:
1. surfaceType (one of ALLOWED_SURFACE_TYPES)
2. user intent (a specific phrase derived from the prompt — not generic)
3. content hierarchy (what leads, what supports)
4. component roles (pick the RICHEST roles that fit the prompt)
5. role-specific content (use SPECIFIC detail from the prompt — never placeholder text)
6. allowed state values (expandable-app-bar = expanded|collapsed only)

=== CONTENT QUALITY BAR (this is the bar to clear) ===
The renderer already produces a working template for any surfaceType.
What YOU add is SPECIFIC CONTENT that reflects the user's scenario.

GOOD:
  prompt: "Morning brief with weather"
  - expandable-app-bar.text = "Good morning, Kyuha"
  - focus-block.content.title = "72° partly cloudy"
  - focus-block.content.sub = "Low 58° · Rain expected 4 PM"

BAD:
  - expandable-app-bar.text = "Home"         (generic)
  - focus-block.content.title = ""           (empty)
  - focus-block.content.sub = "Card content" (placeholder)

=== COMPONENT SELECTION HINTS ===
Pick components that MATCH the activity in the prompt:
- "music playing", "listening", "podcast"     → include now-bar with type="media"
- "charging", "low battery"                    → include now-bar with type="charging"
- "timer", "cooking", "workout duration"       → include now-bar with type="timer"
- "notifications pending", "messages from X"   → include notif-card / notif-card-ai
- "toggle wifi", "bluetooth", "airplane"       → include toggle-chip or toggle-grid
- "lock screen"                                → lock-clock + weather-date + optionally now-bar
- "quick settings"                             → slider-panel (brightness/volume) + toggle-grid
- "share sheet", "pick browser"                → dialog-shell + dialog-icon-grid
- "menu", "pick one of", "choose option"       → selection-dialog
- Ambient, glanceable, minimal-touch contexts  → prefer focus-block with kind="secondary"
                                                 (title + body text), avoid dense lists

=== ONE UI STRUCTURAL RULES ===
- viewing area and interaction area are distinct
- important content should use focus-block hierarchy when appropriate
- bottom bar and bottom navigation are different roles
- safe side margins are respected by the renderer
- expandable app bar may rest only in "expanded" or "collapsed"
- do not mix navigation and action components at the bottom
- every component.role MUST come from ALLOWED_ROLES below

=== STRICT OUTPUT SHAPE ===
Return STRICT JSON only:
{
  "layoutTree": {
    "surfaceType": "<from ALLOWED_SURFACE_TYPES>",
    "intent": "<specific phrase from prompt, 3-7 words>",
    "hierarchy": "focus-on-list | focus-on-hero | focus-on-dialog | focus-on-chrome"
  },
  "renderModel": {
    "surfaceType": "<same as above>",
    "layout": { "surfaceType": "<same>", "theme": "dark | light", "variant": "one-ui" },
    "components": [
      {
        "id": "<unique-id>",
        "role": "<from ALLOWED_ROLES>",
        "state": "<optional — only for app bars>",
        "text": "<top-level text if the role carries a primary string>",
        "content": {
          "title": "<specific to prompt>",
          "sub": "<specific to prompt>",
          "value": "<specific to prompt>",
          "items": [ { "title": "", "sub": "" }, ... ]
        },
        "variant": { "kind": "hero | secondary | ...", "type": "media | timer | charging" }
      }
    ]
  },
  "critic": { "score": 0, "issues": [], "suggestions": [] }
}

=== ALLOWED_SURFACE_TYPES ===
lockscreen, first-depth-list, second-depth-detail, tab-root,
dialog-bottom, dialog-center, quick-settings, notification-shade, selection-mode

=== ALLOWED_ROLES ===
Chrome / layout:
  status-bar, expandable-app-bar, collapsed-app-bar, selection-app-bar,
  search-bar, list-top-bar, bottom-navigation, bottom-bar,
  app-dock, app-grid, app-icon

Content containers:
  focus-block, focus-block-group, list, list-item, detail-content,
  notification-list, paragraph, action-row

Lock screen:
  lock-clock, weather-date, lock-indicator, unlock-hint, lock-shortcuts

Live activity / media:
  now-bar (type: media | timer | charging | dual-line | single-line),
  media-card, media-half, progress-track, output-chip, media-output-row,
  control-pill

Notification / AI:
  notif-card, notif-card-ai

Quick Settings atomics:
  toggle-chip, toggle-grid, slider-pill, slider-panel, single-toggle,
  smart-things, qs-action-tile, drag-handle, quick-settings-panel

Dialog atomics:
  dialog-shell, dialog-site-header, dialog-browser-bar, dialog-icon-grid,
  bottom-dialog, center-dialog, selection-dialog

Background:
  background, scrim
`;
}

function buildGenerateUserPrompt(payload) {
  const constraints = extractConstraints(
    payload.prompt || payload.scenario || '',
    payload.scenario,
    payload.mode || 'dark'
  );
  const tokenSummary = formatConstraintsForPrompt({
    core: constraints.core,
    colors: constraints.colors,
    typography: constraints.typography
  });

  // Extract user-mentioned keywords so the prompt explicitly pushes the
  // LLM to use THESE specifics in component text/content. A common
  // failure mode was the model generating generic "Home" / "Messages"
  // headers regardless of what the user typed.
  const keywordSource = [payload.prompt, payload.intent, payload.activity]
    .filter(Boolean).join(' ').toLowerCase();
  const keywordHints = [];
  [
    ['music', 'now-bar with type="media"'],
    ['playing', 'now-bar with type="media"'],
    ['podcast', 'now-bar with type="media"'],
    ['charging', 'now-bar with type="charging"'],
    ['battery', 'now-bar with type="charging"'],
    ['timer', 'now-bar with type="timer"'],
    ['cooking', 'now-bar with type="timer"'],
    ['workout', 'now-bar with type="timer"'],
    ['weather', 'focus-block with weather info OR weather-date atomic'],
    ['calendar', 'focus-block or list-item with calendar summary'],
    ['message', 'notif-card OR list-item with message preview'],
    ['notification', 'notif-card or notif-card-ai'],
    ['wifi', 'toggle-chip or toggle-grid'],
    ['bluetooth', 'toggle-chip or toggle-grid'],
    ['brightness', 'slider-panel'],
    ['volume', 'slider-panel']
  ].forEach(function (pair) {
    if (keywordSource.indexOf(pair[0]) !== -1) keywordHints.push(pair[1]);
  });
  const hintBlock = keywordHints.length
    ? `Component hints based on prompt keywords (use at least one of these):\n  - ${Array.from(new Set(keywordHints)).join('\n  - ')}\n`
    : '';

  const contextLine = [
    payload.timeOfDay ? `timeOfDay=${payload.timeOfDay}` : null,
    payload.activity  ? `activity="${payload.activity}"` : null,
    payload.intent    ? `intent="${payload.intent}"`     : null
  ].filter(Boolean).join(', ');

  // Build a full decision brief the generator can reason with. The
  // brief stacks the four upstream layers the classifier produced:
  //   (1) 4+2+1 orchestration    → purpose policy
  //   (2) interpretation         → what the user is really trying to do
  //   (3) state packet           → compressed decision state
  //   (4) information priority   → must_show / suppress / defer lists
  // The generator reads these in order BEFORE choosing components.
  const orch = payload.orchestration || null;
  const orchBlock     = orch ? buildOrchestrationBrief(orch) : '';
  const interpBlock   = payload.interpretation      ? buildInterpretationBrief(payload.interpretation) : '';
  const stateBlock    = payload.statePacket         ? buildStatePacketBrief(payload.statePacket)       : '';
  const priorityBlock = payload.informationPriority ? buildPriorityBrief(payload.informationPriority)  : '';

  return `
Requested surfaceType: ${payload.surfaceType || 'first-depth-list'}
Classified context: ${contextLine || '(none extracted)'}
Scenario key: ${payload.scenario || ''}
Prompt: ${payload.prompt || ''}
Brand: ${payload.surface || 'samsung'}
Mode: ${payload.mode || 'dark'}
Device: ${payload.device || 'Galaxy S26'}

${orchBlock}${interpBlock}${stateBlock}${priorityBlock}Constraints:
${JSON.stringify(payload.constraints || {}, null, 2)}

Design tokens (for copy/color/typography reference only — do not quote coordinates):
${tokenSummary}

Reference image attached: ${payload.referenceImage ? 'yes' : 'no'}

${hintBlock}Instructions:
- Every component MUST reflect the USER'S SPECIFIC prompt in its text/content.
- Use concrete details from the prompt, not generic fill ("Home", "Card content", "").
- Respect the 4+2+1 ORCHESTRATION BRIEF above: the purpose type dictates
  what MUST show vs. what should be suppressed.
- If timeOfDay is set, choose greetings / accent copy that match it
  (morning → "Good morning", night → "Tonight" / "Evening briefing").
- If activity is set, surface it via a now-bar (media/timer/charging) OR a
  focus-block with narrative title + body.
- Keep the response semantic and role-based. The frontend renderer handles placement.
- Choose only from approved roles and approved surface types.
- Prefer richer OneUI 8.5 atomics (now-bar, media-card, toggle-grid, slider-panel,
  notif-card-ai, selection-dialog) over plain focus-block whenever the prompt
  makes one of them appropriate.
`;
}

// Format the 4+2+1 classification as a concise decision brief that the
// generator LLM can consume. Only included when the classifier produced
// a non-null orchestration payload — otherwise returns empty string so
// the prompt stays lean.
function buildOrchestrationBrief(orch) {
  if (!orch || !orch.purpose) return '';
  const purposePolicy = {
    context_reconstruction: [
      'PURPOSE: context_reconstruction — consolidate scattered signals into ONE unified view.',
      '  must_show  : the consolidated conclusion (summary cards, aggregate widgets).',
      '  suppress   : raw per-source lists when a summary covers them.',
      '  pattern    : focus-block (kind=hero or secondary) carrying the synthesis.'
    ],
    flow_continuity: [
      'PURPOSE: flow_continuity — preserve the thread of intent across time/surface/device.',
      '  must_show  : continuity-critical state (current step, next step, active session).',
      '  suppress   : any component that breaks the thread.',
      '  pattern    : now-bar + progress-track + handoff affordance.'
    ],
    focus_protection: [
      'PURPOSE: focus_protection — reduce interruptions. Only the one thing that matters.',
      '  must_show  : the single most urgent / ambient signal.',
      '  suppress   : app-grid, dense widgets, promotional content, long lists.',
      '  defer      : anything not time-critical.',
      '  pattern    : now-bar + 1 minimal focus-block. Low density, high glass tier.'
    ],
    multi_party_coordination: [
      'PURPOSE: multi_party_coordination — surface conflicts and alignment actions.',
      '  must_show  : conflict visibility + resolution actions.',
      '  suppress   : single-user personalization until conflict resolves.',
      '  pattern    : selection-dialog / action-row / list showing parties and their states.'
    ]
  };
  const pri = orch.purpose.primary || 'context_reconstruction';
  const sec = orch.purpose.secondary;
  const lines = [];
  lines.push('==== 4+2+1 ORCHESTRATION BRIEF ====');
  (purposePolicy[pri] || purposePolicy.context_reconstruction).forEach(l => lines.push(l));
  if (sec && purposePolicy[sec]) {
    lines.push('(Secondary purpose: ' + sec + ' — layer lightly on top of primary)');
  }
  if (orch.purpose.reasoning) {
    lines.push('Why this purpose: ' + orch.purpose.reasoning);
  }

  const m = orch.modulationA || {};
  const modA = [];
  if (m.attention)    modA.push('attention=' + m.attention);
  if (m.mobility)     modA.push('mobility=' + m.mobility);
  if (m.interaction)  modA.push('interaction=' + m.interaction);
  if (m.privacy)      modA.push('privacy=' + m.privacy);
  if (m.time_of_day)  modA.push('time=' + m.time_of_day);
  if (m.ambient)      modA.push('ambient=' + m.ambient);
  if (modA.length) lines.push('Modulation A (body/env): ' + modA.join(', '));
  if (m.attention === 'glanceable' || m.attention === 'distracted') {
    lines.push('  → REDUCE density. Collapse non-essentials. Prefer minimal-touch targets.');
  }
  if (m.interaction === 'minimal-touch' || m.mobility === 'driving') {
    lines.push('  → Touch targets ≥ 56px. No fine-grain dense lists.');
  }

  const d = orch.modulationB || {};
  const modB = [];
  modB.push('device_count=' + d.device_count);
  if (d.primary_device)   modB.push('primary=' + d.primary_device);
  if (d.handoff_required) modB.push('handoff→' + (d.handoff_target || 'target?'));
  if (modB.length) lines.push('Modulation B (device): ' + modB.join(', '));
  if (d.handoff_required) {
    lines.push('  → Surface a handoff affordance (continuity hint, device icon).');
  }

  const g = orch.governance || {};
  if ((g.triggers && g.triggers.length) || g.explanation_needed || g.override_needed) {
    lines.push('Governance: triggers=[' + (g.triggers || []).join(',') + ']' +
      ', autonomy=' + (g.autonomy_level || 'advise') +
      (g.explanation_needed ? ', explanation_needed' : '') +
      (g.override_needed ? ', override_needed' : ''));
    if (g.explanation_needed) {
      lines.push('  → Include an explicit "why this" rationale in one component\'s sub-text.');
    }
    if (g.override_needed) {
      lines.push('  → Include an explicit user-override action (e.g. "Not now", "Change").');
    }
  }
  lines.push('==== END BRIEF ====');
  lines.push('');
  return lines.join('\n');
}

// R2: interpretation layer brief. Forces the generator to remember the
// 6 question answers before choosing components — the "what is the user
// actually trying to do" context that shouldn't be lost between the
// classifier and the component selector.
function buildInterpretationBrief(interp) {
  if (!interp) return '';
  const lines = [];
  lines.push('==== INTERPRETATION ====');
  if (interp.what_user_doing)  lines.push('user_doing:  ' + interp.what_user_doing);
  if (interp.real_goal)        lines.push('real_goal:   ' + interp.real_goal);
  if (interp.most_lacking)     lines.push('lacking:     ' + interp.most_lacking);
  if (interp.what_interferes)  lines.push('interferes:  ' + interp.what_interferes);
  if (interp.system_role && interp.system_role.length) {
    lines.push('system_role: ' + interp.system_role.join(' + '));
  }
  if (interp.interaction_complexity) {
    lines.push('complexity:  ' + interp.interaction_complexity);
  }
  lines.push('');
  return lines.join('\n');
}

// R2: compressed state packet brief — machine-readable decision packet.
// The generator treats this as a set of HARD constraints on component
// selection (attention_capacity=low → reject dense grids, etc.).
function buildStatePacketBrief(sp) {
  if (!sp) return '';
  const lines = [];
  lines.push('==== STATE PACKET ====');
  const pairs = [
    ['purpose_type',       sp.purpose_type],
    ['primary_goal',       sp.primary_goal],
    ['journey_stage',      sp.journey_stage],
    ['urgency',            sp.urgency],
    ['attention_capacity', sp.attention_capacity],
    ['interaction_budget', sp.interaction_budget],
    ['coordination_need',  sp.coordination_need],
    ['device_role',        sp.device_role],
    ['system_role',        sp.system_role],
    ['autonomy_level',     sp.autonomy_level]
  ];
  pairs.forEach(p => { if (p[1]) lines.push(p[0].padEnd(20) + ': ' + p[1]); });
  if (sp.privacy_level)       lines.push('privacy_level       : ' + sp.privacy_level);
  if (sp.explanation_needed)  lines.push('explanation_needed  : yes');
  if (sp.override_needed)     lines.push('override_needed     : yes');
  if (sp.handoff_required)    lines.push('handoff_required    : yes');
  lines.push('');
  return lines.join('\n');
}

// R2: information priority brief — the CONTRACT the generator must
// honor. must_show entries should map to actual components in the
// output. suppress entries must NOT appear. defer entries may appear
// marked with visibility="collapsed".
function buildPriorityBrief(ip) {
  if (!ip) return '';
  const lines = [];
  lines.push('==== INFORMATION PRIORITY (contract) ====');
  if (ip.must_show.length) {
    lines.push('MUST_SHOW   : ' + ip.must_show.join(', '));
    lines.push('              → Each of these MUST correspond to an emitted component.');
  }
  if (ip.should_show.length) {
    lines.push('should_show : ' + ip.should_show.join(', '));
  }
  if (ip.suppress.length) {
    lines.push('SUPPRESS    : ' + ip.suppress.join(', '));
    lines.push('              → NONE of these may appear in the emitted components.');
  }
  if (ip.defer.length) {
    lines.push('defer       : ' + ip.defer.join(', '));
    lines.push('              → If emitted, mark visibility="collapsed".');
  }
  if (ip.why_must)     lines.push('why_must    : ' + ip.why_must);
  if (ip.why_suppress) lines.push('why_suppress: ' + ip.why_suppress);
  lines.push('');
  return lines.join('\n');
}

// Legacy entry point used elsewhere (handleConstraintExtract, variants). Left
// as a thin wrapper so we don't break callers that expect the old signature.
function buildGeneratePrompt(prompt, scenario, mode) {
  const constraints = extractConstraints(prompt, scenario, mode);
  const constraintJSON = formatConstraintsForPrompt(constraints);

  return `You are generating semantic UI plans for Samsung One UI screens.

You are NOT a layout engine. You do NOT decide coordinates, x/y/width/height, or spatial structure.
The frontend owns spatial placement via the surface grammar engine. Your job is to propose
SEMANTIC components with a role, the right surfaceType, and content — nothing else.

=== STRICT RULES ===
- Do NOT return absolute pixel coordinates (no x, y, top, left, width, height, position).
- Do NOT invent "card1 / card2 / box3" unnamed roles. Every component.role MUST come from the enum below.
- Do NOT merge bottom-bar and bottom-navigation — they are DIFFERENT roles.
- Do NOT invent app-bar "intermediate" states. Only "expanded" or "collapsed" are allowed.
- Do NOT return "free layout" or generic vertical stacks.
- Do NOT generate more components than the surface actually needs.

Always determine:
  1. surfaceType (one of ALLOWED_SURFACE_TYPES)
  2. user intent (e.g., "browse messages", "inspect product")
  3. content hierarchy (what's the focus block? what's secondary?)
  4. component roles (one per slot, from ALLOWED_ROLES)
  5. role-specific content (title, list items, tabs, placeholder, etc.)
  6. allowed state values (for expandable-app-bar: expanded|collapsed)

One UI structural principles you MUST respect (the engine enforces them; you propose semantics):
- Viewing area and interaction area are distinct.
- Focus-block hierarchy is used for emphasis, not as a generic container.
- Safe side margins are the engine's job.
- Expandable app bar may rest ONLY in "expanded" or "collapsed".

=== ALLOWED_SURFACE_TYPES ===
lockscreen, first-depth-list, second-depth-detail, tab-root,
dialog-bottom, dialog-center, quick-settings, notification-shade, selection-mode

=== ALLOWED_ROLES ===
status-bar, expandable-app-bar, collapsed-app-bar, selection-app-bar, search-bar,
focus-block, focus-block-group, list, detail-content, notification-list,
bottom-navigation, bottom-bar, bottom-dialog, center-dialog,
lock-time, lock-date, lock-shortcuts, quick-settings-panel, background, scrim

=== DESIGN CONSTRAINTS (tokens only — for content/copy guidance) ===
${constraintJSON}
=== END CONSTRAINTS ===

RESPOND with valid JSON in this exact structure:
{
  "sessionId": "<uuid>",
  "layoutTree": {
    "surfaceType": "<one of ALLOWED_SURFACE_TYPES>",
    "intent": "<short user-intent phrase>",
    "hierarchy": "focus-on-list | focus-on-hero | focus-on-dialog | focus-on-chrome",
    "zones": { "topSystem": true, "viewing": true, "interaction": true, "bottomNavigation": true }
  },
  "renderModel": {
    "surfaceType": "<same as layoutTree.surfaceType>",
    "layout": {
      "surfaceType": "<same>",
      "theme": "${mode}",
      "variant": "one-ui"
    },
    "components": [
      {
        "id": "<semantic id e.g. 'app-bar'>",
        "role": "<one of ALLOWED_ROLES>",
        "state": "expanded | collapsed (only for expandable-app-bar)",
        "text": "<optional primary copy>",
        "content": { "title": "...", "items": [...], "tabs": [...], "placeholder": "..." }
      }
    ]
  },
  "critic": {
    "score": <0-100>,
    "issues": [ { "type": "hierarchy|density|consistency|semantic", "message": "..." } ],
    "suggestions": [ "..." ]
  }
}

CONTENT RULES:
- Use role-specific content fields: list → content.items[{title, secondary}], bottom-navigation → content.tabs[], search-bar → content.placeholder.
- App-bar content: content.title required, content.subtitle optional.
- If the surface is lock/dialog/QS/notification, do NOT add a bottom-navigation or bottom-bar unless the surfaceType explicitly expects it.

APP ICON RULE (only when you must inline an icon reference in content):
Use <img src="app-icons/{filename}.png" …>. NEVER emit letter or emoji placeholders.
Valid filenames: Phone.png, Messages.png, Camera.png, Gallery.png, Settings.png, Internet.png, Contacts.png, Clock.png, Calculator.png, Weather.png, Health.png, Bixby.png, Cloud.png, Radio.png, Reminder.png, Studio.png, VoiceRecorder.png, MyFiles.png, DailyBoard.png, DeviceCare.png, DigitalWellbeing.png, SecureWifi.png, SecureFolder.png, Find.png, Notes.png, Pass.png, SmartThings.png, Store.png, Wallet.png, Wearable.png. If an app has no exact asset, pick the closest match.

Your output is the SEMANTIC layer. The renderer owns spatial placement.`;
}

function buildRefineSystemPrompt() {
  return `
You are refining an existing Samsung One UI semantic UI plan.

You must not redesign the whole layout.
You must not invent a new surface type unless explicitly instructed by the user.
You must not return absolute coordinates.
You must not move structure ownership away from the frontend renderer.

Refinement rules:
- Patch by targetRole, not arbitrary freeform layout
- Allowed patch kinds: content, style, state
- Forbidden style properties: x, y, top, left, right, bottom, width, height, position
- Expandable app bar state can only be "expanded" or "collapsed"
- Bottom bar and bottom navigation must remain distinct roles
- Preserve One UI structure: viewing area, interaction area, focus hierarchy

Return strict JSON only in this shape:
{
  "parsedIssue": {
    "type": "hierarchy",
    "severity": "medium",
    "summary": "Search bar is competing with title"
  },
  "patchPlan": {
    "surfaceType": "first-depth-list",
    "patches": [
      {
        "targetRole": "expandable-app-bar",
        "changes": [
          {
            "kind": "content",
            "field": "title",
            "to": "Messages"
          },
          {
            "kind": "style",
            "property": "emphasis",
            "to": "stronger"
          }
        ]
      }
    ]
  },
  "critic": {
    "score": 90,
    "issues": [],
    "suggestions": []
  }
}
`;
}

function buildRefineUserPrompt(payload) {
  const fallbackSurfaceType =
    (payload.currentRenderModel && payload.currentRenderModel.surfaceType) ||
    (payload.currentLayout && payload.currentLayout.surfaceType) ||
    'first-depth-list';

  return `
Current surfaceType: ${fallbackSurfaceType}

User feedback:
${payload.feedback || ''}

Issue tags:
${JSON.stringify(payload.issueTags || [], null, 2)}

Selected nodes:
${JSON.stringify(payload.selectedNodes || [], null, 2)}

Current layout tree:
${JSON.stringify(payload.currentLayout || {}, null, 2)}

Current render model:
${JSON.stringify(payload.currentRenderModel || {}, null, 2)}

Variant context:
${JSON.stringify(payload.variantContext || {}, null, 2)}

Snapshot summary:
${JSON.stringify(payload.snapshot || {}, null, 2)}

Refinement instructions:
- Keep the same surfaceType unless the user explicitly demands a surface change.
- Prefer targetRole-based patches.
- Patch semantics, emphasis, copy, and allowed state values.
- Do not output spatial coordinates.
`;
}

// Legacy single-string builder (kept for callers that still expect it).
function buildRefinePrompt(mode) {
  const constraints = {
    core: CONSTRAINT_FRAGMENTS.core,
    colors: mode === 'light' ? CONSTRAINT_FRAGMENTS.colors_light : CONSTRAINT_FRAGMENTS.colors_dark,
    rules: CONSTRAINT_FRAGMENTS.rules
  };
  const constraintJSON = formatConstraintsForPrompt(constraints);

  return `You are a Samsung One UI design critic. You propose ROLE-BASED patches, not structural rewrites.

You are NOT allowed to redesign the screen. The surface engine owns layout. You may only
patch existing roles (title copy, placeholder text, emphasis, opacity, app-bar state, etc.).

=== STRICT REFINE RULES ===
- Patches MUST target a role (targetRole), not absolute coordinates.
- You MAY change: content (title/text/placeholder/subtitle), semantic style tokens (emphasis/opacity/tone), and expandable-app-bar state.
- You MUST NOT change: surfaceType, x/y/top/left/width/height/position, transforms, or delete/replace structural roles.
- You MUST NOT convert a bottom-navigation into a bottom-bar (or vice versa).
- You MUST NOT invent an app-bar state other than "expanded" or "collapsed".
- You MUST preserve all other roles untouched.

=== ALLOWED patch.kind values ===
content   — replace text/title/placeholder
style     — semantic tokens only (emphasis=stronger|softer, opacity=0.0–1.0, tone=cool|warm)
state     — only for expandable-app-bar (expanded|collapsed)

=== FORBIDDEN patch properties ===
x, y, top, left, right, bottom, width, height, position, transform, translate*

=== ALLOWED_ROLES for targetRole ===
status-bar, expandable-app-bar, collapsed-app-bar, selection-app-bar, search-bar,
focus-block, focus-block-group, list, detail-content, notification-list,
bottom-navigation, bottom-bar, bottom-dialog, center-dialog,
lock-time, lock-date, lock-shortcuts, quick-settings-panel, background, scrim

=== DESIGN CONSTRAINTS (for validation / copy tone) ===
${constraintJSON}
=== END CONSTRAINTS ===

RESPOND with valid JSON:
{
  "parsedIssue": {
    "type": "hierarchy|density|consistency|readability|semantic",
    "severity": "high|medium|low",
    "summary": "short summary of what's wrong"
  },
  "patchPlan": {
    "surfaceType": "<unchanged surfaceType>",
    "patches": [
      {
        "targetRole": "<role from ALLOWED_ROLES>",
        "changes": [
          { "kind": "content", "field": "title|text|placeholder|subtitle", "to": "<new value>" },
          { "kind": "style",   "property": "emphasis|opacity|tone", "to": "<new value>" },
          { "kind": "state",   "to": "expanded|collapsed" }
        ]
      }
    ]
  },
  "updatedLayoutTree": null,
  "updatedRenderModel": null,
  "critic": {
    "score": <0-100>,
    "issues": [ { "type": "...", "message": "..." } ],
    "suggestions": [ "..." ]
  }
}

If the user's feedback implies a structural change (move this below that, make it a different
screen, etc.), you MUST REFUSE by returning an empty patches[] and a parsedIssue.type of
"semantic" explaining that a refine cannot restructure the surface — a new generate is required.`;
}

// ============================================================================
// Surface Grammar Schema — shared contract between server & frontend
// ----------------------------------------------------------------------------
// Server proposes semantic components. Frontend's surface engine owns spatial
// placement. sanitize* functions are the enforcement boundary.
// ============================================================================

const ALLOWED_ROLES = new Set([
  // Structural (surface chrome + containers)
  'status-bar',
  'expandable-app-bar',
  'collapsed-app-bar',
  'selection-app-bar',
  'search-bar',
  'focus-block',
  'focus-block-group',
  'list',
  'list-item',
  'list-top-bar',
  'detail-content',
  'notification-list',
  'bottom-navigation',
  'bottom-bar',
  'bottom-dialog',
  'center-dialog',
  'app-dock',
  'app-grid',
  'app-icon',
  'paragraph',
  'action-row',
  // Lockscreen atomics
  'lock-time',            // legacy alias for lock-clock
  'lock-date',
  'lock-shortcuts',
  'lock-clock',
  'weather-date',
  'lock-indicator',
  'unlock-hint',
  // OneUI 8.5 atomic library — enables AI to pick rich, context-aware
  // components: now-bar for ongoing media/timer/charging, media cards,
  // toggle rows, sliders, etc. Previously the AI couldn't surface any
  // of these because they weren't in its vocabulary.
  'now-bar',
  'media-card',
  'media-half',
  'notif-card',
  'notif-card-ai',
  'toggle-chip',
  'toggle-grid',
  'slider-pill',
  'slider-panel',
  'drag-handle',
  'output-chip',
  'progress-track',
  'control-pill',
  'media-output-row',
  'qs-action-tile',
  'single-toggle',
  'smart-things',
  'selection-dialog',
  'dialog-shell',
  'dialog-site-header',
  'dialog-browser-bar',
  'dialog-icon-grid',
  'quick-settings-panel',
  'background',
  'scrim'
]);

const ALLOWED_SURFACE_TYPES = new Set([
  'lockscreen',
  'first-depth-list',
  'second-depth-detail',
  'tab-root',
  'dialog-bottom',
  'dialog-center',
  'quick-settings',
  'notification-shade',
  'selection-mode'
]);

const ALLOWED_APPBAR_STATES = new Set(['expanded', 'collapsed']);

const ALLOWED_PATCH_KINDS = new Set(['content', 'style', 'state']);

const FORBIDDEN_STYLE_FIELDS = new Set([
  'x', 'y', 'top', 'left', 'right', 'bottom',
  'width', 'height', 'position'
]);

function safeSurfaceType(surfaceType) {
  return ALLOWED_SURFACE_TYPES.has(surfaceType)
    ? surfaceType
    : 'first-depth-list';
}

function sanitizeRenderModel(renderModel) {
  if (!renderModel || typeof renderModel !== 'object') {
    return {
      surfaceType: 'first-depth-list',
      layout: { surfaceType: 'first-depth-list' },
      components: []
    };
  }

  const surfaceType = safeSurfaceType(
    renderModel.surfaceType ||
    (renderModel.layout && renderModel.layout.surfaceType)
  );

  // Roles that only make sense when filled with real content — a
  // focus-block with no title/sub renders the atomic's default
  // placeholder ("Focus block · Important content goes here"), which
  // looks broken on canvas. Drop them rather than let them through.
  const CONTENT_REQUIRED_ROLES = new Set([
    'focus-block', 'focus-block-group', 'paragraph', 'notif-card',
    'notif-card-ai', 'list-item', 'media-card', 'media-half'
  ]);
  function _hasMeaningfulContent(c) {
    if (c.text && c.text.trim().length >= 2) return true;
    const ct = c.content && typeof c.content === 'object' ? c.content : null;
    if (!ct) return false;
    const fields = ['title', 'sub', 'subtitle', 'body', 'value', 'label',
                    'description', 'items'];
    for (const k of fields) {
      const v = ct[k];
      if (typeof v === 'string' && v.trim().length >= 2) return true;
      if (Array.isArray(v) && v.length > 0) return true;
    }
    return false;
  }

  const components = Array.isArray(renderModel.components)
    ? renderModel.components
        .filter(c => c && ALLOWED_ROLES.has(c.role))
        .filter(c => !CONTENT_REQUIRED_ROLES.has(c.role) || _hasMeaningfulContent(c))
        .map((c, idx) => ({
          id: c.id || `comp-${idx + 1}`,
          role: c.role,
          type: c.type || null,
          text: c.text || '',
          content: c.content && typeof c.content === 'object' ? c.content : {},
          variant: c.variant && typeof c.variant === 'object' ? c.variant : null,
          visibility: c.visibility === 'collapsed' || c.visibility === 'hidden'
            ? c.visibility : 'visible',
          html: typeof c.html === 'string' ? c.html : '',
          styles: c.styles && typeof c.styles === 'object' ? c.styles : {},
          state:
            c.role === 'expandable-app-bar' && ALLOWED_APPBAR_STATES.has(c.state)
              ? c.state
              : undefined
        }))
    : [];

  return {
    surfaceType,
    layout: {
      ...(renderModel.layout || {}),
      surfaceType
    },
    components
  };
}

function sanitizePatchPlan(patchPlan, fallbackSurfaceType = 'first-depth-list') {
  if (!patchPlan || typeof patchPlan !== 'object') {
    return {
      surfaceType: safeSurfaceType(fallbackSurfaceType),
      patches: []
    };
  }

  const surfaceType = safeSurfaceType(
    patchPlan.surfaceType || fallbackSurfaceType
  );

  const patches = Array.isArray(patchPlan.patches)
    ? patchPlan.patches.map((patch) => {
        const targetRole = ALLOWED_ROLES.has(patch.targetRole)
          ? patch.targetRole
          : null;

        const changes = Array.isArray(patch.changes)
          ? patch.changes.filter(ch => {
              if (!ch || !ALLOWED_PATCH_KINDS.has(ch.kind)) return false;
              if (ch.kind === 'style' && FORBIDDEN_STYLE_FIELDS.has(ch.property)) return false;
              if (ch.kind === 'state' && ch.to && !ALLOWED_APPBAR_STATES.has(ch.to)) return false;
              return true;
            }).map(ch => ({
              kind: ch.kind,
              field: ch.field || null,
              property: ch.property || null,
              to: ch.to
            }))
          : [];

        return {
          targetRole,
          changes
        };
      }).filter(p => p.targetRole && p.changes.length > 0)
    : [];

  return {
    surfaceType,
    patches
  };
}

// R2 information-priority enforcement. The classifier produced a
// contract of must_show / should_show / suppress / defer CONCEPTS.
// The generator LLM received this contract in its prompt but LLMs
// leak — sometimes they emit a suppressed role anyway. This function
// is the backstop: after sanitization, drop any component whose role
// matches a suppress concept, and mark any component whose role
// matches a defer concept with visibility="collapsed".
function enforceInformationPriority(renderModel, ip) {
  if (!renderModel || !Array.isArray(renderModel.components)) {
    return { renderModel, suppressed: [], deferred: [] };
  }
  if (!ip) return { renderModel, suppressed: [], deferred: [] };

  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const suppressSet = new Set((ip.suppress || []).map(norm));
  const deferSet    = new Set((ip.defer    || []).map(norm));

  // Role ↔ semantic-concept aliases. Classifier emits "app_grid",
  // "promo_banner", "dense_list" etc. — these are concepts, not our
  // internal role names. Map each role to the concepts it fulfills
  // so matching is reliable in both directions.
  const ROLE_CONCEPTS = {
    'app-grid':           ['app_grid', 'grid', 'app_icons', 'launcher_grid'],
    'app-icon':           ['app_grid', 'app_icon', 'grid'],
    'app-dock':           ['app_dock', 'dock'],
    'notif-card':         ['notification_noise', 'unread_badges', 'notifications'],
    'notif-card-ai':      ['notification_noise', 'unread_badges', 'notifications'],
    'list':               ['dense_list', 'raw_list', 'raw_source_list'],
    'notification-list':  ['notification_noise', 'notifications'],
    'focus-block-group':  ['dense_widget_row', 'widget_grid', 'widget_row'],
    'toggle-grid':        ['dense_toggles', 'toggle_grid'],
    'smart-things':       ['iot_controls', 'smart_home'],
    'media-card':         ['full_media_controls', 'playlist_detail', 'media_detail'],
    'selection-dialog':   ['menu_list', 'option_picker'],
    'search-bar':         ['search'],
    'expandable-app-bar': ['app_bar_expanded'],
    'list-top-bar':       ['list_header'],
    'bottom-navigation':  ['bottom_nav', 'navigation_chrome'],
    'bottom-bar':         ['bottom_bar']
  };

  const roleMatchesSet = (role, set) => {
    if (!role) return false;
    if (set.has(norm(role))) return true;
    const aliases = ROLE_CONCEPTS[role] || [];
    return aliases.some(a => set.has(a));
  };

  const kept = [];
  const suppressed = [];
  const deferred = [];
  renderModel.components.forEach(c => {
    if (roleMatchesSet(c.role, suppressSet)) {
      suppressed.push({ id: c.id, role: c.role });
      return;                         // drop
    }
    if (roleMatchesSet(c.role, deferSet)) {
      c.visibility = 'collapsed';
      deferred.push({ id: c.id, role: c.role });
    }
    kept.push(c);
  });
  renderModel.components = kept;
  return { renderModel, suppressed, deferred };
}

function coerceGenerateResponse(modelJson, requestedSurfaceType) {
  modelJson = modelJson || {};
  const renderModel = sanitizeRenderModel({
    ...(modelJson.renderModel || {}),
    surfaceType:
      (modelJson.renderModel && modelJson.renderModel.surfaceType) ||
      (modelJson.layoutTree && modelJson.layoutTree.surfaceType) ||
      requestedSurfaceType
  });

  // If sanitize stripped everything (model violated the role contract), drop
  // to a minimal valid surface template instead of returning an empty frame.
  if (!renderModel.components.length) {
    return fallbackGenerateResponse(renderModel.surfaceType);
  }

  return {
    sessionId: modelJson.sessionId || `sess_${Date.now()}`,
    layoutTree: {
      ...(modelJson.layoutTree || {}),
      surfaceType: renderModel.surfaceType,
      intent: (modelJson.layoutTree && modelJson.layoutTree.intent) || 'generated',
      hierarchy: (modelJson.layoutTree && modelJson.layoutTree.hierarchy) || 'default'
    },
    renderModel,
    critic: {
      score: (modelJson.critic && modelJson.critic.score != null) ? modelJson.critic.score : 80,
      issues: Array.isArray(modelJson.critic && modelJson.critic.issues) ? modelJson.critic.issues : [],
      suggestions: Array.isArray(modelJson.critic && modelJson.critic.suggestions) ? modelJson.critic.suggestions : []
    }
  };
}

function coerceRefineResponse(modelJson, fallbackSurfaceType) {
  modelJson = modelJson || {};
  const patchPlan = sanitizePatchPlan(modelJson.patchPlan, fallbackSurfaceType);

  return {
    parsedIssue: {
      type: (modelJson.parsedIssue && modelJson.parsedIssue.type) || 'refinement',
      severity: (modelJson.parsedIssue && modelJson.parsedIssue.severity) || 'medium',
      summary: (modelJson.parsedIssue && modelJson.parsedIssue.summary) || ''
    },
    patchPlan,
    critic: {
      score: (modelJson.critic && modelJson.critic.score != null) ? modelJson.critic.score : 85,
      issues: Array.isArray(modelJson.critic && modelJson.critic.issues) ? modelJson.critic.issues : [],
      suggestions: Array.isArray(modelJson.critic && modelJson.critic.suggestions) ? modelJson.critic.suggestions : []
    }
  };
}

function fallbackGenerateResponse(surfaceType = 'first-depth-list') {
  const st = safeSurfaceType(surfaceType);
  return {
    sessionId: `sess_${Date.now()}`,
    layoutTree: {
      surfaceType: st,
      intent: 'fallback',
      hierarchy: 'default'
    },
    renderModel: {
      surfaceType: st,
      layout: {
        surfaceType: st,
        theme: 'dark',
        variant: 'one-ui'
      },
      components: [
        { id: 'status-bar', role: 'status-bar' },
        { id: 'app-bar', role: 'expandable-app-bar', state: 'expanded', text: 'Title' },
        { id: 'list', role: 'list' },
        { id: 'bottom-nav', role: 'bottom-navigation' }
      ]
    },
    critic: {
      score: 70,
      issues: [{ type: 'fallback', message: 'Model response was sanitized or defaulted' }],
      suggestions: []
    }
  };
}

// ============================================================================
// Route handlers
// ============================================================================

// Step 1 of 2 — cheap classifier LLM call that picks surfaceType + intent
// from the user prompt. Returns a safe default on any failure, so the main
// generate step can always proceed.
// ============================================================================
//  4+2+1 ORCHESTRATION CLASSIFIER
//  -------------------------------------------------------------------------
//  Replaces the simple surfaceType-only classifier. Returns both:
//    (a) Backward-compat fields — surfaceType, intent, hierarchy, timeOfDay,
//        activity — so existing renderFromModel / surfaceType-driven code
//        keeps working untouched.
//    (b) `orchestration` object — the 4+2+1 decision structure:
//          purpose       : 4 Purpose Types (primary + optional secondary + why)
//          modulationA   : body + environment state that modulates UI density
//          modulationB   : multi-device / handoff state
//          governance    : explanation / autonomy / override triggers
//  The generator step downstream reads (b) to reason about must_show /
//  suppress / continuity BEFORE proposing components. The pipelineOutput
//  client renders (b) as a structured block so every generation explains
//  itself in the log.
// ============================================================================
async function classifyIntent(userPrompt) {
  if (!userPrompt || userPrompt.trim().length < 3) {
    return {
      surfaceType: 'first-depth-list',
      intent: 'default',
      confidence: 0,
      orchestration: null
    };
  }

  const systemPrompt = `
You are the ORCHESTRATION CLASSIFIER for a state-based generative UI system
for Samsung One UI 8.5. You do NOT design screens. You analyze the user's
scenario into a FOUR-PART decision packet that a downstream component
selector uses to reason about what should be shown, suppressed, deferred,
or handed off:

  (1) 4+2+1 classification        — purpose type, modulations, governance
  (2) interpretation layer        — 6 questions about the user's situation
  (3) state packet                — compressed machine-readable decision state
  (4) information priority        — must_show / should_show / suppress / defer

Return STRICT JSON with the following shape:

{
  "surfaceType": "lockscreen | first-depth-list | second-depth-detail | tab-root | dialog-bottom | dialog-center | quick-settings | notification-shade | selection-mode",
  "intent":     "<3-7 word specific phrase derived from prompt>",
  "hierarchy":  "focus-on-list | focus-on-hero | focus-on-dialog | focus-on-chrome",
  "timeOfDay":  "morning | afternoon | evening | night | null",
  "activity":   "<short phrase or null>",

  "orchestration": {
    "purpose": {
      "primary":   "context_reconstruction | flow_continuity | focus_protection | multi_party_coordination",
      "secondary": "<same enum or null>",
      "reasoning": "<one sentence: why this purpose type>"
    },
    "modulationA_body_env": {
      "attention":         "glanceable | focused | distracted",
      "mobility":          "stationary | walking | driving | transit",
      "hands":             "both | one | none | null",
      "interaction":       "touch | voice | mixed | minimal-touch",
      "privacy":           "public | private | mixed | null",
      "time_of_day":       "morning | afternoon | evening | night | null",
      "ambient":           "<short free-form phrase like 'dim night private' or null>"
    },
    "modulationB_multi_device": {
      "device_count":      "single | multi",
      "primary_device":    "phone | tablet | watch | tv | desktop | null",
      "secondary_devices": ["<device>", ...],
      "handoff_required":  true | false,
      "handoff_target":    "<device name or null>",
      "surface_allocation_hint": "<short phrase or null>"
    },
    "governance": {
      "triggers":            [ "high_impact_decision" | "biometric" | "high_autonomy" | "explanation_gap" | "trust_risk" | "social_conflict" ],
      "autonomy_level":      "advise | execute_with_confirm | execute",
      "explanation_needed":  true | false,
      "override_needed":     true | false
    }
  },

  "interpretation": {
    "what_user_doing":        "<one sentence — what is the user literally doing right now>",
    "real_goal":              "<one sentence — what is the REAL underlying goal>",
    "most_lacking":           "time | info | confidence | coordination",
    "what_interferes":        "<one sentence — what is blocking the user>",
    "system_role":            ["show", "reduce", "connect", "decide"],
    "interaction_complexity": "low | medium | high"
  },

  "statePacket": {
    "purpose_type":        "<same enum as orchestration.purpose.primary>",
    "primary_goal":        "<short phrase — the main task to accomplish>",
    "journey_stage":       "entry | active | transition | completion | ambient",
    "urgency":             "low | medium | high",
    "attention_capacity":  "low | medium | high",
    "interaction_budget":  "minimal | normal | rich",
    "coordination_need":   "none | low | medium | high",
    "device_role":         "primary-single | primary-multi | secondary | auxiliary",
    "system_role":         "show | reduce | connect | decide",
    "autonomy_level":      "advise | execute_with_confirm | execute",
    "explanation_needed":  true | false,
    "override_needed":     true | false,
    "privacy_level":       "public | private | mixed | null",
    "handoff_required":    true | false
  },

  "informationPriority": {
    "must_show":   ["<semantic concept — what ABSOLUTELY must appear>", ...],
    "should_show": ["<concept — nice to have>", ...],
    "suppress":    ["<concept — must NOT appear in this context>", ...],
    "defer":       ["<concept — collapse / show on demand, not now>", ...],
    "why_suppress": "<one sentence explaining the core suppressions>",
    "why_must":     "<one sentence explaining the core must_show choices>"
  }
}

== 4 PURPOSE TYPES (pick exactly one as primary) ==
- context_reconstruction (맥락 재구성형)
    흩어진 정보, 기능, 신호를 사용자 목적 중심으로 한 화면/한 흐름으로 재편.
    Signals: "morning brief", "at a glance", "summary", "today's status",
             consolidating multiple data sources into one view.

- flow_continuity (흐름 연속형)
    Intent가 시간/surface/디바이스/상태를 넘어도 끊기지 않도록 이어줌.
    Signals: "continue", "pick up where I left", "handoff", "resume on
             another device", navigating step-to-step in a task.

- focus_protection (몰입 보호형)
    방해를 줄이고 지금 필요한 것만 남기며 나머지는 suppress / defer / collapse.
    Signals: "night", "driving", "do not disturb", "ambient", "minimal",
             "while working", "glanceable", "while doing X".

- multi_party_coordination (다자간 조율형)
    여러 사람 / 여러 목표 / 여러 기기 / 여러 제약의 충돌을 조정하고 정렬.
    Signals: "with my team", "shared", "two people need", "family",
             "meeting", "everyone", "schedule together", conflict
             between parties or intents.

== 2 MODULATION LAYERS (how the purpose is modulated by context) ==
A. Body / Environment
   Directly affects attention_capacity, interaction_budget, complexity
   allowance. Extract EVERY field that the prompt provides.
   If the prompt doesn't mention it, INFER the most likely default
   (e.g. no mention of driving → mobility = stationary).

B. Multi-device
   Affects continuity_path, surface_allocation, handoff_design. If the
   prompt mentions only one device, set device_count = single and
   handoff_required = false.

== 1 GOVERNANCE LAYER ==
Check if the scenario triggers any of:
- high_impact_decision : financial / health / legal / safety
- biometric            : uses or implies fingerprint / face / voice ID
- high_autonomy        : system would act without explicit confirm
- explanation_gap      : user may not understand why the UI appeared
- trust_risk           : wrong action degrades trust or breaks a relationship
- social_conflict      : multi-party coordination with competing goals
If NONE apply, triggers = [].
autonomy_level: default "advise" unless scenario clearly says system
should act.

== INTERPRETATION LAYER ==
Before committing to a state packet, answer these 6 questions honestly.
Keep each answer to ONE sentence. They shape the rest of the packet:

- what_user_doing         : literal description of the moment
- real_goal               : the underlying intent (often different from the literal action)
- most_lacking            : what is the user SHORT on right now — time / info / confidence / coordination
- what_interferes         : what's in the way (attention, noise, device, other people, ambiguity)
- system_role             : one or more of show / reduce / connect / decide
   show    = surface what exists and is relevant
   reduce  = strip noise, keep only what's necessary
   connect = bridge states, surfaces, or people
   decide  = take action on behalf of the user
- interaction_complexity  : how much interaction the user can handle right now

== STATE PACKET ==
A compressed, machine-readable representation of your interpretation.
This is what downstream code reads to make decisions. Keep it tight —
every field should directly drive a UI decision. Align the values with
the interpretation layer (system_role, primary_goal, etc. should not
contradict what you said there).

== INFORMATION PRIORITY (CRITICAL) ==
This is the heart of the packet. Before any components are proposed,
sort the candidate content concepts into 4 buckets:

- must_show   : user cannot accomplish their real_goal without this
- should_show : helps, but not strictly required
- suppress    : would actively harm the user's state (noise, distraction,
                privacy leak, cognitive load). MUST NOT appear.
- defer       : relevant but belongs to a later moment (collapse /
                behind gesture / next screen)

Rules:
- focus_protection          → must_show SHORT (1-2 concepts). Large
                              suppress list (app-grid, promotional,
                              dense lists, badges, non-critical chrome).
- context_reconstruction    → must_show centers on the UNIFIED CONCLUSION
                              (summary cards), suppress raw per-source
                              lists that are covered by the summary.
- flow_continuity           → must_show includes continuity-critical
                              state (current step, next step, session
                              identifier). Suppress anything that breaks
                              the thread.
- multi_party_coordination  → must_show includes conflict visibility +
                              alignment actions. Suppress personal
                              preference UI until coordination resolves.

Use SEMANTIC CONCEPTS here, not role names. Examples of good entries:
  must_show:  ["current_playback_status", "weather_glance", "conflict_summary"]
  suppress:   ["app_grid", "promo_banner", "unread_badges", "raw_source_list"]
  defer:      ["message_history", "full_calendar", "detailed_stats"]

== STRICT RULES ==
- Always return ALL top-level fields (orchestration, interpretation,
  statePacket, informationPriority).
- Never invent enum values outside the allowed sets above.
- If a field is unknowable from the prompt, use null.
- Purpose primary MUST be one of the 4 types.
- The state packet must not contradict the interpretation layer.
- informationPriority MUST reflect the purpose type's policy (see rules above).
- Return JSON only, no prose before or after.

EXAMPLE — "Samsung Galaxy Home at night with music playing"
{
  "surfaceType": "tab-root",
  "intent": "evening ambient home with playback",
  "orchestration": { ... purpose.primary = focus_protection ... },
  "interpretation": {
    "what_user_doing":        "checking phone briefly while music plays in the background at night",
    "real_goal":              "confirm playback is going fine without disrupting the ambient mood",
    "most_lacking":           "confidence",
    "what_interferes":        "low attention, dim light, not actively focused on the screen",
    "system_role":            ["reduce", "show"],
    "interaction_complexity": "low"
  },
  "statePacket": {
    "purpose_type":        "focus_protection",
    "primary_goal":        "glanceable_playback_status",
    "journey_stage":       "ambient",
    "urgency":             "low",
    "attention_capacity":  "low",
    "interaction_budget":  "minimal",
    "coordination_need":   "none",
    "device_role":         "primary-single",
    "system_role":         "reduce",
    "autonomy_level":      "advise",
    "explanation_needed":  false,
    "override_needed":     false,
    "privacy_level":       "private",
    "handoff_required":    false
  },
  "informationPriority": {
    "must_show":   ["current_playback_status", "time"],
    "should_show": ["next_track_hint"],
    "suppress":    ["app_grid", "promo_banner", "unread_badges", "dense_widget_row"],
    "defer":       ["full_media_controls", "playlist_detail"],
    "why_must":    "user needs playback confirmation at a glance — time stays as chrome",
    "why_suppress":"night ambient + low attention forbids dense grids and notification noise"
  }
}`;

  try {
    const result = await callOpenAI(systemPrompt, userPrompt.slice(0, 800), 0.1);
    const allowed = ALLOWED_SURFACE_TYPES;
    const surfaceType = (result && allowed.has(result.surfaceType))
      ? result.surfaceType
      : 'first-depth-list';

    // Normalize orchestration payload (defensive — LLM may omit or partial)
    const orch = (result && result.orchestration) || {};
    const ALLOWED_PURPOSE = new Set([
      'context_reconstruction', 'flow_continuity',
      'focus_protection', 'multi_party_coordination'
    ]);
    const purpose = orch.purpose || {};
    const modA    = orch.modulationA_body_env || {};
    const modB    = orch.modulationB_multi_device || {};
    const gov     = orch.governance || {};
    const normalizedOrch = {
      purpose: {
        primary:   ALLOWED_PURPOSE.has(purpose.primary) ? purpose.primary : 'context_reconstruction',
        secondary: ALLOWED_PURPOSE.has(purpose.secondary) ? purpose.secondary : null,
        reasoning: purpose.reasoning || ''
      },
      modulationA: {
        attention:    modA.attention    || 'focused',
        mobility:     modA.mobility     || 'stationary',
        hands:        modA.hands        || null,
        interaction:  modA.interaction  || 'touch',
        privacy:      modA.privacy      || null,
        time_of_day:  modA.time_of_day  || (result && result.timeOfDay) || null,
        ambient:      modA.ambient      || null
      },
      modulationB: {
        device_count:      (modB.device_count === 'multi') ? 'multi' : 'single',
        primary_device:    modB.primary_device    || 'phone',
        secondary_devices: Array.isArray(modB.secondary_devices) ? modB.secondary_devices : [],
        handoff_required:  !!modB.handoff_required,
        handoff_target:    modB.handoff_target    || null,
        surface_allocation_hint: modB.surface_allocation_hint || null
      },
      governance: {
        triggers:            Array.isArray(gov.triggers) ? gov.triggers : [],
        autonomy_level:      gov.autonomy_level || 'advise',
        explanation_needed:  !!gov.explanation_needed,
        override_needed:     !!gov.override_needed
      }
    };

    // ─── R2: normalize interpretation + state packet + information priority ───
    const interp = (result && result.interpretation) || {};
    const ALLOWED_SYSROLE = new Set(['show', 'reduce', 'connect', 'decide']);
    const sysRoleArr = Array.isArray(interp.system_role) ? interp.system_role : [];
    const normalizedInterpretation = {
      what_user_doing:        interp.what_user_doing        || '',
      real_goal:              interp.real_goal              || '',
      most_lacking:           ['time','info','confidence','coordination'].includes(interp.most_lacking)
                                ? interp.most_lacking : 'info',
      what_interferes:        interp.what_interferes        || '',
      system_role:            sysRoleArr.filter(r => ALLOWED_SYSROLE.has(r)),
      interaction_complexity: ['low','medium','high'].includes(interp.interaction_complexity)
                                ? interp.interaction_complexity : 'medium'
    };

    const sp = (result && result.statePacket) || {};
    const normalizedStatePacket = {
      purpose_type:        ALLOWED_PURPOSE.has(sp.purpose_type) ? sp.purpose_type : normalizedOrch.purpose.primary,
      primary_goal:        sp.primary_goal        || '',
      journey_stage:       ['entry','active','transition','completion','ambient'].includes(sp.journey_stage)
                             ? sp.journey_stage : 'active',
      urgency:             ['low','medium','high'].includes(sp.urgency) ? sp.urgency : 'low',
      attention_capacity:  ['low','medium','high'].includes(sp.attention_capacity)
                             ? sp.attention_capacity : 'medium',
      interaction_budget:  ['minimal','normal','rich'].includes(sp.interaction_budget)
                             ? sp.interaction_budget : 'normal',
      coordination_need:   ['none','low','medium','high'].includes(sp.coordination_need)
                             ? sp.coordination_need : 'none',
      device_role:         sp.device_role   || 'primary-single',
      system_role:         ALLOWED_SYSROLE.has(sp.system_role) ? sp.system_role : 'show',
      autonomy_level:      sp.autonomy_level  || normalizedOrch.governance.autonomy_level,
      explanation_needed:  !!sp.explanation_needed,
      override_needed:     !!sp.override_needed,
      privacy_level:       sp.privacy_level   || normalizedOrch.modulationA.privacy,
      handoff_required:    !!sp.handoff_required
    };

    const ip = (result && result.informationPriority) || {};
    const asStrArray = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim().length > 0) : []);
    const normalizedInformationPriority = {
      must_show:    asStrArray(ip.must_show),
      should_show:  asStrArray(ip.should_show),
      suppress:     asStrArray(ip.suppress),
      defer:        asStrArray(ip.defer),
      why_must:     ip.why_must     || '',
      why_suppress: ip.why_suppress || ''
    };

    return {
      surfaceType: surfaceType,
      intent: (result && result.intent) || 'generated',
      hierarchy: (result && result.hierarchy) || 'focus-on-list',
      timeOfDay: (result && result.timeOfDay) || normalizedOrch.modulationA.time_of_day,
      activity:  (result && result.activity)  || null,
      confidence: result && result.surfaceType ? 1 : 0,
      orchestration:        normalizedOrch,
      interpretation:       normalizedInterpretation,
      statePacket:          normalizedStatePacket,
      informationPriority:  normalizedInformationPriority
    };
  } catch (err) {
    console.warn('  [classify] failed:', err.message, '— falling back to client guess');
    return null;
  }
}

async function handleGenerate(body, res) {
  try {
    const clientGuess = safeSurfaceType(body.surfaceType || 'first-depth-list');

    // ── Step 1: Intent classification (4+2+1 + interpretation + state
    //                                   packet + information priority) ──
    let requestedSurfaceType = clientGuess;
    let intent = null;
    let timeOfDay = null;
    let activity = null;
    let orchestration = null;
    let interpretation = null;
    let statePacket = null;
    let informationPriority = null;
    if (body.prompt && body.prompt.trim().length >= 6) {
      const classification = await classifyIntent(body.prompt);
      if (classification && classification.surfaceType) {
        if (classification.surfaceType !== clientGuess) {
          console.log(`  [classify] client="${clientGuess}" → llm="${classification.surfaceType}" (intent: ${classification.intent})`);
        } else {
          console.log(`  [classify] confirmed "${classification.surfaceType}"`);
        }
        if (classification.orchestration) {
          console.log(`  [4+2+1] purpose=${classification.orchestration.purpose.primary}` +
            (classification.orchestration.purpose.secondary ? ` / ${classification.orchestration.purpose.secondary}` : '') +
            ` · attn=${classification.orchestration.modulationA.attention}` +
            ` · devices=${classification.orchestration.modulationB.device_count}` +
            ` · gov_triggers=${classification.orchestration.governance.triggers.length}`);
        }
        if (classification.informationPriority) {
          const ip = classification.informationPriority;
          console.log(`  [priority] must=${ip.must_show.length}, should=${ip.should_show.length}, suppress=${ip.suppress.length}, defer=${ip.defer.length}`);
        }
        requestedSurfaceType = classification.surfaceType;
        intent = classification.intent;
        timeOfDay = classification.timeOfDay;
        activity  = classification.activity;
        orchestration       = classification.orchestration      || null;
        interpretation      = classification.interpretation     || null;
        statePacket         = classification.statePacket        || null;
        informationPriority = classification.informationPriority || null;
      }
    }

    // ── Step 2: Generate the screen with the classified surfaceType ──
    const systemPrompt = buildGenerateSystemPrompt();
    const userPrompt = buildGenerateUserPrompt({
      ...body,
      surfaceType: requestedSurfaceType,
      intent: intent,
      timeOfDay: timeOfDay,
      activity:  activity,
      orchestration: orchestration,
      interpretation: interpretation,
      statePacket: statePacket,
      informationPriority: informationPriority
    });

    const promptSize = ((systemPrompt.length + userPrompt.length) / 1024).toFixed(1);
    console.log(`  [surface-grammar] ${promptSize}KB prompt (surfaceType: ${requestedSurfaceType})`);

    const modelJson = await callOpenAI(systemPrompt, userPrompt, 0.6);

    const beforeCount = Array.isArray(modelJson.renderModel && modelJson.renderModel.components)
      ? modelJson.renderModel.components.length : 0;

    // coerce handles sanitize + empty→fallback internally
    const response = coerceGenerateResponse(modelJson, requestedSurfaceType);

    const afterCount = response.renderModel.components.length;
    if (beforeCount !== afterCount) {
      console.log(`  [sanitize:generate] ${beforeCount} → ${afterCount} components (contract-enforced)`);
    }

    // Attach the classifier's intent to the layoutTree so clients can show it
    if (intent && response.layoutTree && !response.layoutTree.intent) {
      response.layoutTree.intent = intent;
    }

    // R2: enforce suppress / defer contract on non-stream path too
    if (informationPriority && response.renderModel) {
      const enforced = enforceInformationPriority(response.renderModel, informationPriority);
      if (enforced.suppressed.length) {
        console.log(`  [enforce] SUPPRESSED ${enforced.suppressed.length}: ` +
          enforced.suppressed.map(x => x.role).join(', '));
      }
      if (enforced.deferred.length) {
        console.log(`  [enforce] DEFERRED ${enforced.deferred.length}: ` +
          enforced.deferred.map(x => x.role).join(', '));
      }
    }

    // Attach the full decision packet to the layoutTree for caching / inspection.
    if (response.layoutTree) {
      if (orchestration)       response.layoutTree.orchestration       = orchestration;
      if (interpretation)      response.layoutTree.interpretation      = interpretation;
      if (statePacket)         response.layoutTree.statePacket         = statePacket;
      if (informationPriority) response.layoutTree.informationPriority = informationPriority;
    }

    sendJSON(res, 200, response);
  } catch (err) {
    console.error('[agent/generate]', err.message);
    sendJSON(res, 500, { error: err.message || 'Generate failed' });
  }
}

// ============================================================================
//  Streaming Generate — SSE endpoint
// ----------------------------------------------------------------------------
//  Event sequence:
//    event: classified   data: { surfaceType, intent, hierarchy }
//    event: component    data: { id, role, content, ... }     (×N progressive)
//    event: done         data: { sessionId, layoutTree, renderModel, critic }
//    event: error        data: { message }
// ============================================================================
async function handleGenerateStream(body, req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  function emit(event, data) {
    res.write('event: ' + event + '\n');
    res.write('data: ' + JSON.stringify(data) + '\n\n');
  }

  req.on('close', () => { /* client disconnected mid-stream */ });

  try {
    const clientGuess = safeSurfaceType(body.surfaceType || 'first-depth-list');

    // ── Step 1: classify (4+2+1 orchestration + interpretation + state
    //                     packet + information priority) ──
    let surfaceType = clientGuess;
    let intent = null;
    let hierarchy = null;
    let timeOfDay = null;
    let activity = null;
    let orchestration = null;
    let interpretation = null;
    let statePacket = null;
    let informationPriority = null;
    if (body.prompt && body.prompt.trim().length >= 6) {
      const classification = await classifyIntent(body.prompt);
      if (classification && classification.surfaceType) {
        surfaceType         = classification.surfaceType;
        intent              = classification.intent;
        hierarchy           = classification.hierarchy;
        timeOfDay           = classification.timeOfDay;
        activity            = classification.activity;
        orchestration       = classification.orchestration      || null;
        interpretation      = classification.interpretation     || null;
        statePacket         = classification.statePacket        || null;
        informationPriority = classification.informationPriority || null;
        if (orchestration) {
          console.log(`  [stream/4+2+1] purpose=${orchestration.purpose.primary}` +
            ` · attn=${orchestration.modulationA.attention}` +
            ` · devices=${orchestration.modulationB.device_count}`);
        }
        if (informationPriority) {
          console.log(`  [stream/priority] must=${informationPriority.must_show.length}, ` +
            `should=${informationPriority.should_show.length}, ` +
            `suppress=${informationPriority.suppress.length}, ` +
            `defer=${informationPriority.defer.length}`);
        }
      }
    }
    // Emit the full orchestration decision packet (classification +
    // interpretation + state packet + information priority) so the
    // client log can render each layer explicitly and the generator
    // step downstream can consume them.
    emit('classified', {
      surfaceType, intent, hierarchy, timeOfDay, activity,
      orchestration, interpretation, statePacket, informationPriority
    });

    // ── Step 2: stream generate ──
    const systemPrompt = buildGenerateSystemPrompt();
    const userPrompt = buildGenerateUserPrompt({
      ...body, surfaceType, intent, timeOfDay, activity,
      orchestration, interpretation, statePacket, informationPriority
    });

    console.log(`  [stream] generate surfaceType=${surfaceType}`);

    let emittedCount = 0;
    let lastEmitTime = 0;
    const fullJson = await callOpenAIStream(systemPrompt, userPrompt, 0.6, (delta, fullText) => {
      // Throttle parsing to ~every 60ms to keep CPU low
      const now = Date.now();
      if (now - lastEmitTime < 60) return;
      lastEmitTime = now;

      const newComps = extractStreamedComponents(fullText, emittedCount);
      newComps.forEach(comp => {
        if (comp && comp.role && ALLOWED_ROLES.has(comp.role)) {
          emit('component', comp);
        }
        emittedCount++;
      });
    });

    // Final pass — pick up any components missed by the throttled parser
    const remaining = extractStreamedComponents(JSON.stringify(fullJson), emittedCount);
    remaining.forEach(comp => {
      if (comp && comp.role && ALLOWED_ROLES.has(comp.role)) emit('component', comp);
      emittedCount++;
    });

    const response = coerceGenerateResponse(fullJson, surfaceType);
    if (intent && response.layoutTree && !response.layoutTree.intent) {
      response.layoutTree.intent = intent;
    }

    // R2: enforce the information priority contract. If the generator
    // slipped in any role that matches a suppress concept, strip it.
    // Mark defer matches with visibility:"collapsed".
    if (informationPriority && response.renderModel) {
      const enforced = enforceInformationPriority(response.renderModel, informationPriority);
      if (enforced.suppressed.length) {
        console.log(`  [enforce/stream] SUPPRESSED ${enforced.suppressed.length}: ` +
          enforced.suppressed.map(x => x.role).join(', '));
      }
      if (enforced.deferred.length) {
        console.log(`  [enforce/stream] DEFERRED ${enforced.deferred.length}: ` +
          enforced.deferred.map(x => x.role).join(', '));
      }
    }

    // Attach the full decision packet to the layoutTree so it persists
    // in cached responses — when a client replays from the LRU cache,
    // the synthetic `classified` event still renders every layer block.
    if (response.layoutTree) {
      if (orchestration)       response.layoutTree.orchestration       = orchestration;
      if (interpretation)      response.layoutTree.interpretation      = interpretation;
      if (statePacket)         response.layoutTree.statePacket         = statePacket;
      if (informationPriority) response.layoutTree.informationPriority = informationPriority;
    }

    emit('done', response);
  } catch (err) {
    console.error('[agent/generate/stream]', err.message);
    emit('error', { message: err.message || 'Stream failed' });
  } finally {
    res.end();
  }
}

async function handleRefine(body, res) {
  const fallbackSurface = safeSurfaceType(
    (body.currentRenderModel && body.currentRenderModel.surfaceType) ||
    (body.currentLayout && body.currentLayout.surfaceType) ||
    'first-depth-list'
  );

  try {
    const systemPrompt = buildRefineSystemPrompt();
    const userPrompt = buildRefineUserPrompt(body);

    const promptSize = ((systemPrompt.length + userPrompt.length) / 1024).toFixed(1);
    console.log(`  [surface-grammar] ${promptSize}KB refine prompt (surfaceType: ${fallbackSurface})`);

    const modelJson = await callOpenAI(systemPrompt, userPrompt, 0.4);
    const response = coerceRefineResponse(modelJson, fallbackSurface);

    const beforePatches = Array.isArray(modelJson.patchPlan && modelJson.patchPlan.patches)
      ? modelJson.patchPlan.patches.length : 0;
    const afterPatches = response.patchPlan.patches.length;
    if (beforePatches !== afterPatches) {
      console.log(`  [sanitize:refine] dropped ${beforePatches - afterPatches} patches (non-role or forbidden props)`);
    }

    sendJSON(res, 200, {
      parsedIssue: response.parsedIssue,
      patchPlan: response.patchPlan,
      updatedLayoutTree: {
        ...(body.currentLayout || {}),
        surfaceType: response.patchPlan.surfaceType
      },
      updatedRenderModel: sanitizeRenderModel({
        ...(body.currentRenderModel || {}),
        surfaceType: response.patchPlan.surfaceType
      }),
      critic: response.critic
    });
  } catch (err) {
    console.error('[agent/refine]', err.message);
    sendJSON(res, 500, { error: err.message || 'Refine failed' });
  }
}

// ============================================================================
//  Critic — evaluates semantic correctness only, never redesigns
// ============================================================================

function buildCriticSystemPrompt() {
  return `
You are a UI critic for Samsung One UI semantic surfaces.

Do not redesign.
Do not output coordinates.

Evaluate:
- hierarchy
- clarity
- role correctness
- One UI consistency
- action vs navigation separation
- app bar state consistency

Return strict JSON only:
{
  "score": 84,
  "issues": [
    { "type": "hierarchy", "message": "Search bar competes with title" }
  ],
  "suggestions": [
    "Strengthen app bar emphasis",
    "Reduce search bar prominence"
  ]
}
`;
}

function buildCriticUserPrompt(payload) {
  const surfaceType =
    (payload.renderModel && payload.renderModel.surfaceType) ||
    (payload.layoutTree && payload.layoutTree.surfaceType) ||
    'first-depth-list';

  return `
Surface type:
${surfaceType}

Layout tree:
${JSON.stringify(payload.layoutTree || {}, null, 2)}

Render model:
${JSON.stringify(payload.renderModel || {}, null, 2)}

Please critique the semantic correctness and One UI consistency only.
`;
}

async function handleCritic(body, res) {
  try {
    const systemPrompt = buildCriticSystemPrompt();
    const userPrompt = buildCriticUserPrompt(body);

    const modelJson = await callOpenAI(systemPrompt, userPrompt, 0.3);

    sendJSON(res, 200, {
      score: (modelJson && modelJson.score != null) ? modelJson.score : 80,
      issues: Array.isArray(modelJson && modelJson.issues) ? modelJson.issues : [],
      suggestions: Array.isArray(modelJson && modelJson.suggestions) ? modelJson.suggestions : []
    });
  } catch (err) {
    console.error('[agent/critic]', err.message);
    sendJSON(res, 500, { error: err.message || 'Critic failed' });
  }
}

// --- New: constraint extraction endpoint (for frontend debug/inspect) ---
function handleConstraintExtract(body, res) {
  const constraints = extractConstraints(body.prompt, body.scenario, body.mode || 'dark');
  const size = JSON.stringify(constraints).length;
  sendJSON(res, 200, {
    scenario: _detectScenario(body.prompt || body.scenario),
    constraintSize: `${(size / 1024).toFixed(1)}KB`,
    fullDocSize: `${((DESIGN_MD_RAW.length + GENUI_MD_RAW.length + ORCH_MD_RAW.length) / 1024).toFixed(1)}KB`,
    sources: { designMd: `${(DESIGN_MD_RAW.length / 1024).toFixed(1)}KB`, genuiMd: `${(GENUI_MD_RAW.length / 1024).toFixed(1)}KB`, orchMd: `${(ORCH_MD_RAW.length / 1024).toFixed(1)}KB` },
    compressionRatio: `${((1 - size / (DESIGN_MD_RAW.length + GENUI_MD_RAW.length + ORCH_MD_RAW.length)) * 100).toFixed(0)}%`,
    constraints
  });
}

// ============================================================================
// Variant Session Storage — prompt + result per variant
// ============================================================================
// In-memory store (per session). Refine endpoint reads this for full context.
const variantStore = {};  // { sessionId: { A: {prompt, scenario, html, critic}, B: {...} } }

function handleVariantSync(body, res) {
  const sid = body.sessionId || 'default';
  variantStore[sid] = body.variants || {};
  const aPrompt = body.variants?.A?.prompt || '';
  const bPrompt = body.variants?.B?.prompt || '';
  console.log(`  [variants] Session ${sid}: A="${aPrompt.substring(0, 40)}" B="${bPrompt.substring(0, 40)}"`);
  sendJSON(res, 200, { success: true, sessionId: sid });
}

function getVariantContext(sessionId) {
  return variantStore[sessionId || 'default'] || {};
}

// ============================================================================
// HTTP helpers
// ============================================================================

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

function serveStatic(filePath, res) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

// ============================================================================
// Server
// ============================================================================

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const url = req.url.split('?')[0];

  // ── genui_pipeline_v1 endpoints ─────────────────────────────────────────
  //
  //   POST /api/pipeline/plan     → steps 1 → 2 → 3 + plan validation
  //   POST /api/pipeline/compose  → + step 4 (LLM composer) + layout validation
  //   POST /api/pipeline/full     → + step 7 (explanation)
  //
  // All endpoints emit the canonical camelCase contract:
  //   { interpretation, planningPacket, plan, uiState, layoutPlan?,
  //     composerNotes?, explanation?, validation: { summary, violations[] } }
  // ------------------------------------------------------------------------

  if (url === '/api/pipeline/plan' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const scenarioText = body.scenario_text || body.prompt || '';

      const planResult = await pipeline.runPlan({
        scenarioText,
        llmCall: (sys, user) => callOpenAI(sys, user, 0.3)
      });

      const validation = pipeline.rollupValidationResults({
        planViolations:   planResult.planViolations,
        layoutViolations: []
      });

      console.log(`[Pipeline] plan for "${scenarioText.substring(0,50)}" → ${planResult.plan.requiredComponents.length} components, violations:${validation.summary.total}`);
      sendJSON(res, 200, {
        interpretation: planResult.interpretation,
        planningPacket: planResult.planningPacket,
        plan:           planResult.plan,
        uiState:        planResult.uiState,
        validation
      });
    } catch (e) {
      console.error('[Pipeline] plan error:', e.message);
      sendJSON(res, 500, { error: e.message });
    }
    return;
  }

  if (url === '/api/pipeline/compose' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const scenarioText = body.scenario_text || body.prompt || '';
      const viewport     = body.viewport || null;

      const planResult = await pipeline.runPlan({
        scenarioText,
        llmCall: (sys, user) => callOpenAI(sys, user, 0.3)
      });

      const layoutResult = await pipeline.runComposeLayout({
        planningPacket: planResult.planningPacket,
        plan:           planResult.plan,
        llmCall:        (sys, user) => callOpenAI(sys, user, 0.3),
        viewport
      });

      const validation = pipeline.rollupValidationResults({
        planViolations:   planResult.planViolations,
        layoutViolations: layoutResult.violations
      });

      console.log(`[Pipeline] compose for "${scenarioText.substring(0,50)}" → groups:${layoutResult.composed.layoutPlan.groups.length} violations:${validation.summary.total}`);
      sendJSON(res, 200, {
        interpretation: planResult.interpretation,
        planningPacket: planResult.planningPacket,
        plan:           planResult.plan,
        uiState:        planResult.uiState,
        layoutPlan:     layoutResult.composed.layoutPlan,
        composerNotes:  layoutResult.composed.composerNotes,
        validation
      });
    } catch (e) {
      console.error('[Pipeline] compose error:', e.message);
      sendJSON(res, 500, { error: e.message });
    }
    return;
  }

  // Streaming variant of /api/pipeline/full. Emits one SSE event per
  // step so the client can see EXACTLY where the pipeline stalls or
  // fails, along with the JSON output each step produced. Events:
  //   event: step_started   data: { step, label, idx, total }
  //   event: step_done      data: { step, output, elapsedMs, idx, total }
  //   event: done           data: { /* full bundled result */ }
  //   event: error          data: { step, message, elapsedMs }
  if (url === '/api/pipeline/full/stream' && req.method === 'POST') {
    const _body = await readBody(req);
    const _scenarioText = _body.scenario_text || _body.prompt || '';
    const _viewport     = _body.viewport || null;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    function emit(event, data) {
      res.write('event: ' + event + '\n');
      res.write('data: ' + JSON.stringify(data) + '\n\n');
    }

    const STEPS = [
      { id: 'plan',     label: 'interpret \u2192 ui_state \u2192 plan (steps 1-3)' },
      { id: 'compose',  label: 'LLM layout composer (step 4)' },
      { id: 'validate', label: 'Rollup validation (step 5)' },
      { id: 'explain',  label: 'Explanation layer (step 7)' }
    ];
    const TOTAL = STEPS.length;
    let currentStep = null;
    let stepT0 = 0;

    function startStep(idx) {
      currentStep = STEPS[idx];
      stepT0 = Date.now();
      emit('step_started', {
        step:  currentStep.id,
        label: currentStep.label,
        idx:   idx + 1,
        total: TOTAL
      });
    }
    function doneStep(idx, output) {
      emit('step_done', {
        step:      STEPS[idx].id,
        output:    output,
        elapsedMs: Date.now() - stepT0,
        idx:       idx + 1,
        total:     TOTAL
      });
    }

    try {
      // Step 1: plan (interpret + normalize + select)
      startStep(0);
      const planResult = await pipeline.runPlan({
        scenarioText: _scenarioText,
        llmCall: (sys, user) => callOpenAI(sys, user, 0.3)
      });
      doneStep(0, {
        interpretation:  planResult.interpretation,
        planningPacket:  planResult.planningPacket,
        plan:            planResult.plan,
        uiState:         planResult.uiState,
        planViolations:  planResult.planViolations
      });

      // Step 2: compose (LLM layout composer)
      startStep(1);
      const layoutResult = await pipeline.runComposeLayout({
        planningPacket: planResult.planningPacket,
        plan:           planResult.plan,
        llmCall:        (sys, user) => callOpenAI(sys, user, 0.3),
        viewport:       _viewport
      });
      doneStep(1, {
        layoutPlan:       layoutResult.composed.layoutPlan,
        composerNotes:    layoutResult.composed.composerNotes,
        layoutViolations: layoutResult.violations
      });

      // Step 3: validate (rollup)
      startStep(2);
      const validation = pipeline.rollupValidationResults({
        planViolations:   planResult.planViolations,
        layoutViolations: layoutResult.violations
      });
      doneStep(2, validation);

      // Step 4: explain
      startStep(3);
      const explanation = await pipeline.runExplain({
        scenarioText:     _scenarioText,
        uiState:          planResult.uiState,
        plan:             planResult.plan,
        layoutPlan:       layoutResult.composed.layoutPlan,
        validationReport: validation,
        llmCall:          (sys, user) => callOpenAI(sys, user, 0.4)
      });
      doneStep(3, explanation);

      // Final bundled result (same shape as /api/pipeline/full)
      emit('done', {
        interpretation: planResult.interpretation,
        planningPacket: planResult.planningPacket,
        plan:           planResult.plan,
        uiState:        planResult.uiState,
        layoutPlan:     layoutResult.composed.layoutPlan,
        composerNotes:  layoutResult.composed.composerNotes,
        explanation,
        validation
      });
      console.log(`[Pipeline/stream] full for "${_scenarioText.substring(0,50)}" → groups:${layoutResult.composed.layoutPlan.groups.length} violations:${validation.summary.total}`);
    } catch (err) {
      const elapsed = Date.now() - stepT0;
      console.error('[Pipeline/stream]', (currentStep ? currentStep.id : 'init'), err.message);
      emit('error', {
        step: currentStep ? currentStep.id : 'init',
        message: err.message || 'Pipeline failed',
        elapsedMs: elapsed
      });
    } finally {
      res.end();
    }
    return;
  }

  if (url === '/api/pipeline/full' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const scenarioText = body.scenario_text || body.prompt || '';
      const viewport     = body.viewport || null;

      const planResult = await pipeline.runPlan({
        scenarioText,
        llmCall: (sys, user) => callOpenAI(sys, user, 0.3)
      });

      const layoutResult = await pipeline.runComposeLayout({
        planningPacket: planResult.planningPacket,
        plan:           planResult.plan,
        llmCall:        (sys, user) => callOpenAI(sys, user, 0.3),
        viewport
      });

      const validation = pipeline.rollupValidationResults({
        planViolations:   planResult.planViolations,
        layoutViolations: layoutResult.violations
      });

      const explanation = await pipeline.runExplain({
        scenarioText,
        uiState:          planResult.uiState,
        plan:             planResult.plan,
        layoutPlan:       layoutResult.composed.layoutPlan,
        validationReport: validation,
        llmCall:          (sys, user) => callOpenAI(sys, user, 0.4)
      });

      console.log(`[Pipeline] full for "${scenarioText.substring(0,50)}" → groups:${layoutResult.composed.layoutPlan.groups.length} violations:${validation.summary.total} explained:${!!explanation}`);
      sendJSON(res, 200, {
        interpretation: planResult.interpretation,
        planningPacket: planResult.planningPacket,
        plan:           planResult.plan,
        uiState:        planResult.uiState,
        layoutPlan:     layoutResult.composed.layoutPlan,
        composerNotes:  layoutResult.composed.composerNotes,
        explanation,
        validation
      });
    } catch (e) {
      console.error('[Pipeline] full error:', e.message);
      sendJSON(res, 500, { error: e.message });
    }
    return;
  }

  // API routes
  if (url === '/api/agent/generate' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      console.log(`[API] Generate: "${body.prompt || body.scenario || '?'}"`);
      await handleGenerate(body, res);
    } catch (e) {
      console.error('[API] Generate error:', e.message);
      sendJSON(res, 500, { error: e.message });
    }
    return;
  }

  // Streaming generate (SSE)
  if (url === '/api/agent/generate/stream' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      console.log(`[API] Generate (stream): "${(body.prompt || body.scenario || '?').substring(0, 60)}"`);
      await handleGenerateStream(body, req, res);
    } catch (e) {
      console.error('[API] Stream error:', e.message);
      // If res hasn't been written to yet, send JSON error; otherwise just end
      try { sendJSON(res, 500, { error: e.message }); }
      catch (_) { try { res.end(); } catch(__) {} }
    }
    return;
  }

  if (url === '/api/agent/refine' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      console.log(`[API] Refine: "${(body.feedback || '').substring(0, 60)}"`);
      await handleRefine(body, res);
    } catch (e) {
      console.error('[API] Refine error:', e.message);
      sendJSON(res, 500, { error: e.message });
    }
    return;
  }

  if (url === '/api/agent/critic' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      console.log(`[API] Critic: surfaceType=${(body.renderModel && body.renderModel.surfaceType) || 'unknown'}`);
      await handleCritic(body, res);
    } catch (e) {
      console.error('[API] Critic error:', e.message);
      sendJSON(res, 500, { error: e.message });
    }
    return;
  }

  // Variant sync endpoint — store prompt+result per variant
  if (url === '/api/agent/variants' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      handleVariantSync(body, res);
    } catch (e) {
      sendJSON(res, 500, { error: e.message });
    }
    return;
  }

  // Variant read endpoint
  if (url === '/api/agent/variants' && req.method === 'GET') {
    const sid = (req.url.split('?')[1] || '').split('sessionId=')[1] || 'default';
    sendJSON(res, 200, { sessionId: sid, variants: getVariantContext(sid) });
    return;
  }

  // Debug endpoint — inspect extracted constraints for any prompt
  if (url === '/api/agent/constraints' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      handleConstraintExtract(body, res);
    } catch (e) {
      sendJSON(res, 500, { error: e.message });
    }
    return;
  }

  // Evolve: save a refinement issue
  if (url === '/api/agent/evolve' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const result = appendEvolveEntry(body);
      EVOLVE_CONSTRAINTS = loadEvolveConstraints();
      console.log(`[Evolve] Saved ${result.id}: "${(body.title || '').substring(0, 50)}" → ${EVOLVE_CONSTRAINTS ? EVOLVE_CONSTRAINTS.length : 0} total constraints`);
      sendJSON(res, 200, { ...result, totalConstraints: EVOLVE_CONSTRAINTS ? EVOLVE_CONSTRAINTS.length : 0 });
    } catch (e) {
      console.error('[Evolve] Error:', e.message);
      sendJSON(res, 500, { error: e.message });
    }
    return;
  }

  // Evolve: read all entries
  if (url === '/api/agent/evolve' && req.method === 'GET') {
    EVOLVE_CONSTRAINTS = loadEvolveConstraints();
    sendJSON(res, 200, {
      entries: EVOLVE_CONSTRAINTS || [],
      count: EVOLVE_CONSTRAINTS ? EVOLVE_CONSTRAINTS.length : 0
    });
    return;
  }

  if (url === '/api/agent/health') {
    EVOLVE_CONSTRAINTS = loadEvolveConstraints();
    sendJSON(res, 200, {
      status: 'ok',
      model: OPENAI_MODEL,
      mode: 'surface-grammar',
      designKB: {
        mode: 'surface-grammar',
        designSections: Object.keys(DESIGN_SECTIONS).length,
        genuiSections: Object.keys(GENUI_SECTIONS).length,
        orchSections: Object.keys(ORCH_SECTIONS).length,
        evolveEntries: EVOLVE_CONSTRAINTS ? EVOLVE_CONSTRAINTS.length : 0,
        rawSize: `${((DESIGN_MD_RAW.length + GENUI_MD_RAW.length + ORCH_MD_RAW.length) / 1024).toFixed(1)}KB`,
        constraintFragments: Object.keys(CONSTRAINT_FRAGMENTS).length,
        sourceMode: 'constraint-extraction (DESIGN.md + GENUI-PRINCIPLES.md + ORCHESTRATION.md + evolve.md)'
      }
    });
    return;
  }

  // Static files — decode percent-encoded URLs so non-ASCII filenames (e.g.
  // Korean app-icons like Phone.png → %EC%A0%84%ED%99%94.png) resolve correctly.
  let decodedUrl;
  try { decodedUrl = decodeURIComponent(url); }
  catch (e) { decodedUrl = url; }
  let filePath = path.join(__dirname, decodedUrl === '/' ? 'genui.html' : decodedUrl);
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not Found'); return; }
  if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  serveStatic(filePath, res);
});

server.listen(PORT, () => {
  console.log('');
  console.log(`  \x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
  console.log(`  \x1b[1m  Samsung GenUI + AI Agent Server\x1b[0m`);
  console.log(`  \x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
  console.log(`  \x1b[32m✓\x1b[0m Running on  http://localhost:${PORT}`);
  console.log(`  \x1b[32m✓\x1b[0m Model       ${OPENAI_MODEL}`);
  console.log(`  \x1b[32m✓\x1b[0m API Key     ${OPENAI_API_KEY.substring(0, 7)}...${OPENAI_API_KEY.slice(-4)}`);
  console.log(`  \x1b[32m✓\x1b[0m Design KB   constraint-extraction mode`);
  console.log(`  \x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
  console.log('');
});
