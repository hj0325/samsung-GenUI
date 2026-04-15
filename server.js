const http = require('http');
const fs = require('fs');
const path = require('path');
const pipeline = require('./pipeline');           // genui_pipeline_v1 step_1 + step_3
const UIState = require('./ui-state.js') || (global.UIState);  // step_2 resolver (Node CJS export)
const composer = require('./layout_composer');    // genui_pipeline_v1 step_5 + pipeline validators

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
      '전화.png','메시지.png','카메라.png','갤러리.png','설정.png','인터넷.png','연락처.png','시계.png','계산기.png','날씨.png','헬스.png','빅스비.png','클라우드.png','라디오.png','리마인더.png','스튜디오.png','음성 녹음.png','내 파일.png','데일리 보드.png','디바이스 케어_.png','디지털 웰빙.png','보안 Wi-fi.png','보안 폴더.png',
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
// System Prompt Builders (constraint-driven, NOT raw document injection)
// ============================================================================

function buildGeneratePrompt(prompt, scenario, mode) {
  const constraints = extractConstraints(prompt, scenario, mode);
  const constraintJSON = formatConstraintsForPrompt(constraints);

  return `You are a Samsung One UI 8.5 design system expert. You generate mobile UI layouts as structured JSON.

=== DESIGN CONSTRAINTS (extracted from Samsung One UI 8.5 Design System) ===
${constraintJSON}
=== END CONSTRAINTS ===

Apply these constraints precisely. Do NOT invent new tokens — use only the values above.

AVAILABLE COMPONENT TYPES (use these exact type strings):
btn-contained, btn-outlined, btn-flat, fab, switch, checkbox, radio, chip, input, search,
appbar, bottomnav, pill-tab, tab-bar, card, list-item, dialog, snackbar, divider, badge,
status-bar, now-bar, qs-toggle, qs-grid, media-card, notification-card, widget-small, keyboard

For complex custom components, use type:"custom" with inline HTML.

RESPOND with valid JSON in this exact structure:
{
  "sessionId": "<uuid>",
  "layoutTree": {
    "type": "screen",
    "surface": "<scenario name>",
    "children": [ { "id": "item-1", "type": "<component-type>", "role": "gen|static", "text": "..." } ]
  },
  "renderModel": {
    "layout": { "align": "stretch", "gap": <number>, "padding": "<css padding>" },
    "components": [
      {
        "id": "item-1",
        "type": "<component-type or custom>",
        "role": "gen|static",
        "text": "optional override text",
        "html": "only if type is custom - full inner HTML string",
        "motion": "fadeIn|slideUp|scaleUp",
        "delay": <ms>,
        "fullWidth": true
      }
    ]
  },
  "critic": {
    "score": <0-100>,
    "issues": [ { "type": "spacing|hierarchy|density|alignment|consistency", "message": "..." } ],
    "suggestions": [ "..." ]
  }
}

DESIGN RULES:
- Every screen starts with a status-bar (static, fadeIn, delay:0)
- Use appbar for navigation header (static)
- Use bottomnav or pill-tab for bottom navigation (static)
- Content components are "gen" role, chrome/navigation are "static" role
- Gap 0 for edge-to-edge screens, 8-16 for padded content
- Padding: "0" for full bleed, "16px" for standard, "28px 0 0" for lockscreen-style
- Use proper motion stagger: static elements first (delay 0-40ms), gen elements after (100-400ms)
- For custom HTML, use inline styles with CSS variables: var(--primary), var(--text), var(--text-2), var(--text-3), var(--surface), var(--surface-2), var(--divider)
- Create realistic, production-quality screens with proper content (not placeholder text)
- Include 8-15 components per screen for a complete feel
- APP ICONS: every app/shortcut MUST render as <img src="app-icons/{filename}.png" style="width:WIDTHpx;height:HEIGHTpx;border-radius:Rpx;">. NEVER emit letter/initial placeholders like <div>G</div>, coloured squares with a single capital, or emoji glyphs in place of an icon. Valid filenames (Korean filenames are URL-encoded automatically): 전화.png, 메시지.png, 카메라.png, 갤러리.png, 설정.png, 인터넷.png, 연락처.png, 시계.png, 계산기.png, 날씨.png, 헬스.png, 빅스비.png, 클라우드.png, 라디오.png, 리마인더.png, 스튜디오.png, 음성 녹음.png, 내 파일.png, 데일리 보드.png, 디바이스 케어_.png, 디지털 웰빙.png, 보안 Wi-fi.png, 보안 폴더.png, Find.png, Notes.png, Pass.png, SmartThings.png, Store.png, Wallet.png, Wearable.png. If an app has no exact asset, pick the closest match from this list.`;
}

function buildRefinePrompt(mode) {
  // Refinement reuses ONLY core tokens + rules — no full document reload
  const constraints = {
    core: CONSTRAINT_FRAGMENTS.core,
    colors: mode === 'light' ? CONSTRAINT_FRAGMENTS.colors_light : CONSTRAINT_FRAGMENTS.colors_dark,
    rules: CONSTRAINT_FRAGMENTS.rules
  };
  const constraintJSON = formatConstraintsForPrompt(constraints);

  return `You are a Samsung One UI 8.5 design critic and refinement expert. You analyze UI issues and produce precise CSS patch plans.

=== DESIGN CONSTRAINTS (for validation) ===
${constraintJSON}
=== END CONSTRAINTS ===

Apply localized patches only. Do NOT regenerate the entire UI. Preserve unaffected parts.

Given the current layout snapshot and user feedback, you must:
1. Parse the feedback into specific design issues
2. Identify which nodes are affected
3. Check violations against the constraint set above
4. Create a concrete patch plan with CSS property changes

RESPOND with valid JSON:
{
  "parsedIssue": [
    {
      "type": "spacing|density|hierarchy|alignment|sizing|readability|consistency|semantic|interaction",
      "severity": "high|medium|low",
      "description": "what is wrong",
      "affectedNodes": ["item-1", "item-2"],
      "suggestion": "how to fix",
      "violatedConstraint": "which rule from the constraint set is violated (if any)"
    }
  ],
  "patchPlan": {
    "patches": [
      {
        "issueType": "spacing",
        "changes": [
          { "node": "item-1", "property": "margin-top", "from": "0px", "to": "8px", "target": "firstChild" }
        ],
        "expectedEffect": "Increase breathing room between header and content"
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

PATCH RULES:
- target "firstChild" means apply to el.firstElementChild, "self" means apply to the canvas-item itself
- Use standard CSS properties: margin-top, margin-bottom, padding, font-size, font-weight, line-height, border-radius, gap, text-align, width, color, background, opacity
- "from" should reflect the current computed value from the snapshot
- "to" should be the corrected value
- Follow 8dp grid for spacing values
- Samsung One UI type scale: 11px caption, 13px body, 15px subtitle, 20px title, 28px headline
- Font weights: 400 regular, 500 medium, 600 semibold, 700 bold`;
}

// ============================================================================
// Route handlers
// ============================================================================

async function handleGenerate(body, res) {
  const prompt = body.prompt || body.scenario || 'home screen';
  const mode = body.mode || 'dark';
  const scenario = body.scenario || null;

  // Build constraint-driven system prompt (NOT full document)
  const systemPrompt = buildGeneratePrompt(prompt, scenario, mode);

  const userMsg = `Generate a mobile UI screen for: ${prompt}

Context:
- Device: ${body.device || 'Galaxy S26'}
- Design System: ${body.surface || 'samsung'}
- Color Mode: ${mode}
- Canvas: ${body.constraints?.canvasWidth || 360}x${body.constraints?.canvasHeight || 780}px
${body.referenceUrl ? '- Reference URL: ' + body.referenceUrl : ''}

Create a complete, production-quality Samsung One UI 8.5 screen layout.`;

  // Log constraint size for monitoring
  const promptSize = (systemPrompt.length / 1024).toFixed(1);
  console.log(`  [constraints] ${promptSize}KB system prompt (scenario: ${_detectScenario(prompt)})`);

  const result = await callOpenAI(systemPrompt, userMsg, 0.7);
  sendJSON(res, 200, result);
}

async function handleRefine(body, res) {
  const mode = body.mode || 'dark';
  const systemPrompt = buildRefinePrompt(mode);

  const snapshotSummary = (body.snapshot?.items || []).map(it =>
    `${it.id}: styles={fontSize:${it.styles?.fontSize}, fontWeight:${it.styles?.fontWeight}, padding:${it.styles?.padding}, marginTop:${it.styles?.marginTop}, borderRadius:${it.styles?.borderRadius}} rect={w:${it.rect?.width?.toFixed?.(0) || '?'}, h:${it.rect?.height?.toFixed?.(0) || '?'}} text="${(it.textContent || '').substring(0, 40)}"`
  ).join('\n');

  // Inject variant context — Refine knows both prompts and results
  const varCtx = body.variantContext || getVariantContext(body.sessionId);
  const activeV = body.activeVariant || 'A';
  let variantSection = '';
  if (varCtx.A || varCtx.B) {
    variantSection = `\nVariant context (currently editing: ${activeV}):`;
    if (varCtx.A) variantSection += `\n- Variant A prompt: "${varCtx.A.prompt || 'scenario button'}" | scenario: ${varCtx.A.scenario || '?'}${varCtx.A.critic ? ' | score: ' + (varCtx.A.critic.score || '?') : ''}`;
    if (varCtx.B) variantSection += `\n- Variant B prompt: "${varCtx.B.prompt || 'scenario button'}" | scenario: ${varCtx.B.scenario || '?'}${varCtx.B.critic ? ' | score: ' + (varCtx.B.critic.score || '?') : ''}`;
    variantSection += '\n';
  }

  const userMsg = `User feedback: "${body.feedback}"
Selected issue tags: [${(body.issueTags || []).join(', ')}]
${(body.selectedNodes || []).length > 0 ? 'Selected nodes: [' + body.selectedNodes.join(', ') + ']' : ''}
${variantSection}
Current layout snapshot (${(body.snapshot?.items || []).length} items, Variant ${activeV}):
${snapshotSummary}

Canvas style: gap=${body.snapshot?.canvasStyle?.gap}, padding=${body.snapshot?.canvasStyle?.padding}

Analyze the issues and create a precise patch plan. Only patch affected nodes — preserve everything else.`;

  const promptSize = (systemPrompt.length / 1024).toFixed(1);
  console.log(`  [constraints] ${promptSize}KB refine prompt (variant: ${activeV})`);

  const result = await callOpenAI(systemPrompt, userMsg, 0.4);
  sendJSON(res, 200, result);
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

  // ── genui_pipeline_v1 endpoint ──────────────────────────────────────────
  // POST /api/pipeline/plan
  // body: { scenario_text: string, user_context?: {...}, scenario_key?: string }
  // returns: { interpretation, ui_state, plan, validation }
  if (url === '/api/pipeline/plan' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const scenarioText = body.scenario_text || body.prompt || '';

      // 3-step pipeline: ui_state is produced by STEP 1 (LLM-authoritative).
      const result = await pipeline.runPlan({
        scenarioText,
        llmCall: (sys, user) => callOpenAI(sys, user, 0.3)
      });

      const legacyPlan = result.legacy && result.legacy.plan;
      console.log(`[Pipeline] plan for "${scenarioText.substring(0,50)}" → ${result.plan?.requiredComponents?.length ?? 0} components, validation:${result.validation.ok ? 'ok' : 'FAIL'}`);
      // Wire-compat: clients still read required_components (snake_case).
      // Emit legacy plan as `plan`, and include the normalized form alongside.
      sendJSON(res, 200, {
        interpretation:   result.interpretation,
        planning_packet:  result.planningPacket,
        ui_state:         result.uiState,
        plan:             legacyPlan,
        plan_normalized:  result.plan,
        validation:       result.validation
      });
    } catch (e) {
      console.error('[Pipeline] error:', e.message);
      sendJSON(res, 500, { error: e.message });
    }
    return;
  }

  // POST /api/pipeline/compose
  // End-to-end: steps 1 → 3 → 5 + pipeline validators. Same body as /plan.
  // returns: { interpretation, ui_state, plan, plan_validation, layout_plan, layout_validation }
  if (url === '/api/pipeline/compose' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const scenarioText = body.scenario_text || body.prompt || '';
      const viewport     = body.viewport || null;

      // Steps 1 → 2 → 3 (LLM-authoritative ui_state from step_1)
      const planResult = await pipeline.runPlan({
        scenarioText,
        llmCall: (sys, user) => callOpenAI(sys, user, 0.3)
      });
      const uiState = planResult.uiState;
      const legacyPlan = planResult.legacy && planResult.legacy.plan;

      // Step 5 + pipeline validators (composer still reads legacy shape)
      const composeResult = composer.runCompose({
        uiState,
        requiredComponents: legacyPlan?.required_components || [],
        opts: { viewport }
      });

      console.log(`[Pipeline] compose for "${scenarioText.substring(0,50)}" → ${composeResult.layout_plan.children.length} children, layout violations:${composeResult.validation.summary.total}`);
      sendJSON(res, 200, {
        interpretation:    planResult.interpretation,
        planning_packet:   planResult.planningPacket,
        ui_state:          uiState,
        plan:              legacyPlan,
        plan_normalized:   planResult.plan,
        plan_validation:   planResult.validation,
        layout_plan:       composeResult.layout_plan,
        layout_validation: composeResult.validation
      });
    } catch (e) {
      console.error('[Pipeline] compose error:', e.message);
      sendJSON(res, 500, { error: e.message });
    }
    return;
  }

  // POST /api/pipeline/full
  // End-to-end including explanation layer (step_7).
  // returns: { interpretation, ui_state, plan, plan_validation,
  //            layout_plan, layout_validation, explanation }
  if (url === '/api/pipeline/full' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const scenarioText = body.scenario_text || body.prompt || '';
      const viewport     = body.viewport || null;

      // Steps 1 → 2 → 3 (LLM-authoritative ui_state from step_1)
      const planResult = await pipeline.runPlan({
        scenarioText,
        llmCall: (sys, user) => callOpenAI(sys, user, 0.3)
      });
      const uiState = planResult.uiState;
      const legacyPlan = planResult.legacy && planResult.legacy.plan;

      // Step 5 + 6 (composer still reads legacy shape)
      const composeResult = composer.runCompose({
        uiState,
        requiredComponents: legacyPlan?.required_components || [],
        opts: { viewport }
      });

      // Merge plan + layout validation for the explanation input
      const combinedValidation = {
        plan: planResult.validation,
        layout: composeResult.validation
      };

      // Step 7 — runExplain accepts normalized plan directly
      const explanation = await pipeline.runExplain({
        scenarioText,
        uiState,
        plan: planResult.plan,
        plannerNotes: planResult.plan?.plannerNotes || null,
        layoutPlan: composeResult.layout_plan,
        validation: combinedValidation,
        llmCall: (sys, user) => callOpenAI(sys, user, 0.4)
      });

      console.log(`[Pipeline] full for "${scenarioText.substring(0,50)}" → components:${composeResult.layout_plan.children.length} layout_violations:${composeResult.validation.summary.total} explained:${!!explanation}`);
      sendJSON(res, 200, {
        interpretation:    planResult.interpretation,
        planning_packet:   planResult.planningPacket,
        ui_state:          uiState,
        plan:              legacyPlan,
        plan_normalized:   planResult.plan,
        plan_validation:   planResult.validation,
        layout_plan:       composeResult.layout_plan,
        layout_validation: composeResult.validation,
        explanation
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
      designKB: {
        designSections: Object.keys(DESIGN_SECTIONS).length,
        genuiSections: Object.keys(GENUI_SECTIONS).length,
        orchSections: Object.keys(ORCH_SECTIONS).length,
        evolveEntries: EVOLVE_CONSTRAINTS ? EVOLVE_CONSTRAINTS.length : 0,
        rawSize: `${((DESIGN_MD_RAW.length + GENUI_MD_RAW.length + ORCH_MD_RAW.length) / 1024).toFixed(1)}KB`,
        constraintFragments: Object.keys(CONSTRAINT_FRAGMENTS).length,
        mode: 'constraint-extraction (DESIGN.md + GENUI-PRINCIPLES.md + ORCHESTRATION.md + evolve.md)'
      }
    });
    return;
  }

  // Static files
  let filePath = path.join(__dirname, url === '/' ? 'genui.html' : url);
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
