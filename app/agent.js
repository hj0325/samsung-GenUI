// ============================================================================
//  app/agent.js — external agent API + render/state adapters
//  ---------------------------------------------------------------------------
//  AgentAPI.health/generateUI/refineUI/runCritic, StateManager, RenderEngine,
//  agent mode toggle, loading overlay.
// ============================================================================

// =============================================
// === AGENT INTEGRATION LAYER ===
// =============================================

// --- Session & Mode ---
let agentSession = {
  id: null,
  mode: 'local',        // 'local' | 'agent'
  endpoint: '',          // auto-detected from current origin
  lastLayoutTree: null,
  lastRenderModel: null,
  lastCritic: null,
  history: []
};

function setAgentMode(mode) {
  agentSession.mode = mode;
  const indicator = document.getElementById('agentModeIndicator');
  if (indicator) {
    indicator.textContent = mode === 'agent' ? 'AI' : 'Local';
    indicator.className = 'agent-mode-indicator ' + (mode === 'agent' ? 'connected' : 'local');
    indicator.title = mode === 'agent'
      ? 'AI mode \u2014 chat prompts call the OpenAI pipeline. Click to switch to Local (keyword matching).'
      : 'Local mode \u2014 chat prompts match pre-built scenarios via keywords. Click to switch to AI (OpenAI pipeline).';
  }
}

// --- API Adapter (calls Node.js proxy → OpenAI) ---
// ────────────────────────────────────────────────────────────────────────────
// LRU prompt cache — skip server roundtrip for identical (prompt + surfaceType
// + mode) requests within 60s. Size-bounded to 10 entries.
// ────────────────────────────────────────────────────────────────────────────
const _promptCache = {
  max: 10,
  ttl: 60 * 1000,   // 60 seconds
  map: new Map(),
  _key(p) {
    return ((p && p.prompt) || '').slice(0, 200) + '|' +
           ((p && p.surfaceType) || '') + '|' +
           ((p && p.mode) || 'dark') + '|' +
           ((p && p.scenario) || '');
  },
  get(payload) {
    var k = this._key(payload);
    var entry = this.map.get(k);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttl) { this.map.delete(k); return null; }
    // LRU bump — re-insert so it's at the tail of iteration order
    this.map.delete(k);
    this.map.set(k, entry);
    return entry.value;
  },
  set(payload, value) {
    var k = this._key(payload);
    this.map.set(k, { value: value, ts: Date.now() });
    while (this.map.size > this.max) {
      var oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }
  },
  clear() { this.map.clear(); }
};

const AgentAPI = {
  _getBase() {
    // If served from Node server (port 3001), use same origin
    // If served from python server (port 3000), call Node server on 3001
    if (agentSession.endpoint) return agentSession.endpoint;
    const port = location.port;
    if (port === '3001') return '';  // same origin
    return 'http://localhost:3001';  // cross-origin to Node server
  },

  async _post(path, payload) {
    const base = this._getBase();
    const res = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `API error: ${res.status}`);
    }
    return res.json();
  },

  async generateUI(payload) {
    // Prompt cache — return instantly for repeat (prompt+surfaceType+mode)
    const cached = _promptCache.get(payload);
    if (cached) {
      // Flag cached responses so callers can update UI state properly
      return Object.assign({}, cached, { __cached: true });
    }
    const res = await this._post('/api/agent/generate', payload);
    if (res && res.renderModel) _promptCache.set(payload, res);
    return res;
  },

  // Streaming generate. Subscribes to SSE events emitted by the server:
  //   onClassified({ surfaceType, intent, hierarchy })  — ~300ms in
  //   onComponent(component)                            — progressive
  //   onDone(response)                                  — final sanitized
  //   onError({ message })
  // Resolves with the final response (same shape as generateUI).
  async generateUIStream(payload, handlers) {
    handlers = handlers || {};
    // Cache hit — short-circuit with synthetic events
    const cached = _promptCache.get(payload);
    if (cached) {
      if (handlers.onClassified) handlers.onClassified({
        surfaceType: cached.renderModel && cached.renderModel.surfaceType,
        intent: cached.layoutTree && cached.layoutTree.intent,
        hierarchy: cached.layoutTree && cached.layoutTree.hierarchy
      });
      const res = Object.assign({}, cached, { __cached: true });
      if (handlers.onDone) handlers.onDone(res);
      return res;
    }

    const base = this._getBase();
    const response = await fetch(base + '/api/agent/generate/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Stream error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResponse = null;
    let streamError = null;

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      // Split SSE frames on blank line (\n\n)
      let frames = buffer.split('\n\n');
      buffer = frames.pop() || '';  // last may be incomplete

      for (const frame of frames) {
        if (!frame.trim()) continue;
        let event = 'message';
        let dataStr = '';
        const lines = frame.split('\n');
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
        }
        if (!dataStr) continue;
        let data;
        try { data = JSON.parse(dataStr); } catch (e) { continue; }

        switch (event) {
          case 'classified':
            if (handlers.onClassified) handlers.onClassified(data);
            break;
          case 'component':
            if (handlers.onComponent) handlers.onComponent(data);
            break;
          case 'done':
            finalResponse = data;
            if (handlers.onDone) handlers.onDone(data);
            break;
          case 'error':
            streamError = data;
            if (handlers.onError) handlers.onError(data);
            break;
        }
      }
    }

    if (streamError) throw new Error(streamError.message || 'Stream error');
    if (!finalResponse) throw new Error('Stream ended without final response');
    if (finalResponse.renderModel) _promptCache.set(payload, finalResponse);
    return finalResponse;
  },

  async refineUI(payload) {
    return this._post('/api/agent/refine', payload);
  },

  async runCritic(payload) {
    return this._post('/api/agent/critic', payload);
  },

  async health() {
    const base = this._getBase();
    const res = await fetch(base + '/api/agent/health');
    if (!res.ok) throw new Error('Not available');
    return res.json();
  }
};

// --- State Manager: bridges agent response → UI ---
const StateManager = {
  currentLayout: null,
  currentRender: null,

  updateFromAgentGenerate(response) {
    // response: { sessionId, layoutTree, renderModel, critic }
    agentSession.id = response.sessionId;
    agentSession.lastLayoutTree = response.layoutTree;
    agentSession.lastRenderModel = response.renderModel;
    agentSession.lastCritic = response.critic;
    this.currentLayout = response.layoutTree;
    this.currentRender = response.renderModel;
    agentSession.history.push({ type: 'generate', timestamp: Date.now(), sessionId: response.sessionId });
  },

  updateFromAgentRefine(response) {
    // response: { parsedIssue, patchPlan, updatedLayoutTree, updatedRenderModel, critic }
    agentSession.lastLayoutTree = response.updatedLayoutTree;
    agentSession.lastRenderModel = response.updatedRenderModel;
    agentSession.lastCritic = response.critic;
    this.currentLayout = response.updatedLayoutTree;
    this.currentRender = response.updatedRenderModel;
    agentSession.history.push({ type: 'refine', timestamp: Date.now() });
  },

  getGeneratePayload(scenarioKey, promptText) {
    const frame = document.getElementById('canvasFrame');
    const device = document.querySelector('.device-selector-btn .dev-name')?.textContent || 'Galaxy S26';
    const mode = document.body.classList.contains('light-mode') ? 'light' : 'dark';

    const scenarioToSurface = {
      lockscreen: window.SURFACE_TYPES?.LOCKSCREEN || 'lockscreen',
      lock: window.SURFACE_TYPES?.LOCKSCREEN || 'lockscreen',
      home: window.SURFACE_TYPES?.TAB_ROOT || 'tab-root',
      feed: window.SURFACE_TYPES?.FIRST_DEPTH_LIST || 'first-depth-list',
      list: window.SURFACE_TYPES?.FIRST_DEPTH_LIST || 'first-depth-list',
      detail: window.SURFACE_TYPES?.SECOND_DEPTH_DETAIL || 'second-depth-detail',
      dialog: window.SURFACE_TYPES?.DIALOG_BOTTOM || 'dialog-bottom',
      notifications: window.SURFACE_TYPES?.NOTIFICATION_SHADE || 'notification-shade',
      notification: window.SURFACE_TYPES?.NOTIFICATION_SHADE || 'notification-shade',
      notif: window.SURFACE_TYPES?.NOTIFICATION_SHADE || 'notification-shade',
      quicksettings: window.SURFACE_TYPES?.QUICK_SETTINGS || 'quick-settings',
      quickSettings: window.SURFACE_TYPES?.QUICK_SETTINGS || 'quick-settings',
      qs: window.SURFACE_TYPES?.QUICK_SETTINGS || 'quick-settings',
      selection: window.SURFACE_TYPES?.SELECTION_MODE || 'selection-mode'
    };

    const surfaceType =
      scenarioToSurface[scenarioKey] ||
      window.currentSurfaceType ||
      window.SURFACE_TYPES?.FIRST_DEPTH_LIST ||
      'first-depth-list';

    // NOTE: surface-grammar rules are in the server's system prompt
    // (buildGenerateSystemPrompt). We don't duplicate them here — that
    // was 2KB of wasted tokens per request. Pass the raw user prompt.
    return {
      sessionId: agentSession.id,
      scenario: scenarioKey,
      surfaceType: surfaceType,
      prompt: promptText || '',
      surface: currentBrand,
      device: device,
      mode: mode,
      constraints: {
        canvasWidth: 451,
        canvasHeight: 978,
        designSystem: currentBrand,
        wallpaper: frame?.style.background || 'none',
        useSurfaceGrammar: true,
        requireAbsoluteSlotLayout: true,
        safeMarginDp: 24,
        appBarSnapStates: ['expanded', 'collapsed']
      },
      referenceImage: window._refImageData || null
    };
  },

  getRefinePayload(feedback, tags, snapshot) {
    const selectedNodeIds = Array.from(selectedItems);
    return {
      sessionId: agentSession.id,
      currentLayout: agentSession.lastLayoutTree,
      currentRenderModel: agentSession.lastRenderModel,
      activeVariant: activeVariant,
      variantContext: {
        A: variants.A.generated ? { prompt: variants.A.prompt, scenario: variants.A.scenario, critic: variants.A.critic } : null,
        B: variants.B.generated ? { prompt: variants.B.prompt, scenario: variants.B.scenario, critic: variants.B.critic } : null
      },
      feedback: feedback,
      issueTags: Array.from(tags),
      selectedNodes: selectedNodeIds,
      snapshot: {
        items: snapshot.items.map(it => ({
          id: it.id,
          styles: it.styles,
          textContent: it.textContent,
          rect: { width: it.rect.width, height: it.rect.height, top: it.rect.top, left: it.rect.left }
        })),
        canvasStyle: snapshot.canvasStyle
      }
    };
  }
};

// Infer the surface-grammar zone for an agent-supplied component role
// when the agent didn't set an explicit zone. Used by renderFromModel
// to slot AI-picked atomics (now-bar, media-card, focus-block, etc.)
// into the right region of the canned surface plan — otherwise they
// fall through the role-merge filter and never render.
function _inferZoneForAgentRole(role) {
  if (!role) return 'interaction';
  if (role === 'status-bar') return 'topSystem';
  if (role === 'expandable-app-bar' || role === 'collapsed-app-bar' ||
      role === 'selection-app-bar' || role === 'search-bar' ||
      role === 'list-top-bar' || role === 'lock-clock' ||
      role === 'weather-date' || role === 'lock-time' ||
      role === 'lock-date') {
    return 'viewing';
  }
  if (role === 'app-dock' || role === 'bottom-navigation' ||
      role === 'bottom-bar' || role === 'gesture-bar' ||
      role === 'gestureBar' || role === 'bottom-dialog') {
    return 'bottomNav';
  }
  if (role === 'lock-indicator' || role === 'unlock-hint' ||
      role === 'shortcut-left' || role === 'shortcut-right' ||
      role === 'lock-shortcuts' || role === 'now-bar') {
    return 'bottomAction';
  }
  // Content / interactive components (focus-block, list, list-item,
  // media-card, notif-card, toggle-grid, slider-panel, selection-dialog,
  // dialog-shell, etc.) all land in the interaction zone and are
  // stacked vertically within it.
  return 'interaction';
}

// --- Render Engine: renders agent response to DOM ---
const RenderEngine = {
  _normalizeSurfaceType(renderModel) {
    return (
      renderModel?.surfaceType ||
      renderModel?.layout?.surfaceType ||
      renderModel?.meta?.surfaceType ||
      window.currentSurfaceType ||
      window.SURFACE_TYPES?.FIRST_DEPTH_LIST ||
      'first-depth-list'
    );
  },

  _normalizeRenderModel(renderModel) {
    if (!renderModel) return null;

    const out = { ...renderModel };
    out.surfaceType = this._normalizeSurfaceType(renderModel);

    if (!out.layout) out.layout = {};
    out.layout.surfaceType = out.surfaceType;

    if (!Array.isArray(out.components)) out.components = [];

    out.components = out.components.map((comp, idx) => ({
      id: comp.id || `agent-comp-${idx + 1}`,
      role: comp.role || 'gen',
      type: comp.type || null,
      text: comp.text || '',
      html: comp.html || '',
      styles: comp.styles || {},
      motion: comp.motion || '',
      delay: comp.delay || 0,
      fullWidth: !!comp.fullWidth,
      state: comp.state || null,
      zone: comp.zone || null,
      // Preserve semantic content + variant so renderers downstream
      // (renderAtomicForRole, focus-block kind:secondary, now-bar
      // type:media, etc.) can use them. Earlier this was stripped,
      // which is why rich AI components like now-bar always rendered
      // with default (empty) state.
      content: comp.content || null,
      variant: comp.variant || null
    }));

    return out;
  },

  _shouldUseSurfaceRenderer(renderModel) {
    const surfaceType = this._normalizeSurfaceType(renderModel);
    return !!surfaceType && typeof window.generateSurfaceScenario === 'function';
  },

  _mergeAgentOverridesIntoSurface(surfaceType, renderModel) {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;

    const byRole = new Map();
    (renderModel.components || []).forEach(comp => {
      if (!comp.role) return;
      if (!byRole.has(comp.role)) byRole.set(comp.role, comp);
    });

    canvas.querySelectorAll('.canvas-item').forEach(el => {
      const role = el.dataset.role;
      const agentComp = byRole.get(role);
      if (!agentComp) return;

      if (agentComp.html) {
        el.innerHTML = agentComp.html;
      } else if (agentComp.text) {
        const editable = el.querySelector('[contenteditable], button, .oui-appbar-title');
        if (editable) editable.textContent = agentComp.text;
      }

      if (agentComp.styles) {
        Object.assign(el.style, agentComp.styles);
      }

      if (agentComp.state && role === 'expandable-app-bar') {
        el.dataset.appBarState = agentComp.state;
      }
    });
  },

  renderFromModel(renderModel) {
    if (!renderModel) return;

    const normalized = this._normalizeRenderModel(renderModel);
    agentSession.lastRenderModel = normalized;

    const canvas = document.getElementById('canvas');
    if (!canvas) return;

    if (this._shouldUseSurfaceRenderer(normalized)) {
      const surfaceType = normalized.surfaceType;

      clearCanvas();

      // Build plan manually so we can inject agent content BEFORE the
      // expansion step turns "list" into N "list-item" children. Otherwise
      // expansion uses random presets and the agent's semantic content
      // (items / title / description / actions) is thrown away.
      const viewport = { width: 451, height: 978 };
      const layout = window.createOneUILayout(viewport, surfaceType);
      const plan = window.composeSurfacePlan(surfaceType, layout);

      // Pass 1: merge agent content into plan items by role (for chrome
      // components already present in the canned plan — status-bar,
      // app-bar, app-dock, etc.). First match wins.
      const agentByRole = new Map();
      (normalized.components || []).forEach(function (ac) {
        if (!agentByRole.has(ac.role)) agentByRole.set(ac.role, ac);
      });
      const consumedRoles = new Set();
      (plan.components || []).forEach(function (pc) {
        var ac = agentByRole.get(pc.role);
        if (!ac) return;
        consumedRoles.add(pc.role);
        if (ac.id)      pc.id      = ac.id;
        if (ac.text)    pc.text    = ac.text;
        if (ac.state)   pc.state   = ac.state;
        if (ac.content) pc.content = Object.assign({}, pc.content || {}, ac.content);
        if (ac.styles)  pc.styles  = Object.assign({}, pc.styles  || {}, ac.styles);
        if (ac.variant) pc.variant = Object.assign({}, pc.variant || {}, ac.variant);
      });

      // Before Pass 2: if the AI is providing rich interaction-zone
      // content, strip the canned plan's default interaction components
      // (like app-grid for tab-root, detail-content for detail surfaces,
      // focus-block-group for lockscreen) so AI's components don't
      // overlap them. Chrome (status-bar/app-dock/bottom-nav) stays.
      const agentInteractionRoles = new Set();
      (normalized.components || []).forEach(function (ac) {
        if (!ac.role || consumedRoles.has(ac.role)) return;
        const iz = ac.zone || _inferZoneForAgentRole(ac.role);
        if (iz === 'interaction') agentInteractionRoles.add(ac.role);
      });
      if (agentInteractionRoles.size > 0) {
        plan.components = (plan.components || []).filter(function (pc) {
          return pc.zone !== 'interaction';
        });
      }

      // Pass 2: APPEND agent's unique content components that weren't
      // matched by any canned plan role. These are the rich atomics the
      // AI picked specifically for this prompt (now-bar for music,
      // media-card for playback, focus-block for narrative, etc.).
      // Stack them vertically in the interaction zone with a 12px gap
      // so they don't overlap the canned chrome.
      const interactionZone = (layout && layout.zones && layout.zones.interaction) ||
        { x: 18, y: 140, w: 415, h: 600 };
      let stackY = interactionZone.y;
      const defaultH = {
        'focus-block': 160,
        'focus-block-group': 240,
        'now-bar': 64,
        'media-card': 180,
        'media-half': 144,
        'notif-card': 80,
        'notif-card-ai': 80,
        'list': 200,
        'list-item': 80,
        'paragraph': 52,
        'action-row': 48,
        'toggle-chip': 56,
        'toggle-grid': 180,
        'slider-pill': 56,
        'slider-panel': 240,
        'single-toggle': 88,
        'smart-things': 88,
        'selection-dialog': 360,
        'dialog-shell': 200,
        'dialog-site-header': 72,
        'dialog-browser-bar': 92,
        'dialog-icon-grid': 202
      };
      (normalized.components || []).forEach(function (ac) {
        if (!ac.role) return;
        if (consumedRoles.has(ac.role)) return;   // already merged in pass 1
        const inferredZone = ac.zone || _inferZoneForAgentRole(ac.role);
        // Only stack content components in interaction; chrome roles
        // that weren't in the plan can still be added but use the
        // standard zone resolution (resolveComponentRect will compute
        // their rect from the zone).
        const append = {
          id:      ac.id || ('agent-' + ac.role),
          role:    ac.role,
          zone:    inferredZone,
          text:    ac.text,
          content: ac.content || {},
          state:   ac.state,
          variant: ac.variant
        };
        if (inferredZone === 'interaction') {
          const h = defaultH[ac.role] || 120;
          const remaining = (interactionZone.y + interactionZone.h) - stackY;
          if (remaining < h + 12) return;         // ran out of space; skip
          append._rect = {
            x: interactionZone.x,
            y: stackY,
            w: interactionZone.w,
            h: h
          };
          stackY += h + 12;
        }
        plan.components.push(append);
        consumedRoles.add(ac.role);
      });

      // Expand list / focus-block-group / detail-content with agent content
      window.expandContainerComponents(plan, layout);
      window.renderSurfacePlan(canvas, plan, layout);

      // Hydrate DesignDoc from the merged+expanded plan so Scene Inspector
      // shows agent-seeded nodes (each list-item is editable individually).
      if (window.DesignDoc && typeof window.DesignDoc.hydrateFromPlan === 'function') {
        window.DesignDoc.hydrateFromPlan(plan, surfaceType);
      }

      if (typeof window.enableExpandableAppBarSnap === 'function') {
        window.enableExpandableAppBarSnap(canvas, surfaceType);
      }

      return;
    }

    // Legacy fallback path (no surfaceType): old flex-column rendering.
    if (window.DesignDoc && typeof window.DesignDoc.hydrateFromRenderModel === 'function') {
      window.DesignDoc.hydrateFromRenderModel(normalized);
    }

    if (!normalized.components || !normalized.components.length) return;

    clearCanvas();
    canvas.style.display = 'flex';
    canvas.style.flexDirection = 'column';
    canvas.style.alignItems = normalized.layout?.align || 'stretch';
    canvas.style.gap = (normalized.layout?.gap ?? 8) + 'px';
    canvas.style.padding = normalized.layout?.padding || '16px';

    const useMotion = document.getElementById('genMotion')?.checked;
    const useStagger = document.getElementById('genStagger')?.checked;

    normalized.components.forEach((comp, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'canvas-item';
      wrapper.id = comp.id || 'item-' + (++itemCounter);
      wrapper.dataset.role = comp.role || 'gen';
      // Bind DOM ↔ design-doc
      wrapper.dataset.nodeId = wrapper.id;

      if (comp.html) {
        wrapper.innerHTML = comp.html;
      } else if (comp.type && templates[comp.type]) {
        wrapper.innerHTML = templates[comp.type]();
        if (comp.text) {
          const editable = wrapper.querySelector('[contenteditable], button, .oui-appbar-title');
          if (editable) editable.textContent = comp.text;
        }
      }

      if (comp.styles) {
        Object.assign(wrapper.style, comp.styles);
      }

      const isFullWidth = comp.fullWidth || fullWidthTypes.has(comp.type);
      wrapper.style.width = isFullWidth ? '100%' : '';
      wrapper.setAttribute('draggable', 'true');

      if (useMotion && comp.motion) {
        const delay = useStagger ? (comp.delay || idx * 40) : 0;
        wrapper.style.opacity = '0';
        setTimeout(() => {
          wrapper.style.animation = `${comp.motion} ${currentDuration}ms ${currentEasing} forwards`;
        }, delay);
      }

      initDrag(wrapper);
      // Click / hover: centralized via interaction-state.js canvas-level tracker.
      canvas.appendChild(wrapper);
    });
  },

  applyAgentPatches(patchPlan) {
    if (!patchPlan || !patchPlan.patches) return;

    const FORBIDDEN_PATCH_PROPS = new Set([
      'x', 'y', 'top', 'left', 'right', 'bottom',
      'width', 'height', 'position',
      'transform', 'translate', 'translateX', 'translateY'
    ]);
    const ALLOWED_KINDS = new Set(['content', 'style', 'state']);

    patchPlan.patches.forEach(patch => {
      let targets = [];

      // Role-first lookup (preferred). Fall back to node id only when no role.
      if (patch.targetRole) {
        targets = Array.from(
          document.querySelectorAll(`.canvas-item[data-role="${patch.targetRole}"], .rules-item[data-role="${patch.targetRole}"], .surface-item[data-role="${patch.targetRole}"]`)
        );
      } else if (patch.node) {
        const el = document.getElementById(patch.node);
        if (el) targets = [el];
      }

      if (!targets.length) return;

      // Route through DesignDoc when the element is bound to a node, so the
      // document stays in lockstep with the DOM.
      if (window.DesignDoc && typeof window.DesignDoc.updateNode === 'function') {
        targets.forEach(el => {
          const nodeId = el.dataset.nodeId;
          if (!nodeId) return;
          const docPatch = {};
          (patch.changes || []).forEach(ch => {
            if (!ALLOWED_KINDS.has(ch.kind)) return;
            if (ch.kind === 'state') {
              docPatch.state = ch.to;
            } else if (ch.kind === 'style') {
              if (FORBIDDEN_PATCH_PROPS.has(ch.property)) return;
              docPatch.styles = docPatch.styles || {};
              docPatch.styles[ch.property] = ch.to;
            } else if (ch.kind === 'content') {
              docPatch.props = docPatch.props || {};
              if (ch.field) docPatch.props[ch.field] = ch.to;
            }
          });
          if (Object.keys(docPatch).length) {
            window.DesignDoc.updateNode(nodeId, docPatch);
          }
          el.classList.remove('refine-highlight');
          el.classList.add('refine-patched');
        });
        return;  // DesignDoc applied — skip legacy DOM path below
      }

      targets.forEach(el => {
        (patch.changes || []).forEach(change => {
          if (!change || !change.kind || !ALLOWED_KINDS.has(change.kind)) return;

          // --- state kind: only valid for expandable-app-bar ---
          if (change.kind === 'state' && patch.targetRole === 'expandable-app-bar') {
            if (typeof window.setExpandableAppBarState === 'function') {
              window.setExpandableAppBarState(el, change.to);
            }
            return;
          }

          // --- style kind: semantic tokens only, no layout props ---
          if (change.kind === 'style') {
            if (FORBIDDEN_PATCH_PROPS.has(change.property)) return;

            const target = el.firstElementChild || el;
            const prop = (change.property || '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());

            if (prop === 'emphasis') {
              if (change.to === 'stronger') {
                target.style.filter = 'contrast(1.05)';
                target.style.transform = 'scale(1.0)';
              } else if (change.to === 'softer') {
                target.style.opacity = '0.9';
              }
            } else if (prop === 'tone') {
              if (change.to === 'cool') target.style.filter = 'hue-rotate(-10deg)';
              else if (change.to === 'warm') target.style.filter = 'hue-rotate(10deg)';
            } else {
              target.style[prop] = change.to;
            }
            return;
          }

          // --- content kind: text / title / placeholder / subtitle ---
          if (change.kind === 'content') {
            const target =
              el.querySelector('[data-appbar-title], [contenteditable], .oui-appbar-title, input') ||
              el.firstElementChild;
            if (!target) return;

            if (change.field === 'placeholder' && target.tagName === 'INPUT') {
              target.placeholder = change.to;
            } else if (change.field === 'title' || change.field === 'text' || change.field === 'subtitle') {
              target.textContent = change.to;
            }
          }
        });

        el.classList.remove('refine-highlight');
        el.classList.add('refine-patched');
      });
    });

    setTimeout(() => {
      document.querySelectorAll('.refine-patched').forEach(el => el.classList.remove('refine-patched'));
    }, 2000);
  },

  renderCritic(critic) {
    if (!critic) return;

    // ── Compact badge on the Generate tab header ─────────────────
    const badge = document.getElementById('criticBadge');
    const badgeScore = document.getElementById('criticBadgeScore');
    const badgeIssues = document.getElementById('criticBadgeIssues');
    if (badge && badgeScore) {
      const score = (typeof critic.score === 'number') ? critic.score : null;
      if (score != null) {
        badgeScore.textContent = score + '/100';
        // Color: green ≥85, amber 70-84, red <70
        const color = score >= 85 ? '#0FCF6E' : score >= 70 ? '#F5A623' : '#FF6B6B';
        badgeScore.style.color = color;
        if (badgeIssues) {
          const issuesArr = Array.isArray(critic.issues) ? critic.issues : [];
          if (issuesArr.length) {
            const preview = issuesArr.slice(0, 2).map(function (i) {
              return '<span style="color:' + color + ';opacity:0.9;">\u2022</span> ' + (i.message || i.type || '');
            }).join('<br>');
            badgeIssues.innerHTML = preview + (issuesArr.length > 2 ? '<br><span style="opacity:0.6;">+' + (issuesArr.length - 2) + ' more</span>' : '');
          } else {
            badgeIssues.innerHTML = '<span style="color:' + color + ';opacity:0.8;">No issues flagged</span>';
          }
        }
        badge.style.display = 'block';
        badge.style.borderColor = color + '55';
      }
    }

    // ── Full critic panel (existing Refine-tab area) ─────────────
    const el = document.getElementById('criticPanel');
    if (!el) return;
    let html = '<div class="critic-content">';
    if (critic.score !== undefined) {
      html += `<div class="critic-score">${critic.score}<span>/100</span></div>`;
    }
    if (critic.issues && critic.issues.length > 0) {
      critic.issues.forEach(issue => {
        html += `<div class="critic-issue"><span class="refine-issue-type ${issue.type}">${issue.type}</span> ${issue.message}</div>`;
      });
    }
    if (critic.suggestions && critic.suggestions.length > 0) {
      html += '<div class="critic-suggestions">';
      critic.suggestions.forEach(s => { html += `<div class="critic-suggestion">&#128161; ${s}</div>`; });
      html += '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
    el.style.display = 'block';
  }
};

// --- Loading UI helper ---
function showAgentLoading(message) {
  let overlay = document.getElementById('agentLoadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'agentLoadingOverlay';
    overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:500;border-radius:inherit;';
    document.getElementById('canvasFrame').appendChild(overlay);
  }
  overlay.innerHTML = `
    <div style="width:32px;height:32px;border:2px solid rgba(255,255,255,0.15);border-top-color:var(--primary);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
    <div style="margin-top:12px;font-size:12px;font-weight:500;color:var(--text-2);letter-spacing:0.3px;">${message || 'Processing...'}</div>
  `;
  overlay.style.display = 'flex';
}

function hideAgentLoading() {
  const overlay = document.getElementById('agentLoadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

function toggleAgentMode() {
  if (agentSession.mode === 'agent') {
    setAgentMode('local');
    console.log('[mode] Switched to Local \u2014 chat Send will match keywords against promptMap');
    return;
  }
  // Try to connect to Node.js agent server
  const indicator = document.getElementById('agentModeIndicator');
  if (indicator) {
    indicator.textContent = '\u2026';
    indicator.className = 'agent-mode-indicator local';
    indicator.title = 'Connecting to AI server\u2026';
  }

  AgentAPI.health()
    .then(data => {
      setAgentMode('agent');
      console.log('[mode] Switched to AI (%s)', (data && data.model) || 'connected');
    })
    .catch(() => {
      // Revert indicator and surface a non-blocking toast-style message
      // in #pipelineOutput (not an alert — alerts break flow).
      setAgentMode('local');
      if (typeof _pipelineStart === 'function') {
        _pipelineStart('AI server not reachable');
        _pipelineError('Can\'t reach /api/agent/health at the current origin.');
        _pipelineInfo('Start the Node server: <code>node server.js</code> (requires .env with OPENAI_API_KEY)');
        _pipelineInfo('Staying in Local mode \u2014 chat Send will keep using keyword matching.');
      }
    });
}

// --- Local Fallback wrappers (preserve existing logic) ---
// Original functions renamed with _local prefix, originals become routers

const _local_interpretFeedback = function(text, tags, snapshot) {
  // This is the original interpretFeedback logic — preserved as fallback
  const issues = [];
  const textLower = (text || '').toLowerCase();
  const items = snapshot.items;
  for (const [type, keywords] of Object.entries(ISSUE_KEYWORDS)) {
    const matched = keywords.filter(k => textLower.includes(k));
    if (matched.length > 0 || tags.has(type)) {
      issues.push({ type, severity: matched.length >= 2 ? 'high' : 'medium', description: '', affectedNodes: [], suggestion: '', fromText: matched, fromTag: tags.has(type) });
    }
  }
  if (issues.length === 0 && textLower.length > 0) {
    issues.push({ type: 'spacing', severity: 'medium', description: '', affectedNodes: [], suggestion: '', fromText: [], fromTag: false });
  }
  issues.forEach(issue => {
    const affected = localizeIssue(issue, items);
    issue.affectedNodes = affected.nodes;
    issue.description = affected.description;
    issue.suggestion = affected.suggestion;
  });
  return issues;
};

// _local_planRefinementPatches is defined later in the refinement section

