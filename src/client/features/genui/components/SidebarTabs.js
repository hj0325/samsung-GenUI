export default function SidebarTabs({ prompt, onPromptChange, onGenerate, isRunning }) {
  return (
    <div className="genui-shell-sidebar-card">
      <div className="genui-shell-card-title">Generate</div>
      <textarea
        className="genui-shell-textarea"
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        placeholder="Describe your screen"
        rows={7}
      />
      <button className="genui-shell-button primary" disabled={isRunning || !prompt.trim()} onClick={onGenerate} type="button">
        {isRunning ? 'Running pipeline...' : 'Run Pipeline'}
      </button>
      <div className="genui-shell-hint">
        The React shell now owns prompt input and pipeline logging. The legacy iframe only renders the canvas surface.
      </div>
    </div>
  );
}
