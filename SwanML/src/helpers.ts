/**
 * Format a duration between two timestamps as a human-readable string.
 */
export function formatDuration(createdAt: string, finishedAt: string | null): string {
  const start = new Date(createdAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

const RTF = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const diffMins = Math.round((d.getTime() - Date.now()) / 60000);

  if (Math.abs(diffMins) < 60) {
    return RTF.format(diffMins, "minute");
  }
  if (Math.abs(diffMins) < 1440) {
    return RTF.format(Math.round(diffMins / 60), "hour");
  }
  return d.toLocaleDateString();
}

/**
 * Run state
 */
export interface StateConfig {
  label: string;
  color: string;
  icon: string;
  pulse?: boolean;
}

const STATE_MAP: Record<string, StateConfig> = {
  SUCCEEDED: { label: "Succeeded", color: "#2ea043", icon: "✓" },
  FAILED: { label: "Failed", color: "#cf222e", icon: "✗" },
  RUNNING: { label: "Running", color: "#1f6feb", icon: "●", pulse: true },
  PENDING: { label: "Pending", color: "#9a6700", icon: "◌", pulse: true },
  CANCELING: { label: "Canceling", color: "#9a6700", icon: "◌" },
  CANCELED: { label: "Canceled", color: "#656d76", icon: "⊘" },
  PAUSED: { label: "Paused", color: "#9a6700", icon: "❚❚" },
  SKIPPED: { label: "Skipped", color: "#656d76", icon: "→" },
};

export function getStateConfig(state: string): StateConfig {
  return STATE_MAP[state] || { label: state, color: "#656d76", icon: "?" };
}
