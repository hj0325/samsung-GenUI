import pipelineContract from '@/src/shared/contracts/pipeline';

const { PIPELINE_STREAM_EVENTS } = pipelineContract;

export async function streamPipeline({ path, payload, onEvent }) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Stream failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';
    for (const frame of frames) {
      if (!frame.trim()) continue;
      let event = 'message';
      let data = '';
      frame.split('\n').forEach((line) => {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data += line.slice(5).trim();
      });
      if (!data) continue;
      let parsed = data;
      try { parsed = JSON.parse(data); } catch (_) {}
      if (!Object.values(PIPELINE_STREAM_EVENTS).includes(event)) continue;
      onEvent({ event, data: parsed });
    }
  }
}
