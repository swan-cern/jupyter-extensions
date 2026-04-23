import React, { useEffect, useState, useCallback, useRef } from "react";
import { LabIcon } from "@jupyterlab/ui-components";

import { PipelineRun, fetchRuns } from "./api";
import { formatDuration, formatTime, getStateConfig } from "./helpers";

import kubeflowSvgStr from "../style/kubeflow.svg";

const kubeflowIcon = new LabIcon({
  name: "mlcern:kubeflow",
  svgstr: kubeflowSvgStr,
});

const POLL_INTERVAL = 15_000;
const PAGE_SIZE = 20;

interface VisibilityHost {
  readonly isVisible: boolean;
  onVisibilityChange(listener: (visible: boolean) => void): () => void;
}

export function RunStatusPanel({ widget }: { widget: VisibilityHost }): React.ReactElement {
  const [isVisible, setIsVisible] = useState(widget.isVisible);
  useEffect(() => widget.onVisibilityChange(setIsVisible), [widget]);

  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Track how many runs are loaded so polling preserves pagination depth.
  const loadedCountRef = useRef(PAGE_SIZE);
  useEffect(() => {
    loadedCountRef.current = Math.max(runs.length, PAGE_SIZE);
  }, [runs.length]);

  /**
   * Re-fetch all currently loaded runs (preserves depth).
   * If the user has loaded 3 pages, this will fetch all 3 pages
   * in a single request so the list doesn't shrink.
   */
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const page = await fetchRuns(loadedCountRef.current);
      setRuns(page.runs);
      setNextPageToken(page.next_page_token);
      setError(null);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to fetch runs");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch the next page and append to existing runs.
   */
  const loadMore = useCallback(async () => {
    if (!nextPageToken || loadingMore) {
      return;
    }
    try {
      setLoadingMore(true);
      const page = await fetchRuns(PAGE_SIZE, nextPageToken);
      setRuns(prev => [...prev, ...page.runs]);
      setNextPageToken(page.next_page_token);
      setError(null);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load more runs");
    } finally {
      setLoadingMore(false);
    }
  }, [nextPageToken, loadingMore]);

  // Fetch immediately when the sidebar becomes visible, then poll while visible.
  useEffect(() => {
    if (!isVisible) {
      return;
    }
    const initial = setTimeout(refresh, 0);
    const poll = setInterval(refresh, POLL_INTERVAL);
    return () => {
      clearTimeout(initial);
      clearInterval(poll);
    };
  }, [isVisible, refresh]);

  // Re-render relative times periodically.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mlcern-sidebar">
      {/* Header */}
      <div className="mlcern-header">
        <div className="mlcern-header-title">
          <kubeflowIcon.react tag="span" className="mlcern-header-icon" />
          <h2>Pipeline Runs</h2>
        </div>
        <div className="mlcern-header-actions">
          <button className="mlcern-refresh-btn" onClick={refresh} title="Refresh now" disabled={loading}>
            {loading ? "…" : "↻"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mlcern-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Run List */}
      <div className="mlcern-run-list">
        {runs.length === 0 && loading && !error && (
          <div className="mlcern-loading">
            <span className="mlcern-spinner" aria-hidden />
            <span>Loading runs…</span>
          </div>
        )}

        {runs.length === 0 && !loading && !error && <div className="mlcern-empty">No pipeline runs found.</div>}

        {runs.map(run => {
          const cfg = getStateConfig(run.state);

          return (
            <a
              key={run.id}
              className="mlcern-run-item"
              href={run.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open run in ml.cern.ch"
            >
              <div className="mlcern-run-top">
                <span className="mlcern-run-name">{run.name}</span>
                <span
                  className="mlcern-run-badge"
                  style={{
                    color: cfg.color,
                    background: `${cfg.color}18`,
                  }}
                >
                  <span className={cfg.pulse ? "mlcern-pulse" : ""}>{cfg.icon}</span>
                  {cfg.label}
                </span>
              </div>
              <div className="mlcern-run-meta">
                <span>{formatTime(run.created_at)}</span>
                <span>{formatDuration(run.created_at, run.finished_at)}</span>
              </div>
            </a>
          );
        })}

        {/* Load More */}
        {nextPageToken && (
          <div className="mlcern-load-more">
            <button className="mlcern-load-more-btn" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load more runs"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
