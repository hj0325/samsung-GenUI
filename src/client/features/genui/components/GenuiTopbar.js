const THEMES = ['default', 'minimal', 'vibrant', 'mono'];

export default function GenuiTopbar({
  theme,
  themeMode,
  device,
  onThemeChange,
  onThemeModeToggle,
  onDeviceChange,
  onClear,
}) {
  return (
    <div className="page-topbar genui-shell-topbar">
      <div>
        <div className="page-title">GenUI Workspace</div>
        <div className="page-subtitle">React shell controls the outer frame while the legacy runtime focuses on the canvas.</div>
      </div>
      <div className="genui-shell-actions">
        <label className="genui-shell-control">
          <span>Theme</span>
          <select value={theme} onChange={(event) => onThemeChange(event.target.value)}>
            {THEMES.map((value) => (
              <option value={value} key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button className="genui-shell-button" onClick={onThemeModeToggle} type="button">
          {themeMode === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
        </button>
        <label className="genui-shell-control">
          <span>Device</span>
          <select value={device} onChange={(event) => onDeviceChange(event.target.value)}>
            <option value="mobile">Galaxy S26</option>
            <option value="tablet">Galaxy Tab S10+</option>
            <option value="watch">Galaxy Watch 7</option>
            <option value="tv">Samsung TV</option>
            <option value="desktop">Galaxy Book</option>
          </select>
        </label>
        <button className="genui-shell-button ghost" onClick={onClear} type="button">Clear</button>
      </div>
    </div>
  );
}
