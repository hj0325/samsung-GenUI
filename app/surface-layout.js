// ============================================================================
// app/surface-layout.js
// One UI surface grammar based layout system
// Surface-first, zone-first, slot-based renderer
// ============================================================================

window.SURFACE_TYPES = {
  LOCKSCREEN: 'lockscreen',
  FIRST_DEPTH_LIST: 'first-depth-list',
  SECOND_DEPTH_DETAIL: 'second-depth-detail',
  TAB_ROOT: 'tab-root',
  DIALOG_BOTTOM: 'dialog-bottom',
  DIALOG_CENTER: 'dialog-center',
  QUICK_SETTINGS: 'quick-settings',
  NOTIFICATION_SHADE: 'notification-shade',
  SELECTION_MODE: 'selection-mode'
};

window.currentSurfaceType = window.SURFACE_TYPES.FIRST_DEPTH_LIST;

window.setSurfaceType = function setSurfaceType(type, el) {
  window.currentSurfaceType = type;

  document.querySelectorAll('.layout-preset').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
};

window.createOneUILayout = function createOneUILayout(viewport, surfaceType) {
  const width = viewport.width || 451;
  const height = viewport.height || 978;

  const safe = {
    top: 16,
    right: 24,
    bottom: 16,
    left: 24
  };

  const topSystemH = 28;
  const appBarExpandedH = Math.round(height * 0.22);
  const appBarCollapsedH = 56;
  const interactionStartY = Math.round(height * 0.58);
  const bottomNavH = 72;
  const bottomBarH = 64;

  return {
    viewport: { width, height },
    safe,
    metrics: {
      topSystemH,
      appBarExpandedH,
      appBarCollapsedH,
      interactionStartY,
      bottomNavH,
      bottomBarH,
      gap: 12,
      focusBlockRadius: 28
    },
    zones: {
      full: {
        x: 0, y: 0, w: width, h: height
      },
      topSystem: {
        x: safe.left,
        y: safe.top,
        w: width - safe.left - safe.right,
        h: topSystemH
      },
      viewing: {
        x: safe.left,
        y: safe.top + topSystemH + 8,
        w: width - safe.left - safe.right,
        h: interactionStartY - (safe.top + topSystemH + 8) - 12
      },
      interaction: {
        x: safe.left,
        y: interactionStartY,
        w: width - safe.left - safe.right,
        h: height - interactionStartY - safe.bottom - bottomNavH
      },
      bottomNav: {
        x: safe.left,
        y: height - safe.bottom - bottomNavH,
        w: width - safe.left - safe.right,
        h: bottomNavH
      },
      bottomBar: {
        x: safe.left,
        y: height - safe.bottom - bottomBarH,
        w: width - safe.left - safe.right,
        h: bottomBarH
      }
    },
    surfaceType
  };
};

window.composeSurfacePlan = function composeSurfacePlan(surfaceType, layout) {
  const T = window.SURFACE_TYPES;

  switch (surfaceType) {
    case T.LOCKSCREEN:
      return {
        surfaceType,
        components: [
          { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
          { id: 'lock-time', role: 'lock-time', zone: 'viewing' },
          { id: 'lock-date', role: 'lock-date', zone: 'viewing' },
          { id: 'lock-widgets', role: 'focus-block-group', zone: 'interaction' },
          { id: 'lock-shortcuts', role: 'lock-shortcuts', zone: 'bottomNav' }
        ]
      };

    case T.FIRST_DEPTH_LIST: {
      // Pick the search-bar theme ONCE per scene compose and share it with
      // the selection-dialog below so both alternate in sync (Figma
      // 629:1603 = light, 629:1602 = dark — pure black/white, no AI).
      var listTheme = Math.random() < 0.5 ? 'light' : 'dark';

      // Natural-sounding menu scenarios — rotated per scene so the user
      // sees realistic planning / recommendation / schedule content
      // instead of "This is a menu option" placeholders.
      var LIST_SCENARIOS = [
        {
          title: 'Summer travel plan',
          options: [
            'Jun 8-10 \u00b7 Jeju Island (3 days)',
            'Jul 15-22 \u00b7 Italy (1 week)',
            'Book Colosseum tour in Rome',
            'Hike Hallasan \u00b7 Witseoreum trail',
            'Sunscreen SPF50 + eye cream',
            'Book JAL flight (ICN \u2192 FCO)'
          ]
        },
        {
          title: 'Weekend plan \u00b7 Apr 27-28',
          options: [
            'Sat morning \u00b7 Brunch with Mom',
            'Sat afternoon \u00b7 MMCA exhibition',
            'Sat evening \u00b7 IU concert (Olympic Park)',
            'Sun lunch \u00b7 Bukchon hanok restaurant',
            'Sun afternoon \u00b7 Naksan Park sunset walk',
            'Mon morning \u00b7 Confirm reservation'
          ]
        },
        {
          title: 'Today\u2019s agenda \u00b7 Mon, Apr 20',
          options: [
            '10 AM \u00b7 Design team standup',
            '2 PM \u00b7 Q2 review presentation',
            '4 PM \u00b7 Coffee with Sarah',
            'Before EOD \u00b7 Finish project brief',
            'Workout \u00b7 Arms + core',
            'Return Mom\u2019s missed call'
          ]
        },
        {
          title: 'Saved Articles',
          options: [
            'The Future of Ambient UI',
            'Samsung One UI 8.5 deep dive',
            'Why designers write less now',
            'Jony Ive\'s next act, explained',
            'Building a type system at scale',
            'Galaxy S26 review — one year later'
          ]
        },
        {
          title: 'Shopping List · 6 items',
          options: [
            'MacBook Pro M4 14" · Space Black',
            'AirPods Pro 2 (USB-C)',
            'Samsung T7 Shield 2TB',
            'iPhone clear case w/ MagSafe',
            'Sony WH-1000XM5 (Black)',
            'Anker 737 power bank (24K mAh)'
          ]
        },
        {
          title: 'This week\u2019s bookings',
          options: [
            'Tue 7 PM \u00b7 Cheongdam omakase',
            'Wed 10 AM \u00b7 Dental checkup',
            'Thu 6 PM \u00b7 Pilates private lesson',
            'Fri 8 PM \u00b7 Dinner with the kids',
            'Sat 2 PM \u00b7 Gangnam hair salon',
            'Sun 11 AM \u00b7 Han River picnic (4)'
          ]
        }
      ];
      var pickedScenario = LIST_SCENARIOS[Math.floor(Math.random() * LIST_SCENARIOS.length)];

      return {
        surfaceType,
        components: [
          { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
          // Compact Figma "Top" header (989:22761) — big time + date.
          // Replaces the old tall `expandable-app-bar` so search-bar and
          // selection-dialog sit higher with more breathing room.
          // Scenario title moved INTO list-top-bar (above time/date).
          // selection-dialog renders with showTitle:false so the title
          // isn't duplicated in both the header and the menu.
          { id: 'list-top-bar', role: 'list-top-bar', zone: 'viewing',
            variant: { title: pickedScenario.title } },
          { id: 'search-bar', role: 'search-bar', zone: 'viewing',
            variant: { style: listTheme } },
          { id: 'selection-dialog', role: 'selection-dialog', zone: 'interaction',
            variant: {
              theme: listTheme,
              showTitle: false,
              options: pickedScenario.options
            } },
          // Keep the pinned-apps dock on the bottom nav (same shortcuts as Home).
          { id: 'app-dock', role: 'app-dock', zone: 'bottomNav',
            content: { apps: ['Phone','Messages','Internet','Camera'] } }
        ]
      };
    }

    case T.SECOND_DEPTH_DETAIL: {
      // Detail — status-bar (restored) + list-top-bar rendered as TWO
      // lines (greeting title on line 1, time + date on line 2) so the
      // upper area feels balanced next to the stack of focus-blocks
      // below. A random greeting is picked on each generation so the
      // screen reads differently each time.
      var DETAIL_GREETINGS = [
        'Good morning, Kyuha',
        'Here\u2019s your day',
        'Today at a glance',
        'Daily briefing',
        'Welcome back'
      ];
      var detailGreet = DETAIL_GREETINGS[Math.floor(Math.random() * DETAIL_GREETINGS.length)];
      return {
        surfaceType,
        components: [
          { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
          { id: 'list-top-bar', role: 'list-top-bar', zone: 'viewing',
            variant: { title: detailGreet } },
          { id: 'hero-card',      role: 'focus-block', zone: 'viewing',
            variant: { kind: 'secondary',
              title: 'Morning routine',
              body: 'Weather + calendar preview so you can plan the day at a glance.' } },
          { id: 'secondary-card', role: 'focus-block', zone: 'viewing',
            variant: { kind: 'secondary',
              title: 'Now playing',
              body: 'Resume \u201cDaily Mix 1\u201d on Spotify. Queued: 27 tracks.' } },
          { id: 'tertiary-card',  role: 'focus-block', zone: 'viewing',
            variant: { kind: 'secondary',
              title: 'Coming up',
              body: 'Design review at 3:00 PM with Sarah and Alex. Notes attached.' } },
          { id: 'app-dock', role: 'app-dock', zone: 'bottomNav',
            content: { apps: ['Phone','Messages','Internet','Camera'] } }
        ]
      };
    }

    case T.TAB_ROOT:
      // Home screen — filled with app icon grid (no title, no card list).
      // app-grid expands to N individual app-icon nodes (editable each).
      // app-dock pins 4 shortcuts at the bottom.
      return {
        surfaceType,
        components: [
          { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
          { id: 'app-grid',   role: 'app-grid',   zone: 'interaction' },
          { id: 'app-dock',   role: 'app-dock',   zone: 'bottomNav',
            content: { apps: ['Phone','Messages','Internet','Camera'] } }
        ]
      };

    case T.DIALOG_BOTTOM:
      return {
        surfaceType,
        components: [
          { id: 'scrim', role: 'scrim', zone: 'full' },
          { id: 'dialog', role: 'bottom-dialog', zone: 'interaction' }
        ]
      };

    case T.DIALOG_CENTER:
      return {
        surfaceType,
        components: [
          { id: 'scrim', role: 'scrim', zone: 'full' },
          { id: 'dialog', role: 'center-dialog', zone: 'full' }
        ]
      };

    case T.QUICK_SETTINGS:
      return {
        surfaceType,
        components: [
          { id: 'qs-bg', role: 'background', zone: 'full' },
          { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
          { id: 'qs-panel', role: 'quick-settings-panel', zone: 'interaction' }
        ]
      };

    case T.NOTIFICATION_SHADE:
      return {
        surfaceType,
        components: [
          { id: 'shade-bg', role: 'background', zone: 'full' },
          { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
          { id: 'notif-list', role: 'notification-list', zone: 'interaction' }
        ]
      };

    case T.SELECTION_MODE:
      return {
        surfaceType,
        components: [
          { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
          { id: 'selection-app-bar', role: 'selection-app-bar', zone: 'viewing' },
          { id: 'selection-list', role: 'list', zone: 'interaction' },
          { id: 'selection-toolbar', role: 'bottom-bar', zone: 'bottomBar' }
        ]
      };

    default:
      return {
        surfaceType,
        components: [
          { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
          { id: 'app-bar', role: 'collapsed-app-bar', zone: 'viewing' },
          { id: 'content', role: 'detail-content', zone: 'interaction' }
        ]
      };
  }
};

// ============================================================================
// Container expansion — turn compositional roles (list, focus-block-group,
// detail-content) into individual editable nodes with real gaps.
// ============================================================================

// List-item preset pool — messaging-style rows with varied content
var LIST_ITEM_PRESETS = [
  { avatar: 'Messages.png',  title: 'Jimin',          subtitle: 'See you at 7 PM',            time: '2m',  badge: 3 },
  { avatar: null, glyph: 'M', accent: '#EA4335', title: 'Sarah Chen',   subtitle: 'Re: Q2 planning — let\u2019s sync', time: '12m' },
  { avatar: 'Contacts.png',  title: 'Hannah',         subtitle: '\u266B Voice message',        time: '1h',  badge: 1 },
  { avatar: null, glyph: 'S', accent: '#611F69', title: 'Alex (Slack)', subtitle: 'PR is ready for review',        time: '30m' },
  { avatar: 'Notes.png',     title: 'Maya',           subtitle: 'Added you to "Trip plan"',    time: '3h' },
  { avatar: null, glyph: 'D', accent: '#5865F2', title: 'Dev Community',subtitle: 'New message in #general',       time: '5h',  badge: 12 },
  { avatar: 'Gallery.png',   title: 'Tomas',          subtitle: 'Shared a photo',              time: '6h' },
  { avatar: null, glyph: 'F', accent: '#25D366', title: 'Family',       subtitle: 'Dad: Pickup at 6',              time: '1d' },
  { avatar: 'Clock.png',     title: 'Reminder',       subtitle: 'Call mom today',              time: '9h' },
  { avatar: null, glyph: 'W', accent: '#1DA1F2', title: 'Work',         subtitle: 'Standup tomorrow at 10',        time: '1d' }
];

function _randomList(pool, n) {
  var copy = pool.slice();
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = copy[i]; copy[i] = copy[j]; copy[j] = t;
  }
  return copy.slice(0, Math.min(n, copy.length));
}

// Widget presets (for focus-block-group cells)
var WIDGET_PRESETS = [
  { kind: 'weather',  title: 'Seoul',        value: '18\u00B0',  accent: '#5AC8FA', sub: 'Partly cloudy' },
  { kind: 'battery',  title: 'Battery',      value: '69%',       accent: '#34C759', sub: '5h left' },
  { kind: 'activity', title: 'Steps',        value: '4,209',     accent: '#FF6B6B', sub: 'Goal 6,000' },
  { kind: 'music',    title: 'Now playing',  value: 'Dynamite',  accent: '#9B6BE6', sub: 'BTS' },
  { kind: 'calendar', title: 'Today',        value: '3 events',  accent: '#4285F4', sub: 'Next: 2pm stand-up' },
  { kind: 'alarm',    title: 'Alarm',        value: '7:00 AM',   accent: '#FF9500', sub: 'Weekday' }
];

window.expandContainerComponents = function expandContainerComponents(plan, layout) {
  if (!plan || !Array.isArray(plan.components)) return plan;
  var out = [];
  plan.components.forEach(function (comp) {
    var kids = null;
    if (comp.role === 'list')                kids = _expandList(comp, layout);
    else if (comp.role === 'notification-list') kids = _expandList(comp, layout); // same vertical stack
    else if (comp.role === 'focus-block-group') kids = _expandFocusBlockGroup(comp, layout);
    else if (comp.role === 'detail-content')  kids = _expandDetailContent(comp, layout);
    else if (comp.role === 'app-grid')        kids = _expandAppGrid(comp, layout);
    if (kids && kids.length) {
      out.push.apply(out, kids);
    } else {
      out.push(comp);
    }
  });
  plan.components = out;
  return plan;
};

// Home app grid — fills the space from below status-bar to above dock with
// a 4-column grid of app icons. Each cell becomes an editable `app-icon` node.
var HOME_APP_POOL = [
  'Phone', 'Messages', 'Camera', 'Gallery',
  'Contacts', 'Clock', 'Weather', 'Calculator',
  'Settings', 'Notes', 'Cloud', 'Health',
  'Reminder', 'Store', 'SmartThings', 'Bixby',
  'Internet', 'MyFiles', 'Studio', 'Wallet'
];

function _expandAppGrid(comp, layout) {
  var z = layout.zones;
  var leftX  = z.topSystem.x;
  var rightX = leftX + z.topSystem.w;
  var topY   = z.topSystem.y + z.topSystem.h + 12;        // below status bar
  var bottomY = z.bottomNav.y - 10;                        // above dock
  var gridW  = rightX - leftX;
  var gridH  = bottomY - topY;

  var cols   = 4;
  var colGap = 4;
  var labelH = 22;                                          // text row under icon
  var rowGap = 10;

  var cellW = Math.floor((gridW - colGap * (cols - 1)) / cols);
  var cellH = cellW + labelH;                              // icon area + label

  var rows = Math.max(1, Math.floor((gridH + rowGap) / (cellH + rowGap)));
  if (rows > 5) rows = 5;
  var total = Math.min(rows * cols, HOME_APP_POOL.length);

  // Center the grid vertically if there's leftover space
  var actualH = rows * cellH + (rows - 1) * rowGap;
  var startY = topY + Math.max(0, Math.floor((gridH - actualH) / 2));

  var result = [];
  for (var i = 0; i < total; i++) {
    var r = Math.floor(i / cols), c = i % cols;
    result.push({
      id: comp.id + ':app-' + i,
      role: 'app-icon',
      zone: comp.zone,
      _rect: {
        x: leftX + c * (cellW + colGap),
        y: startY + r * (cellH + rowGap),
        w: cellW,
        h: cellH
      },
      variant: { app: HOME_APP_POOL[i] }
    });
  }
  return result;
}

function _expandList(comp, layout) {
  var z = layout.zones[comp.zone] || layout.zones.interaction;
  var gap = (layout.metrics && layout.metrics.gap) || 8;
  var itemH = 72;  // One UI list-item default
  var maxCount = Math.max(1, Math.floor((z.h + gap) / (itemH + gap)));

  // Prefer agent-provided items when present — maps arbitrary shape into
  // our canonical list-item variant. Falls back to random presets otherwise.
  var agentItems = (comp.content && Array.isArray(comp.content.items))
    ? comp.content.items : null;

  var count, picked;
  if (agentItems && agentItems.length) {
    count = Math.min(agentItems.length, maxCount);
    picked = agentItems.slice(0, count).map(function (it) {
      it = it || {};
      return {
        title:    it.title    || it.name    || it.primary  || 'Item',
        subtitle: it.subtitle || it.secondary || it.description || it.body || '',
        time:     it.time     || it.timestamp || it.date   || '',
        avatar:   it.avatar   || it.icon     || null,
        glyph:    it.glyph    || null,
        accent:   it.accent   || null,
        badge:    it.badge    != null ? it.badge : undefined
      };
    });
  } else {
    count = Math.min(6, maxCount);
    picked = _randomList(LIST_ITEM_PRESETS, count);
  }

  var result = [];
  var y = z.y;
  for (var i = 0; i < count; i++) {
    result.push({
      id: comp.id + ':item-' + i,
      role: 'list-item',
      zone: comp.zone,
      _rect: { x: z.x, y: y, w: z.w, h: itemH },
      variant: picked[i] || {}
    });
    y += itemH + gap;
  }
  return result;
}

function _expandFocusBlockGroup(comp, layout) {
  var z = layout.zones[comp.zone] || layout.zones.interaction;
  var cols = 2, rows = 2;
  var gap = (layout.metrics && layout.metrics.gap) || 12;
  var cellW = Math.round((z.w - gap * (cols - 1)) / cols);
  // cap cell height so the group doesn't stretch the full zone
  var cellH = Math.min(110, Math.round((z.h - gap * (rows - 1)) / rows));
  var picked = _randomList(WIDGET_PRESETS, cols * rows);
  var result = [];
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var i = r * cols + c;
      result.push({
        id: comp.id + ':cell-' + i,
        role: 'focus-block',
        zone: comp.zone,
        _rect: {
          x: z.x + c * (cellW + gap),
          y: z.y + r * (cellH + gap),
          w: cellW,
          h: cellH
        },
        variant: picked[i] || {}
      });
    }
  }
  return result;
}

function _expandDetailContent(comp, layout) {
  var z = layout.zones[comp.zone] || layout.zones.interaction;
  var gap = (layout.metrics && layout.metrics.gap) || 12;
  var items = [];
  var y = z.y;

  // Agent-provided content (preferred) or fallback copy
  var c = comp.content || {};
  var heroTitle   = c.hero || c.title || 'Hero content';
  var titleText   = c.title || c.headline || 'Detail Title';
  var bodyParas   = Array.isArray(c.paragraphs) && c.paragraphs.length
    ? c.paragraphs
    : Array.isArray(c.body) ? c.body
    : (c.description
        ? [c.description]
        : [
            'Concise description of the detail — one or two lines that give the user the core of what they\u2019re looking at.',
            'A secondary paragraph with supporting info. Tap to expand for more context, reviews, or related items.'
          ]);
  var actions = c.actions || c.primaryAction
    ? {
        primary:   (c.actions && c.actions[0] && (c.actions[0].label || c.actions[0].text)) || c.primaryAction || 'Save',
        secondary: (c.actions && c.actions[1] && (c.actions[1].label || c.actions[1].text)) || c.secondaryAction || 'Share'
      }
    : { primary: 'Save', secondary: 'Share' };

  // Hero card (4:3 aspect)
  var heroH = Math.round(z.w * 0.6);
  items.push({
    id: comp.id + ':hero', role: 'focus-block', zone: comp.zone,
    _rect: { x: z.x, y: y, w: z.w, h: heroH },
    variant: { kind: 'hero', title: heroTitle }
  });
  y += heroH + gap;

  // Title block
  items.push({
    id: comp.id + ':title', role: 'paragraph', zone: comp.zone,
    _rect: { x: z.x, y: y, w: z.w, h: 48 },
    variant: { kind: 'title', text: titleText }
  });
  y += 48 + gap;

  // Body paragraphs (agent-provided or fallback)
  for (var p = 0; p < Math.min(bodyParas.length, 3) && (y + 52) <= z.y + z.h - 60; p++) {
    items.push({
      id: comp.id + ':para-' + p, role: 'paragraph', zone: comp.zone,
      _rect: { x: z.x, y: y, w: z.w, h: 52 },
      variant: { kind: 'body', text: bodyParas[p] }
    });
    y += 52 + gap;
  }

  // Action row
  items.push({
    id: comp.id + ':actions', role: 'action-row', zone: comp.zone,
    _rect: { x: z.x, y: y, w: z.w, h: 48 },
    variant: actions
  });

  return items;
}

window.resolveComponentRect = function resolveComponentRect(comp, layout, plan) {
  // If the container-expansion pass already computed a rect, use it as-is.
  if (comp._rect) return comp._rect;

  const z = layout.zones;
  const m = layout.metrics;
  const vw = layout.viewport.width;
  const vh = layout.viewport.height;

  switch (comp.role) {
    case 'status-bar':
      return {
        x: z.topSystem.x,
        y: z.topSystem.y,
        w: z.topSystem.w,
        h: z.topSystem.h
      };

    case 'expandable-app-bar':
      return {
        x: z.viewing.x,
        y: z.viewing.y,
        w: z.viewing.w,
        h: comp.state === 'expanded' ? m.appBarExpandedH : m.appBarCollapsedH
      };

    case 'collapsed-app-bar':
    case 'selection-app-bar':
      return {
        x: z.viewing.x,
        y: z.viewing.y,
        w: z.viewing.w,
        h: m.appBarCollapsedH
      };

    case 'search-bar':
      // Sits below the list-top-bar (80h + 8 gap). The top-bar now holds
      // a title line + time/date line so it's taller than before.
      return {
        x: z.viewing.x,
        y: z.viewing.y + 80 + 8,   // list-top-bar.bottom + 8
        w: z.viewing.w,
        h: 44
      };

    case 'focus-block': {
      // Sits below the list-top-bar (80h + 12 gap). Detail screen may
      // include up to THREE stacked focus-blocks — 'secondary-card' (or
      // 'hero-card-2') offsets below the first by 1× (fbH + 12 gap),
      // and 'tertiary-card' (or 'hero-card-3') offsets by 2×.
      var fbBaseY = z.viewing.y + 80 + 12;
      var fbH = 160;
      var fbY = fbBaseY;
      if (comp.id === 'secondary-card' || comp.id === 'hero-card-2') {
        fbY = fbBaseY + fbH + 12;
      } else if (comp.id === 'tertiary-card' || comp.id === 'hero-card-3') {
        fbY = fbBaseY + (fbH + 12) * 2;
      }
      return {
        x: z.viewing.x,
        y: fbY,
        w: z.viewing.w,
        h: fbH
      };
    }

    case 'focus-block-group':
      return {
        x: z.interaction.x,
        y: z.interaction.y,
        w: z.interaction.w,
        h: z.interaction.h - 12
      };

    case 'detail-content':
    case 'list':
    case 'notification-list':
      return {
        x: z.interaction.x,
        y: z.interaction.y,
        w: z.interaction.w,
        h: z.interaction.h
      };

    case 'list-top-bar':
      // Figma "Top" header (989:22761) + optional title line above.
      // Height 80: 30 for title + 4 gap + 35 for time/date + 11 pad.
      // When no title, still uses 80 so downstream positions stay stable.
      return {
        x: z.viewing.x,
        y: z.viewing.y,
        w: z.viewing.w,
        h: 80
      };

    case 'selection-dialog': {
      // Sits just below the search-bar on List screens. Starts at
      // (list-top-bar + 8 gap + search-bar + 16 gap) and extends through
      // the interaction zone so the 6 menu options have room to breathe.
      var sdY = z.viewing.y + 80 + 8 + 44 + 16; // top-bar(80) + gap + search-bar(44) + gap
      var sdH = (z.interaction.y + z.interaction.h) - sdY - 12;
      return {
        x: z.viewing.x,
        y: sdY,
        w: z.viewing.w,
        h: Math.max(200, sdH)
      };
    }

    case 'bottom-navigation':
    case 'app-dock':
      return {
        x: z.bottomNav.x,
        y: z.bottomNav.y,
        w: z.bottomNav.w,
        h: z.bottomNav.h
      };

    case 'app-grid':
      // Full content column between status bar and dock.
      return {
        x: z.topSystem.x,
        y: z.topSystem.y + z.topSystem.h + 12,
        w: z.topSystem.w,
        h: z.bottomNav.y - (z.topSystem.y + z.topSystem.h + 12) - 10
      };

    case 'bottom-bar':
      return {
        x: z.bottomBar.x,
        y: z.bottomBar.y,
        w: z.bottomBar.w,
        h: z.bottomBar.h
      };

    case 'bottom-dialog':
      return {
        x: 0,
        y: vh - 320,
        w: vw,
        h: 320
      };

    case 'center-dialog':
      return {
        x: Math.round(vw * 0.1),
        y: Math.round(vh * 0.38),
        w: Math.round(vw * 0.8),
        h: 220
      };

    case 'quick-settings-panel':
      return {
        x: 0,
        y: Math.round(vh * 0.16),
        w: vw,
        h: vh - Math.round(vh * 0.16)
      };

    case 'lock-time':
      return {
        x: z.viewing.x,
        y: z.viewing.y + 24,
        w: z.viewing.w,
        h: 96
      };

    case 'lock-date':
      return {
        x: z.viewing.x,
        y: z.viewing.y + 126,
        w: z.viewing.w,
        h: 28
      };

    case 'lock-shortcuts':
      return {
        x: z.bottomNav.x,
        y: z.bottomNav.y,
        w: z.bottomNav.w,
        h: z.bottomNav.h
      };

    case 'scrim':
    case 'background':
      return {
        x: 0,
        y: 0,
        w: vw,
        h: vh
      };

    default:
      return {
        x: z.interaction.x,
        y: z.interaction.y,
        w: 200,
        h: 60
      };
  }
};

// ── Token helpers (typography + glass + radius + spacing) ───────────────
// Thin wrappers that read from design_rules.json via Generator.* when loaded.
// Fallbacks are defensive for offline / early-boot rendering.
function _T(size, opts) {
  if (window.Generator && typeof window.Generator.typography === 'function') {
    return window.Generator.typography(size, opts || {});
  }
  const pxMap = { micro:10, caption:12, label:14, body:15, title:16, heading:18, large:20, date:24, headline:26, hero:112 };
  const weightMap = { regular:400, medium:500, semibold:600, bold:700 };
  const o = opts || {};
  return 'font-size:' + (pxMap[size] || 15) + 'px;font-weight:' + (weightMap[o.weight || 'regular']) + ';color:#fff;';
}
function _G(tier) {
  if (window.Generator && typeof window.Generator.glass === 'function') {
    return window.Generator.glass(tier);
  }
  return 'background:rgba(23,23,26,0.6);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.08);';
}
function _R(tier) {
  if (window.Generator && typeof window.Generator.radius === 'function') {
    return window.Generator.radius(tier);
  }
  const rMap = { small:10, card:14, medium:18, widget:20, pill:32, dialog:36, panel:40, container:50, circle:63.636 };
  return (rMap[tier] != null ? rMap[tier] : 14) + 'px';
}
function _S(tier) {
  if (window.Generator && typeof window.Generator.spacing === 'function') {
    return window.Generator.spacing(tier);
  }
  const sMap = { xs:4, sm:6, md:8, base:10, lg:12, xl:14, xxl:16, '3xl':18, '4xl':20 };
  return (sMap[tier] != null ? sMap[tier] : 8) + 'px';
}

window.renderAtomicForRole = function renderAtomicForRole(comp, rect) {
  const A = window.GalaxyAtomics || {};

  switch (comp.role) {
    case 'status-bar':
      return A.StatusBar
        ? A.StatusBar({ theme: 'dark', battery: 69, carrier: 'K-Arts' })
        : '<div style="height:100%;display:flex;align-items:center;justify-content:space-between;' +
            _T('caption', { color: 'statusBar' }) +
          '"><span>12:45</span><span>69%</span></div>';

    case 'list-top-bar': {
      // Figma "Top" 989:22761 + optional title line.
      //   Line 1 (18/700): big bold title (e.g. scenario title)
      //   Line 2: 26/700 time "8:21" + 18/500 date "Thu 28 Aug" inline
      // When variant.title is empty, only the time/date line renders.
      var ltv = (comp && comp.variant) || {};
      var ltTitle = ltv.title || '';
      var now = new Date();
      var h = now.getHours();
      var mi = now.getMinutes();
      var timeStr = h + ':' + (mi < 10 ? '0' + mi : String(mi));
      var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      var mon  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var dateStr = days[now.getDay()] + ' ' + now.getDate() + ' ' + mon[now.getMonth()];
      return '<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;gap:8px;padding:0 10px;box-sizing:border-box;color:#fff;font-family:var(--font);">' +
        (ltTitle
          ? '<div style="font-size:22px;font-weight:700;letter-spacing:-0.1px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + ltTitle + '</div>'
          : '') +
        '<div style="display:flex;align-items:center;gap:20px;">' +
          '<span style="font-size:22px;font-weight:700;letter-spacing:0.22px;line-height:1;">' + timeStr + '</span>' +
          '<span style="font-size:15px;font-weight:500;letter-spacing:0.15px;line-height:1;opacity:0.9;">' + dateStr + '</span>' +
        '</div>' +
      '</div>';
    }

    case 'expandable-app-bar': {
      var abc = (comp && comp.content) || {};
      var abTitle = abc.title || comp.text || 'Title';
      var abSub   = abc.subtitle || '';
      return '<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding:0 0 ' + _S('lg') + ' 0;box-sizing:border-box;">' +
        '<div data-appbar-title="1" style="' +
          _T(comp.state === 'expanded' ? 'headline' : 'heading', { weight: 'bold' }) +
          'line-height:1.1;transition:font-size 220ms cubic-bezier(0.2,0,0,1), transform 220ms cubic-bezier(0.2,0,0,1);">' + abTitle + '</div>' +
        (abSub ? '<div style="' + _T('caption', { color: 'translucentLabel' }) + 'margin-top:2px;">' + abSub + '</div>' : '') +
      '</div>';
    }

    case 'collapsed-app-bar':
    case 'selection-app-bar': {
      var cabc = (comp && comp.content) || {};
      var cabTitle = cabc.title || comp.text || 'Title';
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;">' +
        '<span style="' + _T('heading', { weight: 'bold' }) + '">' + cabTitle + '</span>' +
        '<span style="' + _T('large') + 'opacity:0.7;">⋮</span>' +
      '</div>';
    }

    case 'selection-dialog': {
      // Figma SelectionDialog — node 629:1603 (light) / 629:1602 (dark).
      //   container: 354 wide, bg rgba(255,255,255,0.5) OR rgba(0,0,0,0.5),
      //              backdrop-blur 24, rounded 28, padding 24, gap 24
      //   title: 20/600 (bold), theme-colored
      //   options: 6 rows, 20/400, theme-colored, 30h each
      var sdv = (comp && comp.variant) || {};
      var sdTheme = sdv.theme === 'dark' ? 'dark' : 'light';
      var sdTitle = sdv.title || 'This is a menu title';
      var DEFAULT_OPTIONS = [
        'This is a menu option',
        'This is a menu option',
        'This is a menu option',
        'This is a menu option',
        'This is a menu option',
        'This is a menu option'
      ];
      var sdOptions = Array.isArray(sdv.options) ? sdv.options : DEFAULT_OPTIONS;
      var sdShowTitle = sdv.showTitle !== false;
      var sdBg, sdText;
      if (sdTheme === 'dark') {
        sdBg   = 'rgba(0,0,0,0.5)';
        sdText = '#ffffff';
      } else {
        sdBg   = 'rgba(255,255,255,0.5)';
        sdText = '#000000';
      }
      var titleHTML = sdShowTitle
        ? '<div data-shortcut="1" style="width:100%;padding:8px 0;display:flex;align-items:center;cursor:pointer;">' +
            '<span style="font-family:var(--font);font-size:20px;font-weight:600;color:' + sdText + ';">' + sdTitle + '</span>' +
          '</div>'
        : '';
      var optsHTML = sdOptions.map(function (opt) {
        return '<div data-shortcut="1" style="width:100%;padding:8px 0;display:flex;align-items:center;cursor:pointer;">' +
          '<span style="font-family:var(--font);font-size:20px;font-weight:400;color:' + sdText + ';">' + opt + '</span>' +
        '</div>';
      }).join('');
      return '<div style="width:100%;height:100%;box-sizing:border-box;' +
        'background:' + sdBg + ';' +
        '-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);' +
        'border-radius:28px;padding:24px;' +
        'display:flex;flex-direction:column;gap:24px;align-items:flex-start;overflow:hidden;">' +
        titleHTML +
        '<div style="display:flex;flex-direction:column;gap:24px;width:100%;align-items:flex-start;">' +
          optsHTML +
        '</div>' +
      '</div>';
    }

    // ========================================================================
    // DIALOG ATOMICS (Figma InternetPopOutMenu 3074:6464)
    //   dialog-shell        → rounded glass container (bg + 24px blur)
    //   dialog-site-header  → 50×50 thumb + title + URL + share icon row
    //   dialog-browser-bar  → 5 circular icon buttons with labels
    //   dialog-icon-grid    → 2×4 icon+label grid inside a glass box +
    //                          page-indicator dots
    // These mirror the Dialog overlay's rules-renderer counterparts
    // (app/rules-renderer.js: renderDialogShell/SiteHeader/BrowserBar/
    // IconGrid) so the Dialog overlay can render its components through
    // the same atomic library that backs the Design-tab palette.
    // ========================================================================
    case 'dialog-shell': {
      return '<div style="width:100%;height:100%;' +
        'background:rgba(23,23,26,0.6);' +
        '-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);' +
        'border-radius:32px;box-sizing:border-box;' +
        'box-shadow:0 16px 48px rgba(0,0,0,0.35);"></div>';
    }

    case 'dialog-site-header': {
      var dshv = (comp && comp.variant) || {};
      var dshTitle = dshv.siteName || dshv.title || 'One UI Design Kit';
      var dshUrl   = dshv.siteDesc || dshv.url   || 'https://www.figma.com/community/file/oneui';
      return (
        '<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:12px;padding:8px 8px 0;box-sizing:border-box;">' +
          '<div style="display:flex;align-items:center;gap:15px;">' +
            '<div style="width:50px;height:50px;border-radius:10px;background:linear-gradient(135deg,#4A5568,#2D3748);flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:700;">\u25A3</div>' +
            '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;">' +
              '<div style="font-family:var(--font);font-size:18px;font-weight:600;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1;">' + dshTitle + '</div>' +
              '<div style="font-family:var(--font);font-size:14px;font-weight:400;color:#848487;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1;">' + dshUrl + '</div>' +
            '</div>' +
            '<div style="width:42px;height:42px;border-radius:14px;background:#17171a;flex-shrink:0;display:flex;align-items:center;justify-content:center;">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 16V4M12 4l-4 4M12 4l4 4M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</div>' +
          '</div>' +
          '<div style="height:1px;background:#5f5f61;width:100%;"></div>' +
        '</div>'
      );
    }

    case 'dialog-browser-bar': {
      var dbbActions = [
        { label: 'History',   svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 3-6.7L3 7M3 3v4h4M12 7v5l3.5 2" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
        { label: 'Downloads', svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 4v12M6 12l6 6 6-6M4 20h16" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
        { label: 'Galaxy AI', svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.8 4.5L18 9l-4.2 1.5L12 15l-1.8-4.5L6 9l4.2-1.5L12 3zM18 15l.9 2.2L21 18l-2.1.8L18 21l-.9-2.2L15 18l2.1-.8L18 15z" fill="#fff"/></svg>' },
        { label: 'Add page',  svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>' },
        { label: 'Settings',  svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="#fff" stroke-width="1.6"/><path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>' }
      ];
      var dbbCells = dbbActions.map(function (a) {
        return '<div data-shortcut="1" style="display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;">' +
          '<div style="width:54px;height:54px;border-radius:48px;background:#17171a;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 4.7px rgba(0,0,0,0.25);">' + a.svg + '</div>' +
          '<div style="font-family:var(--font);font-size:12px;font-weight:400;color:#fff;text-align:center;line-height:1.2;white-space:nowrap;">' + a.label + '</div>' +
        '</div>';
      }).join('');
      return '<div style="width:100%;height:100%;display:flex;align-items:flex-start;justify-content:space-between;padding:0 8px;box-sizing:border-box;">' +
        dbbCells +
      '</div>';
    }

    case 'dialog-icon-grid': {
      var digApps = [
        { name: 'Videos',     svg: '<rect x="3" y="5" width="18" height="12" rx="1.5" stroke="#fff" stroke-width="1.6" fill="none"/><path d="M10 9l5 3-5 3V9z" fill="#fff"/>' },
        { name: 'Extensions', svg: '<path d="M8 3v3h8V3M3 8h3v8H3M21 8h-3v8h3M8 21v-3h8v3M6 9v6h12V9H6z" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" fill="none"/>' },
        { name: 'Block ads',  svg: '<circle cx="12" cy="12" r="9" stroke="#fff" stroke-width="1.6" fill="none"/><path d="M5 5l14 14" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>' },
        { name: 'Privacy',    svg: '<path d="M12 3l7 3v5a9 9 0 0 1-7 9 9 9 0 0 1-7-9V6l7-3z" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" fill="none"/>' },
        { name: 'Brightness', svg: '<circle cx="12" cy="12" r="4" stroke="#fff" stroke-width="1.6" fill="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>' },
        { name: 'Find',       svg: '<circle cx="11" cy="11" r="7" stroke="#fff" stroke-width="1.6" fill="none"/><path d="M16 16l4 4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>' },
        { name: 'Text',       svg: '<path d="M5 6h14M12 6v14M9 20h6" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>' },
        { name: 'Save PDF',   svg: '<rect x="5" y="3" width="14" height="18" rx="1.5" stroke="#fff" stroke-width="1.6" fill="none"/><path d="M15 3v4h4M12 11v6M9 14l3 3 3-3" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' }
      ];
      var digRow = function (slice) {
        return slice.map(function (a) {
          return '<div data-shortcut="1" style="width:54px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;">' +
            '<div style="width:40px;height:28px;display:flex;align-items:center;justify-content:center;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none">' + a.svg + '</svg></div>' +
            '<div style="font-family:var(--font);font-size:12px;font-weight:400;color:#fff;text-align:center;line-height:1.2;white-space:nowrap;">' + a.name + '</div>' +
          '</div>';
        }).join('');
      };
      return (
        '<div style="width:100%;height:100%;background:rgba(23,23,26,0.6);border-radius:24px;padding:18px 20px 16px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;">' +
          '<div style="display:flex;justify-content:space-between;width:100%;">' + digRow(digApps.slice(0, 4)) + '</div>' +
          '<div style="display:flex;justify-content:space-between;width:100%;">' + digRow(digApps.slice(4, 8)) + '</div>' +
          '<div style="display:flex;justify-content:center;align-items:center;gap:6px;">' +
            '<div style="width:6px;height:6px;border-radius:5px;background:#ffffff;"></div>' +
            '<div style="width:6px;height:6px;border-radius:5px;background:rgba(255,255,255,0.6);"></div>' +
          '</div>' +
        '</div>'
      );
    }

    case 'search-bar': {
      // Randomly picks one of 4 Figma search-bar variants + one of 10
      // natural-sounding prompts. Renders as an actual <input> so the
      // user can type — styled to match Figma exactly (bg/text/mic).
      //
      // Figma variants (kxDvBUif6pV502Si4RPidK):
      //   47:221  — dark solid (#17171a bg, white text)
      //   547:9639 — light solid (#fcfcff bg, black text)
      //   47:228  — Galaxy-AI dark gradient (with blue→green gradient text)
      //   547:9646 — Galaxy-AI light gradient
      //
      // variant.style can pin a specific one ('dark'|'light'|'ai-dark'|
      // 'ai-light'); otherwise it's random per render.
      var sbc = (comp && comp.content) || {};
      var sbv = (comp && comp.variant) || {};
      var SEARCH_PROMPTS = [
        'What are you searching for?',
        'What do you need?',
        'What would you like to find?',
        'What are you trying to find?',
        'What can I help you find?',
        'What do you have in mind?',
        'What are you here for?',
        'What are you after?',
        'What are you hoping to discover?',
        'What brings you here today?'
      ];
      var sbPh = sbc.placeholder || sbv.placeholder ||
        SEARCH_PROMPTS[Math.floor(Math.random() * SEARCH_PROMPTS.length)];

      var STYLES = ['dark', 'light', 'ai-dark', 'ai-light'];
      var sbStyle = sbv.style || STYLES[Math.floor(Math.random() * STYLES.length)];

      // Common shell: 30px rounded pill, px-20 py-17, flex justify-between
      // with 24px mic icon on the right. Background + text color vary.
      var wrapBg, inputColor, inputBgClip, shadow, phColor;
      if (sbStyle === 'light') {
        wrapBg     = 'background:#fcfcff;';
        inputColor = 'color:#000000;';
        inputBgClip = '';
        shadow = '';
        phColor = '#000000';
      } else if (sbStyle === 'ai-dark') {
        wrapBg     = 'background:linear-gradient(to right,#364b6f 0%,#384247 64.807%,#2d2d30 87.168%);';
        inputColor = 'color:transparent;background:linear-gradient(to right,#66a1f3,#22c9a6);-webkit-background-clip:text;background-clip:text;';
        inputBgClip = '';
        shadow = 'box-shadow:-1px 0 4px 1px rgba(78,102,139,0.58);';
        phColor = 'transparent'; // gradient via ::placeholder workaround below
      } else if (sbStyle === 'ai-light') {
        wrapBg     = 'background:linear-gradient(to right,#364b6f 0%,#91b0bf 64.807%,#cfcfcf 87.168%);';
        inputColor = 'color:transparent;background:linear-gradient(to right,#66a1f3,#22c9a6);-webkit-background-clip:text;background-clip:text;';
        inputBgClip = '';
        shadow = 'box-shadow:-1px 0 4px 1px rgba(78,102,139,0.58);';
        phColor = 'transparent';
      } else {
        // dark (default)
        wrapBg     = 'background:#17171a;';
        inputColor = 'color:#ffffff;';
        inputBgClip = '';
        shadow = '';
        phColor = '#ffffff';
      }

      // Unique ID so multiple search-bars on one page don't collide.
      var inputId = 'searchbar-' + Math.random().toString(36).slice(2, 8);
      var isAI = sbStyle === 'ai-dark' || sbStyle === 'ai-light';

      // Mic icon — 24×24, inherits wrap text color (stroke currentColor)
      var micColor = (sbStyle === 'light') ? '#000000' : '#ffffff';
      var micSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;color:' + micColor + ';"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>';

      // For AI variants, use a separate span that renders the gradient text
      // AND a transparent real input on top for typing. The span shows the
      // placeholder when empty; hidden when user types.
      if (isAI) {
        return '<div style="width:100%;height:100%;' + wrapBg + shadow +
          'border-radius:30px;padding:17px 20px;box-sizing:border-box;' +
          'display:flex;align-items:center;justify-content:space-between;gap:8px;overflow:hidden;position:relative;">' +
          '<div style="flex:1;min-width:0;position:relative;height:22px;">' +
            // Gradient placeholder (shown when input is empty)
            '<span data-sb-gradient-placeholder style="position:absolute;inset:0;display:flex;align-items:center;' +
              'font-family:var(--font);font-size:16px;font-weight:600;line-height:1;' +
              'background:linear-gradient(to right,#66a1f3,#22c9a6);-webkit-background-clip:text;background-clip:text;color:transparent;' +
              'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;">' + sbPh + '</span>' +
            // Real input (transparent text so user sees gradient placeholder,
            // switches to own text once they type)
            '<input id="' + inputId + '" type="text" ' +
              'oninput="this.previousElementSibling.style.display=this.value?\'none\':\'flex\';" ' +
              'style="width:100%;height:100%;background:transparent;border:none;outline:none;' +
              'font-family:var(--font);font-size:16px;font-weight:600;' +
              'background:linear-gradient(to right,#66a1f3,#22c9a6);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;' +
              'caret-color:#66a1f3;padding:0;margin:0;"/>' +
          '</div>' +
          micSvg +
        '</div>';
      }

      // Solid variants (dark / light)
      return '<div style="width:100%;height:100%;' + wrapBg +
        'border-radius:30px;padding:17px 20px;box-sizing:border-box;' +
        'display:flex;align-items:center;justify-content:space-between;gap:8px;overflow:hidden;">' +
        '<input id="' + inputId + '" type="text" placeholder="' + sbPh + '" ' +
          'style="flex:1;min-width:0;height:22px;background:transparent;border:none;outline:none;' +
          'font-family:var(--font);font-size:16px;font-weight:600;' + inputColor + 'padding:0;margin:0;' +
          '--sb-ph:' + phColor + ';"/>' +
        micSvg +
      '</div>';
    }

    case 'focus-block': {
      // Variant-aware: widget cells, hero cards, 'secondary' editorial
      // cards, or default focus
      var fv = (comp && comp.variant) || {};
      var ftitle = fv.title || 'Focus block';
      var fvalue = fv.value || '';
      var fbody  = fv.body || fv.description || '';
      var fsub   = fv.sub   || (fv.kind === 'hero' ? '' : 'Important content goes here');
      var faccent = fv.accent || '#0381FE';

      if (fv.kind === 'hero') {
        return '<div style="width:100%;height:100%;border-radius:' + _R('widget') + ';' +
          _G('panel') +
          'display:flex;align-items:center;justify-content:center;box-sizing:border-box;overflow:hidden;">' +
          '<div style="width:60px;height:60px;border-radius:50%;background:' + faccent + ';opacity:0.6;"></div>' +
        '</div>';
      }
      // 'secondary' editorial card: title + body paragraph, no dot.
      // Used for Detail-screen focus-block stacks where every card should
      // read as a short article block (title + 1-2 line copy).
      if (fv.kind === 'secondary') {
        return '<div style="width:100%;height:100%;border-radius:' + _R('widget') + ';' +
          _G('panel') +
          'padding:20px 22px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;gap:10px;overflow:hidden;">' +
          '<div style="' + _T('large', { weight: 'bold' }) + 'line-height:1.2;">' + ftitle + '</div>' +
          (fbody ? '<div style="' + _T('label', { color: 'translucentLabel' }) +
            'line-height:1.4;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">' + fbody + '</div>' : '') +
        '</div>';
      }
      // Widget-style cell (focus-block-group expansion)
      if (fv.kind) {
        return '<div style="width:100%;height:100%;border-radius:' + _R('widget') + ';' +
          _G('panel') +
          'padding:' + _S('lg') + ';box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;gap:' + _S('sm') + ';overflow:hidden;">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
            '<div style="' + _T('micro', { color: 'translucentLabel' }) + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + ftitle + '</div>' +
            '<div style="width:8px;height:8px;border-radius:50%;background:' + faccent + ';flex-shrink:0;"></div>' +
          '</div>' +
          (fvalue ? '<div style="' + _T('large', { weight: 'bold' }) + 'line-height:1;">' + fvalue + '</div>' : '') +
          (fsub ? '<div style="' + _T('micro', { color: 'sectionLabel' }) + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + fsub + '</div>' : '') +
        '</div>';
      }
      // Default focus-block
      return '<div style="width:100%;height:100%;border-radius:' + _R('widget') + ';' +
        _G('panel') +
        'padding:' + _S('3xl') + ';box-sizing:border-box;">' +
        '<div style="' + _T('large', { weight: 'bold' }) + '">' + ftitle + '</div>' +
        (fsub ? '<div style="' + _T('label', { color: 'translucentLabel' }) + 'margin-top:' + _S('sm') + ';">' + fsub + '</div>' : '') +
      '</div>';
    }

    case 'list-item': {
      // Mirrors the `notif-card` atomic (Figma Notification/Regular 544:1088)
      // with two theme variants:
      //   theme='light' (default) → bg #ffffff, text #000 — List screen
      //   theme='dark'            → bg rgba(23,23,26,0.6), text #efeef2 —
      //     used in Detail screen where the group sits in a glass shell
      //
      // Shared layout: rounded 50 pill, 56 icon, title+time row, subtitle
      // below, trailing chevron or badge pill.
      var lv = (comp && comp.variant) || {};
      var liTheme  = lv.theme === 'dark' ? 'dark' : 'light';
      var title    = lv.title    || 'Item';
      var subtitle = lv.subtitle || '';
      var time     = lv.time     || '';
      var avatar   = lv.avatar   || null;
      var glyph    = lv.glyph    || title.charAt(0).toUpperCase();
      var accent   = lv.accent   || '#4285F4';
      var badge    = lv.badge;

      var liBg, liTitleColor, liTimeColor, liSubColor, liChevColor;
      if (liTheme === 'dark') {
        liBg         = 'rgba(23,23,26,0.6)';
        liTitleColor = '#efeef2';
        liTimeColor  = '#d5d5d5';
        liSubColor   = '#cfcccf';
        liChevColor  = '#ffffff';
      } else {
        liBg         = '#ffffff';
        liTitleColor = '#000000';
        liTimeColor  = '#555555';
        liSubColor   = '#333333';
        liChevColor  = '#222222';
      }

      var iconHTML = avatar
        ? '<img src="app-icons/' + avatar + '" style="width:56px;height:56px;border-radius:50%;object-fit:cover;flex-shrink:0;"/>'
        : '<div style="width:56px;height:56px;border-radius:50%;background:' + accent +
            ';display:flex;align-items:center;justify-content:center;flex-shrink:0;' +
            'color:#fff;font-size:22px;font-weight:600;line-height:1;">' + glyph + '</div>';

      var trailingHTML = (badge != null && badge > 0)
        ? '<div style="min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#FF3B30;' +
            'display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;' +
            'font-size:10px;font-weight:700;font-family:Inter,system-ui,sans-serif;">' + badge + '</div>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;opacity:0.8;"><path d="M6 9l6 6 6-6" stroke="' + liChevColor + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

      return '<div style="width:100%;height:100%;background:' + liBg + ';border-radius:50px;' +
        'padding:15px 20px 15px 16px;box-sizing:border-box;' +
        'display:flex;align-items:center;gap:10px;overflow:hidden;font-family:var(--font);">' +
        iconHTML +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;overflow:hidden;">' +
          '<div style="display:flex;align-items:baseline;gap:8px;white-space:nowrap;overflow:hidden;">' +
            '<span style="font-size:15px;font-weight:600;color:' + liTitleColor + ';overflow:hidden;text-overflow:ellipsis;">' + title + '</span>' +
            (time ? '<span style="font-size:12px;font-weight:400;color:' + liTimeColor + ';flex-shrink:0;">' + time + '</span>' : '') +
          '</div>' +
          (subtitle
            ? '<div style="font-size:14px;font-weight:400;color:' + liSubColor + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">' + subtitle + '</div>'
            : '') +
        '</div>' +
        trailingHTML +
      '</div>';
    }

    case 'paragraph': {
      var pv = (comp && comp.variant) || {};
      var ptxt = pv.text || '';
      if (pv.kind === 'title') {
        return '<div style="width:100%;height:100%;display:flex;align-items:center;">' +
          '<div style="' + _T('headline', { weight: 'bold' }) + 'line-height:1.2;">' + ptxt + '</div>' +
        '</div>';
      }
      return '<div style="width:100%;height:100%;display:flex;align-items:flex-start;">' +
        '<div style="' + _T('body', { color: 'translucentLabel' }) + 'line-height:1.5;">' + ptxt + '</div>' +
      '</div>';
    }

    case 'action-row': {
      var av = (comp && comp.variant) || {};
      var pLabel = av.primary || 'Primary';
      var sLabel = av.secondary || 'Secondary';
      return '<div style="width:100%;height:100%;display:flex;gap:' + _S('lg') + ';align-items:center;">' +
        '<button style="flex:1;height:100%;border:none;border-radius:' + _R('pill') + ';' +
          'background:var(--primary);color:#fff;' + _T('body', { weight: 'semibold' }) + 'cursor:pointer;">' + pLabel + '</button>' +
        '<button style="flex:1;height:100%;border:none;border-radius:' + _R('pill') + ';' +
          _G('widgetPill') + _T('body', { weight: 'semibold' }) + 'cursor:pointer;">' + sLabel + '</button>' +
      '</div>';
    }

    case 'focus-block-group':
      return '<div style="width:100%;height:100%;display:grid;grid-template-columns:1fr 1fr;gap:' + _S('lg') + ';">' +
        '<div style="border-radius:' + _R('widget') + ';' + _G('widgetPill') + '"></div>' +
        '<div style="border-radius:' + _R('widget') + ';' + _G('widgetPill') + '"></div>' +
        '<div style="border-radius:' + _R('widget') + ';' + _G('widgetPill') + '"></div>' +
        '<div style="border-radius:' + _R('widget') + ';' + _G('widgetPill') + '"></div>' +
      '</div>';

    case 'list':
    case 'notification-list':
      // Plain list — 6 simple system-surface rows (used when the list
      // isn't expanded into individual list-item children).
      return '<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:' + _S('base') + ';">' +
        Array.from({ length: 6 }).map(() =>
          '<div style="height:56px;border-radius:' + _R('widget') + ';background:#F1F1F3;box-shadow:0 1px 2px rgba(0,0,0,0.08);"></div>'
        ).join('') +
      '</div>';

    case 'detail-content': {
      // Detail screen — "related items" rows use the DARK notif-card
      // variant at rgba(23,23,26,0.6) (30% opacity) and the outer shell
      // also uses rgba(23,23,26,0.6) so the whole section reads as one
      // cohesive dark glass group over the wallpaper/app background.
      var presetItems = [
        { title: 'Lisa Park',    sub: 'Shared a photo · 2 new',  time: '10:32 AM', glyph: 'L', accent: '#E91E63', theme: 'dark' },
        { title: 'Team standup', sub: 'Starts in 15 min · Zoom', time: '9:45 AM',  glyph: 'T', accent: '#4285F4', theme: 'dark' },
        { title: 'Gmail',        sub: 'Re: Q2 planning draft',   time: '8:14 AM',  glyph: 'M', accent: '#EA4335', theme: 'dark' },
        { title: 'Bank',         sub: '\u2212$48.20 at Starbucks', time: '7:02 AM', glyph: '$', accent: '#00A86B', theme: 'dark' }
      ];
      var cardsHTML = presetItems.map(function (it) {
        return '<div style="height:86px;">' +
          window.renderAtomicForRole(
            { role: 'list-item', variant: it },
            { w: 0, h: 86 }
          ) +
        '</div>';
      }).join('');
      return '<div style="width:100%;height:100%;' +
        'background:rgba(23,23,26,0.6);' +
        '-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);' +
        'border:1px solid rgba(255,255,255,0.08);border-radius:32px;' +
        'padding:10px;box-sizing:border-box;overflow:hidden;' +
        'display:flex;flex-direction:column;gap:6px;">' +
        cardsHTML +
      '</div>';
    }

    case 'bottom-navigation': {
      var bnc = (comp && comp.content) || {};
      var tabs = Array.isArray(bnc.tabs) ? bnc.tabs : ['Home','Explore','Saved','Profile'];
      var activeIdx = bnc.activeIndex != null ? bnc.activeIndex : 0;

      // Returns a SVG path pair: { outline, filled } for active/inactive state.
      // Samsung One UI bottom-nav: filled variant on active, outline on rest.
      function navIconFor(name, active) {
        var lc = (name || '').toLowerCase();
        var c = 'currentColor';
        var sw = active ? '0' : '1.7';
        var fill = active ? c : 'none';
        var s = 'width="22" height="22" viewBox="0 0 24 24"';

        if (/home|main|for.you/.test(lc)) {
          return '<svg ' + s + ' fill="' + fill + '"><path d="M3 11L12 3l9 8v9a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1v-9z" stroke="' + c + '" stroke-width="' + sw + '" stroke-linejoin="round"/></svg>';
        }
        if (/search|explore|discover|browse|find/.test(lc)) {
          return '<svg ' + s + ' fill="none"><circle cx="11" cy="11" r="7" stroke="' + c + '" stroke-width="' + (active ? '2.2' : '1.7') + '" fill="' + (active ? c : 'none') + '" fill-opacity="' + (active ? '0.18' : '0') + '"/><path d="M20 20l-3.5-3.5" stroke="' + c + '" stroke-width="' + (active ? '2.4' : '1.7') + '" stroke-linecap="round"/></svg>';
        }
        if (/save|bookmark|wishlist|favorite|favour|like|heart/.test(lc)) {
          return '<svg ' + s + ' fill="' + fill + '"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" stroke="' + c + '" stroke-width="' + sw + '" stroke-linejoin="round"/></svg>';
        }
        if (/profile|account|me|user/.test(lc)) {
          return '<svg ' + s + ' fill="' + fill + '"><circle cx="12" cy="8" r="3.5" stroke="' + c + '" stroke-width="' + sw + '"/><path d="M5 20a7 7 0 0 1 14 0" stroke="' + c + '" stroke-width="' + sw + '" stroke-linecap="round" fill="' + fill + '"/></svg>';
        }
        if (/message|chat|inbox|mail/.test(lc)) {
          return '<svg ' + s + ' fill="' + fill + '"><path d="M4 6h16v10H8l-4 4V6z" stroke="' + c + '" stroke-width="' + sw + '" stroke-linejoin="round"/></svg>';
        }
        if (/cart|shop|buy/.test(lc)) {
          return '<svg ' + s + ' fill="none"><path d="M4 5h2l2 12h11l2-8H7" stroke="' + c + '" stroke-width="' + (active ? '2.2' : '1.7') + '" stroke-linejoin="round" fill="' + (active ? c : 'none') + '" fill-opacity="' + (active ? '0.18' : '0') + '"/><circle cx="10" cy="20" r="1.6" fill="' + c + '"/><circle cx="17" cy="20" r="1.6" fill="' + c + '"/></svg>';
        }
        if (/album|gallery|photo|media|library/.test(lc)) {
          return '<svg ' + s + ' fill="' + fill + '"><rect x="4" y="5" width="16" height="14" rx="2" stroke="' + c + '" stroke-width="' + sw + '"/><circle cx="9" cy="10" r="1.5" stroke="' + c + '" fill="' + (active ? '#fff' : 'none') + '" stroke-width="' + sw + '"/><path d="M4 16l5-5 4 4 3-3 4 4" stroke="' + c + '" stroke-width="' + sw + '" stroke-linejoin="round" fill="none"/></svg>';
        }
        if (/play|music|listen/.test(lc)) {
          return '<svg ' + s + ' fill="' + fill + '"><path d="M8 5l12 7-12 7V5z" stroke="' + c + '" stroke-width="' + sw + '" stroke-linejoin="round"/></svg>';
        }
        if (/notif|alert|bell/.test(lc)) {
          return '<svg ' + s + ' fill="' + fill + '"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2H4.5L6 16z" stroke="' + c + '" stroke-width="' + sw + '" stroke-linejoin="round"/><path d="M10 20a2 2 0 0 0 4 0" stroke="' + c + '" stroke-width="1.7" stroke-linecap="round" fill="none"/></svg>';
        }
        if (/settings|gear|pref/.test(lc)) {
          return '<svg ' + s + ' fill="' + fill + '"><circle cx="12" cy="12" r="3" stroke="' + c + '" stroke-width="' + sw + '"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke="' + c + '" stroke-width="1.7" stroke-linecap="round"/></svg>';
        }
        if (/add|plus|create|new/.test(lc)) {
          return '<svg ' + s + ' fill="none"><circle cx="12" cy="12" r="9" stroke="' + c + '" stroke-width="' + (active ? '2.2' : '1.7') + '" fill="' + (active ? c : 'none') + '" fill-opacity="' + (active ? '0.18' : '0') + '"/><path d="M12 8v8M8 12h8" stroke="' + c + '" stroke-width="' + (active ? '2.2' : '1.7') + '" stroke-linecap="round"/></svg>';
        }
        // Fallback — solid dot when active, ring when inactive
        return '<svg ' + s + ' fill="' + fill + '"><circle cx="12" cy="12" r="5" stroke="' + c + '" stroke-width="' + sw + '"/></svg>';
      }

      var tabsHTML = tabs.slice(0, 5).map(function (t, i) {
        var active = i === activeIdx;
        var label = (t && typeof t === 'object') ? (t.label || t.text || '') : String(t);
        var styleLbl = active
          ? _T('micro', { weight: 'semibold' })
          : _T('micro', { color: 'sectionLabel' });
        return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;flex:1;' +
          (active ? 'color:#fff;' : 'color:rgba(255,255,255,0.55);') +
        '">' +
          '<div style="display:flex;align-items:center;justify-content:center;line-height:0;">' + navIconFor(label, active) + '</div>' +
          '<span style="' + styleLbl + '">' + label + '</span>' +
        '</div>';
      }).join('');

      return '<div style="width:100%;height:100%;border-radius:' + _R('pill') + ';' +
        _G('widgetPill') +
        'display:flex;align-items:stretch;padding:6px 4px;box-sizing:border-box;">' +
        tabsHTML +
      '</div>';
    }

    case 'app-icon': {
      // Single app launcher: PNG icon + small label underneath.
      // Used inside Home's app-grid (expanded from `app-grid` role).
      var av = (comp && comp.variant) || {};
      var app = av.app || 'App';
      var pngMap = {
        'Phone':'Phone.png','Messages':'Messages.png','Internet':'Internet.png',
        'Camera':'Camera.png','Gallery':'Gallery.png','Contacts':'Contacts.png',
        'Settings':'Settings.png','Clock':'Clock.png','Weather':'Weather.png',
        'Calculator':'Calculator.png','Calendar':'Clock.png','Notes':'Notes.png',
        'Cloud':'Cloud.png','Health':'Health.png','Reminder':'Reminder.png',
        'Store':'Store.png','SmartThings':'SmartThings.png','Bixby':'Bixby.png',
        'MyFiles':'MyFiles.png','Studio':'Studio.png','Wallet':'Wallet.png',
        'Wearable':'Wearable.png','Pass':'Pass.png','Find':'Find.png',
        'Radio':'Radio.png','VoiceRecorder':'VoiceRecorder.png',
        'DailyBoard':'DailyBoard.png','DeviceCare':'DeviceCare.png',
        'DigitalWellbeing':'DigitalWellbeing.png','SecureFolder':'SecureFolder.png',
        'SecureWifi':'SecureWifi.png'
      };
      var file = pngMap[app];
      // Size icon to the cell width (leave room for 22px label)
      var iconSize = rect ? Math.min(rect.w - 8, (rect.h || 0) - 22, 72) : 60;
      if (iconSize < 32) iconSize = 32;
      var iconRadius = Math.round(iconSize * 0.28);

      var iconHTML;
      if (file) {
        iconHTML = '<img src="app-icons/' + file + '" style="width:' + iconSize + 'px;height:' + iconSize + 'px;border-radius:' + iconRadius + 'px;object-fit:cover;flex-shrink:0;">';
      } else {
        iconHTML = '<div style="width:' + iconSize + 'px;height:' + iconSize + 'px;border-radius:' + iconRadius + 'px;background:linear-gradient(135deg,#4285F4,#0381FE);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;line-height:1;' +
          _T('heading', { weight: 'bold', color: '#fff' }) + '">' + app.charAt(0).toUpperCase() + '</div>';
      }

      return '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">' +
        iconHTML +
        '<div style="font-size:10px;font-weight:500;color:#fff;line-height:1.35;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px 1px;text-shadow:0 1px 2px rgba(0,0,0,0.45);">' + app + '</div>' +
      '</div>';
    }

    // ─── OneUI 8.5 atomics — extracted from Figma One UI Design Kit ───────
    // Shared primitives intentionally kept small so Media / QS / Notif
    // variants can be composed from them.

    case 'toggle-chip': {
      // 56×56 circular toggle — primitive. Matches Figma `ToggleIcon`
      // 544:1125 exactly: bg rgba(180,180,180,0.2) / p-13 / rounded-full.
      // `data-toggle-chip` marks it for the delegated interact-mode click
      // handler (see _bindInteractiveAtomics at bottom of file).
      //
      // variant.label → Samsung QS "label below circle" composition. NOT a
      //                 Figma-defined atomic — it's composed by Samsung from
      //                 Single/Toggle (88×88) + external label text. Use
      //                 `single-toggle` role (role = 'single-toggle') for
      //                 Figma-exact 88×88 wrapper or 199×88 side-label.
      // variant.icon  → named glyph for the circle center.
      var tcv = (comp && comp.variant) || {};
      var on = tcv.on === true || tcv.state === 'on';
      var label = tcv.label || '';
      var iconKey = tcv.icon || '';

      // Small icon library for QS labeled toggles. Keys mirror the Samsung
      // QS names (auto-rotate / airplane / flashlight / …). Unknown keys
      // fall back to a neutral + / ✓ pair.
      var ICONS = {
        'sound':       '<path d="M5 9v6h4l5 4V5L9 9H5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
        'vibrate':     '<path d="M5 9v6h4l5 4V5L9 9H5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M18 8c1.5 1 2 2.5 2 4s-0.5 3-2 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
        'mute':        '<path d="M5 9v6h4l5 4V5L9 9H5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
        // Figma 340:6297 — classic bluetooth B: diagonals + vertical spine.
        // Path: low-left → diag up-right → top-peak → vertical spine down →
        // low-right-peak → diag up-left back. Renders the recognizable
        // Samsung bluetooth glyph at 24×24.
        'bluetooth':   '<path d="M7 17l10-10-5-5v20l5-5-10-10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
        'screen-share':'<rect x="3" y="5" width="18" height="11" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M9 20h6M12 16v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
        'camera':      '<rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="13.5" r="3.5" stroke="currentColor" stroke-width="1.6"/><path d="M9 7l1.5-2h3L15 7" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
        'auto-rotate': '<path d="M4 12a8 8 0 0 1 14-5l2-2M20 7v4h-4M20 12a8 8 0 0 1-14 5l-2 2M4 17v-4h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
        'airplane':    '<path d="M3 13l8-2V5a1 1 0 0 1 2 0v6l8 2v2l-8-1v4l2 1v2l-3-1-3 1v-2l2-1v-4l-8 1v-2z" fill="currentColor"/>',
        'flashlight':  '<path d="M9 3h6v3l-1 3H10L9 6V3zM10 9h4v12h-4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
        'hotspot':     '<path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 16a6 6 0 0 1 0-8M16 16a6 6 0 0 0 0-8M5 19a10 10 0 0 1 0-14M19 19a10 10 0 0 0 0-14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
        'power-save':  '<rect x="5" y="7" width="13" height="10" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="19" y="10" width="2" height="4" fill="currentColor"/><path d="M11 10l-2 4h3l-1 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
        'location':    '<path d="M12 22s-7-7-7-12a7 7 0 1 1 14 0c0 5-7 12-7 12z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" stroke-width="1.6"/>',
        'link':        '<path d="M10 14l-3 3a3 3 0 0 1-4-4l3-3M14 10l3-3a3 3 0 0 1 4 4l-3 3M8 16l8-8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
        'quick-share': '<circle cx="6" cy="12" r="2.5" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="6" r="2.5" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="18" r="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M8 11l8-4M8 13l8 4" stroke="currentColor" stroke-width="1.6"/>',
        'dex':         '<rect x="3" y="5" width="18" height="12" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M8 20h8M12 17v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><text x="12" y="12.5" font-size="6" fill="currentColor" text-anchor="middle" font-family="Arial" font-weight="700">DeX</text>',
        'eye-comfort': '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M16 8a6 6 0 1 1-4 10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="10" r="1" fill="currentColor"/>',
        'dnd':         '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M7 12h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
        'qr':          '<rect x="4" y="4" width="6" height="6" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="4" width="6" height="6" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="14" width="6" height="6" stroke="currentColor" stroke-width="1.6"/><path d="M14 14h3v3M20 14v6M14 20h6" stroke="currentColor" stroke-width="1.6"/>',
        'interpreter': '<path d="M5 9h6M8 6v3M7 12l2 5 2-5M14 14l2 5 2-5M13 17h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
        'multi':       '<path d="M6 12l4-4 4 4-4 4-4-4zM14 6h6v6M20 18h-6v-6" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
        'secure':      '<rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
        'broadcast':   '<circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M8 8a5 5 0 0 0 0 8M16 8a5 5 0 0 1 0 8M5 5a9 9 0 0 0 0 14M19 5a9 9 0 0 1 0 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        // Figma "wifi 3" (3018:6371 / 6381) — 4 vectors: 3 nested arcs
        // (outer/middle/inner) bowing UP + 1 dot at the bottom center.
        // Cubic bezier used (instead of elliptical arc) for a smoother
        // Samsung curve at small sizes.
        'wifi':        '<path d="M5 10.5c3.9-3 10.1-3 14 0M7.5 13.5c2.6-2 6.4-2 9 0M10 16.5c1.3-1 2.7-1 4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/>',
        // Figma 989:22477 / 3018:6357 "mobile data qs" — two vertical arrows
        // side-by-side: left ↓ (download), right ↑ (upload). Aspect ≈ 71:61.
        'mobile-data': '<path d="M8.5 4v16M4.5 15l4 5 4-5M15.5 20V4M11.5 9l4-5 4 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
        // Figma 474:600 — battery "fully charged" pill with 100% fill.
        // Rounded rectangle body + small positive terminal nub on the right.
        'battery':     '<rect x="3" y="8" width="17" height="10" rx="2.5" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="20.5" y="11" width="1.5" height="4" rx="0.5" fill="currentColor"/><rect x="5" y="10" width="13" height="6" rx="1" fill="currentColor"/>',
        'modes':       '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/><path d="M12 4v8l6 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
        // Figma brightness (I1109:10261;…;340:6324 + 6325) — sun disc + rays
        'brightness':  '<circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v3M12 19v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M5.5 18.5l2-2M16.5 7.5l2-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
        // Figma 1109:10246;…;530:6 — music eighth note with beam
        'music':       '<path d="M9 18V5l11-2v11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="7" cy="18" r="2.5" fill="currentColor"/><circle cx="18" cy="14" r="2.5" fill="currentColor"/>',
        // Figma 340:6583 — dark mode moon (crescent)
        'moon':        '<path d="M19 14A8 8 0 1 1 10 5a6 6 0 0 0 9 9z" fill="currentColor"/>',
        // Figma 340:7776 — sound vibrate (muted speaker with diagonal line)
        'mute':        '<path d="M4 10v4h3l4 3.5V6.5L7 10H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
        // Phone handset — used by lock-screen bottom-left shortcut
        'phone':       '<path d="M5 4.5C5 3.67 5.67 3 6.5 3h2.28c0.69 0 1.28 0.47 1.44 1.14l0.59 2.35c0.11 0.43-0.02 0.88-0.33 1.19l-1.27 1.27a11.5 11.5 0 0 0 5.34 5.34l1.27-1.27c0.31-0.31 0.76-0.44 1.19-0.33l2.35 0.59c0.67 0.16 1.14 0.75 1.14 1.44V17.5c0 0.83-0.67 1.5-1.5 1.5C9.94 19 5 14.06 5 8.5V4.5z" fill="currentColor"/>'
      };
      var iconPath = ICONS[iconKey] || ICONS['modes'];
      var size = label ? 22 : 24;
      var iconColor = on ? '#222' : '#fff';
      var plusSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>';
      var iconSvg = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" style="color:' + iconColor + ';">' + iconPath + '</svg>';
      var circle = '<div data-toggle-chip data-on="' + (on ? '1' : '0') + '" ' +
        'style="width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
          'background:' + (on ? '#d5d5d5' : 'rgba(180,180,180,0.2)') + ';transition:background 180ms ease;' +
          (label ? 'margin:0 auto 8px;' : 'margin:auto;') + '">' +
          '<span data-toggle-on style="display:' + (on ? 'inline-flex' : 'none') + ';">' + iconSvg + '</span>' +
          '<span data-toggle-off style="display:' + (on ? 'none' : 'inline-flex') + ';">' +
            (iconKey ? iconSvg.replace('color:#222', 'color:#fff') : plusSvg) +
          '</span>' +
        '</div>';
      if (!label) return circle;
      // Labeled variant — ANCHOR the circle to the top (NOT justify-center)
      // so rows of chips stay perfectly aligned regardless of whether the
      // label wraps to 1 or 2 lines. Circle at padding-top:4; label at
      // fixed margin-top so it hangs below at a consistent offset.
      return '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;' +
        'padding-top:4px;box-sizing:border-box;color:#fff;font-family:var(--font);overflow:visible;">' +
        circle +
        '<div style="font-size:11px;font-weight:500;text-align:center;line-height:1.25;max-width:86px;' +
          'margin-top:8px;white-space:normal;word-break:keep-all;color:rgba(255,255,255,0.92);">' + label + '</div>' +
      '</div>';
    }

    case 'toggle-grid': {
      // Figma "Icons" shell — node 544:865 / 1109:10370. Glass pill with
      // N rows of 56×56 toggle-chips, evenly distributed via flex
      // justify-between. Spec matches 1:1:
      //   bg rgba(23,23,26,0.6) + 1px border rgba(255,255,255,0.2)
      //   rounded 50 · padding 24 25 · column flex gap 20
      //   per row: flex justify-between, 4 toggle-chips
      //   drag handle 50×4 bar near the bottom edge
      //
      // variant.cells → array of { icon, label, on } — when a cell has a
      //                 `label` we render the labeled toggle-chip (icon +
      //                 text below). No label = icon-only 56 circle.
      // variant.cols / rows → grid shape (default 4×2 = 8 cells).
      var tgv = (comp && comp.variant) || {};
      var cells = Array.isArray(tgv.cells) ? tgv.cells : null;
      var cols = tgv.cols || 4;
      var rows = tgv.rows || 2;

      function _tgCell(cellVariant) {
        return window.renderAtomicForRole(
          { role: 'toggle-chip', variant: cellVariant || {} },
          { w: 88, h: 88 }
        );
      }

      var rowsHtml = '';
      for (var r = 0; r < rows; r++) {
        var rowInner = '';
        for (var c = 0; c < cols; c++) {
          var idx = r * cols + c;
          var cellVariant;
          if (cells && cells[idx]) {
            cellVariant = {
              icon:  cells[idx].icon  || 'modes',
              label: cells[idx].label || '',
              on:    cells[idx].on === true
            };
          } else {
            cellVariant = { on: false };
          }
          rowInner += '<div style="flex-shrink:0;display:flex;align-items:center;justify-content:center;">' +
            _tgCell(cellVariant) +
          '</div>';
        }
        rowsHtml += '<div style="display:flex;align-items:flex-start;justify-content:space-between;width:100%;flex-shrink:0;">' +
          rowInner +
        '</div>';
      }

      return '<div style="width:100%;height:100%;' +
        'background:rgba(23,23,26,0.6);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);' +
        'border:1px solid rgba(255,255,255,0.2);border-radius:50px;' +
        'padding:24px 25px;box-sizing:border-box;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;' +
        'position:relative;overflow:hidden;">' +
        rowsHtml +
        // Figma drag handle (987:16943 + 544:2861): 11px holder at bottom:-1px
        // with a 50×4 bar riding at top of holder → visually sits just above
        // the bottom edge, bumping slightly past the rounded corner.
        '<div style="position:absolute;left:50%;bottom:-1px;transform:translateX(-50%);width:50px;height:11px;pointer-events:none;">' +
          '<div style="position:absolute;top:0;left:0;width:50px;height:4px;border-radius:2px;background:rgba(255,255,255,0.6);"></div>' +
        '</div>' +
      '</div>';
    }

    case 'slider-pill': {
      // Pill slider with gradient fill. Horizontal by default; set
      // `variant.orient = 'vertical'` for the tall brightness-style slider.
      // `variant.icon` selects the handle glyph:
      //   'volume' (default), 'sun' (brightness), 'moon' (night).
      var spv = (comp && comp.variant) || {};
      var pct = spv.percent != null ? spv.percent : 32;
      var orient = spv.orient || 'horizontal';
      var iconKey = spv.icon || 'volume';
      var ICON_SVGS = {
        'volume':    '<path d="M4 12h16M7 8l-3 4 3 4M17 8l3 4-3 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
        'sun':       '<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
        'moon':      '<path d="M20 14a8 8 0 1 1-10-10 6 6 0 0 0 10 10z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
        // Figma brightness (I1109:10261;…;340:6324 + 6325): sun disc + rays
        'brightness':'<circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v3M12 19v2M3 12h2M19 12h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5l1.5-1.5M17 7l1.5-1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
        // Figma music (I1109:10246;…;530:6): eighth note with beam
        'music':     '<path d="M9 18V5l11-2v11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="7" cy="18" r="2.5" fill="currentColor"/><circle cx="18" cy="14" r="2.5" fill="currentColor"/>'
      };
      var iconSvg = ICON_SVGS[iconKey] || ICON_SVGS['volume'];

      if (orient === 'vertical') {
        // Tall vertical slider — fill grows from the BOTTOM up. Handle icon
        // sits at the bottom center of the pill (representing the control
        // handle / indicator glyph below the track).
        return '<div data-slider-pill data-pct="' + pct + '" data-orient="vertical" ' +
          'style="width:100%;height:100%;min-width:56px;background:rgba(185,185,185,0.2);border-radius:28px;position:relative;touch-action:none;overflow:hidden;">' +
          '<div data-slider-fill style="position:absolute;left:0;right:0;bottom:0;height:' + pct + '%;min-height:56px;background:linear-gradient(to top,#c6c4c3,#e4e4e4);border-radius:28px;transition:height 60ms linear;"></div>' +
          '<div style="position:absolute;bottom:13px;left:50%;transform:translateX(-50%);width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#222;pointer-events:none;">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none">' + iconSvg + '</svg>' +
          '</div>' +
        '</div>';
      }
      return '<div data-slider-pill data-pct="' + pct + '" ' +
        'style="width:100%;height:56px;background:rgba(185,185,185,0.2);border-radius:28px;position:relative;touch-action:none;">' +
        '<div data-slider-fill style="position:absolute;left:0;top:0;bottom:0;width:' + pct + '%;min-width:74px;background:linear-gradient(to right,#c6c4c3,#e4e4e4);border-radius:28px;transition:width 60ms linear;"></div>' +
        '<div style="position:absolute;left:13px;top:13px;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#222;pointer-events:none;">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none">' + iconSvg + '</svg>' +
        '</div>' +
      '</div>';
    }

    case 'drag-handle': {
      // 50×4 rounded bar — bottom-of-sheet / QS expand indicator.
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><div style="width:50px;height:4px;border-radius:2px;background:rgba(255,255,255,0.6);"></div></div>';
    }

    case 'now-bar': {
      // Figma Now Bar — 248×64 pill with 3 type variants (3 distinct Figma
      // components sharing the same container spec):
      //   media    (752:7978) → teal bg rgba(3,78,110,0.8), 40 image + song
      //                          title (14 semibold) + prev/pause/next controls
      //   timer    (752:7988) → glass rgba(23,23,26,0.6) + 0.25 border, 40
      //                          icon (#5b53c8 optional bg) + 26 semibold time
      //                          + pause icon on right
      //   charging (752:7994) → glass + green Union gradient fill (left), bolt
      //                          icon + 26 semibold percent (no right icon)
      // All: backdrop-blur 12px, padding 12 top/bottom, pl 12 pr 18, radius 53.
      var nbv = (comp && comp.variant) || {};
      var nbType = nbv.type || 'timer';
      var common = 'min-height:64px;height:64px;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);' +
        'padding:12px 18px 12px 12px;box-sizing:border-box;display:flex;align-items:center;gap:14px;' +
        'border-radius:53px;color:#fff;font-family:var(--font);overflow:hidden;position:relative;';

      if (nbType === 'media') {
        // Song title scrolls as a marquee so long strings like
        // "Never Gonna Give You Up · Rick Astley (1987)" cycle across the
        // 164-wide text slot. Pure CSS via @keyframes nowbar-marquee.
        var mSong    = nbv.title || nbv.song || 'Never Gonna Give You Up';
        var mMarquee = nbv.marquee || (mSong + ' \u00B7 Rick Astley (1987)');
        var mImgBg   = nbv.imgBg || '#5b53c8';
        return '<div style="width:100%;' + common + 'background:rgba(3,78,110,0.8);padding:5px 12px;gap:8px;">' +
          '<div style="width:40px;height:40px;border-radius:37px;background:' + mImgBg + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" stroke="#fff" stroke-width="1.8"/><circle cx="18" cy="16" r="3" stroke="#fff" stroke-width="1.8"/></svg>' +
          '</div>' +
          '<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:10px;">' +
            // Marquee container: fixed 164 width, overflow-hidden, inner track animates
            '<div style="width:164px;height:14px;overflow:hidden;position:relative;mask-image:linear-gradient(to right,transparent 0,#000 8px,#000 calc(100% - 8px),transparent 100%);">' +
              '<div class="nowbar-marquee-track" style="position:absolute;top:0;left:0;white-space:nowrap;font-size:14px;font-weight:600;line-height:14px;color:#fff;animation:nowbar-marquee 14s linear infinite;">' +
                '<span style="padding-right:32px;">' + mMarquee + '</span>' +
                '<span style="padding-right:32px;">' + mMarquee + '</span>' +
              '</div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:15px;">' +
              '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M18 5L8 12l10 7V5z" fill="#fff"/><rect x="5" y="5" width="2" height="14" fill="#fff"/></svg>' +
              '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="7" y="5" width="3.5" height="14" fill="#fff"/><rect x="13.5" y="5" width="3.5" height="14" fill="#fff"/></svg>' +
              '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 5l10 7-10 7V5z" fill="#fff"/><rect x="17" y="5" width="2" height="14" fill="#fff"/></svg>' +
            '</div>' +
          '</div>' +
        '</div>';
      }

      if (nbType === 'charging') {
        var percent = nbv.percent != null ? nbv.percent : 69;
        // Green gradient "Union" fill on the left side — fakes a battery level
        // shape that tapers off to the right. Uses a simplified left-rounded
        // rectangle to approximate the Figma Union shape without needing the
        // asset URL.
        return '<div style="width:100%;' + common + 'background:rgba(23,23,26,0.6);">' +
          '<div style="position:absolute;left:-1px;top:-6px;bottom:-6px;width:157px;background:linear-gradient(to right,#0FCF6E 0%,#0FCF6E 60%,rgba(15,207,110,0.7) 85%,rgba(15,207,110,0) 100%);border-radius:53px 32px 32px 53px;"></div>' +
          '<div style="position:relative;z-index:1;display:flex;align-items:center;gap:14px;width:100%;">' +
            '<div style="width:40px;height:40px;border-radius:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
              '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#fff"/></svg>' +
            '</div>' +
            '<div style="flex:1;min-width:0;text-align:center;padding-right:24px;">' +
              '<div style="font-size:26px;font-weight:600;line-height:18px;color:#fff;letter-spacing:-0.2px;">' + percent + '%</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }

      // timer (default) — icon + 26px time + pause
      // When variant.live === true, adds data-live-timer so a global ticker
      // (see scenes.js _startLiveTimerTicker) increments the displayed time
      // every second. The `data-start` attribute records when the timer
      // began so we can compute elapsed seconds on each tick (survives
      // rerenders by using the wall-clock delta, not an accumulator).
      var tLabel = nbv.label || nbv.time || '00:00:00';
      var tIcon  = nbv.icon  || 'stopwatch';
      var showPause = nbv.showPause !== false;
      var iconBg = nbv.iconBg !== false;
      var isLive = nbv.live === true;
      var TIMER_ICONS = {
        'stopwatch':'<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="14" r="7" stroke="#fff" stroke-width="1.6"/><path d="M12 11v3l2 1.5M10 3h4M14 5l1.5-1.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>',
        'timer':    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="#fff" stroke-width="1.6"/><path d="M12 8v5l3 2" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>'
      };
      var timerSvg = TIMER_ICONS[tIcon] || TIMER_ICONS['stopwatch'];
      var liveAttrs = isLive ? ' data-live-timer="1" data-start="' + Date.now() + '"' : '';
      return '<div style="width:100%;' + common + 'background:rgba(23,23,26,0.6);border:0.25px solid rgba(55,55,55,0.3);">' +
        '<div style="width:40px;height:40px;border-radius:20px;flex-shrink:0;display:flex;align-items:center;justify-content:center;' +
          (iconBg ? 'background:#5b53c8;' : '') + '">' + timerSvg + '</div>' +
        '<div style="flex:1;min-width:0;"><div' + liveAttrs + ' style="font-size:26px;font-weight:600;line-height:18px;color:#fff;letter-spacing:-0.2px;white-space:nowrap;font-family:Inter,system-ui,sans-serif;">' + tLabel + '</div></div>' +
        (showPause ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;"><rect x="7" y="5" width="3.5" height="14" fill="#fff"/><rect x="13.5" y="5" width="3.5" height="14" fill="#fff"/></svg>' : '') +
      '</div>';
    }

    case 'media-half': {
      // Figma "Media (Half | Off)" — node 544:967. Collapsed 199×163 glass
      // card shown when no media is active. Structure:
      //   container 199×163, bg rgba(23,23,26,0.6), border 1px rgba 0.2,
      //              rounded 36, padding 14 29
      //   inner stack (160w) vertically justify-between:
      //     1) Output chip — bg rgba(0,0,0,0.2) rounded 43, px-8 py-5,
      //          media-volume icon 19.7 + "Media Output" text 14/400
      //     2) Song row — play-triangle 19 + "No Media Playing" 15/500
      //     3) Progress line — thin 150.5 horizontal divider
      //     4) Controls — prev/play/next 24px icons, gap 21
      // All-interactive: each control has data-shortcut for press ripple.
      var mhv = (comp && comp.variant) || {};
      var mhTitle = mhv.title || 'No Media Playing';
      var mhOutput = mhv.output || 'Media Output';
      return '<div style="width:100%;height:100%;min-width:199px;' +
        'background:rgba(23,23,26,0.6);border:1px solid rgba(255,255,255,0.2);' +
        'border-radius:36px;padding:14px 29px;box-sizing:border-box;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'color:#fff;font-family:var(--font);overflow:hidden;">' +
        '<div style="width:100%;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:10px;flex:1;">' +
          // 1) Output chip
          '<div data-shortcut="1" style="display:flex;align-items:center;gap:6px;padding:6px 9px;background:rgba(0,0,0,0.2);border-radius:43px;cursor:pointer;">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="color:#fff;">' +
              '<path d="M4 10v4h3l4 3.5V6.5L7 10H4z" fill="currentColor"/>' +
              '<path d="M14 9.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>' +
            '</svg>' +
            '<span style="font-size:12px;font-weight:400;color:#fff;white-space:nowrap;">' + mhOutput + '</span>' +
          '</div>' +
          // 2) Song title row (play-triangle + "No Media Playing")
          '<div style="display:flex;align-items:center;gap:6px;justify-content:center;">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;"><path d="M8 5l10 7-10 7V5z" fill="#fff"/></svg>' +
            '<span style="font-size:13px;font-weight:500;letter-spacing:0.3px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + mhTitle + '</span>' +
          '</div>' +
          // 3) Progress line (empty/inactive)
          '<div style="width:100%;height:2px;background:rgba(255,255,255,0.25);border-radius:1px;"></div>' +
          // 4) Controls row — prev / play / next
          '<div style="display:flex;align-items:center;gap:21px;">' +
            '<svg data-shortcut="1" width="22" height="22" viewBox="0 0 24 24" fill="none" style="cursor:pointer;"><path d="M6 5v14M18 5L8 12l10 7V5z" fill="#fff" stroke="#fff" stroke-width="1" stroke-linejoin="round"/></svg>' +
            '<svg data-shortcut="1" width="22" height="22" viewBox="0 0 24 24" fill="none" style="cursor:pointer;"><path d="M8 5l10 7-10 7V5z" fill="#fff"/></svg>' +
            '<svg data-shortcut="1" width="22" height="22" viewBox="0 0 24 24" fill="none" style="cursor:pointer;"><path d="M18 5v14M6 5l10 7-10 7V5z" fill="#fff" stroke="#fff" stroke-width="1" stroke-linejoin="round"/></svg>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    case 'media-card': {
      // Full media player (background image + title + progress + 5 controls).
      var mcv = (comp && comp.variant) || {};
      var mTitle = mcv.title  || 'Title';
      var mArtist = mcv.artist || 'Artist';
      var mService = mcv.service || 'Samsung Music';
      return '<div style="width:100%;height:100%;border-radius:' + _R('dialog') + ';padding:14px 29px;box-sizing:border-box;color:#fff;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(135deg,#2A1A5E,#1A0A3E 60%,#3A1A6E);overflow:hidden;position:relative;">' +
        // Service + output row
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">' +
          '<div style="display:flex;align-items:center;gap:6px;font-size:12px;letter-spacing:0.24px;">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M8 5v12a3 3 0 1 1-3-3m3 0V7l11-3v10a3 3 0 1 1-3-3m3 0V7" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '<span>' + mService + '</span>' +
          '</div>' +
          '<div style="background:rgba(0,0,0,0.2);border-radius:16px;padding:4px 8px;font-size:10px;display:flex;align-items:center;gap:4px;">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="6" y="3" width="12" height="18" rx="2" stroke="#fff" stroke-width="1.5"/></svg>' +
            '<span>Phone speaker</span>' +
          '</div>' +
        '</div>' +
        // Title + artist
        '<div style="display:flex;flex-direction:column;gap:2px;">' +
          '<div style="font-size:14px;font-weight:500;letter-spacing:0.28px;">' + mTitle + '</div>' +
          '<div style="font-size:12px;color:rgba(255,255,255,0.75);letter-spacing:0.24px;">' + mArtist + '</div>' +
        '</div>' +
        // Progress
        '<div style="display:flex;flex-direction:column;gap:3px;">' +
          '<div style="height:3px;background:rgba(255,255,255,0.25);border-radius:2px;position:relative;"><div style="position:absolute;left:0;top:0;bottom:0;width:45%;background:#fff;border-radius:2px;"></div><div style="position:absolute;left:45%;top:50%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 0 6px rgba(255,255,255,0.5);"></div></div>' +
          '<div style="display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,0.75);letter-spacing:0.2px;">' +
            '<span>02:41</span><span>03:24</span>' +
          '</div>' +
        '</div>' +
        // Controls (shuffle / prev / pause / next / heart)
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:0 4px;">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 7h3l3 3m6-3h4l-2-2m2 2l-2 2M3 17h3l8-10h4l-2 2m2-2l-2-2" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M18 5L8 12l10 7V5z" fill="#fff"/><rect x="5" y="5" width="2" height="14" fill="#fff"/></svg>' +
          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="7" y="5" width="3.5" height="14" fill="#fff"/><rect x="13.5" y="5" width="3.5" height="14" fill="#fff"/></svg>' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 5l10 7-10 7V5z" fill="#fff"/><rect x="17" y="5" width="2" height="14" fill="#fff"/></svg>' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
        '</div>' +
      '</div>';
    }

    case 'notif-card': {
      // Figma Notification/Regular — node 544:1088. Samsung OneUI 8.5 pill
      // shape with 56×56 app icon + title/time row + subtitle + chevron.
      //
      //   container  → 415×86, rounded 50, padding 15 / 16 / 20, gap 10
      //   icon       → 56×56 circle, app accent bg or png icon inside
      //
      //   theme='dark'  (default, over Lock shade)
      //     bg rgba(23,23,26,0.6) + backdrop-blur; title #efeef2 / sub #cfcccf
      //   theme='light' (over Home / List / Detail day UI)
      //     bg #ffffff; title #000 / sub #333 — pops against light app content
      var ncv = (comp && comp.variant) || {};
      var ncTheme = ncv.theme === 'light' ? 'light' : 'dark';
      var ncTitle = ncv.title || ncv.app || 'Title';
      var ncBody  = ncv.body  || ncv.subtitle || '';
      var ncTime  = ncv.time  || '';
      var ncAccent= ncv.accent|| '#d5d5d5';
      var ncIcon  = ncv.icon  || null;
      var ncGlyph = ncv.glyph || '';
      var ncShowSub = !!ncBody;

      var ncBg, ncBlur, ncTitleColor, ncTimeColor, ncSubColor, ncChevronColor;
      if (ncTheme === 'light') {
        ncBg = '#ffffff';
        ncBlur = '';
        ncTitleColor = '#000000';
        ncTimeColor = '#555555';
        ncSubColor = '#333333';
        ncChevronColor = '#222222';
      } else {
        ncBg = 'rgba(23,23,26,0.6)';
        ncBlur = '-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);';
        ncTitleColor = '#efeef2';
        ncTimeColor = '#d5d5d5';
        ncSubColor = '#cfcccf';
        ncChevronColor = '#ffffff';
      }

      // 56×56 circular app icon. Uses the png if provided, else a colored
      // circle with the glyph fallback. Matches Figma Shape (548:2740).
      var ncIconHTML = ncIcon
        ? '<img src="app-icons/' + ncIcon + '" style="width:56px;height:56px;border-radius:50%;flex-shrink:0;object-fit:cover;"/>'
        : '<div style="width:56px;height:56px;border-radius:50%;background:' + ncAccent +
            ';display:flex;align-items:center;justify-content:center;flex-shrink:0;' +
            'color:#fff;font-size:22px;font-weight:600;line-height:1;">' + ncGlyph + '</div>';

      return '<div style="width:100%;height:100%;' +
        'background:' + ncBg + ';' + ncBlur +
        'border-radius:50px;padding:15px 20px 15px 16px;box-sizing:border-box;' +
        'display:flex;align-items:center;gap:10px;overflow:hidden;font-family:var(--font);">' +
        ncIconHTML +
        // Stacked unit — title+time row (baseline aligned) on top, subtitle below
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;overflow:hidden;">' +
          '<div style="display:flex;align-items:baseline;gap:8px;white-space:nowrap;overflow:hidden;">' +
            '<span style="font-size:15px;font-weight:600;color:' + ncTitleColor + ';overflow:hidden;text-overflow:ellipsis;">' + ncTitle + '</span>' +
            (ncTime ? '<span style="font-size:12px;font-weight:400;color:' + ncTimeColor + ';flex-shrink:0;">' + ncTime + '</span>' : '') +
          '</div>' +
          (ncShowSub
            ? '<div style="font-size:14px;font-weight:400;color:' + ncSubColor + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">' + ncBody + '</div>'
            : '') +
        '</div>' +
        // Chevron-down expand affordance (Figma node 745:7185, opacity 0.8)
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;opacity:0.8;"><path d="M6 9l6 6 6-6" stroke="' + ncChevronColor + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</div>';
    }

    case 'notif-card-ai': {
      // Notification variant with AI blue→green gradient background.
      // Same layout as notifCard but brighter + AI sparkle icon slot.
      // variant.theme='light' shifts text colors darker for day-mode bases.
      var naiv = (comp && comp.variant) || {};
      var aiTheme = naiv.theme === 'light' ? 'light' : 'dark';
      var aiTitle = naiv.title    || 'Title';
      var aiSub   = naiv.subtitle || 'Subtitle';
      var aiTime  = naiv.time     || '8:21 AM';
      var aiTitleColor = aiTheme === 'light' ? '#111111' : '#efeef2';
      var aiTimeColor  = aiTheme === 'light' ? '#444444' : '#d5d5d5';
      var aiSubColor   = aiTheme === 'light' ? '#222222' : '#cfcccf';
      var aiChevColor  = aiTheme === 'light' ? '#111111' : '#ffffff';
      var aiSparkleC   = '#ffffff';
      // Gradient opacity depends on base:
      //   dark (over Lock) → 0.4 alpha — base blur is doing the heavy
      //                      visual lifting; card stays translucent.
      //   light (over Home/List/Detail) → 1.0 alpha — no backdrop blur
      //                      so the card pops as a solid AI pill.
      var aiGrad = aiTheme === 'light'
        ? 'linear-gradient(to right,rgba(102,161,243,1),rgba(34,201,166,1))'
        : 'linear-gradient(to right,rgba(102,161,243,0.4),rgba(34,201,166,0.4))';
      return '<div style="width:100%;height:100%;background:' + aiGrad + ';border-radius:50px;padding:15px 20px 15px 16px;display:flex;align-items:center;gap:10px;box-sizing:border-box;overflow:hidden;">' +
        '<div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.22);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);flex-shrink:0;display:flex;align-items:center;justify-content:center;">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.8 4.5L18 9l-4.2 1.5L12 15l-1.8-4.5L6 9l4.2-1.5L12 3zM18 15l.9 2.2L21 18l-2.1.8L18 21l-.9-2.2L15 18l2.1-.8L18 15z" fill="' + aiSparkleC + '"/></svg>' +
        '</div>' +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;overflow:hidden;">' +
          '<div style="display:flex;gap:8px;align-items:baseline;white-space:nowrap;overflow:hidden;">' +
            '<span style="font-size:15px;font-weight:600;color:' + aiTitleColor + ';">' + aiTitle + '</span>' +
            '<span style="font-size:12px;color:' + aiTimeColor + ';">' + aiTime + '</span>' +
          '</div>' +
          '<div style="font-size:14px;color:' + aiSubColor + ';line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + aiSub + '</div>' +
        '</div>' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="opacity:0.8;flex-shrink:0;"><path d="M7 10l5 5 5-5" stroke="' + aiChevColor + '" stroke-width="1.5" stroke-linecap="round"/></svg>' +
      '</div>';
    }

    case 'output-chip': {
      // Small pill — media device indicator ("Phone speaker").
      var ocv = (comp && comp.variant) || {};
      var ocLabel = ocv.label || 'Phone speaker';
      return '<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;background:rgba(0,0,0,0.35);border-radius:16px;font-size:11px;color:#fff;white-space:nowrap;margin:auto;">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="6" y="3" width="12" height="18" rx="2" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="17" r="1" fill="#fff"/></svg>' +
        '<span>' + ocLabel + '</span>' +
      '</div>';
    }

    case 'progress-track': {
      // Time progress bar with left/right timestamps.
      var ptv = (comp && comp.variant) || {};
      var left  = ptv.left  || '02:41';
      var right = ptv.right || '03:24';
      var ptPct = ptv.percent != null ? ptv.percent : 45;
      return '<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:3px;justify-content:center;padding:0 4px;box-sizing:border-box;">' +
        '<div style="height:3px;background:rgba(255,255,255,0.25);border-radius:2px;position:relative;"><div style="position:absolute;left:0;top:0;bottom:0;width:' + ptPct + '%;background:#fff;border-radius:2px;"></div><div style="position:absolute;left:' + ptPct + '%;top:50%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:#fff;"></div></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,0.75);">' +
          '<span>' + left + '</span><span>' + right + '</span>' +
        '</div>' +
      '</div>';
    }

    case 'lock-clock': {
      // Huge digital time display (Samsung lock-screen signature).
      // variant:
      //   time   → 'HH:MM' string (default '9:41')
      //   weight → 100–400 font weight (default 200 for thin display feel)
      //   size   → px font-size (default 96 — fits the 176h Figma column)
      // Text is centered and given a soft drop-shadow so it reads over any
      // wallpaper without needing a scrim.
      var lcv = (comp && comp.variant) || {};
      var lcTime   = lcv.time   || '9:41';
      var lcWeight = lcv.weight || 200;
      var lcSize   = lcv.size   || 96;
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-family:var(--font);">' +
        '<div style="font-size:' + lcSize + 'px;font-weight:' + lcWeight + ';line-height:1;letter-spacing:-2px;text-shadow:0 2px 12px rgba(0,0,0,0.35);">' + lcTime + '</div>' +
      '</div>';
    }

    case 'weather-date': {
      // Compact "condition · temp · date" inline pill. Lives just above the
      // lock-screen clock in Samsung's layout.
      //   condition → 'sunny' | 'cloudy' | 'rain' | 'snow'
      //   temp      → e.g. '72°'
      //   date      → e.g. 'Wed, Oct 16'
      var wdv = (comp && comp.variant) || {};
      var wdCond = wdv.condition || 'sunny';
      var wdTemp = wdv.temp || '72°';
      var wdDate = wdv.date || 'Wed, Oct 16';
      var WEATHER_SVGS = {
        'sunny':  '<circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5l1.5-1.5M17 7l1.5-1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
        'cloudy': '<path d="M7 17a4 4 0 0 1 0-8 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 17 17H7z" fill="currentColor"/>',
        'rain':   '<path d="M7 14a4 4 0 0 1 0-8 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 17 14H7z" fill="currentColor"/><path d="M9 17v3M12 17v3M15 17v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
        'snow':   '<path d="M7 13a4 4 0 0 1 0-8 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 17 13H7z" fill="currentColor"/><path d="M8 17v2M12 17v2M16 17v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
      };
      var wdSvg = WEATHER_SVGS[wdCond] || WEATHER_SVGS['sunny'];
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:8px;color:#fff;font-family:var(--font);font-size:14px;font-weight:500;text-shadow:0 1px 4px rgba(0,0,0,0.35);">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="color:#fff;">' + wdSvg + '</svg>' +
        '<span>' + wdTemp + '</span>' +
        '<span style="opacity:0.6;">·</span>' +
        '<span>' + wdDate + '</span>' +
      '</div>';
    }

    case 'lock-indicator': {
      // Small padlock / fingerprint / face-ID glyph shown just below the
      // status bar. variant.state: 'locked' | 'unlocked' | 'fingerprint'.
      var liv = (comp && comp.variant) || {};
      var liState = liv.state || 'locked';
      var LOCK_SVGS = {
        'locked':      '<rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="1.8" fill="none"/>',
        'unlocked':    '<rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M8 11V7a4 4 0 0 1 8 0" stroke="currentColor" stroke-width="1.8" fill="none"/>',
        'fingerprint': '<path d="M12 5a7 7 0 0 0-7 7v3M19 12a7 7 0 0 0-3-5.7M19 15v3M8 21a7 7 0 0 0 2-5v-4a2 2 0 0 1 4 0v5a9 9 0 0 1-1 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>'
      };
      var liSvg = LOCK_SVGS[liState] || LOCK_SVGS['locked'];
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.9);filter:drop-shadow(0 1px 4px rgba(0,0,0,0.35));">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="color:currentColor;">' + liSvg + '</svg>' +
      '</div>';
    }

    case 'unlock-hint': {
      // "Swipe up to unlock" text with optional up-chevron above. Centered
      // at the bottom of the lock screen, just above the shortcut row.
      var uhv = (comp && comp.variant) || {};
      var uhText = uhv.text != null ? uhv.text : 'Swipe up to unlock';
      var uhArrow = uhv.showArrow !== false;
      return '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:rgba(255,255,255,0.8);font-family:var(--font);font-size:12px;font-weight:500;text-shadow:0 1px 4px rgba(0,0,0,0.35);">' +
        (uhArrow
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="color:rgba(255,255,255,0.7);"><path d="M7 15l5-5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          : '') +
        '<span>' + uhText + '</span>' +
      '</div>';
    }

    case 'slider-panel': {
      // Figma 1109:10261 (brightness) / 1109:10246 (volume) — a vertical
      // slider PANEL that bundles a track + mode-cap toggle in one glass
      // container. Exact spec:
      //   container: 88×h, bg rgba(23,23,26,0.6) + 1px border + rounded-50
      //               padding 18, flex-col, gap 10
      //   track:      fills remaining vertical space (rotated slider-pill)
      //   cap:        56 circle at bottom, active by default (#d5d5d5 bg)
      //
      // variant:
      //   icon    → slider handle glyph ('brightness' | 'music' | …)
      //   capIcon → mode cap glyph ('moon' | 'mute' | …)
      //   capOn   → cap active state (default true — matches Figma)
      //   percent → slider fill 0..100
      var spnv = (comp && comp.variant) || {};
      var spnPct    = spnv.percent != null ? spnv.percent : 62;
      var spnIcon   = spnv.icon    || 'brightness';
      var spnCapI   = spnv.capIcon || 'moon';
      var spnCapOn  = spnv.capOn !== false; // default true per Figma
      var spnSlider = window.renderAtomicForRole(
        { role: 'slider-pill', variant: { orient: 'vertical', icon: spnIcon, percent: spnPct } },
        { w: 56, h: 200 }
      );
      var spnCap = window.renderAtomicForRole(
        { role: 'toggle-chip', variant: { icon: spnCapI, on: spnCapOn } },
        { w: 56, h: 56 }
      );
      return '<div style="width:100%;height:100%;' +
        'background:rgba(23,23,26,0.6);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);' +
        'border:1px solid rgba(255,255,255,0.2);border-radius:50px;' +
        'padding:18px;box-sizing:border-box;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;' +
        'overflow:hidden;">' +
        '<div style="flex:1;min-height:0;width:100%;display:flex;align-items:stretch;justify-content:center;">' + spnSlider + '</div>' +
        '<div style="flex-shrink:0;width:56px;height:56px;">' + spnCap + '</div>' +
      '</div>';
    }

    case 'single-toggle': {
      // Figma "Single Toggle" component (1003:13051, 1003:13038, 1006:14473,
      // 1006:14489). Four exact variant combinations:
      //   width='single' + kind='toggle'   → 88×88  icon-only (Figma 987:17561)
      //   width='single' + kind='shortcut' → 88×88  open-arrow only (985:13445)
      //   width='half'   + kind='toggle'   → 199×88 icon + title/sub (544:1012)
      //   width='half'   + kind='shortcut' → 199×88 arrow + title/sub (544:1044)
      // Glass pill: bg rgba(23,23,26,0.6), border 1px rgba(255,255,255,0.2),
      //             rounded 50.
      var stv = (comp && comp.variant) || {};
      var stWidth = stv.width || 'half';
      var stKind  = stv.kind  || 'toggle';
      var stTitle = stv.title || 'Title';
      var stSub   = stv.sub || stv.subtitle || 'Subtitle';
      var stShowSub = stv.showSubtitle !== false;
      var stIcon  = stv.icon || 'add';
      var stOn    = stv.on === true;
      var glass   = 'background:rgba(23,23,26,0.6);border:1px solid rgba(255,255,255,0.2);border-radius:50px;box-sizing:border-box;';

      // Reusable 56-circle. Delegates to the `toggle-chip` atomic so the
      // full icon library (Wi-Fi / Mobile Data / Bluetooth / …) is picked
      // up correctly — previously this helper was hardcoded to check/plus
      // glyphs, which made every single-toggle render the wrong icon.
      function _stChip(on, iconKey) {
        return window.renderAtomicForRole(
          { role: 'toggle-chip', variant: { icon: iconKey, on: on } },
          { w: 56, h: 56 }
        );
      }
      // Shortcut left icon — 34×34 in a 32.5×35 holder (per Figma). Default
      // is the "open" arrow (navigation cue). `variant.icon` can override
      // with any key in SHORTCUT_ICONS below — e.g. 'song-search' renders
      // the Figma media_volume speaker+waves glyph (node 340:8807) for the
      // Samsung Song Search affordance.
      var SHORTCUT_ICONS = {
        'open':        '<path d="M14 5h5v5M19 5l-9 9M10 7H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
        // Figma 340:8807 media_volume — speaker cone + two wave arcs.
        // Proportions match the 19.69%/14.04%/24.53%/14.32% insets at 24×24.
        'song-search':'<path d="M4 10v4h3l4 3.5V6.5L7 10H4z" fill="currentColor"/>' +
                      '<path d="M14 9.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>' +
                      '<path d="M17 6.5a7 7 0 0 1 0 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
        'smart-view': '<rect x="3" y="5" width="18" height="11" rx="1.5" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M10 9l5 2.5-5 2.5V9z" fill="currentColor"/>'
      };
      function _stShortcutIcon(iconKey) {
        var path = SHORTCUT_ICONS[iconKey] || SHORTCUT_ICONS['open'];
        // Holder sized to match the toggle chip's 56 circle footprint, with
        // the SVG rendered at 26px for clear visibility. Figma's raw
        // 32.5×35 + p-13 holder math would clip the glyph to ~7×9, which
        // is what caused the "icons are too small" bug in the reference.
        return '<div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" style="color:#fff;">' + path + '</svg>' +
        '</div>';
      }
      // Shortcut variants get `data-shortcut` so the delegated interact-mode
      // click handler can flash a quick press animation — navigation-style
      // feedback without needing to route to a real destination.
      var shortcutAttr = (stKind === 'shortcut') ? ' data-shortcut="1"' : '';

      if (stWidth === 'single') {
        // 88×88 centered. 'toggle' = 56 circle; 'shortcut' = 34 arrow.
        var innerSingle = stKind === 'shortcut' ? _stShortcutIcon(stIcon) : _stChip(stOn, stIcon);
        return '<div' + shortcutAttr + ' style="width:88px;height:88px;max-width:88px;max-height:88px;' + glass +
          'display:flex;align-items:center;justify-content:center;transition:transform 120ms ease,background 160ms ease;' +
          (stKind === 'shortcut' ? 'padding:24px;' : 'padding:10px 0;') + '">' +
          innerSingle +
        '</div>';
      }

      // half: 199×88 — left icon (toggle or shortcut) + title/sub stacked right.
      var leftHalf = stKind === 'shortcut' ? _stShortcutIcon(stIcon) : _stChip(stOn, stIcon);
      var padX = stKind === 'shortcut' ? 'padding:24px 25px 24px 20px;' : 'padding:24px 17px;';
      return '<div' + shortcutAttr + ' style="width:199px;height:88px;max-height:88px;' + glass + padX +
        'display:flex;flex-direction:column;align-items:flex-start;justify-content:center;overflow:hidden;color:#fff;font-family:var(--font);transition:transform 120ms ease,background 160ms ease;">' +
        '<div style="display:flex;align-items:center;gap:10px;width:100%;">' +
          leftHalf +
          '<div style="flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;">' +
            '<div style="font-size:16px;font-weight:600;color:#efeef2;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + stTitle + '</div>' +
            (stShowSub ? '<div style="font-size:14px;font-weight:400;color:#cfcccf;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + stSub + '</div>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }

    case 'smart-things': {
      // Figma SmartThings (1006:14505 / 544:1020) — 415×88, glass pill
      // with a device icon + 2-line title/sub on the left and up to 3
      // circular action toggles on the right. Every dimension mirrors the
      // Figma component 1:1. variant.actions = array of up to 3 icon keys.
      var stmv = (comp && comp.variant) || {};
      var stmTitle = stmv.title || 'Title';
      var stmSub   = stmv.sub || stmv.subtitle || 'Subtitle';
      var stmShowSub = stmv.showSubtitle !== false;
      // actionCount: 1 (compact — single output chip on right, as in the
      //              QS compact/minimal reference) or 3 (Full — Figma default).
      // variant.actions explicit array overrides actionCount.
      var stmActionCount = (stmv.actionCount === 1) ? 1 : 3;
      var stmActions = Array.isArray(stmv.actions)
        ? stmv.actions.slice(0, 3)
        : (stmActionCount === 1
          ? ['power']
          : ['smart-view', 'remote', 'power']);
      var stmActiveIdx = (stmv.activeIndex != null) ? stmv.activeIndex : -1;

      // Device icon on the left — Figma 552:1513 "tv outline" glyph.
      //   screen: rounded rectangle (~17.5×11.5) with stroke
      //   stand: horizontal bar at the bottom
      //   stem: thin vertical line connecting screen to stand
      // Rendered at 30×30 SVG inside a 44×44 holder so the glyph reads
      // clearly alongside the title text (matches Figma visual weight even
      // though we abandoned Figma's clipped 32.5×35 p-13 container math).
      var deviceGlyph = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" style="color:#efeef2;">' +
        '<rect x="3" y="4" width="18" height="12" rx="1.5" stroke="currentColor" stroke-width="1.8" fill="none"/>' +
        '<path d="M8 20h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="M12 16v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      '</svg>';

      var ACTION_SVGS = {
        'smart-view': '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" style="color:#fff;"><rect x="3" y="5" width="18" height="12" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M12 9l4 2.5-4 2.5V9z" fill="currentColor"/></svg>',
        'remote':     '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" style="color:#fff;"><rect x="6" y="3" width="12" height="18" rx="2" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="7" r="1.3" fill="currentColor"/><path d="M9 11h6M9 14h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
        'power':      '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" style="color:#222;"><path d="M12 4v8M6.5 7a7 7 0 1 0 11 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        'refresh':    '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" style="color:#fff;"><path d="M4 12a8 8 0 0 1 14-5l2-2M20 7v4h-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        'play':       '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" style="color:#fff;"><path d="M8 5l10 7-10 7V5z" fill="currentColor"/></svg>',
        'add':        '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" style="color:#fff;"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
      };
      var actionsHtml = stmActions.map(function (key, i) {
        var active = i === stmActiveIdx;
        var bg = active ? '#d5d5d5' : 'rgba(180,180,180,0.2)';
        var glyph = ACTION_SVGS[key] || ACTION_SVGS['add'];
        // When active, swap stroke to dark so the glyph is visible on #d5d5d5
        if (active) glyph = glyph.replace("color:#fff", "color:#222");
        return '<div data-toggle-chip data-on="' + (active ? '1' : '0') + '" ' +
          'style="width:51.67px;height:51.67px;aspect-ratio:1;border-radius:63.636px;' +
            'background:' + bg + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + glyph + '</div>';
      }).join('');

      return '<div style="width:415px;height:88px;max-height:88px;' +
        'background:rgba(23,23,26,0.6);border:1px solid rgba(255,255,255,0.2);' +
        'border-radius:50px;padding:24px 17px 24px 20px;gap:20px;box-sizing:border-box;' +
        'display:flex;align-items:center;overflow:hidden;color:#fff;font-family:var(--font);">' +
        // Left: icon + title/sub
        '<div style="flex:1;min-width:0;display:flex;align-items:center;gap:10px;">' +
          '<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + deviceGlyph + '</div>' +
          '<div style="display:flex;flex-direction:column;min-width:0;">' +
            '<div style="font-size:16px;font-weight:600;color:#efeef2;line-height:1.2;width:138px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + stmTitle + '</div>' +
            (stmShowSub ? '<div style="font-size:14px;font-weight:400;color:#cfcccf;line-height:1.3;width:138px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + stmSub + '</div>' : '') +
          '</div>' +
        '</div>' +
        // Right: action circles
        '<div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:flex-end;gap:10px;">' + actionsHtml + '</div>' +
      '</div>';
    }

    case 'control-pill': {
      // QS control row: left circular icon + 2-line text + optional right
      // icon. Used for "SmartThings / Device control" and stand-alone
      // "Modes" row in the three QS states. variant keys:
      //   icon: 'smartthings'|'modes'|'wifi' — left circle glyph
      //   title, sub: two text lines
      //   rightIcon: 'refresh'|'chevron'|null — right-side accessory
      var cpv = (comp && comp.variant) || {};
      var cpIcon = cpv.icon || 'smartthings';
      var cpTitle = cpv.title || 'SmartThings';
      var cpSub   = cpv.sub || '';
      var cpRight = cpv.rightIcon || null;
      var LEFT_SVGS = {
        'smartthings':'<circle cx="12" cy="12" r="2.2" fill="#222"/><circle cx="12" cy="5" r="1.6" fill="#222"/><circle cx="12" cy="19" r="1.6" fill="#222"/><circle cx="5" cy="12" r="1.6" fill="#222"/><circle cx="19" cy="12" r="1.6" fill="#222"/><path d="M12 7.5v3M12 13.5v3M7 12h3M14 12h3" stroke="#222" stroke-width="1.4" stroke-linecap="round"/>',
        'modes':      '<circle cx="12" cy="12" r="7.5" stroke="#222" stroke-width="1.6"/><path d="M12 5v7l5 2.5" stroke="#222" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
        'wifi':       '<path d="M5 10a12 12 0 0 1 14 0M7 13.5a8 8 0 0 1 10 0M9 17a4 4 0 0 1 6 0" stroke="#222" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="20" r="1.4" fill="#222"/>'
      };
      var RIGHT_SVGS = {
        'refresh':  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 0 1 14-5l2-2M20 7v4h-4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        'chevron':  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      };
      var leftSvg = LEFT_SVGS[cpIcon] || LEFT_SVGS['smartthings'];
      var rightBlock = '';
      if (cpRight && RIGHT_SVGS[cpRight]) {
        rightBlock = '<div style="width:44px;height:44px;border-radius:50%;background:rgba(180,180,180,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:8px;">' + RIGHT_SVGS[cpRight] + '</div>';
      }
      return '<div style="width:100%;height:100%;min-height:64px;background:rgba(120,120,125,0.28);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-radius:36px;padding:10px 14px 10px 10px;box-sizing:border-box;display:flex;align-items:center;gap:12px;color:#fff;font-family:var(--font);">' +
        '<div style="width:44px;height:44px;border-radius:50%;background:#d5d5d5;flex-shrink:0;display:flex;align-items:center;justify-content:center;">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none">' + leftSvg + '</svg>' +
        '</div>' +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;overflow:hidden;">' +
          '<div style="font-size:14px;font-weight:600;line-height:1.2;">' + cpTitle + '</div>' +
          (cpSub ? '<div style="font-size:11px;line-height:1.3;opacity:0.75;">' + cpSub + '</div>' : '') +
        '</div>' +
        rightBlock +
      '</div>';
    }

    case 'media-output-row': {
      // "♪ Play music                     Media output"  label row
      // used in QS compact/minimal above the Smart View / Song Search tiles.
      var mor = (comp && comp.variant) || {};
      var morL = mor.left  || 'Play music';
      var morR = mor.right || 'Media output';
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 16px;box-sizing:border-box;color:#fff;font-family:var(--font);font-size:13px;">' +
        '<div style="display:flex;align-items:center;gap:8px;"><span style="opacity:0.85;">\u266B</span><span>' + morL + '</span></div>' +
        '<div style="opacity:0.85;">' + morR + '</div>' +
      '</div>';
    }

    case 'qs-action-tile': {
      // Pill tile used for "Smart View / Mirror screen" and "Song Search"
      // at the bottom of QS. Left circular icon badge + 2-line text.
      var qat = (comp && comp.variant) || {};
      var qatIcon = qat.icon || 'smart-view';
      var qatTitle = qat.title || 'Smart View';
      var qatSub   = qat.sub || 'Mirror screen';
      var ICON_SVGS = {
        'smart-view':'<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="12" rx="1.5" stroke="#222" stroke-width="1.6"/><path d="M12 9l4 2.5-4 2.5V9z" fill="#222"/></svg>',
        'song-search':'<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 17V6l10-2v11" stroke="#222" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="17" r="2.4" stroke="#222" stroke-width="1.6"/><circle cx="17" cy="15" r="2.4" stroke="#222" stroke-width="1.6"/></svg>'
      };
      var qatSvg = ICON_SVGS[qatIcon] || ICON_SVGS['smart-view'];
      return '<div style="width:100%;height:100%;min-height:56px;background:rgba(120,120,125,0.28);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-radius:32px;padding:8px 14px 8px 8px;box-sizing:border-box;display:flex;align-items:center;gap:10px;color:#fff;font-family:var(--font);">' +
        '<div style="width:40px;height:40px;border-radius:50%;background:#d5d5d5;flex-shrink:0;display:flex;align-items:center;justify-content:center;">' + qatSvg + '</div>' +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;overflow:hidden;">' +
          '<div style="font-size:13px;font-weight:600;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + qatTitle + '</div>' +
          '<div style="font-size:11px;line-height:1.3;opacity:0.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + qatSub + '</div>' +
        '</div>' +
      '</div>';
    }

    case 'app-dock': {
      // Samsung Home dock — real PNG app icons, label-less.
      var dc = (comp && comp.content) || {};
      var defaultApps = ['Phone', 'Messages', 'Internet', 'Camera'];
      var apps = Array.isArray(dc.apps) ? dc.apps : defaultApps;

      function dockIconHTML(appName) {
        // Map label → filename in /app-icons/. Falls back to a glyph tile.
        var map = {
          'Phone':'Phone.png', 'Messages':'Messages.png', 'Internet':'Internet.png',
          'Camera':'Camera.png', 'Gallery':'Gallery.png', 'Contacts':'Contacts.png',
          'Settings':'Settings.png', 'Clock':'Clock.png', 'Weather':'Weather.png',
          'Calculator':'Calculator.png', 'Calendar':'Clock.png', 'Notes':'Notes.png',
          'Cloud':'Cloud.png', 'Health':'Health.png', 'Reminder':'Reminder.png',
          'Store':'Store.png', 'SmartThings':'SmartThings.png'
        };
        var file = map[appName] || null;
        if (file) {
          return '<img src="app-icons/' + file + '" style="width:56px;height:56px;border-radius:16px;object-fit:cover;flex-shrink:0;">';
        }
        var glyph = (appName || '·').charAt(0).toUpperCase();
        return '<div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#4285F4,#0381FE);display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;' +
          _T('heading', { weight: 'bold' }) + '">' + glyph + '</div>';
      }

      var iconsHTML = apps.slice(0, 5).map(dockIconHTML).join('');
      return '<div style="width:100%;height:100%;border-radius:' + _R('pill') + ';' +
        _G('widgetPill') +
        'display:flex;align-items:center;justify-content:space-around;padding:0 12px;box-sizing:border-box;">' +
        iconsHTML +
      '</div>';
    }

    case 'bottom-bar': {
      var bbc = (comp && comp.content) || {};
      var actions = Array.isArray(bbc.actions) ? bbc.actions : [{ label: 'Back' }, { label: 'Save' }, { label: 'Share' }];

      function barIconFor(label) {
        var lc = (label || '').toLowerCase();
        var c = 'currentColor';
        var s = 'width="16" height="16" viewBox="0 0 24 24" fill="none"';
        if (/back|cancel|close/.test(lc)) return '<svg ' + s + '><path d="M15 6l-6 6 6 6" stroke="' + c + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        if (/save|bookmark/.test(lc))      return '<svg ' + s + '><path d="M6 4h12v16l-6-4-6 4V4z" stroke="' + c + '" stroke-width="1.7" stroke-linejoin="round"/></svg>';
        if (/share/.test(lc))              return '<svg ' + s + '><circle cx="18" cy="6" r="2" stroke="' + c + '" stroke-width="1.7"/><circle cx="6" cy="12" r="2" stroke="' + c + '" stroke-width="1.7"/><circle cx="18" cy="18" r="2" stroke="' + c + '" stroke-width="1.7"/><path d="M8 11l8-4M8 13l8 4" stroke="' + c + '" stroke-width="1.5"/></svg>';
        if (/done|confirm|ok|check/.test(lc))  return '<svg ' + s + '><path d="M5 12l5 5 9-11" stroke="' + c + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        if (/delete|trash|remove/.test(lc))    return '<svg ' + s + '><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14" stroke="' + c + '" stroke-width="1.6" stroke-linejoin="round"/></svg>';
        if (/edit|pencil/.test(lc))           return '<svg ' + s + '><path d="M4 20l4-1 10-10-3-3L5 16l-1 4z" stroke="' + c + '" stroke-width="1.6" stroke-linejoin="round"/></svg>';
        if (/cart|buy|order/.test(lc))        return '<svg ' + s + '><path d="M4 5h2l2 12h11l2-8H7" stroke="' + c + '" stroke-width="1.7" stroke-linejoin="round"/></svg>';
        if (/like|heart|favor/.test(lc))      return '<svg ' + s + '><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" stroke="' + c + '" stroke-width="1.7" stroke-linejoin="round"/></svg>';
        return '';
      }

      var actHTML = actions.slice(0, 4).map(function (a) {
        var lbl = (a && (a.label || a.text)) || '';
        var icon = barIconFor(lbl);
        return '<div style="display:flex;align-items:center;gap:6px;color:#fff;">' +
          (icon ? '<span style="display:flex;align-items:center;line-height:0;">' + icon + '</span>' : '') +
          '<span style="' + _T('caption', { weight: 'semibold' }) + '">' + lbl + '</span>' +
        '</div>';
      }).join('');

      return '<div style="width:100%;height:100%;border-radius:' + _R('pill') + ';' +
        _G('widgetPill') +
        'display:flex;align-items:center;justify-content:space-around;padding:0 14px;box-sizing:border-box;">' +
        actHTML +
      '</div>';
    }

    case 'bottom-dialog':
      // Light surface — typography color override
      return '<div style="width:100%;height:100%;border-radius:' + _R('dialog') + ' ' + _R('dialog') + ' 0 0;background:#f1f1f4;color:#111;padding:' + _S('4xl') + ';box-sizing:border-box;">' +
        '<div style="' + _T('heading', { weight: 'bold', color: '#111' }) + '">Dialog header</div>' +
        '<div style="' + _T('label', { color: '#666' }) + 'margin-top:' + _S('md') + ';">Dialog description</div>' +
        '<div style="display:flex;justify-content:space-between;margin-top:24px;' + _T('body', { color: '#111' }) + '"><span>Action 1</span><span>Action 2</span></div>' +
      '</div>';

    case 'center-dialog':
      return '<div style="width:100%;height:100%;border-radius:' + _R('dialog') + ';background:#f1f1f4;color:#111;padding:' + _S('4xl') + ';box-sizing:border-box;">' +
        '<div style="' + _T('heading', { weight: 'bold', color: '#111' }) + '">Center dialog</div>' +
        '<div style="' + _T('label', { color: '#666' }) + 'margin-top:' + _S('md') + ';">Blocking or loading state</div>' +
      '</div>';

    case 'lock-time':
      // hero size, clock family (SamsungNrDefault-V6), bold
      return '<div style="width:100%;height:100%;display:flex;align-items:flex-start;' +
        _T('hero', { family: 'clock', weight: 'bold' }) +
      '">12:45</div>';

    case 'lock-date':
      return '<div style="width:100%;height:100%;display:flex;align-items:center;' +
        _T('heading', { color: 'translucentLabel' }) +
      '">Tue, Apr 20</div>';

    case 'lock-shortcuts':
      // shortcutCircle glass tier; radius via circle token
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;">' +
        '<div style="width:48px;height:48px;border-radius:50%;' + _G('shortcutCircle') + '"></div>' +
        '<div style="width:48px;height:48px;border-radius:50%;' + _G('shortcutCircle') + '"></div>' +
      '</div>';

    case 'quick-settings-panel':
      return A.QSScreen
        ? A.QSScreen()
        : '<div style="width:100%;height:100%;border-radius:' + _R('panel') + ' ' + _R('panel') + ' 0 0;' + _G('panel') + '"></div>';

    case 'background':
      return A.Background ? A.Background() : '';

    case 'scrim':
      return '<div style="width:100%;height:100%;background:rgba(0,0,0,0.42);"></div>';

    default:
      return '<div style="width:100%;height:100%;border-radius:16px;background:rgba(255,255,255,0.08);"></div>';
  }
};

window.renderSurfacePlan = function renderSurfacePlan(canvas, plan, layout) {
  canvas.innerHTML = '';
  canvas.dataset.rulesMode = '1';
  canvas.style.position = 'relative';
  canvas.style.display = 'block';
  canvas.style.width = layout.viewport.width + 'px';
  canvas.style.height = layout.viewport.height + 'px';
  canvas.style.padding = '0';
  canvas.style.gap = '0';
  canvas.style.overflow = 'hidden';

  for (const comp of plan.components) {
    const rect = window.resolveComponentRect(comp, layout, plan);
    const wrapper = document.createElement('div');
    wrapper.className = 'canvas-item surface-item';
    wrapper.id = comp.id;
    wrapper.dataset.role = comp.role;
    wrapper.setAttribute('data-role', comp.role);
    wrapper.dataset.nodeId = comp.id;

    wrapper.style.position = 'absolute';
    wrapper.style.left = rect.x + 'px';
    wrapper.style.top = rect.y + 'px';
    wrapper.style.width = rect.w + 'px';
    wrapper.style.height = rect.h + 'px';

    if (comp.role === 'background' || comp.role === 'scrim') {
      wrapper.style.pointerEvents = 'none';
    }

    wrapper.innerHTML = window.renderAtomicForRole(comp, rect);

    // Expanded children (list-item, focus-block cells, paragraphs, etc.)
    // get drag-drop reorder handlers. Identified by presence of `_rect`
    // (pre-computed during container expansion).
    if (comp._rect && window.attachReorderHandlers) {
      window.attachReorderHandlers(wrapper, comp.id);
    }

    canvas.appendChild(wrapper);
  }
};

// ============================================================================
// Drag-drop reorder for grouped children (list-items, widget cells, paragraphs,
// notif cards, palette-added items in the same column).
// ============================================================================
window.attachReorderHandlers = function attachReorderHandlers(el, nodeId) {
  if (!el || el.dataset.reorderBound === '1') return;
  el.dataset.reorderBound = '1';
  el.setAttribute('draggable', 'true');

  el.addEventListener('dragstart', function (e) {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', nodeId);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
    // Suppress hover overlay during drag
    if (typeof window.setHoveredNode === 'function') window.setHoveredNode(null);
  });

  el.addEventListener('dragend', function () {
    el.classList.remove('dragging');
    document.querySelectorAll('.drag-insert-before, .drag-insert-after')
      .forEach(function (n) { n.classList.remove('drag-insert-before', 'drag-insert-after'); });
  });

  el.addEventListener('dragover', function (e) {
    // Only accept drops from other draggable same-column items
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    var rect = el.getBoundingClientRect();
    var mid = rect.top + rect.height / 2;
    el.classList.remove('drag-insert-before', 'drag-insert-after');
    if (e.clientY < mid) el.classList.add('drag-insert-before');
    else el.classList.add('drag-insert-after');
  });

  el.addEventListener('dragleave', function () {
    el.classList.remove('drag-insert-before', 'drag-insert-after');
  });

  el.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('drag-insert-before', 'drag-insert-after');
    var sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === nodeId) return;
    if (window.DesignDoc && typeof window.DesignDoc.reorderInColumn === 'function') {
      window.DesignDoc.reorderInColumn(sourceId, nodeId);
    }
  });
};

// Render the given surface type into #canvas.
// Fires EXACTLY ONE DesignDoc subscribe event ('hydrate') at the end.
// Callers (scene buttons, agent fallback, skeleton loader) rely on this
// single-event contract so scene-inspector + interaction-overlay don't
// double-refresh.
window.generateSurfaceScenario = function generateSurfaceScenario(surfaceType) {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  const viewport = { width: 451, height: 978 };
  const layout = window.createOneUILayout(viewport, surfaceType);
  const plan = window.composeSurfacePlan(surfaceType, layout);
  // Expand compositional roles into individual editable nodes.
  window.expandContainerComponents(plan, layout);
  window.renderSurfacePlan(canvas, plan, layout);

  // Single hydrate — emits one 'hydrate' event to subscribers.
  if (window.DesignDoc && typeof window.DesignDoc.hydrateFromPlan === 'function') {
    window.DesignDoc.hydrateFromPlan(plan, surfaceType);
  }
};

// ============================================================================
// Expandable app bar — 2-state snap logic (expanded / collapsed only)
// Per One UI guide: no resting mid-state. Threshold-based snap on scroll.
// ============================================================================

window.setExpandableAppBarState = function setExpandableAppBarState(el, state) {
  if (!el) return;
  const isExpanded = state === 'expanded';

  el.dataset.appBarState = isExpanded ? 'expanded' : 'collapsed';

  const title = el.querySelector('[data-appbar-title]') || el.firstElementChild;
  if (title) {
    title.style.transition = 'font-size 220ms cubic-bezier(0.2,0,0,1), transform 220ms cubic-bezier(0.2,0,0,1), opacity 220ms cubic-bezier(0.2,0,0,1)';
  }

  el.style.transition = 'height 220ms cubic-bezier(0.2,0,0,1), top 220ms cubic-bezier(0.2,0,0,1)';
  el.style.height = isExpanded ? '215px' : '56px';

  if (title) {
    title.style.fontSize = isExpanded ? '32px' : '20px';
    title.style.transform = isExpanded ? 'translateY(0)' : 'translateY(-2px)';
  }
};

window.enableExpandableAppBarSnap = function enableExpandableAppBarSnap(canvas, surfaceType) {
  if (!canvas) return;
  if (
    surfaceType !== (window.SURFACE_TYPES?.FIRST_DEPTH_LIST || 'first-depth-list') &&
    surfaceType !== (window.SURFACE_TYPES?.SECOND_DEPTH_DETAIL || 'second-depth-detail')
  ) return;

  const appBar = canvas.querySelector('[data-role="expandable-app-bar"], .canvas-item[data-role="expandable-app-bar"]');
  const scrollBody =
    canvas.querySelector('[data-role="list"]') ||
    canvas.querySelector('[data-role="detail-content"]') ||
    canvas.querySelector('.canvas-item[data-role="list"]') ||
    canvas.querySelector('.canvas-item[data-role="detail-content"]');

  if (!appBar || !scrollBody) return;
  if (appBar.dataset.snapBound === '1') return;

  appBar.dataset.snapBound = '1';
  appBar.dataset.appBarState = appBar.dataset.appBarState || 'expanded';

  scrollBody.style.overflowY = 'auto';
  scrollBody.style.webkitOverflowScrolling = 'touch';

  let ticking = false;
  let lastScrollTop = 0;

  function applySnap() {
    ticking = false;
    const st = scrollBody.scrollTop;
    const threshold = 48;

    if (st <= 0) {
      window.setExpandableAppBarState(appBar, 'expanded');
      lastScrollTop = st;
      return;
    }

    if (st > threshold) {
      window.setExpandableAppBarState(appBar, 'collapsed');
    } else {
      window.setExpandableAppBarState(appBar, 'expanded');
    }

    lastScrollTop = st;
  }

  scrollBody.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(applySnap);
    }
  });

  scrollBody.addEventListener('touchend', () => {
    applySnap();
  });

  scrollBody.addEventListener('mouseup', () => {
    applySnap();
  });
};

// ============================================================================
//  Interact-mode delegated handlers for surface atomics
//  ---------------------------------------------------------------------------
//  Atomics (toggle-chip, slider-pill, etc.) are rendered as innerHTML strings,
//  which means per-element onclick can't easily survive re-renders from
//  composeSurfacePlan. Instead we delegate from document:
//    - Clicks only take effect when body.cmd-interact-mode is set
//    - We stopPropagation so the canvas click handler doesn't run selection
//  The handler is idempotent — bind once.
// ============================================================================
(function () {
  if (window._atomicInteractBound) return;
  window._atomicInteractBound = true;

  function _inInteractMode(e) {
    return !!(e && (e.metaKey || e.ctrlKey)) ||
           document.body.classList.contains('cmd-interact-mode');
  }

  // --- Toggle chip: click anywhere on the 56×56 circle flips on/off --------
  document.addEventListener('click', function (e) {
    if (!_inInteractMode(e)) return;
    var chip = e.target.closest('[data-toggle-chip]');
    if (!chip) return;
    e.stopPropagation();
    var on = chip.getAttribute('data-on') === '1';
    var next = !on;
    chip.setAttribute('data-on', next ? '1' : '0');
    chip.style.background = next ? '#d5d5d5' : 'rgba(180,180,180,0.2)';
    var onEl = chip.querySelector('[data-toggle-on]');
    var offEl = chip.querySelector('[data-toggle-off]');
    if (onEl) onEl.style.display = next ? 'inline-flex' : 'none';
    if (offEl) offEl.style.display = next ? 'none' : 'inline-flex';
  }, true);

  // --- Shortcut / navigation press animation -------------------------------
  // `[data-shortcut]` marks single-toggle kind='shortcut' and any other
  // Figma atomics that represent a navigation action (open another screen).
  // No state changes — just a quick press-ripple so the click feels real.
  document.addEventListener('click', function (e) {
    if (!_inInteractMode(e)) return;
    var btn = e.target.closest('[data-shortcut]');
    if (!btn) return;
    e.stopPropagation();
    btn.style.transform = 'scale(0.96)';
    btn.style.background = 'rgba(23,23,26,0.5)';
    setTimeout(function () {
      btn.style.transform = '';
      btn.style.background = '';
    }, 140);
  }, true);

  // --- Slider pill: pointer-drag updates fill in %. Works for both
  // horizontal and vertical orientations (data-orient="vertical").
  // Vertical fill grows bottom→top, so we invert the Y axis.
  var _drag = null;
  function _setPctFromPoint(pill, clientX, clientY) {
    var rect = pill.getBoundingClientRect();
    var vertical = pill.getAttribute('data-orient') === 'vertical';
    var raw;
    if (vertical) {
      // Invert: pointer near top = 100%, near bottom = 0%
      raw = 1 - (clientY - rect.top) / Math.max(1, rect.height);
    } else {
      raw = (clientX - rect.left) / Math.max(1, rect.width);
    }
    var pct = Math.round(Math.max(0, Math.min(1, raw)) * 100);
    pill.setAttribute('data-pct', String(pct));
    var fill = pill.querySelector('[data-slider-fill]');
    if (!fill) return;
    if (vertical) fill.style.height = pct + '%';
    else          fill.style.width  = pct + '%';
  }
  document.addEventListener('pointerdown', function (e) {
    if (!_inInteractMode(e)) return;
    var pill = e.target.closest('[data-slider-pill]');
    if (!pill) return;
    e.stopPropagation();
    e.preventDefault();
    _drag = pill;
    try { pill.setPointerCapture(e.pointerId); } catch (_) {}
    _setPctFromPoint(pill, e.clientX, e.clientY);
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (!_drag) return;
    _setPctFromPoint(_drag, e.clientX, e.clientY);
  }, true);
  document.addEventListener('pointerup', function () { _drag = null; }, true);
  document.addEventListener('pointercancel', function () { _drag = null; }, true);
})();
