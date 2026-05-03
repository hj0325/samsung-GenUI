import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { fetchThemes, saveTheme, setActiveTheme } from '@/src/client/features/customize/api-client';

function themeStyle(vars) {
  return Object.entries(vars || {}).reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}

function toEditableTheme(theme) {
  return {
    id: theme?.id || '',
    name: theme?.name || '',
    description: theme?.description || '',
    vars: { ...(theme?.vars || {}) },
  };
}

export default function CustomizeWorkspace() {
  const [themesData, setThemesData] = useState({ _active: '', themes: [] });
  const [selectedThemeId, setSelectedThemeId] = useState('');
  const [draft, setDraft] = useState(toEditableTheme());
  const [status, setStatus] = useState('Loading…');
  const [error, setError] = useState('');

  async function loadThemes(preferredThemeId) {
    setStatus('Loading…');
    setError('');
    try {
      const data = await fetchThemes();
      setThemesData(data);
      const nextThemeId = preferredThemeId || data._active || data.themes?.[0]?.id || '';
      setSelectedThemeId(nextThemeId);
      const activeTheme = data.themes.find((item) => item.id === nextThemeId) || data.themes[0];
      setDraft(toEditableTheme(activeTheme));
      setStatus('Ready');
    } catch (loadError) {
      setError(loadError.message);
      setStatus('Failed');
    }
  }

  useEffect(() => {
    loadThemes();
  }, []);

  const previewStyle = useMemo(() => themeStyle(draft.vars), [draft.vars]);
  const activeTheme = themesData.themes.find((item) => item.id === themesData._active);

  return (
    <div className="page-shell customize-shell">
      <Head><title>Theme Customize</title></Head>
      <div className="page-topbar">
        <div>
          <div className="page-title">Theme Customize</div>
          <div className="page-subtitle">React 편집기에서 `pages/api/themes/*`에 직접 연결되고, 레거시 `customize.html`은 fallback으로 남깁니다.</div>
        </div>
        <div className="page-links">
          <Link className="page-link" href="/">Home</Link>
          <Link className="page-link" href="/genui">GenUI</Link>
          <Link className="page-link" href="/improve">Improve</Link>
          <a className="page-link" href="/api/legacy/customize.html" target="_blank" rel="noreferrer">Legacy Customize</a>
        </div>
      </div>

      <div className="workspace-grid workspace-grid-customize">
        <section className="workspace-panel">
          <div className="workspace-panel-title">Theme Editor</div>
          <label className="workspace-field">
            <span>Base Theme</span>
            <select
              className="workspace-select"
              value={selectedThemeId}
              onChange={(event) => {
                const nextId = event.target.value;
                setSelectedThemeId(nextId);
                const theme = themesData.themes.find((item) => item.id === nextId);
                setDraft(toEditableTheme(theme));
              }}
            >
              {themesData.themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
            </select>
          </label>
          <label className="workspace-field"><span>Theme ID</span><input className="workspace-input" value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} /></label>
          <label className="workspace-field"><span>Theme Name</span><input className="workspace-input" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
          <label className="workspace-field"><span>Description</span><textarea className="workspace-textarea" rows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
          <div className="workspace-scroll-list">
            {Object.entries(draft.vars).map(([key, value]) => (
              <label className="workspace-field" key={key}>
                <span>{key}</span>
                <input
                  className="workspace-input"
                  value={value}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    vars: { ...current.vars, [key]: event.target.value },
                  }))}
                />
              </label>
            ))}
          </div>
          <div className="workspace-actions">
            <button className="genui-shell-button primary" type="button" onClick={async () => {
              setStatus('Saving…');
              setError('');
              try {
                await saveTheme({ theme: draft, replace: true });
                await loadThemes(draft.id);
                setStatus('Saved');
              } catch (saveError) {
                setError(saveError.message);
                setStatus('Failed');
              }
            }}>Save Theme</button>
            <button className="genui-shell-button" type="button" onClick={async () => {
              setStatus('Applying…');
              setError('');
              try {
                await saveTheme({ theme: draft, replace: true });
                await setActiveTheme(draft.id);
                await loadThemes(draft.id);
                setStatus('Applied');
              } catch (saveError) {
                setError(saveError.message);
                setStatus('Failed');
              }
            }}>Save + Activate</button>
          </div>
          <div className="workspace-note">Active theme: {activeTheme?.name || 'none'} · {status}</div>
          {error ? <div className="workspace-error">{error}</div> : null}
        </section>

        <section className="workspace-panel">
          <div className="workspace-panel-title">Live Preview</div>
          <div className="theme-preview-stage" style={previewStyle}>
            <div className="theme-preview-card weather-card">
              <div className="theme-preview-label">Morning Briefing</div>
              <div className="theme-preview-value">21°</div>
              <div className="theme-preview-meta">Sunny · Seoul</div>
            </div>
            <div className="theme-preview-card calendar-card">
              <div className="theme-preview-label">Calendar</div>
              <div className="theme-preview-row"><strong>09:30</strong><span>Design review with System UI</span></div>
              <div className="theme-preview-row"><strong>14:00</strong><span>Theme polish sync</span></div>
            </div>
            <div className="theme-preview-card message-card">
              <div className="theme-preview-label">Messages</div>
              <div className="theme-preview-row"><strong>Alex</strong><span>Can we ship the mono theme today?</span></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
