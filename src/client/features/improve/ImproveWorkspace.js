import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  extractPatterns,
  fetchImproveHistory,
  fetchImproveReport,
  fetchLearnedRules,
  fetchRuleSchema,
  fetchTestSuite,
  runImproveCycle,
  runTestSuite,
} from '@/src/client/features/improve/api-client';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function statusLabel(state) {
  if (state.loading) return 'Loading';
  if (state.running) return state.running;
  return 'Idle';
}

export default function ImproveWorkspace() {
  const [history, setHistory] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [learned, setLearned] = useState({ runtime: [], persisted: [] });
  const [ruleSchema, setRuleSchema] = useState({ ruleTypes: [] });
  const [testSuite, setTestSuite] = useState(null);
  const [extraction, setExtraction] = useState(null);
  const [error, setError] = useState('');
  const [state, setState] = useState({ loading: true, running: '' });

  async function refreshDashboard(preferredFilename) {
    setState((current) => ({ ...current, loading: true }));
    setError('');
    try {
      const [historyData, learnedData, ruleSchemaData, suiteData] = await Promise.all([
        fetchImproveHistory(),
        fetchLearnedRules(),
        fetchRuleSchema(),
        fetchTestSuite(),
      ]);
      const reports = historyData.reports || [];
      setHistory(reports);
      setLearned(learnedData);
      setRuleSchema(ruleSchemaData);
      setTestSuite(suiteData);
      const target = preferredFilename || reports[0];
      if (target) {
        setSelectedReport(await fetchImproveReport(target));
      } else {
        setSelectedReport(null);
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setState({ loading: false, running: '' });
    }
  }

  useEffect(() => {
    refreshDashboard();
  }, []);

  const latestSummary = useMemo(() => {
    if (!selectedReport) return null;
    return selectedReport.summary || selectedReport.baseline || null;
  }, [selectedReport]);

  async function handleRunSuite() {
    setState({ loading: false, running: 'Running test suite…' });
    setError('');
    try {
      const report = await runTestSuite();
      setSelectedReport(report);
      await refreshDashboard(report.summary?.savedAs);
    } catch (runError) {
      setError(runError.message);
      setState({ loading: false, running: '' });
    }
  }

  async function handleExtract() {
    setState({ loading: false, running: 'Extracting patterns…' });
    setError('');
    try {
      const filename = history[0];
      const result = await extractPatterns(filename ? { reportFilename: filename } : {});
      setExtraction(result);
    } catch (runError) {
      setError(runError.message);
    } finally {
      setState({ loading: false, running: '' });
    }
  }

  async function handleRunCycle() {
    setState({ loading: false, running: 'Running full improve cycle…' });
    setError('');
    try {
      const cycle = await runImproveCycle();
      setExtraction(cycle);
      await refreshDashboard();
    } catch (runError) {
      setError(runError.message);
    } finally {
      setState({ loading: false, running: '' });
    }
  }

  return (
    <div className="page-shell improve-shell">
      <Head><title>Improve Dashboard</title></Head>
      <div className="page-topbar">
        <div>
          <div className="page-title">Improve Dashboard</div>
          <div className="page-subtitle">React 화면이 `pages/api/improve/*`에 직접 연결되고, 레거시 `improve.html`은 fallback 역할만 남깁니다.</div>
        </div>
        <div className="page-links">
          <Link className="page-link" href="/">Home</Link>
          <Link className="page-link" href="/genui">GenUI</Link>
          <Link className="page-link" href="/customize">Customize</Link>
          <a className="page-link" href="/api/legacy/improve.html" target="_blank" rel="noreferrer">Legacy Improve</a>
        </div>
      </div>

      <div className="workspace-grid workspace-grid-2">
        <section className="workspace-panel">
          <div className="workspace-panel-title">Control Center</div>
          <div className="workspace-actions">
            <button className="genui-shell-button primary" onClick={handleRunSuite} type="button">Run Test Suite</button>
            <button className="genui-shell-button" onClick={handleExtract} type="button">Extract Patterns</button>
            <button className="genui-shell-button" onClick={handleRunCycle} type="button">Run Full Cycle</button>
          </div>
          <div className="workspace-kpis">
            <div className="workspace-kpi"><span>Status</span><strong>{statusLabel(state)}</strong></div>
            <div className="workspace-kpi"><span>Suite Scenarios</span><strong>{testSuite?.scenarios?.length || 0}</strong></div>
            <div className="workspace-kpi"><span>Persisted Rules</span><strong>{learned?.persisted?.length || 0}</strong></div>
          </div>
          {error ? <div className="workspace-error">{error}</div> : null}
          <div className="workspace-note">
            Rule schema types: {(ruleSchema.ruleTypes || []).map((item) => item.type || item.id || item).slice(0, 8).join(', ') || 'none'}
          </div>
        </section>

        <section className="workspace-panel">
          <div className="workspace-panel-title">Latest Report</div>
          {latestSummary ? (
            <div className="workspace-stack">
              <div className="workspace-kpis">
                <div className="workspace-kpi"><span>Baseline</span><strong>{latestSummary.baselineScore ?? latestSummary.cumulativeScore ?? '—'}</strong></div>
                <div className="workspace-kpi"><span>Final</span><strong>{latestSummary.finalScore ?? latestSummary.weightedAvgScore ?? '—'}</strong></div>
                <div className="workspace-kpi"><span>Accepted</span><strong>{latestSummary.acceptedCount ?? 0}</strong></div>
              </div>
              <div className="workspace-table-wrap">
                <table className="workspace-table">
                  <thead>
                    <tr><th>Scenario</th><th>Score</th><th>Visible</th><th>Surface</th></tr>
                  </thead>
                  <tbody>
                    {(selectedReport?.runs || []).map((run) => (
                      <tr key={run.scenarioId}>
                        <td>{run.scenarioText}</td>
                        <td>{run.score}</td>
                        <td>{run.visibleCount}</td>
                        <td>{run.actualSurface}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : <div className="workspace-empty">No report loaded yet.</div>}
        </section>

        <section className="workspace-panel">
          <div className="workspace-panel-title">History</div>
          <div className="workspace-list">
            {history.length === 0 ? <div className="workspace-empty">No saved reports.</div> : history.map((filename) => (
              <button
                className="workspace-list-item"
                key={filename}
                onClick={async () => setSelectedReport(await fetchImproveReport(filename))}
                type="button"
              >
                <span>{filename}</span>
                <small>{formatDate(filename.replace('.json', '').replace(/-/g, ':'))}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="workspace-panel">
          <div className="workspace-panel-title">Extracted Rules / Cycle Result</div>
          {extraction ? (
            <div className="workspace-stack">
              {Array.isArray(extraction.proposedRules) ? (
                <div className="workspace-list">
                  {extraction.proposedRules.map((rule, index) => (
                    <div className="workspace-card" key={`${rule.type}-${index}`}>
                      <strong>{rule.type}</strong>
                      <div>{rule.reason || rule.constraint || 'No reason'}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {Array.isArray(extraction.trials) ? (
                <div className="workspace-list">
                  {extraction.trials.map((trial, index) => (
                    <div className="workspace-card" key={`${trial.rule?.id || trial.rule?.type || index}`}>
                      <strong>{trial.rule?.type || 'trial'}</strong>
                      <div>delta {trial.deltaPct}%</div>
                      <div>{trial.reason || (trial.accepted ? 'accepted' : 'rejected')}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : <div className="workspace-empty">Pattern extraction or cycle output will appear here.</div>}
        </section>
      </div>
    </div>
  );
}
