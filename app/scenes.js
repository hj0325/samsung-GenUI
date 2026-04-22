// ============================================================================
//  app/scenes.js — scenario generation engine (local + pipeline + variants)
//  ---------------------------------------------------------------------------
//  End-to-end orchestration of: prompt/URL → scenario selection → variant
//  generation (local or agent) → canvas render. Also owns pipeline rendering
//  (renderPipelineResponse walks layoutPlan.groups[].children[]).
// ============================================================================

// ---------------------------------------------------------------------------
//  Voice input (Korean) — Web Speech API
//  ---------------------------------------------------------------------------
//  Uses browser-native SpeechRecognition. Click to start, click again to stop.
//  Appends recognized Korean text to #genPrompt input.
// ---------------------------------------------------------------------------
let _speechRecognition = null;
let _speechActive = false;

function toggleVoiceInput() {
  const btn = document.getElementById('voiceBtn');
  const input = document.getElementById('genPrompt');
  if (!input) return;

  // Stop if already recording
  if (_speechActive && _speechRecognition) {
    _speechRecognition.stop();
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    alert('이 브라우저는 음성 입력을 지원하지 않습니다.\nChrome, Edge 또는 Safari에서 이용해 주세요.');
    return;
  }

  const rec = new SR();
  rec.lang = 'ko-KR';            // Korean (South Korea)
  rec.interimResults = true;     // show text as it's being recognized
  rec.continuous = false;        // stop automatically after silence
  rec.maxAlternatives = 1;

  const baseText = input.value;  // preserve any existing text
  let lastFinal = '';

  rec.onstart = () => {
    _speechActive = true;
    if (btn) {
      btn.style.color = '#E74C3C';
      btn.style.background = 'rgba(231,76,60,0.12)';
      btn.title = '녹음 중... 클릭하여 종료';
    }
    input.placeholder = '듣고 있습니다... (한국어)';
  };

  rec.onresult = (event) => {
    let interim = '';
    let final = lastFinal;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) final += transcript;
      else interim += transcript;
    }
    lastFinal = final;
    const sep = baseText && !baseText.endsWith(' ') ? ' ' : '';
    input.value = baseText + sep + final + interim;
  };

  rec.onerror = (event) => {
    console.warn('[voice]', event.error);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      alert('마이크 접근 권한이 필요합니다. 브라우저 설정에서 허용해 주세요.');
    } else if (event.error === 'no-speech') {
      // silent timeout — just reset UI
    }
  };

  rec.onend = () => {
    _speechActive = false;
    _speechRecognition = null;
    if (btn) {
      btn.style.color = '';
      btn.style.background = '';
      btn.title = '음성 입력 (한국어) — 클릭 후 말씀하세요';
    }
    input.placeholder = 'Describe a screen or paste a URL (한글도 가능)...';
    input.focus();
  };

  _speechRecognition = rec;
  rec.start();
}

function generateVariants(scenarioKey, promptText) {
  const prompt = promptText || scenarioKey;

  // Local-first routing (covers the 17 canonical scenario buttons):
  //   - Rules-based surfaces (Lock / Notif / QS / Dialog) → Figma atomic render
  //   - Hardcoded scenarios in templates.js → deterministic high-fidelity render
  //   - Anything else (free-form prompt with no matching scenario) → agent
  var hasLocalScenario =
    (typeof window.isRulesScenario === 'function' && window.isRulesScenario(scenarioKey)) ||
    (typeof scenarios !== 'undefined' && scenarios && scenarios[scenarioKey]);

  if (hasLocalScenario) {
    _generateVariantsLocal(scenarioKey, prompt);
    return;
  }

  // No local scenario for this key → fall back to agent if connected, else
  // a safe default (feed layout).
  if (agentSession.mode === 'agent') {
    generateVariantsFromAgent(prompt, scenarioKey);
    return;
  }
  _generateVariantsLocal(scenarioKey, prompt);
}

function _generateVariantsLocal(scenarioKey, promptText) {
  showVariantBar();
  const prompt = promptText || scenarioKey;
  const v = activeVariant; // generate only for currently active variant

  generateScenario(scenarioKey);
  _saveCurrentVariant();
  variants[v].generated = true;
  variants[v].prompt = prompt;
  variants[v].scenario = scenarioKey;

  // Save to backend
  _syncVariantsToBackend();
}

// Sync variant prompt+result metadata to backend for Refine context
async function _syncVariantsToBackend() {
  if (agentSession.mode !== 'agent') return;
  try {
    const base = AgentAPI._getBase();
    await fetch(base + '/api/agent/variants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: agentSession.id,
        variants: {
          A: variants.A.generated ? { prompt: variants.A.prompt, scenario: variants.A.scenario, html: variants.A.html.substring(0, 2000), critic: variants.A.critic } : null,
          B: variants.B.generated ? { prompt: variants.B.prompt, scenario: variants.B.scenario, html: variants.B.html.substring(0, 2000), critic: variants.B.critic } : null
        }
      })
    });
  } catch (e) {
    console.warn('[Variants] Sync to backend failed:', e.message);
  }
}

function _applyVariantBDifferences() {
  const canvas = document.getElementById('canvas');
  const items = canvas.querySelectorAll('.canvas-item');
  if (items.length === 0) return;

  // Controlled differences: spacing, density, hierarchy emphasis
  // 1. Adjust gap (tighter or looser by 8px)
  const currentGap = parseInt(canvas.style.gap) || 0;
  canvas.style.gap = Math.max(0, currentGap + (currentGap < 8 ? 8 : -4)) + 'px';

  // 2. Adjust padding (slightly different)
  const currentPad = canvas.style.padding;
  if (currentPad === '0' || currentPad === '0px') {
    canvas.style.padding = '8px 0 0';
  } else if (parseInt(currentPad) >= 16) {
    canvas.style.padding = '8px';
  }

  // 3. Typography hierarchy: bump first heading
  items.forEach((item, i) => {
    const fc = item.firstElementChild;
    if (!fc) return;
    const cs = getComputedStyle(fc);

    if (i === 0 || i === 1) return; // skip status bar and appbar

    // Vary border-radius slightly
    if (fc.style.borderRadius || cs.borderRadius !== '0px') {
      const r = parseInt(cs.borderRadius) || 18;
      fc.style.borderRadius = Math.max(8, r + (r > 20 ? -6 : 6)) + 'px';
    }

    // Vary padding on cards
    if (fc.classList.contains('oui-card') || fc.style.padding) {
      const p = parseInt(cs.padding) || 16;
      fc.style.padding = (p + 4) + 'px';
    }

    // First content item: stronger hierarchy
    if (i === 2 || i === 3) {
      const fs = parseFloat(cs.fontSize) || 14;
      if (fs >= 18) {
        fc.style.fontSize = (fs + 2) + 'px';
        fc.style.fontWeight = '800';
      }
    }
  });
}

// Agent-powered generation — only generates for currently active variant
// ────────────────────────────────────────────────────────────────────────
// Generate history — last 5 (prompt, payload, response) tuples for
// ← previous / regenerate / → navigation.
// ────────────────────────────────────────────────────────────────────────
window.generateHistory = window.generateHistory || { entries: [], index: -1, max: 5 };

function _pushHistoryEntry(entry) {
  var h = window.generateHistory;
  // If user navigated back and then generated new → truncate forward branch
  if (h.index >= 0 && h.index < h.entries.length - 1) {
    h.entries = h.entries.slice(0, h.index + 1);
  }
  h.entries.push(entry);
  while (h.entries.length > h.max) h.entries.shift();
  h.index = h.entries.length - 1;
  _updateHistoryUI();
}

function _updateHistoryUI() {
  var h = window.generateHistory;
  var bar = document.getElementById('generateHistoryBar');
  var label = document.getElementById('historyLabel');
  var prev = document.getElementById('historyPrevBtn');
  var next = document.getElementById('historyNextBtn');
  if (!bar) return;
  if (h.entries.length === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'block';
  if (label) label.textContent = 'History ' + (h.index + 1) + '/' + h.entries.length;
  if (prev) prev.disabled = h.index <= 0;
  if (next) next.disabled = h.index >= h.entries.length - 1;
  if (prev) prev.style.opacity = h.index <= 0 ? '0.35' : '1';
  if (next) next.style.opacity = h.index >= h.entries.length - 1 ? '0.35' : '1';
}

function _restoreHistoryEntry(i) {
  var h = window.generateHistory;
  if (i < 0 || i >= h.entries.length) return;
  h.index = i;
  var entry = h.entries[i];
  if (entry.response && entry.response.renderModel) {
    RenderEngine.renderFromModel(entry.response.renderModel);
    if (entry.response.critic) RenderEngine.renderCritic(entry.response.critic);
  }
  _updateHistoryUI();
}

window.generateHistoryPrev = function () { _restoreHistoryEntry(window.generateHistory.index - 1); };
window.generateHistoryNext = function () { _restoreHistoryEntry(window.generateHistory.index + 1); };
window.generateRegenerate = function () {
  var h = window.generateHistory;
  if (h.index < 0 || h.index >= h.entries.length) return;
  var entry = h.entries[h.index];
  // Re-run with same prompt. Bypass cache by clearing the entry key.
  if (typeof _promptCache !== 'undefined' && _promptCache && _promptCache.map) {
    _promptCache.map.clear();
  }
  generateVariantsFromAgent(entry.prompt, entry.scenarioHint);
};

// ────────────────────────────────────────────────────────────────────────
// Error banner helpers
// ────────────────────────────────────────────────────────────────────────
var _lastGenerateAttempt = { prompt: null, scenarioHint: null };

function _showGenerateError(kind, message) {
  var banner = document.getElementById('generateErrorBanner');
  var kindEl = document.getElementById('generateErrorKind');
  var msgEl  = document.getElementById('generateErrorMessage');
  if (banner) banner.style.display = 'block';
  if (kindEl) kindEl.textContent = kind || 'ERROR';
  if (msgEl)  msgEl.textContent = message || 'Generation failed.';
}

function _hideGenerateError() {
  var banner = document.getElementById('generateErrorBanner');
  if (banner) banner.style.display = 'none';
}

window.retryLastGenerate = function () {
  _hideGenerateError();
  // Bypass cache — user explicitly asked for a fresh result
  if (typeof _promptCache !== 'undefined' && _promptCache && _promptCache.map) {
    _promptCache.map.clear();
  }
  generateVariantsFromAgent(_lastGenerateAttempt.prompt, _lastGenerateAttempt.scenarioHint);
};

// Hard reset everything that could "bleed through" into an AI-generated
// screen: the overlay layer, Screens / Overlays active highlights, and
// the state flags that the overlay flow reads (window.currentOverlay,
// window.currentBaseSurface, canvas-frame data-overlay-active /
// data-overlay-base, the overlay-hides-* classes on maskHost). Chat
// Send represents a fresh intent — the last Lock + Notification combo
// has nothing to do with "pick a browser to share this page".
function _fullResetForGeneration() {
  // 1. Remove overlay DOM + reset frame flags
  if (typeof _removeOverlayLayer === 'function') {
    try { _removeOverlayLayer(); } catch (e) { /* ignore */ }
  }
  window.currentOverlay     = null;
  window.currentBaseSurface = null;

  var frame = document.getElementById('canvasFrame');
  if (frame) {
    delete frame.dataset.overlayActive;
    delete frame.dataset.overlayBase;
  }

  // 2. Clear Screens / Overlays active highlights so the sidebar
  //    doesn't falsely suggest the canvas is showing canned Lock/Home/etc.
  document.querySelectorAll('.scene-btn.active').forEach(function (b) {
    b.classList.remove('active');
  });

  // 3. Drop overlay-hides-* classes off the mask host (canvas/rulesInner)
  var canvas = document.getElementById('canvas');
  if (canvas) {
    canvas.classList.remove('overlay-hides-all', 'overlay-hides-statusbar',
      'overlay-hides-lock-content');
    if (canvas._rulesInner && canvas._rulesInner !== canvas) {
      canvas._rulesInner.classList.remove('overlay-hides-all',
        'overlay-hides-statusbar', 'overlay-hides-lock-content');
    }
  }

  // 4. Refresh the Overlay hint text so it no longer says "Base: lock · Overlay: notif"
  if (typeof _refreshOverlayHint === 'function') {
    try { _refreshOverlayHint(); } catch (e) { /* ignore */ }
  }
}

async function generateVariantsFromAgent(prompt, scenarioHint) {
  // Blank the slate first — overlay layer, active scene-btn highlights,
  // and overlay state flags from a previous click all get wiped so the
  // AI render doesn't sit on top of stale scenario state.
  _fullResetForGeneration();

  showVariantBar();
  const v = activeVariant;
  _lastGenerateAttempt = { prompt: prompt, scenarioHint: scenarioHint };
  _hideGenerateError();

  const payload = StateManager.getGeneratePayload(scenarioHint, prompt);

  if (scenarioHint && typeof applyScenarioBackground === 'function') {
    applyScenarioBackground(scenarioHint);
  }

  // Skeleton pre-render
  const skeletonSurfaceType = payload.surfaceType ||
    (window.SURFACE_TYPES && window.SURFACE_TYPES.FIRST_DEPTH_LIST) ||
    'first-depth-list';
  if (typeof window.generateSurfaceScenario === 'function') {
    try {
      window.generateSurfaceScenario(skeletonSurfaceType);
      const canvas = document.getElementById('canvas');
      if (canvas) canvas.classList.add('skeleton-loading');
    } catch (err) { /* ignore */ }
  }

  showAgentLoading(`Generating Variant ${v}...`);

  // Live log in the pipelineOutput panel so the user can watch progress.
  _pipelineStart('AI generation \u2014 Variant ' + v);
  _pipelineInfo('Prompt: "' + prompt.slice(0, 80) + (prompt.length > 80 ? '\u2026' : '') + '"');
  if (scenarioHint) _pipelineInfo('Scenario hint: ' + scenarioHint);
  _pipelineInfo('Surface skeleton: ' + skeletonSurfaceType);
  _pipelineStatus('ai-step', '\u2022 Calling AI\u2026', 'var(--text-3)');
  const _tStart = Date.now();

  try {
    let classifiedSurfaceType = skeletonSurfaceType;
    let componentCount = 0;

    const res = await AgentAPI.generateUIStream(payload, {
      // Classifier lands ~300ms in — update skeleton to the correct surface
      // type immediately so the user sees accurate structure early.
      onClassified: function (info) {
        if (info && info.surfaceType && info.surfaceType !== classifiedSurfaceType) {
          classifiedSurfaceType = info.surfaceType;
          try {
            window.generateSurfaceScenario(info.surfaceType);
            const c2 = document.getElementById('canvas');
            if (c2) c2.classList.add('skeleton-loading');
          } catch (err) { /* ignore */ }
        }
        // Update loading message with intent
        if (info && info.intent) {
          showAgentLoading(`Generating \u201C${info.intent}\u201D\u2026`);
        }
        // Live pipeline log
        if (info) {
          if (info.surfaceType) _pipelineLog('\u2022 Surface classified: <b>' + info.surfaceType + '</b>');
          if (info.intent)      _pipelineLog('\u2022 Intent: ' + info.intent);
          // R1: 4+2+1 orchestration block (purpose type, modulations, governance)
          if (info.orchestration)       _renderClassificationBlock(info);
          // R2: interpretation layer, state packet, information priority
          if (info.interpretation)      _renderInterpretationBlock(info);
          if (info.statePacket)         _renderStatePacketBlock(info);
          if (info.informationPriority) _renderPriorityBlock(info);
        }
      },
      // Progressive component count — updates the loader message
      onComponent: function (comp) {
        componentCount++;
        showAgentLoading(`Received ${componentCount} component${componentCount === 1 ? '' : 's'}\u2026`);
        _pipelineStatus('comp-count',
          '\u2022 Receiving components: <b>' + componentCount + '</b>',
          '#3E91FF');
      }
    });

    hideAgentLoading();
    const canvas = document.getElementById('canvas');
    if (canvas) canvas.classList.remove('skeleton-loading');

    RenderEngine.renderFromModel(res.renderModel);
    _saveCurrentVariant();
    variants[v].generated = true;
    variants[v].prompt = prompt;
    variants[v].scenario = scenarioHint;
    variants[v].layoutTree = res.layoutTree;
    variants[v].renderModel = res.renderModel;
    variants[v].critic = res.critic;

    StateManager.updateFromAgentGenerate(res);
    _syncVariantsToBackend();

    if (res.critic) RenderEngine.renderCritic(res.critic);

    // Surface the cached / fallback badges on the critic card
    var tagEl    = document.getElementById('criticBadgeTag');
    var cachedEl = document.getElementById('criticBadgeCached');
    var isFallback = res.critic && Array.isArray(res.critic.issues) &&
                     res.critic.issues.some(function (i) { return i && i.type === 'fallback'; });
    if (tagEl)    tagEl.style.display    = isFallback ? 'inline-block' : 'none';
    if (cachedEl) cachedEl.style.display = res.__cached ? 'inline-block' : 'none';

    if (isFallback) {
      _showGenerateError('FALLBACK',
        'Model response was sanitized or defaulted. Generated result is a minimal fallback surface.');
    }

    // Pipeline log — summary on success
    var elapsed = ((Date.now() - _tStart) / 1000).toFixed(1);
    _pipelineStatus('ai-step',
      (res.__cached ? '\u2022 Served from cache' : '\u2022 AI call complete') +
      ' (' + elapsed + 's)', '#4ade80');
    if (res.critic) {
      var issuesCount = (res.critic.issues && res.critic.issues.length) || 0;
      _pipelineLog('\u2022 Critic: ' + (issuesCount
        ? issuesCount + ' issue' + (issuesCount === 1 ? '' : 's') + ' flagged'
        : 'no issues'), issuesCount ? '#f59e0b' : '#4ade80');
    }
    _pipelineSuccess('Rendered Variant ' + v + (isFallback ? ' (fallback)' : ''));

    // History — push unless this is a cached replay (cached came from history)
    if (!res.__cached) {
      _pushHistoryEntry({
        prompt: prompt,
        scenarioHint: scenarioHint,
        payload: payload,
        response: res,
        ts: Date.now()
      });
    }
  } catch (err) {
    console.warn('Agent generation failed:', err.message);
    hideAgentLoading();
    const canvasErr = document.getElementById('canvas');
    if (canvasErr) canvasErr.classList.remove('skeleton-loading');
    _pipelineError('Agent generation failed: ' +
      ((err && err.message) ? err.message : 'Unknown error'));

    // Graceful fallback: auto-run local keyword matching so the user
    // always sees SOMETHING on Send instead of a broken canvas. The
    // error banner still shows so they know the AI path failed and can
    // click Retry once the server recovers.
    _pipelineInfo('Falling back to Local mode (keyword matching)\u2026');
    try {
      const promptLower = (prompt || '').toLowerCase();
      let matched = scenarioHint;
      if (!matched) {
        for (const [keyword, scenario] of Object.entries(promptMap)) {
          if (promptLower.includes(keyword)) { matched = scenario; break; }
        }
      }
      matched = matched || (promptLower ? 'feed' : 'login');
      _pipelineSuccess('Local render: ' + matched);
      generateVariants(matched, prompt);
    } catch (fbErr) {
      console.warn('Local fallback also failed:', fbErr.message);
    }
    _showGenerateError('AI UNAVAILABLE \u2014 showing Local fallback',
      (err && err.message) ? err.message : 'Check server / network; click Retry after fixing.');
  }
}

function pipelineRenderChild(child, content, groupId) {
  const type = child.componentId;
  let html;
  if (templates[type]) {
    html = templates[type]();
  } else if (PIPELINE_FALLBACK_TEMPLATES[type]) {
    html = PIPELINE_FALLBACK_TEMPLATES[type](content || {});
  } else {
    html = `<div class="oui-card"><div class="oui-card-title">${type}</div><div class="oui-card-desc">(no template registered)</div></div>`;
  }
  // Best-effort content injection for registry-native templates
  if (templates[type] && content && (content.label || content.value)) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const title = tmp.querySelector('.oui-card-title, .oui-appbar-title, .oui-list-title, .oui-dialog-title');
    const body  = tmp.querySelector('.oui-card-desc, .oui-list-sub, .oui-dialog-body');
    if (title && content.label) title.textContent = content.label;
    if (body  && content.value) body.textContent  = content.value;
    html = tmp.innerHTML;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'canvas-item full-width';
  wrapper.id = 'pipeline-item-' + (++itemCounter);
  wrapper.dataset.compType          = type;
  wrapper.dataset.pipelineGroup     = groupId || '';
  wrapper.dataset.pipelineVariant   = child.variant || '';
  wrapper.dataset.pipelinePlacement = child.placement || '';
  wrapper.dataset.pipelinePriority  = String(child.priority || 2);
  wrapper.dataset.pipelineVisibility = child.visibility || 'visible';
  wrapper.innerHTML = html;
  wrapper.setAttribute('draggable','true');
  // Click / hover: centralized via interaction-state.js canvas-level tracker.
  initDrag(wrapper);
  return wrapper;
}

function renderPipelineResponse(resp) {
  const canvas = document.getElementById('canvas');
  const frame  = document.getElementById('canvasFrame');
  const output = document.getElementById('pipelineOutput');

  const uiState    = resp.uiState    || {};
  const layoutPlan = resp.layoutPlan || {};
  const plan       = resp.plan       || {};
  const validation = resp.validation || { summary: {}, violations: [] };
  const explanation = resp.explanation || {};

  // (1) Background from canonical uiState — Generator resolves 3-layer model
  //     (wallpaper / app-bg / focus-block) per One UI 4+ guidelines.
  if (window.UIState && uiState.backgroundPolicy) {
    const decision = {
      showWallpaper: (uiState.backgroundPolicy === 'wallpaper' ||
                      uiState.backgroundPolicy === 'scrim-over-wallpaper'),
      backgroundPolicy: uiState.backgroundPolicy
    };
    window.UIState.applyDecisionToFrame(frame, decision, uiState);

    const layers = window.Generator
      ? window.Generator.resolveLayers(uiState, { theme: 'dark' })
      : null;
    // Keep the user's wallpaper visible. Only switch to the dialog surface
    // when the backgroundPolicy explicitly requires it.
    if (typeof setWallpaper === 'function') {
      if (uiState.backgroundPolicy === 'dialog-surface') {
        setWallpaper('dialog-surface', { system: true });
      } else {
        setWallpaper(userWallpaperChoice || 'wp-1', { system: true });
      }
    }
  }

  // (2) Canvas: surface-first path — if the pipeline provides a surfaceType,
  //     delegate to the zone-based surface renderer and skip legacy groups[].
  clearCanvas();

  if (layoutPlan.surfaceType && typeof window.generateSurfaceScenario === 'function') {
    window.generateSurfaceScenario(layoutPlan.surfaceType);
    return;
  }

  canvas.style.display       = 'flex';
  canvas.style.flexDirection = 'column';
  canvas.style.alignItems    = 'stretch';
  canvas.style.gap           = (layoutPlan.gap ?? 12) + 'px';
  const pad = layoutPlan.padding || { top:16, right:16, bottom:16, left:16 };
  canvas.style.padding = `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px`;

  const contentByType = new Map(
    (plan.requiredComponents || []).map(c => [c.componentType, c.content || {}])
  );

  let renderedIndex = 0;
  (layoutPlan.groups || []).forEach(group => {
    const groupEl = document.createElement('div');
    groupEl.className = 'canvas-group';
    groupEl.dataset.groupId = group.groupId || '';
    groupEl.style.display = 'flex';
    groupEl.style.flexDirection = (group.container === 'horizontal-stack') ? 'row'
                                : (group.container === 'grid')             ? 'row'
                                : 'column';
    if (group.container === 'grid') groupEl.style.flexWrap = 'wrap';
    groupEl.style.gap = (group.gap ?? 8) + 'px';
    groupEl.style.width = '100%';

    (group.children || []).forEach(child => {
      if (child.visibility && child.visibility !== 'visible') return;
      const content = contentByType.get(child.componentId) || {};
      const el = pipelineRenderChild(child, content, group.groupId);
      el.style.animation = `fadeIn 300ms cubic-bezier(0.2,0,0,1) ${renderedIndex * 40}ms backwards`;
      if (group.container === 'grid') el.style.flex = '1 1 calc(50% - 8px)';
      groupEl.appendChild(el);
      renderedIndex++;
    });

    // One UI guideline: bottom navigation must always anchor to screen bottom
    if (groupEl.querySelector('.oui-bottomnav')) {
      groupEl.style.marginTop = 'auto';
      groupEl.style.flexShrink = '0';
    }

    if (groupEl.children.length > 0) canvas.appendChild(groupEl);
  });

  // (3) Output panel: uiState chips + explanation + canonical validation summary
  if (output) {
    const chips = [
      uiState.baseSurface       && `surface:${uiState.baseSurface}`,
      uiState.overlayType       && uiState.overlayType !== 'none' && `overlay:${uiState.overlayType}`,
      uiState.attentionMode     && `attn:${uiState.attentionMode}`,
      uiState.densityMode       && `density:${uiState.densityMode}`,
      uiState.interactionMode   && `int:${uiState.interactionMode}`,
      uiState.backgroundPolicy  && `bg:${uiState.backgroundPolicy}`
    ].filter(Boolean).map(t => `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:rgba(3,129,254,0.15);color:#3E91FF;font-size:10px;margin:0 4px 4px 0;">${t}</span>`).join('');

    const bullet = arr => (arr && arr.length) ? arr.map(s => `<li>${s}</li>`).join('') : '<li style="color:var(--text-3);">—</li>';
    const summary = validation.summary || {};
    const violations = validation.violations || [];
    const violationLines = violations.map(v => `[${v.stage}] ${v.ruleId} — ${v.message}`);

    output.innerHTML = `
      <div style="margin-bottom:6px;">${chips}</div>
      <div style="color:#fff;font-weight:600;margin-bottom:4px;">Why this UI</div>
      <div style="margin-bottom:8px;">${explanation.why_this_ui || '—'}</div>
      <div style="color:#fff;font-weight:600;margin-top:8px;">Prioritized</div>
      <ul style="margin:4px 0 0 16px;padding:0;">${bullet(explanation.what_was_prioritized)}</ul>
      <div style="color:#fff;font-weight:600;margin-top:8px;">Collapsed / removed</div>
      <ul style="margin:4px 0 0 16px;padding:0;">${bullet(explanation.what_was_removed_or_collapsed)}</ul>
      <div style="color:#fff;font-weight:600;margin-top:8px;">Validation (${summary.total || 0} — ${summary.high || 0}H / ${summary.medium || 0}M / ${summary.low || 0}L)</div>
      <ul style="margin:4px 0 0 16px;padding:0;">${bullet(violationLines)}</ul>`;
    output.style.display = 'block';
  }
}

// ---------------------------------------------------------------------------
//  pipelineOutput helpers — live progress surface for AI / pipeline calls
//  ---------------------------------------------------------------------------
//  #pipelineOutput is a scrollable panel below the chat input. We use it as
//  a live log during AI generation (sendChatMessage in Agent mode,
//  pipelineGenerate, generateFromUrl) so the user sees what's happening
//  instead of just a blocking spinner.
// ---------------------------------------------------------------------------
function _pipelineOutput() {
  return document.getElementById('pipelineOutput');
}
// Reset + show the panel with a title header.
function _pipelineStart(title) {
  var o = _pipelineOutput();
  if (!o) return;
  o.style.display = 'block';
  o.innerHTML = '<div style="color:#3E91FF;font-weight:600;margin-bottom:6px;">' +
    title + '</div>';
}
// Append a one-off log line.
function _pipelineLog(html, color) {
  var o = _pipelineOutput();
  if (!o) return;
  o.style.display = 'block';
  var line = document.createElement('div');
  line.style.cssText = 'padding:1px 0;' + (color ? ('color:' + color + ';') : '');
  line.innerHTML = html;
  o.appendChild(line);
  o.scrollTop = o.scrollHeight;
}
// Update (or create) a persistent status line by key — used for counters
// that should update in place rather than appending a new row each tick.
function _pipelineStatus(key, html, color) {
  var o = _pipelineOutput();
  if (!o) return;
  o.style.display = 'block';
  var line = o.querySelector('[data-pline="' + key + '"]');
  if (!line) {
    line = document.createElement('div');
    line.dataset.pline = key;
    line.style.cssText = 'padding:1px 0;' + (color ? ('color:' + color + ';') : '');
    o.appendChild(line);
  } else if (color) {
    line.style.color = color;
  }
  line.innerHTML = html;
  o.scrollTop = o.scrollHeight;
}
function _pipelineSuccess(msg) { _pipelineLog('\u2713 ' + msg, '#4ade80'); }
function _pipelineError(msg)   { _pipelineLog('\u2717 ' + msg, '#ff6b6b'); }
function _pipelineInfo(msg)    { _pipelineLog('\u2192 ' + msg, 'var(--text-2)'); }

// Escape HTML for safe JSON rendering in the pipelineOutput panel.
function _escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// Render a pretty-printed <details> block containing a step's JSON output.
function _pipelineJsonBlock(title, obj, meta) {
  var json = '';
  try { json = JSON.stringify(obj, null, 2); }
  catch (e) { json = String(obj); }
  // Cap size to avoid huge panels — show first 2500 chars + "(+N more)"
  var MAX = 2500;
  var truncated = '';
  if (json.length > MAX) {
    truncated = ' <span style="color:var(--text-3);">(+' + (json.length - MAX) + ' more chars)</span>';
    json = json.slice(0, MAX);
  }
  var metaHtml = meta ? ' <span style="color:var(--text-3);font-weight:400;">' + _escapeHtml(meta) + '</span>' : '';
  return '<details style="margin:4px 0;padding:4px 0;border-top:1px solid rgba(255,255,255,0.05);">' +
    '<summary style="cursor:pointer;color:#fff;font-weight:600;font-size:11px;">' + _escapeHtml(title) + metaHtml + '</summary>' +
    '<pre style="margin:6px 0 0 0;padding:8px;background:rgba(0,0,0,0.35);border-radius:6px;font-size:10px;line-height:1.45;color:#cbd5e1;overflow:auto;max-height:260px;white-space:pre-wrap;word-break:break-word;">' +
      _escapeHtml(json) + truncated +
    '</pre>' +
  '</details>';
}

// ---------------------------------------------------------------------------
//  4+2+1 classification renderer — displays the orchestration decision
//  packet the classifier returned. Default collapsed to a single-line
//  summary chip; click to expand the full brief (purpose, modulation A,
//  modulation B, governance). Color codes each purpose type so the
//  reader can tell at a glance what kind of UI should result.
// ---------------------------------------------------------------------------
var _PURPOSE_META = {
  context_reconstruction: { label: '\uB9E5\uB77D \uC7AC\uAD6C\uC131\uD615', en: 'Context Reconstruction',
    color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)',
    icon: '\u25C8' },
  flow_continuity:        { label: '\uD750\uB984 \uC5F0\uC18D\uD615', en: 'Flow Continuity',
    color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.35)',
    icon: '\u2192' },
  focus_protection:       { label: '\uBABB\uC785 \uBCF4\uD638\uD615', en: 'Focus Protection',
    color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.35)',
    icon: '\u25CE' },
  multi_party_coordination: { label: '\uB2E4\uC790\uAC04 \uC870\uC728\uD615', en: 'Multi-party Coordination',
    color: '#fb923c', bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.35)',
    icon: '\u22C8' }
};

function _purposeChip(key, prefix) {
  var m = _PURPOSE_META[key];
  if (!m) return _escapeHtml(key || '');
  return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;' +
    'background:' + m.bg + ';color:' + m.color + ';border:1px solid ' + m.border + ';' +
    'font-size:10px;font-weight:600;letter-spacing:0.2px;">' +
    m.icon + ' ' + (prefix || '') + m.label + ' <span style="opacity:0.6;">(' + m.en + ')</span>' +
    '</span>';
}

function _fieldRow(label, value, dim) {
  if (value === undefined || value === null || value === '') return '';
  var v = Array.isArray(value) ? value.join(', ') : String(value);
  return '<div style="display:flex;gap:8px;padding:1px 0;font-size:10px;">' +
    '<span style="color:var(--text-3);min-width:110px;">' + _escapeHtml(label) + '</span>' +
    '<span style="color:' + (dim ? 'var(--text-2)' : '#fff') + ';">' + _escapeHtml(v) + '</span>' +
    '</div>';
}

function _renderClassificationBlock(payload) {
  var o = _pipelineOutput();
  if (!o || !payload || !payload.orchestration) return;
  var orch = payload.orchestration;
  var pri  = (orch.purpose && orch.purpose.primary)   || 'context_reconstruction';
  var sec  = (orch.purpose && orch.purpose.secondary) || null;
  var modA = orch.modulationA || {};
  var modB = orch.modulationB || {};
  var gov  = orch.governance  || {};

  var summary = '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:3px 0;">' +
    _purposeChip(pri) +
    (sec ? _purposeChip(sec, '+ ') : '') +
    '<span style="font-size:10px;color:var(--text-3);">\u00b7</span>' +
    '<span style="font-size:10px;color:var(--text-2);">attn:<b style="color:#fff;margin-left:2px;">' + _escapeHtml(modA.attention || '?') + '</b></span>' +
    '<span style="font-size:10px;color:var(--text-2);">interaction:<b style="color:#fff;margin-left:2px;">' + _escapeHtml(modA.interaction || '?') + '</b></span>' +
    '<span style="font-size:10px;color:var(--text-2);">devices:<b style="color:#fff;margin-left:2px;">' + _escapeHtml(modB.device_count || 'single') + '</b></span>' +
    ((gov.triggers && gov.triggers.length)
      ? '<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.35);">\u26A0 governance</span>'
      : '') +
    '</div>';

  var details = '';
  if (orch.purpose && orch.purpose.reasoning) {
    details += '<div style="font-size:10px;color:var(--text-2);font-style:italic;padding:2px 0 6px 0;">' +
      '\u201C' + _escapeHtml(orch.purpose.reasoning) + '\u201D</div>';
  }
  details += '<div style="padding:4px 0;">' +
    '<div style="font-size:10px;color:var(--text-3);font-weight:600;margin-bottom:2px;">Modulation A \u00B7 body / environment</div>' +
    _fieldRow('attention',   modA.attention) +
    _fieldRow('mobility',    modA.mobility) +
    _fieldRow('hands',       modA.hands) +
    _fieldRow('interaction', modA.interaction) +
    _fieldRow('privacy',     modA.privacy) +
    _fieldRow('time of day', modA.time_of_day) +
    _fieldRow('ambient',     modA.ambient) +
    '</div>';
  details += '<div style="padding:4px 0;">' +
    '<div style="font-size:10px;color:var(--text-3);font-weight:600;margin-bottom:2px;">Modulation B \u00B7 multi-device</div>' +
    _fieldRow('device count',   modB.device_count) +
    _fieldRow('primary device', modB.primary_device) +
    _fieldRow('secondary',      (modB.secondary_devices && modB.secondary_devices.length) ? modB.secondary_devices : null) +
    _fieldRow('handoff',        modB.handoff_required ? ('yes \u2192 ' + (modB.handoff_target || '?')) : 'no', true) +
    _fieldRow('allocation',     modB.surface_allocation_hint) +
    '</div>';
  details += '<div style="padding:4px 0;">' +
    '<div style="font-size:10px;color:var(--text-3);font-weight:600;margin-bottom:2px;">Governance</div>' +
    _fieldRow('triggers',            (gov.triggers && gov.triggers.length) ? gov.triggers : 'none', !(gov.triggers && gov.triggers.length)) +
    _fieldRow('autonomy',            gov.autonomy_level) +
    _fieldRow('explanation needed',  gov.explanation_needed ? 'yes' : 'no', !gov.explanation_needed) +
    _fieldRow('override needed',     gov.override_needed    ? 'yes' : 'no', !gov.override_needed) +
    '</div>';

  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div style="margin:6px 0;padding:8px 10px;border:1px solid rgba(255,255,255,0.08);' +
      'border-radius:8px;background:rgba(0,0,0,0.25);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
        '<span style="font-size:10px;color:var(--text-3);letter-spacing:0.4px;font-weight:600;">4+2+1 CLASSIFICATION</span>' +
      '</div>' +
      summary +
      '<details style="margin-top:6px;">' +
        '<summary style="cursor:pointer;font-size:10px;color:var(--text-3);padding:2px 0;">details</summary>' +
        details +
      '</details>' +
    '</div>';
  o.appendChild(wrap.firstElementChild);
  o.scrollTop = o.scrollHeight;
}

// ---------------------------------------------------------------------------
//  R2 — Interpretation Layer renderer (6-question answer block)
// ---------------------------------------------------------------------------
function _renderInterpretationBlock(payload) {
  var o = _pipelineOutput();
  if (!o || !payload || !payload.interpretation) return;
  var i = payload.interpretation;

  var qaRows = '';
  var rows = [
    ['what user is doing',         i.what_user_doing],
    ['real goal',                  i.real_goal],
    ['most lacking',               i.most_lacking],
    ['what interferes',            i.what_interferes],
    ['system role',                (i.system_role && i.system_role.length) ? i.system_role.join(' + ') : null],
    ['interaction complexity',     i.interaction_complexity]
  ];
  rows.forEach(function (r) {
    if (!r[1]) return;
    qaRows += '<div style="display:flex;gap:8px;padding:2px 0;font-size:10px;line-height:1.4;">' +
      '<span style="color:var(--text-3);min-width:130px;flex-shrink:0;">' + _escapeHtml(r[0]) + '</span>' +
      '<span style="color:#fff;">' + _escapeHtml(r[1]) + '</span>' +
      '</div>';
  });

  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div style="margin:6px 0;padding:8px 10px;border:1px solid rgba(255,255,255,0.08);' +
      'border-radius:8px;background:rgba(255,255,255,0.02);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<span style="font-size:10px;color:var(--text-3);letter-spacing:0.4px;font-weight:600;">' +
          '\uD83D\uDD0D INTERPRETATION' +
        '</span>' +
      '</div>' +
      qaRows +
    '</div>';
  o.appendChild(wrap.firstElementChild);
  o.scrollTop = o.scrollHeight;
}

// ---------------------------------------------------------------------------
//  R2 — State Packet renderer (compressed machine-readable decision state)
// ---------------------------------------------------------------------------
function _renderStatePacketBlock(payload) {
  var o = _pipelineOutput();
  if (!o || !payload || !payload.statePacket) return;
  var sp = payload.statePacket;
  var fields = [
    ['purpose_type',        sp.purpose_type],
    ['primary_goal',        sp.primary_goal],
    ['journey_stage',       sp.journey_stage],
    ['urgency',             sp.urgency],
    ['attention_capacity',  sp.attention_capacity],
    ['interaction_budget',  sp.interaction_budget],
    ['coordination_need',   sp.coordination_need],
    ['device_role',         sp.device_role],
    ['system_role',         sp.system_role],
    ['autonomy_level',      sp.autonomy_level],
    ['privacy_level',       sp.privacy_level]
  ];
  var rowsHtml = '';
  fields.forEach(function (f) {
    if (!f[1]) return;
    rowsHtml += '<div style="display:flex;gap:8px;padding:1px 0;font-size:10px;font-family:ui-monospace,monospace;">' +
      '<span style="color:var(--text-3);min-width:150px;">' + _escapeHtml(f[0]) + '</span>' +
      '<span style="color:#fff;">' + _escapeHtml(f[1]) + '</span>' +
      '</div>';
  });
  var flags = [];
  if (sp.explanation_needed) flags.push('explanation_needed');
  if (sp.override_needed)    flags.push('override_needed');
  if (sp.handoff_required)   flags.push('handoff_required');
  var flagsHtml = flags.length
    ? '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">' +
        flags.map(function (f) {
          return '<span style="font-size:9px;padding:1px 6px;border-radius:8px;' +
            'background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.35);">' +
            _escapeHtml(f) + '</span>';
        }).join('') +
      '</div>'
    : '';

  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div style="margin:6px 0;padding:8px 10px;border:1px solid rgba(255,255,255,0.08);' +
      'border-radius:8px;background:rgba(255,255,255,0.02);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<span style="font-size:10px;color:var(--text-3);letter-spacing:0.4px;font-weight:600;">' +
          '\uD83D\uDCE6 STATE PACKET' +
        '</span>' +
      '</div>' +
      rowsHtml +
      flagsHtml +
    '</div>';
  o.appendChild(wrap.firstElementChild);
  o.scrollTop = o.scrollHeight;
}

// ---------------------------------------------------------------------------
//  R2 — Information Priority renderer (4-column must/should/suppress/defer)
// ---------------------------------------------------------------------------
function _renderPriorityBlock(payload) {
  var o = _pipelineOutput();
  if (!o || !payload || !payload.informationPriority) return;
  var ip = payload.informationPriority;

  function renderColumn(title, items, color, bg, border, emoji) {
    var chips = (items && items.length)
      ? items.map(function (c) {
          return '<div style="padding:2px 6px;margin:1px 0;border-radius:5px;' +
            'background:' + bg + ';color:' + color + ';border:1px solid ' + border + ';' +
            'font-size:10px;line-height:1.3;word-break:break-word;">' + _escapeHtml(c) + '</div>';
        }).join('')
      : '<div style="padding:2px 0;color:var(--text-3);font-size:10px;font-style:italic;">\u2014</div>';
    return '<div style="flex:1;min-width:0;">' +
      '<div style="font-size:9px;color:' + color + ';letter-spacing:0.4px;font-weight:700;margin-bottom:3px;">' +
        emoji + ' ' + title + ' <span style="color:var(--text-3);font-weight:400;">(' + (items ? items.length : 0) + ')</span>' +
      '</div>' +
      chips +
      '</div>';
  }

  var columns =
    renderColumn('MUST',    ip.must_show,    '#4ade80', 'rgba(74,222,128,0.10)',  'rgba(74,222,128,0.30)',  '\u25CF') +
    renderColumn('SHOULD',  ip.should_show,  '#60a5fa', 'rgba(96,165,250,0.10)',  'rgba(96,165,250,0.30)',  '\u25CB') +
    renderColumn('SUPPRESS',ip.suppress,     '#f87171', 'rgba(248,113,113,0.10)', 'rgba(248,113,113,0.30)', '\u2298') +
    renderColumn('DEFER',   ip.defer,        '#fbbf24', 'rgba(251,191,36,0.10)',  'rgba(251,191,36,0.30)',  '\u23F8');

  var reasoning = '';
  if (ip.why_must || ip.why_suppress) {
    reasoning = '<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.05);font-size:10px;color:var(--text-2);font-style:italic;line-height:1.4;">';
    if (ip.why_must)     reasoning += '<div>\u2022 <span style="color:#4ade80;">MUST:</span> ' + _escapeHtml(ip.why_must) + '</div>';
    if (ip.why_suppress) reasoning += '<div>\u2022 <span style="color:#f87171;">SUPPRESS:</span> ' + _escapeHtml(ip.why_suppress) + '</div>';
    reasoning += '</div>';
  }

  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div style="margin:6px 0;padding:8px 10px;border:1px solid rgba(255,255,255,0.08);' +
      'border-radius:8px;background:rgba(255,255,255,0.02);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<span style="font-size:10px;color:var(--text-3);letter-spacing:0.4px;font-weight:600;">' +
          '\uD83C\uDFAF INFORMATION PRIORITY' +
        '</span>' +
      '</div>' +
      '<div style="display:flex;gap:8px;align-items:flex-start;">' + columns + '</div>' +
      reasoning +
    '</div>';
  o.appendChild(wrap.firstElementChild);
  o.scrollTop = o.scrollHeight;
}

// Run the full 5-step pipeline with Server-Sent Events so each step's
// JSON output lands in #pipelineOutput as soon as it's produced. If a
// step fails, an explicit "✗ {step}" line appears instead of a generic
// error — makes it immediately obvious WHERE the chain is breaking.
async function pipelineGenerate() {
  const prompt = document.getElementById('genPrompt').value.trim();
  if (!prompt) { alert('Enter a scenario first.'); return; }
  _pipelineStart('AI Pipeline (5 steps)');
  _pipelineInfo('Prompt: "' + prompt.slice(0, 80) + (prompt.length > 80 ? '\u2026' : '') + '"');
  _pipelineInfo('Streaming each step&rsquo;s JSON output below.');
  const tPipeline = Date.now();

  let finalData = null;
  let firstErrStep = null;
  try {
    const resp = await fetch('/api/pipeline/full/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify({ scenario_text: prompt })
    });
    if (!resp.ok || !resp.body) throw new Error('HTTP ' + resp.status);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Parse SSE frames separated by blank lines
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';
      for (const frame of frames) {
        if (!frame.trim()) continue;
        let ev = 'message', data = '';
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) ev = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        let payload = {};
        try { payload = data ? JSON.parse(data) : {}; } catch (e) { payload = { raw: data }; }
        _handlePipelineEvent(ev, payload);
        if (ev === 'done') finalData = payload;
        if (ev === 'error' && !firstErrStep) firstErrStep = payload.step || 'unknown';
      }
    }

    if (firstErrStep) {
      _pipelineError('Pipeline halted at step "' + firstErrStep + '"');
      return;
    }
    if (!finalData) {
      _pipelineError('Stream ended without a "done" event');
      return;
    }
    _pipelineSuccess('Pipeline complete (' + ((Date.now() - tPipeline) / 1000).toFixed(1) + 's total)');
    renderPipelineResponse(finalData);
  } catch (e) {
    console.error('[pipeline]', e);
    _pipelineError('Pipeline request failed: ' + e.message);
  }
}

// Per-event handler. Each SSE event from /api/pipeline/full/stream is
// rendered as its own status line + collapsible JSON block.
function _handlePipelineEvent(ev, payload) {
  if (ev === 'step_started') {
    _pipelineStatus('step-' + payload.step,
      '<b>Step ' + payload.idx + '/' + payload.total + '</b> &middot; ' +
      _escapeHtml(payload.step) + ' \u2014 ' + _escapeHtml(payload.label || '') +
      ' <span style="color:var(--text-3);">running\u2026</span>',
      'var(--text-2)');
    return;
  }
  if (ev === 'step_done') {
    var secs = ((payload.elapsedMs || 0) / 1000).toFixed(1);
    _pipelineStatus('step-' + payload.step,
      '\u2713 <b>Step ' + payload.idx + '/' + payload.total + '</b> &middot; ' +
      _escapeHtml(payload.step) + ' <span style="color:var(--text-3);">(' + secs + 's)</span>',
      '#4ade80');
    // Append a collapsible JSON preview for that step
    var title = payload.step + ' output';
    var meta = '(' + secs + 's)';
    var o = _pipelineOutput();
    if (o) {
      var wrap = document.createElement('div');
      wrap.innerHTML = _pipelineJsonBlock(title, payload.output || {}, meta);
      o.appendChild(wrap.firstElementChild);
      o.scrollTop = o.scrollHeight;
    }
    return;
  }
  if (ev === 'done') {
    // Schema check — validate the server actually returned what
    // renderPipelineResponse expects (layoutPlan.groups[].children[]).
    _validatePipelineSchema(payload);
    return;
  }
  if (ev === 'error') {
    var secs2 = ((payload.elapsedMs || 0) / 1000).toFixed(1);
    _pipelineStatus('step-' + (payload.step || 'unknown'),
      '\u2717 <b>' + _escapeHtml(payload.step || 'unknown') + '</b> \u2014 ' +
      _escapeHtml(payload.message || 'error') +
      ' <span style="color:var(--text-3);">(' + secs2 + 's)</span>',
      '#ff6b6b');
    return;
  }
}

// Validate the final pipeline payload has the schema that
// renderPipelineResponse expects, and log any mismatches. This makes
// Phase-1 debugging explicit: if the server changes contract or a
// composer step returns something unexpected, we see it immediately.
function _validatePipelineSchema(data) {
  var errors = [];       // schema broken (renderer will fail)
  var warnings = [];     // schema ok, but suspicious data (renderer might show empty)

  if (!data || typeof data !== 'object') {
    errors.push('response is not an object');
  } else {
    if (!data.uiState || typeof data.uiState !== 'object') {
      errors.push('missing uiState (expected step-2 ui_state_resolution output)');
    }
    if (!data.plan || typeof data.plan !== 'object') {
      errors.push('missing plan (expected step-3 required_components output)');
    } else if (!Array.isArray(data.plan.requiredComponents)) {
      errors.push('plan.requiredComponents missing or not an array');
    } else if (data.plan.requiredComponents.length === 0) {
      warnings.push('plan.requiredComponents is empty \u2014 composer will render no content');
    }
    if (!data.layoutPlan || typeof data.layoutPlan !== 'object') {
      errors.push('missing layoutPlan (expected step-4 composer output)');
    } else {
      if (!Array.isArray(data.layoutPlan.groups)) {
        errors.push('layoutPlan.groups missing or not an array \u2014 renderPipelineResponse expects groups[]');
      } else {
        data.layoutPlan.groups.forEach(function (g, i) {
          if (!Array.isArray(g.children)) {
            errors.push('layoutPlan.groups[' + i + '].children missing or not an array');
          } else {
            g.children.forEach(function (c, j) {
              if (!c.componentId) {
                errors.push('layoutPlan.groups[' + i + '].children[' + j + '] missing componentId');
              }
            });
          }
        });
        if (!data.layoutPlan.surfaceType && !data.layoutPlan.groups.length) {
          errors.push('layoutPlan has neither surfaceType nor any groups');
        }
      }
      // Cross-check: every componentId used in layoutPlan should exist
      // in plan.requiredComponents. Composer inventing new ids is a
      // real bug we want to surface.
      if (data.plan && Array.isArray(data.plan.requiredComponents) &&
          Array.isArray(data.layoutPlan.groups)) {
        var known = new Set(data.plan.requiredComponents.map(function (c) { return c.componentType || c.id; }));
        data.layoutPlan.groups.forEach(function (g) {
          (g.children || []).forEach(function (c) {
            if (c.componentId && !known.has(c.componentId)) {
              warnings.push('composer invented componentId "' + c.componentId +
                '" not in plan.requiredComponents');
            }
          });
        });
      }
    }
    if (!data.validation || typeof data.validation !== 'object') {
      errors.push('missing validation (expected rollupValidationResults output)');
    } else if (data.validation.summary && data.validation.summary.high > 0) {
      warnings.push('validation: ' + data.validation.summary.high + ' HIGH-severity violation(s)');
    }
    if (!data.explanation || typeof data.explanation !== 'object') {
      errors.push('missing explanation (expected step-7 output)');
    }
  }

  if (errors.length === 0) {
    var groupCount = (data.layoutPlan && data.layoutPlan.groups && data.layoutPlan.groups.length) || 0;
    var childCount = 0;
    (data.layoutPlan && data.layoutPlan.groups || []).forEach(function (g) {
      childCount += (g.children || []).length;
    });
    _pipelineSuccess('Schema OK \u2014 layoutPlan.groups[' + groupCount + '] with ' +
      childCount + ' child' + (childCount === 1 ? '' : 'ren'));
  } else {
    _pipelineError('Schema BROKEN (' + errors.length + ' error' + (errors.length === 1 ? '' : 's') + '):');
    errors.forEach(function (msg) { _pipelineLog('&nbsp;&nbsp;\u2022 ' + _escapeHtml(msg), '#ff6b6b'); });
  }
  if (warnings.length > 0) {
    _pipelineLog('&#9888; Warnings (' + warnings.length + '):', '#fbbf24');
    warnings.forEach(function (msg) { _pipelineLog('&nbsp;&nbsp;\u2022 ' + _escapeHtml(msg), '#fbbf24'); });
  }
}

const promptMap = {
  'home': 'home', '홈': 'home', '홈화면': 'home', '홈 화면': 'home', 'homescreen': 'home', 'launcher': 'home',
  'login': 'login', 'sign in': 'login', 'signin': 'login', '로그인': 'login', '로그 인': 'login', '회원가입': 'login',
  'product': 'product', 'detail': 'product', '제품': 'product', '상세': 'product', '상품': 'product', 'galaxy': 'product',
  'settings': 'settings', 'setting': 'settings', '설정': 'settings', '환경설정': 'settings',
  'chat': 'chat', 'message': 'chat', '채팅': 'chat', '메시지': 'chat', '대화': 'chat',
  'feed': 'feed', 'news': 'feed', '피드': 'feed', '뉴스': 'feed', '탐색': 'feed', 'discover': 'feed',
  'profile': 'profile', '프로필': 'profile', '마이페이지': 'profile', 'my page': 'profile',
  'gallery': 'gallery', 'photo': 'gallery', '갤러리': 'gallery', '사진': 'gallery', '앨범': 'gallery',
  'dashboard': 'dashboard', '대시보드': 'dashboard', '통계': 'dashboard', 'stats': 'dashboard', 'analytics': 'dashboard',
  'onboarding': 'onboarding', 'welcome': 'onboarding', '온보딩': 'onboarding', '웰컴': 'onboarding', '시작': 'onboarding',
  'music': 'music', '음악': 'music', '플레이어': 'music',
  'lock': 'lockscreen', 'lockscreen': 'lockscreen', 'lock screen': 'lockscreen', '잠금': 'lockscreen', '잠금화면': 'lockscreen', '잠금 화면': 'lockscreen',
  'notification': 'notifications', 'notifications': 'notifications', '알림': 'notifications', '알림창': 'notifications',
  'quick settings': 'quicksettings', 'quicksettings': 'quicksettings', 'qs': 'quicksettings', '빠른 설정': 'quicksettings', '빠른설정': 'quicksettings', 'toggles': 'quicksettings',
  'smart': 'smartthings', 'smartthings': 'smartthings', 'iot': 'smartthings', '스마트싱스': 'smartthings', '스마트홈': 'smartthings',
  'media': 'media', 'player': 'media', '미디어': 'media',
  'keyboard': 'keyboard', '키보드': 'keyboard', 'type': 'keyboard', '타이핑': 'keyboard',
};

// Background policy is resolved by window.UIState (see ui-state.js) and then
// realised by *swapping the active wallpaper*:
//   - lock / home surfaces   → user's chosen wallpaper
//   - app surfaces           → 'galaxy-night' wallpaper
//   - shades over app        → 'galaxy-night' + scrim handled elsewhere
//   - shades over lock/home  → user's wallpaper + scrim
//   - system-dialog          → 'dialog-surface' wallpaper
function applyScenarioBackground(scenarioKey) {
  const frame = document.getElementById('canvasFrame');
  if (!frame) return;
  const decision = (window.UIState && window.UIState.decisionForScenario)
    ? window.UIState.decisionForScenario(scenarioKey)
    : { showWallpaper: (scenarioKey === 'home' || scenarioKey === 'lockscreen'),
        backgroundPolicy: (scenarioKey === 'home' || scenarioKey === 'lockscreen') ? 'wallpaper' : 'solid-dark' };

  // Mirror decision onto the frame as data-attrs (for any CSS hooks).
  frame.dataset.bgPolicy      = decision.backgroundPolicy;
  frame.dataset.showWallpaper = decision.showWallpaper ? 'true' : 'false';

  // Generator picks the wallpaper asset from the resolved 3-layer model.
  // Layer ① (wallpaper) → user's pick; Layer ② (app-bg) → galaxy-night;
  // dialog-surface is an isolated system surface.
  const resolved = (window.UIState && window.UIState.resolveForScenario)
    ? window.UIState.resolveForScenario(scenarioKey)
    : { baseSurface: (scenarioKey === 'lockscreen') ? 'lock'
                   : (scenarioKey === 'home')       ? 'home' : 'app',
        overlayType: 'none', backgroundPolicy: decision.backgroundPolicy };
  const layers = window.Generator
    ? window.Generator.resolveLayers(resolved, { theme: 'dark' })
    : null;

  // Restore the user's chosen wallpaper (or wp-1 default) for any scenario
  // whose backgroundPolicy allows it. Previously we force-set 'none' (solid
  // dark) for every generated scenario, which hid the wallpaper on Home /
  // List / Detail / Lock. Now the device-frame shows the actual wallpaper.
  if (typeof setWallpaper === 'function') {
    if (decision.backgroundPolicy === 'dialog-surface') {
      setWallpaper('dialog-surface', { system: true });
    } else {
      setWallpaper(userWallpaperChoice || 'wp-1', { system: true });
    }
  }
}

// ============================================================================
//  SCREEN / OVERLAY composition
// ----------------------------------------------------------------------------
//  Per One UI guideline, the nav distinguishes:
//    - Screens (full-surface): Lock / Home / App(list) / App(detail)
//    - Overlays (regions over a screen): Notification / QuickSettings / Dialog
//
//  State:
//    window.currentBaseSurface — which screen is rendered as the base
//    window.currentOverlay     — which overlay is layered on top (or null)
//
//  Entry points from genui.html buttons:
//    generateScreen(key, el) — sets base, clears overlay, renders
//    toggleOverlay(key, el)  — adds/removes overlay without touching base
//    clearOverlay()          — removes overlay only
// ============================================================================

window.currentBaseSurface = window.currentBaseSurface || null;
window.currentOverlay     = window.currentOverlay     || null;

function generateScreen(scenarioKey, buttonEl) {
  window.currentBaseSurface = scenarioKey;
  window.currentOverlay = null;
  _removeOverlayLayer();
  _markActiveSceneBtn(buttonEl, 'screen');
  generateScenario(scenarioKey);
  _refreshOverlayHint();
}

function toggleOverlay(overlayKey, buttonEl) {
  // If the user hit an overlay button without picking a screen first, pick
  // one of the four base screens at random so the overlay has realistic
  // context behind it (matches the Lock / Home / List / Detail buttons in
  // genui.html line 468–471). Every open gives a fresh underlying scene.
  if (!window.currentBaseSurface) {
    var BASE_SCREENS = ['lockscreen', 'home', 'feed', 'detail'];
    var pickedBase = BASE_SCREENS[Math.floor(Math.random() * BASE_SCREENS.length)];
    window.currentBaseSurface = pickedBase;
    generateScenario(pickedBase);
    // Reflect the pick in the sidebar so the user sees which base was chosen
    var baseBtn = document.querySelector('.scene-btn[data-role="screen"][onclick*="\'' + pickedBase + '\'"]');
    if (baseBtn) _markActiveSceneBtn(baseBtn, 'screen');
  }

  if (window.currentOverlay === overlayKey) {
    clearOverlay();
    return;
  }

  // Switching overlays: remove previous, render new
  window.currentOverlay = overlayKey;
  _removeOverlayLayer();
  _renderOverlay(overlayKey);
  _markActiveSceneBtn(buttonEl, 'overlay');
  _refreshOverlayHint();
}

function clearOverlay() {
  window.currentOverlay = null;
  _removeOverlayLayer();
  document.querySelectorAll('.scene-btn[data-role="overlay"].active')
    .forEach(function (b) { b.classList.remove('active'); });
  _refreshOverlayHint();
}

function _markActiveSceneBtn(btn, role) {
  if (role === 'screen') {
    document.querySelectorAll('.scene-btn[data-role="screen"].active')
      .forEach(function (b) { b.classList.remove('active'); });
    // Screen change also clears overlay button active state
    document.querySelectorAll('.scene-btn[data-role="overlay"].active')
      .forEach(function (b) { b.classList.remove('active'); });
  } else if (role === 'overlay') {
    document.querySelectorAll('.scene-btn[data-role="overlay"].active')
      .forEach(function (b) { b.classList.remove('active'); });
  }
  if (btn) btn.classList.add('active');
}

function _refreshOverlayHint() {
  var hint = document.getElementById('overlayHint');
  if (!hint) return;
  if (!window.currentBaseSurface) {
    hint.textContent = 'Overlays render on top of the current screen. Pick a screen first.';
  } else if (!window.currentOverlay) {
    hint.textContent = 'Base: ' + window.currentBaseSurface + ' — click an overlay to layer it on top.';
  } else {
    hint.textContent = 'Base: ' + window.currentBaseSurface + ' · Overlay: ' + window.currentOverlay;
  }
}

// Remove overlay DOM + overlay nodes from DesignDoc; leaves base intact.
function _removeOverlayLayer() {
  var canvas = document.getElementById('canvas');
  if (!canvas) return;

  // overlay-inner now lives on canvas-FRAME (not canvas-inner). Clean
  // up from both locations so we catch legacy + current layouts.
  canvas.querySelectorAll(':scope > .overlay-inner').forEach(function (n) { n.remove(); });

  var frameEl = document.getElementById('canvasFrame');
  if (frameEl) {
    frameEl.querySelectorAll(':scope > .overlay-inner').forEach(function (n) { n.remove(); });
    delete frameEl.dataset.overlayActive;
    delete frameEl.dataset.overlayBase;
  }

  var rulesInner = canvas._rulesInner;
  if (rulesInner) {
    rulesInner.querySelectorAll(':scope > .overlay-inner').forEach(function (n) { n.remove(); });
    rulesInner.querySelectorAll('[data-layer="overlay"]').forEach(function (n) { n.remove(); });
    rulesInner.classList.remove('overlay-hides-all', 'overlay-hides-statusbar',
      'overlay-hides-lock-content');
  }

  // Also strip any stray overlay-layer items at canvas level
  canvas.querySelectorAll('[data-layer="overlay"]').forEach(function (n) { n.remove(); });

  // Drop overlay nodes from DesignDoc
  if (window.DesignDoc && window.DesignDoc.state && Array.isArray(window.DesignDoc.state.nodes)) {
    var kept = window.DesignDoc.state.nodes.filter(function (n) { return n.layer !== 'overlay'; });
    if (kept.length !== window.DesignDoc.state.nodes.length) {
      window.DesignDoc.state.nodes = kept;
    }
  }
}

// Render an overlay (Dialog / QS / Notif) on top of the current base screen.
function _renderOverlay(overlayKey) {
  var canvas = document.getElementById('canvas');
  if (!canvas) return;
  if (typeof window.renderPlanIntoTarget !== 'function') return;
  if (!window.Generator) return;

  var ruleMap = {
    notifications: 'notificationShadeRules',
    notification:  'notificationShadeRules',
    notif:         'notificationShadeRules',
    quicksettings: 'quickSettingsRules',
    quickSettings: 'quickSettingsRules',
    qs:            'quickSettingsRules',
    dialog:        'dialogWidgetRules'
  };
  var fnName = ruleMap[overlayKey];
  var fn = fnName && window.Generator[fnName];
  if (typeof fn !== 'function') return;

  // Default uiState per overlay type
  var defaults = {
    notifications: { overlayType: 'shade', attentionMode: 'focused', contextTags: ['media-playing'] },
    quicksettings: { overlayType: 'shade', attentionMode: 'focused', contextTags: [] },
    dialog:        { baseSurface: 'app', contextTags: ['live-activity:call'] }
  };
  var uiState =
    defaults[overlayKey] ||
    defaults[ruleMap[overlayKey] === 'notificationShadeRules' ? 'notifications' :
             ruleMap[overlayKey] === 'quickSettingsRules'     ? 'quicksettings' :
             'dialog'] || {};

  var viewport = { width: 451, height: 978 };
  var plan = fn(uiState, { viewport: viewport });

  // The overlay is appended to the CANVAS (canvas-inner) as a sibling of
  // _rulesInner — NOT inside _rulesInner. Why: _rulesInner has
  // transform:scale() which creates a stacking context that traps
  // backdrop-filter. If the overlay lives inside _rulesInner it can only
  // blur what's inside that stacking context, producing a visible seam at
  // the scaled element's boundary. By placing overlay-inner at canvas
  // level, backdrop-filter can reach all the way to canvas-frame's
  // wallpaper, and overlay-inner fills 100% of the visible phone area so
  // there's no seam anywhere.
  // overlay-inner stays INSIDE canvas-inner so chrome z-index:550 keeps
  // working (chrome above overlay-inner z:500, both within canvas-inner's
  // zoom stacking context). To work around canvas-inner's zoom:0.78
  // visibly shrinking the overlay, oversize overlay-inner by a generous
  // margin on all sides — canvas-frame's overflow:hidden + radius:44
  // clips the excess cleanly at the device silhouette.
  // overlay-inner is a direct child of canvas-FRAME so it naturally
  // covers the full phone silhouette (canvas-inner's zoom:0.78 +
  // overflow-y:auto would otherwise clip both the horizontal shrinkage
  // AND any vertical negative-inset compensation). canvas-frame has
  // no zoom and overflow:hidden + border-radius:44 so inset:0 here
  // fills the phone edge-to-edge with clean rounded corners.
  //
  // Chrome (status-bar/now-bar/etc at z:550 inside canvas-inner) still
  // renders above the blur: canvas-inner gets z-index:550 when the
  // overlay is active (and only for Lock base — other bases keep
  // canvas-inner at z-auto so base content stays below the blur).
  var overlayInner = document.createElement('div');
  overlayInner.className = 'overlay-inner';
  overlayInner.dataset.overlayKey = overlayKey;
  overlayInner.style.cssText =
    'position:absolute;inset:0;z-index:500;pointer-events:auto;' +
    'overflow:hidden;border-radius:inherit;';

  var frameEl = document.getElementById('canvasFrame');
  var hostEl = frameEl || canvas;
  hostEl.appendChild(overlayInner);
  if (frameEl) frameEl.dataset.overlayActive = '1';

  // An inner wrapper re-applies 0.78 zoom so plan children (at Figma
  // 451×978 coords) render at the same scale as the base screen inside
  // canvas-inner.
  var overlayScaled = document.createElement('div');
  overlayScaled.className = 'overlay-scaled';
  overlayScaled.style.cssText =
    'position:absolute;inset:0;zoom:0.78;pointer-events:auto;';
  overlayInner.appendChild(overlayScaled);

  var overlayCoord = overlayScaled;

  // Per-overlay base-screen masking — applied to the base content host
  // (_rulesInner), NOT the overlay. QS covers the whole screen behind a
  // frosted shade so base pointer-events must be off. Notif is a pure
  // "cards on top" layer — no mask, base stays fully visible and
  // interactive. Dialog hides only the status bar so the app underneath
  // stays contextually present.
  var maskHost = canvas._rulesInner || canvas;
  maskHost.classList.remove('overlay-hides-all', 'overlay-hides-statusbar',
    'overlay-hides-lock-content');
  var isQS = overlayKey === 'quicksettings' || overlayKey === 'qs' ||
             overlayKey === 'quickSettings';
  var isNotif = overlayKey === 'notifications' || overlayKey === 'notification' ||
                overlayKey === 'notif';
  var isDialog = overlayKey === 'dialog';
  if (isQS)          maskHost.classList.add('overlay-hides-all');
  else if (isDialog) maskHost.classList.add('overlay-hides-statusbar');
  // Notif: no mask — just cards floating on the untouched base.

  // Determine the theme for notif cards based on the CURRENT base screen:
  //   Lock → dark (glass dark bg + blurred wallpaper behind; cards stay
  //                translucent dark to match the shade treatment)
  //   Home / List / Detail → light (no blur; cards become solid white with
  //                black text so they pop against app content)
  // QS keeps its dark shade regardless of base (Samsung always shows QS
  // with the wallpaper blur + dark translucent tint).
  var baseKey = window.__currentBaseScenario || 'lockscreen';
  var baseIsLock = (baseKey === 'lockscreen' || baseKey === 'lock');
  // When ANY overlay opens over Lock, fade out the Lock-screen decorative
  // content (clock, weather, widgets, padlock icon) so only the blurred
  // wallpaper + chrome remain behind the shade — matches Samsung's
  // pattern where the giant clock ghost doesn't bleed through the frost.
  if (baseIsLock && (isQS || isNotif || isDialog)) {
    maskHost.classList.add('overlay-hides-lock-content');
  }
  var notifTheme = (isNotif && !baseIsLock) ? 'light' : 'dark';
  overlayInner.dataset.theme = notifTheme;
  overlayInner.dataset.base = baseKey;
  // Mirror the base onto canvas-frame so CSS can scope behavior (e.g.
  // canvas-inner z-index promotion is Lock-only — other bases keep
  // base content visible below the blur).
  if (frameEl) frameEl.dataset.overlayBase = baseKey;

  // Stamp the theme into every notif-card / notif-card-ai component's
  // variant so the atomic picks the right bg + text colors.
  if (isNotif) {
    plan.components.forEach(function (comp) {
      if (comp.role === 'notif-card' || comp.role === 'notif-card-ai') {
        comp.variant = comp.variant || {};
        comp.variant.theme = notifTheme;
      }
    });
  }

  window.renderPlanIntoTarget(plan, overlayCoord, {
    scenarioKey: overlayKey,
    layer: 'overlay'
  });

  // Append overlay components to DesignDoc (alongside base nodes) so the
  // Scene Inspector / property editor / interaction overlay work on them.
  // Use addNode so subscribers (interaction-state, scene-inspector) are
  // notified properly — direct .push() wouldn't emit a change event.
  if (window.DesignDoc && typeof window.DesignDoc.addNode === 'function') {
    plan.components.forEach(function (comp) {
      window.DesignDoc.addNode({
        id: comp.id,
        role: comp.role,
        type: null,
        state: (comp.variant && comp.variant.state) || null,
        props: {},
        styles: {},
        content: {},
        zone: (comp.position && comp.position._zone) || null,
        cluster: (comp.position && comp.position._cluster) || null,
        position: comp.position || null,
        layer: 'overlay',
        html: null
      });
    });
  }
}

function generateScenario(scenarioKey) {
  // Track the last-rendered base scenario so overlays (Notif / QS / Dialog)
  // can adapt their theme to whatever's underneath (e.g. Notif over Lock =
  // dark shade, over Home = light).
  window.__currentBaseScenario = scenarioKey;
  // 1) Resolve the surface type (used only by Tier-2 fallback below).
  const surfaceMap = {
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
    surfaceMap[scenarioKey] ||
    window.currentSurfaceType ||
    window.SURFACE_TYPES?.FIRST_DEPTH_LIST ||
    'first-depth-list';

  if (typeof applyScenarioBackground === 'function') {
    applyScenarioBackground(scenarioKey);
  }

  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  // 2) Tear down previous rules-mode DOM state so both render paths start clean.
  if (canvas.dataset.rulesMode) {
    canvas.style.position = '';
    canvas.style.inset = '';
    canvas.style.width = '';
    canvas.style.height = '';
    canvas.style.overflow = '';
    canvas.style.zoom = '';
    delete canvas.dataset.rulesMode;
    // _rulesInner now aliases the canvas itself (unified render paths).
    // Only `.remove()` if it's a DIFFERENT element from canvas — otherwise
    // we'd delete the canvas itself and null out on the next click.
    if (canvas._rulesInner && canvas._rulesInner !== canvas) {
      try { canvas._rulesInner.remove(); } catch (e) {}
    }
    canvas._rulesInner = null;
    const hint = document.getElementById('canvasHint');
    if (hint) hint.style.display = '';
  }

  clearCanvas();

  // 3) Tier 1 — Figma-ground-truth rules (Lock / QS / Notif / Dialog).
  //    These have pixel-accurate atomics extracted from Figma designs and
  //    should always win over the generic surface grammar when available.
  const useRules =
    typeof window.isRulesScenario === 'function' &&
    typeof window.renderFromRules === 'function' &&
    window.isRulesScenario(scenarioKey);

  if (useRules) {
    const rendered = window.renderFromRules(scenarioKey /* default uiState per surface */);
    if (rendered) {
      // renderFromRules handles canvas styling + sets dataset.rulesMode.
      // Real-time clock applies to rules output too.
      injectRealtimeDateTime(canvas);
      return;
    }
    // renderFromRules returned false → fall through to Tier-2.
  }

  // 4) Tier 2 — generic surface grammar (zone/role engine).
  if (typeof window.generateSurfaceScenario === 'function') {
    window.generateSurfaceScenario(surfaceType);
  } else {
    canvas.style.display = 'flex';
    canvas.style.flexDirection = 'column';
    canvas.style.alignItems = 'stretch';
    canvas.style.gap = '12px';
    canvas.style.padding = '16px';
  }

  injectRealtimeDateTime(canvas);
}

// ---------------------------------------------------------------------------
//  injectRealtimeDateTime — replace hardcoded Figma clock placeholders
//  ---------------------------------------------------------------------------
//  Walks the canvas DOM and substitutes known placeholder strings with the
//  current clock. Safe for every scenario (legacy hardcoded, rules-based
//  atomics, and future AI-generated screens) because it only replaces text
//  nodes whose content exactly matches a known Figma placeholder.
//
//  Replacements:
//    "9:41" / "8:21"                → current H:MM (no leading 0 on hour)
//    "09" or "8" clock line 1       → zero-padded hour
//    "41" or "21" clock line 2      → zero-padded minute
//    "Sat, May 3"                   → today's ddd, MMM D
//    "Thu 28 Aug"                   → today's ddd D MMM
//    "Monday, April 14"             → today's dddd, MMMM D
// ---------------------------------------------------------------------------
// Global live tick — updates the canvas's time display every minute.
// Started lazily on first injectRealtimeDateTime call.
var _liveClockTimer = null;
function _startLiveClockTick() {
  if (_liveClockTimer) return;
  _liveClockTimer = setInterval(function () {
    var c = document.getElementById('canvas');
    if (c) injectRealtimeDateTime(c);
  }, 30 * 1000); // every 30 seconds — cheap DOM walk
}

// --------------------------------------------------------------------------
//  Live timer ticker — progressively enhances `[data-live-timer]` nodes
//  (set by the now-bar atomic when variant.live=true) so the stopwatch
//  Now Bar counts up every second from the `data-start` timestamp.
//  Runs once per second globally; cheap (<= 1 element normally).
// --------------------------------------------------------------------------
var _liveTimerTimer = null;
function _startLiveTimerTick() {
  if (_liveTimerTimer) return;
  _liveTimerTimer = setInterval(function () {
    var nodes = document.querySelectorAll('[data-live-timer="1"][data-start]');
    if (!nodes.length) return;
    var now = Date.now();
    nodes.forEach(function (el) {
      var start = parseInt(el.getAttribute('data-start'), 10) || now;
      var elapsed = Math.max(0, Math.floor((now - start) / 1000));
      var h = Math.floor(elapsed / 3600);
      var m = Math.floor((elapsed % 3600) / 60);
      var s = elapsed % 60;
      var pad = function (n) { return n < 10 ? '0' + n : String(n); };
      el.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
    });
  }, 1000);
}
// Kick off immediately on load so timers start counting as soon as rendered.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _startLiveTimerTick);
  } else {
    _startLiveTimerTick();
  }
}

// --------------------------------------------------------------------------
//  Live weather — open-meteo API (free, CORS-friendly, no API key).
//  Tries geolocation first, falls back to Seoul. Caches result on
//  window.__liveWeather and re-injects on each canvas render.
// --------------------------------------------------------------------------
window.__liveWeather = null;

function _fetchLiveWeather() {
  function run(lat, lon) {
    // Celsius — matches Samsung's default locale in most regions.
    var url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude='  + lat +
      '&longitude=' + lon +
      '&current=temperature_2m,weather_code&temperature_unit=celsius';
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.current) return;
        window.__liveWeather = {
          temp: Math.round(d.current.temperature_2m),
          code: d.current.weather_code
        };
        // Apply to canvas immediately if already rendered
        var c = document.getElementById('canvas');
        if (c) _applyLiveWeather(c);
      })
      .catch(function () { /* silent — default temp stays */ });
  }
  // Try geolocation, fall back to Seoul (37.5665, 126.9780) after short timeout
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function (pos) { run(pos.coords.latitude, pos.coords.longitude); },
      function ()    { run(37.5665, 126.9780); },
      { timeout: 2500, maximumAge: 600000 }
    );
  } else {
    run(37.5665, 126.9780);
  }
}

// Substitute the rendered "24°" placeholder (used by GalaxyWeatherDate) with
// the live temp when available. Walks only text nodes matching /^\s*\d+°\s*$/
// so we don't touch percentages like "69%" or unrelated numbers.
function _applyLiveWeather(canvas) {
  var w = window.__liveWeather;
  if (!w || !canvas) return;
  var walker = document.createTreeWalker(canvas, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      var p = node.parentNode;
      var tag = p && p.tagName ? p.tagName.toLowerCase() : '';
      if (tag === 'script' || tag === 'style') return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  var n;
  while ((n = walker.nextNode())) {
    if (/^\s*\d+°\s*$/.test(n.nodeValue)) {
      n.nodeValue = w.temp + '°';
    }
  }
}

// Kick off the live-weather fetch once per page load. Refresh every 10 min.
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _fetchLiveWeather);
  } else {
    _fetchLiveWeather();
  }
  setInterval(_fetchLiveWeather, 10 * 60 * 1000);
}

function injectRealtimeDateTime(canvas) {
  if (!canvas) return;
  _startLiveClockTick();
  var now = new Date();
  var days  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var daysF = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var mon   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var monF  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  var hour   = now.getHours();
  var min    = now.getMinutes();
  var dayI   = now.getDay();
  var date   = now.getDate();
  var monI   = now.getMonth();

  var HH = hour.toString().padStart(2, '0');
  var MM = min.toString().padStart(2, '0');
  var Hc = hour + ':' + MM;                          // "9:07"
  var HHc = HH + ':' + MM;                           // "09:07"
  var shortDate = days[dayI]  + ', ' + mon[monI] + ' ' + date;         // "Sat, Apr 20"
  var notifDate = days[dayI]  + ' ' + date + ' ' + mon[monI];          // "Sat 20 Apr"
  var longDate  = daysF[dayI] + ', ' + monF[monI] + ' ' + date;        // "Saturday, April 20"

  // Ordered exact-match replacements. Longest/most-specific first.
  var MAP = [
    // Long labels first so we don't partially match them later
    { from: 'Monday, April 14',    to: longDate  },
    { from: 'Sat, May 3',          to: shortDate },
    { from: 'Thu 28 Aug',          to: notifDate },
    // Time labels (inline "9:41" / "8:21" placeholders inside small text)
    { from: '9:41',                to: Hc        },
    { from: '8:21',                to: Hc        }
    // Note: the two-line hero clock ["09","41"] substitution was removed.
    // renderClock now injects the real time directly, so text-substitute
    // is no longer needed AND it was causing the "3636" double-replace bug.
  ];

  // Walk text nodes. Avoid inputs/textareas/contenteditable.
  var walker = document.createTreeWalker(canvas, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      var p = node.parentNode;
      if (!p) return NodeFilter.FILTER_REJECT;
      var tag = (p.tagName || '').toLowerCase();
      if (tag === 'script' || tag === 'style') return NodeFilter.FILTER_REJECT;
      if (p.isContentEditable) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  var nodes = [];
  var n;
  while ((n = walker.nextNode())) nodes.push(n);

  nodes.forEach(function (node) {
    var txt = node.nodeValue;
    var trimmed = txt.trim();
    for (var i = 0; i < MAP.length; i++) {
      var r = MAP[i];
      if (trimmed !== r.from) continue;
      if (r.onlyHeroClock) {
        // Only replace when the text is in a clock-like context — very big
        // font-size (e.g. 56, 80, 112) or the dedicated clock font family.
        var fs = 0;
        try { fs = parseFloat(getComputedStyle(node.parentNode).fontSize) || 0; } catch (e) {}
        if (fs < 48) continue;
      }
      node.nodeValue = txt.replace(r.from, r.to);
      break;
    }
  });

  // Also inject live-weather temperature if the open-meteo fetch has
  // completed. Runs at the end so any "24°" placeholder rendered by
  // GalaxyWeatherDate gets swapped for the real-time value.
  _applyLiveWeather(canvas);
}

// ---------------------------------------------------------------------------
//  applyUnifiedDesignRules — normalize legacy scenarios to match Figma tokens
//  ---------------------------------------------------------------------------
//  Rules injected:
//    1. Inject a unified status bar at top (if none present)
//    2. Force font-family to the system token on all text nodes
//    3. Snap radius values to the nearest radius tier
//
//  Only touches .canvas-item children; does not alter user-authored inline
//  styles beyond these three axes.
// ---------------------------------------------------------------------------
function applyUnifiedDesignRules(canvas, scenarioKey) {
  try {
    var G = window.Generator;

    // 1. REPLACE any existing ad-hoc status bar at the top with the unified
    //    Figma status bar. Rules-mapped scenarios (lock/qs/notif) skip this
    //    because their atomics already render the Figma status bar.
    if (window.isRulesScenario && window.isRulesScenario(scenarioKey)) {
      // rules path already handles everything
    } else {
      var firstItem = canvas.querySelector('.canvas-item');
      var firstHTML = firstItem ? firstItem.innerHTML : '';
      var looksLikeStatusBar = /\b(9:41|K-Arts|\bTJG\b)/.test(firstHTML) ||
                               /status-bar|battery-left|wifi\.svg/.test(firstHTML);

      // Build the unified status bar wrapper with explicit margin/padding
      // matching Figma surface header: 18px top breathing room + 44px bar.
      var sbWrapper = document.createElement('div');
      sbWrapper.className = 'canvas-item';
      sbWrapper.dataset.role = 'static';
      sbWrapper.dataset.injected = 'unified-status-bar';
      sbWrapper.style.cssText = 'margin-top:0;padding-top:4px;flex-shrink:0;';
      sbWrapper.innerHTML = G.statusBarHTML({ carrier: 'K-Arts' });

      if (looksLikeStatusBar && firstItem) {
        // Replace the legacy status bar
        firstItem.parentNode.replaceChild(sbWrapper, firstItem);
      } else if (firstItem) {
        // Prepend (no status bar existed)
        canvas.insertBefore(sbWrapper, firstItem);
      }
    }

    // 2-3. Font + radius normalization DISABLED (too aggressive).
  } catch (e) {
    console.warn('[applyUnifiedDesignRules] skipped due to error:', e.message);
  }
}

// Unified chat send: inspects input and routes to URL/prompt/image flows.
// Chat now accepts all three in one field (URL auto-detected, image via paperclip).
// Auto-grow the chat textarea as the user types.
// min-height/max-height are enforced in the inline style (48px / 240px).
function autoResizeChatInput(el) {
  if (!el) return;
  el.style.height = 'auto';
  // Cap height using the inline max-height so scrollbar appears past the limit
  const max = parseInt(el.style.maxHeight, 10) || 240;
  const next = Math.min(el.scrollHeight, max);
  el.style.height = next + 'px';
}

function sendChatMessage() {
  const raw = document.getElementById('genPrompt').value.trim();
  if (!raw) return;
  // URL detection — http(s):// or starts with www. or looks like a domain
  const urlPattern = /^(https?:\/\/|www\.)|^[a-z0-9-]+\.[a-z]{2,}(\/|$)/i;
  if (urlPattern.test(raw)) {
    // Proxy into generateFromUrl by temporarily shimming #genUrl (removed from DOM)
    const shim = document.createElement('input');
    shim.id = 'genUrl';
    shim.value = raw;
    shim.style.display = 'none';
    document.body.appendChild(shim);
    try { generateFromUrl(); } finally { shim.remove(); }
    return;
  }
  generateFromPrompt();
}

function generateFromPrompt() {
  const prompt = document.getElementById('genPrompt').value.trim();
  const promptLower = prompt.toLowerCase();

  // Determine scenario hint
  let scenarioHint = null;
  for (const [keyword, scenario] of Object.entries(promptMap)) {
    if (promptLower.includes(keyword)) { scenarioHint = scenario; break; }
  }

  if (agentSession.mode === 'agent') {
    // Agent Mode: full reset happens inside generateVariantsFromAgent
    generateVariantsFromAgent(prompt, scenarioHint);
  } else {
    // Local Mode: same blank-slate rule so the canvas doesn't show
    // previous overlay/screen state under the new scenario.
    _fullResetForGeneration();
    const matched = scenarioHint || (promptLower ? 'feed' : 'login');
    _pipelineStart('Local mode');
    _pipelineInfo('Prompt: "' + prompt.slice(0, 80) + (prompt.length > 80 ? '\u2026' : '') + '"');
    _pipelineInfo('Keyword match: ' + (scenarioHint ? '<b>' + scenarioHint + '</b>' : 'none') +
      (scenarioHint ? '' : ' \u2014 defaulting to <b>' + matched + '</b>'));
    _pipelineSuccess('Rendering scenario: ' + matched);
    generateVariants(matched, prompt);
  }
}

function _local_generateFromPrompt(promptLower) {
  if (!promptLower) { generateScenario('login'); return; }
  let matched = null;
  for (const [keyword, scenario] of Object.entries(promptMap)) {
    if (promptLower.includes(keyword)) { matched = scenario; break; }
  }
  if (matched) {
    generateScenario(matched);
  } else {
    generateScenario('feed');
  }
}

function generateFromUrl() {
  const url = document.getElementById('genUrl').value.trim();
  if (!url) return;

  if (agentSession.mode === 'agent') {
    // Agent mode: send URL for analysis
    const payload = StateManager.getGeneratePayload(null, '');
    payload.referenceUrl = url;
    showAgentLoading('Analyzing reference...');
    _pipelineStart('URL reference generation');
    _pipelineInfo('Reference URL: ' + url);
    _pipelineStatus('url-step', '\u2022 Analyzing reference\u2026', 'var(--text-3)');
    var _urlT0 = Date.now();
    AgentAPI.generateUI(payload)
      .then(response => {
        hideAgentLoading();
        _pipelineStatus('url-step',
          '\u2022 Analysis complete (' + ((Date.now() - _urlT0) / 1000).toFixed(1) + 's)',
          '#4ade80');
        StateManager.updateFromAgentGenerate(response);
        RenderEngine.renderFromModel(response.renderModel);
        RenderEngine.renderCritic(response.critic);
        _pipelineSuccess('Rendered from URL');
      })
      .catch(err => {
        console.warn('Agent URL generate failed, falling back to local:', err.message);
        hideAgentLoading();
        _pipelineError('URL analysis failed: ' + err.message + ' \u2014 falling back to local');
        _local_generateFromUrl(url);
      });
    return;
  }
  _pipelineStart('Local mode \u2014 URL');
  _pipelineInfo('URL: ' + url);
  _local_generateFromUrl(url);
}

function _local_generateFromUrl(url) {
  if (url.includes('login') || url.includes('sign')) generateScenario('login');
  else if (url.includes('product') || url.includes('galaxy') || url.includes('smartphone')) generateScenario('product');
  else if (url.includes('setting')) generateScenario('settings');
  else if (url.includes('message') || url.includes('chat')) generateScenario('chat');
  else if (url.includes('profile') || url.includes('account')) generateScenario('profile');
  else if (url.includes('gallery') || url.includes('photo')) generateScenario('gallery');
  else if (url.includes('music') || url.includes('player')) generateScenario('music');
  else generateScenario('product'); // Default for samsung.com
}

const _origGenerateScenario = generateScenario;
generateScenario = function(key) {
  _origGenerateScenario(key);
  // After generating, apply current brand theme
  if (currentBrand !== 'samsung') {
    const btn = document.querySelector(`.brand-btn[data-brand="${currentBrand}"]`);
    if (btn) setBrand(currentBrand, btn);
  }
};


function _detectCurrentScenario() {
  // Try to detect from active scene button
  const activeBtn = document.querySelector('.scene-btn[style*="border-color"],.scene-btn.active');
  if (activeBtn) {
    const onclick = activeBtn.getAttribute('onclick') || '';
    const m = onclick.match(/generateVariants\('([^']+)'\)/);
    if (m) return m[1];
  }
  return 'general';
}

