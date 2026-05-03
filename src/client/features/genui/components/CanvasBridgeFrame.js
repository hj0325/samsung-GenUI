import { useEffect, useRef } from 'react';
import bridgeContract from '@/src/shared/contracts/bridge';

const { BRIDGE_MESSAGE_TYPES, BRIDGE_SOURCE } = bridgeContract;

export default function CanvasBridgeFrame({ prompt, device, theme, themeMode, clearNonce, onReady }) {
  const frameRef = useRef(null);
  const targetOrigin = typeof window !== 'undefined' ? window.location.origin : '*';

  function postMessage(message) {
    if (!frameRef.current || !frameRef.current.contentWindow) return;
    frameRef.current.contentWindow.postMessage({ source: BRIDGE_SOURCE, ...message }, targetOrigin);
  }

  useEffect(() => {
    postMessage({ type: BRIDGE_MESSAGE_TYPES.DEVICE, payload: { mode: device } });
  }, [device]);

  useEffect(() => {
    postMessage({ type: BRIDGE_MESSAGE_TYPES.THEME_PRESET, payload: { themeId: theme } });
  }, [theme]);

  useEffect(() => {
    postMessage({ type: BRIDGE_MESSAGE_TYPES.THEME_MODE, payload: { mode: themeMode } });
  }, [themeMode]);

  useEffect(() => {
    if (!clearNonce) return;
    postMessage({ type: BRIDGE_MESSAGE_TYPES.CLEAR });
  }, [clearNonce]);

  useEffect(() => {
    if (!prompt) return;
    postMessage({ type: BRIDGE_MESSAGE_TYPES.PROMPT, payload: { prompt } });
  }, [prompt]);

  return (
    <iframe
      className="genui-shell-canvas-frame"
      ref={frameRef}
      onLoad={() => {
        onReady?.({
          sendGenerate: () => postMessage({ type: BRIDGE_MESSAGE_TYPES.GENERATE, payload: { prompt } }),
          resendState: () => {
            postMessage({ type: BRIDGE_MESSAGE_TYPES.DEVICE, payload: { mode: device } });
            postMessage({ type: BRIDGE_MESSAGE_TYPES.THEME_PRESET, payload: { themeId: theme } });
            postMessage({ type: BRIDGE_MESSAGE_TYPES.THEME_MODE, payload: { mode: themeMode } });
          },
        });
      }}
      src="/api/legacy/genui.html?embed=canvas"
      title="GenUI Canvas"
    />
  );
}
