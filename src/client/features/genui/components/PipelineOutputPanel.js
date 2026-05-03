import { summarizePipelineResponse } from '@/src/client/renderers/scenes/renderPipelineResponse';
import { buildPipelineSections } from '@/src/client/renderers/scenes/pipelinePanels';

export default function PipelineOutputPanel({ events, response }) {
  const summary = response ? summarizePipelineResponse(response) : null;
  const sections = response ? buildPipelineSections(response) : [];

  return (
    <div className="genui-shell-sidebar-card">
      <div className="genui-shell-card-title">Pipeline Output</div>
      <div className="genui-shell-log-list">
        {events.length === 0 ? (
          <div className="genui-shell-empty">No streamed events yet.</div>
        ) : events.map((item, index) => (
          <div className="genui-shell-log-item" key={`${item.event}-${index}`}>
            <div className="genui-shell-log-event">{item.event}</div>
            <div className="genui-shell-log-body">{item.preview}</div>
          </div>
        ))}
      </div>
      {summary ? (
        <div className="genui-shell-summary">
          <div>Components: {summary.count}</div>
          <div>Renderable: {summary.renderable}</div>
        </div>
      ) : null}
      {sections.length ? (
        <div className="genui-shell-sections">
          {sections.map((section) => (
            <div className="genui-shell-section" key={section.id}>
              <div className="genui-shell-section-title">{section.title}</div>
              {section.lines.map((line, index) => (
                <div className="genui-shell-section-line" key={`${section.id}-${index}`}>{String(line)}</div>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
