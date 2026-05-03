import { useMemo, useRef, useState } from 'react';
import GenuiTopbar from '@/src/client/features/genui/components/GenuiTopbar';
import SidebarTabs from '@/src/client/features/genui/components/SidebarTabs';
import PipelineOutputPanel from '@/src/client/features/genui/components/PipelineOutputPanel';
import CanvasBridgeFrame from '@/src/client/features/genui/components/CanvasBridgeFrame';
import { streamPipeline } from '@/src/client/features/genui/streamingClient';
import { createHistoryState, pushHistory } from '@/src/client/features/genui/historyState';

function previewForEvent(event, data) {
  if (typeof data === 'string') return data.slice(0, 120);
  try {
    return JSON.stringify(data).slice(0, 160);
  } catch (_) {
    return String(data);
  }
}

export default function GenuiWorkspace() {
  const bridgeRef = useRef(null);
  const [prompt, setPrompt] = useState('morning briefing on lock screen with weather and meetings');
  const [theme, setTheme] = useState('default');
  const [themeMode, setThemeMode] = useState('dark');
  const [device, setDevice] = useState('mobile');
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState([]);
  const [response, setResponse] = useState(null);
  const [clearNonce, setClearNonce] = useState(0);
  const [history, setHistory] = useState(() => createHistoryState());

  const latestHistory = useMemo(() => history.entries[history.index] || null, [history]);

  async function handleGenerate() {
    const nextPrompt = prompt.trim();
    if (!nextPrompt || isRunning) return;
    setIsRunning(true);
    setEvents([]);
    setResponse(null);
    bridgeRef.current?.sendGenerate?.();

    try {
      await streamPipeline({
        path: '/api/pipeline/full/stream',
        payload: { prompt: nextPrompt, scenario_text: nextPrompt, fastMode: false },
        onEvent: ({ event, data }) => {
          setEvents((current) => current.concat({ event, preview: previewForEvent(event, data) }));
          if (event === 'done') {
            setResponse(data);
            setHistory((current) => pushHistory(current, { prompt: nextPrompt, response: data }));
          }
        },
      });
    } catch (error) {
      setEvents((current) => current.concat({ event: 'error', preview: error.message }));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="page-shell genui-shell">
      <GenuiTopbar
        theme={theme}
        themeMode={themeMode}
        device={device}
        onThemeChange={setTheme}
        onThemeModeToggle={() => setThemeMode((current) => current === 'dark' ? 'light' : 'dark')}
        onDeviceChange={setDevice}
        onClear={() => {
          setClearNonce((current) => current + 1);
          setEvents([]);
          setResponse(null);
        }}
      />
      <div className="genui-shell-layout">
        <div className="genui-shell-sidebar">
          <SidebarTabs prompt={prompt} onPromptChange={setPrompt} onGenerate={handleGenerate} isRunning={isRunning} />
          <PipelineOutputPanel events={events} response={response || latestHistory?.response} />
        </div>
        <div className="genui-shell-canvas-stage">
          <CanvasBridgeFrame
            prompt={prompt}
            theme={theme}
            themeMode={themeMode}
            device={device}
            clearNonce={clearNonce}
            onReady={(bridge) => {
              bridgeRef.current = bridge;
              bridge.resendState?.();
            }}
          />
        </div>
      </div>
    </div>
  );
}
