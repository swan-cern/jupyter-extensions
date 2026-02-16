import { FileBrowser } from '@jupyterlab/filebrowser';
import { IQuota, fetchQuota, formatBytes } from './quota';

const CSS = {
  container: 'swan-quota-container',
  label: 'swan-quota-label',
  barOuter: 'swan-quota-bar-outer',
  barInner: 'swan-quota-bar-inner',
  barWarning: 'swan-quota-bar-warning',
  barCritical: 'swan-quota-bar-critical'
} as const;

/** Usage thresholds for visual warnings */
const WARN_THRESHOLD = 0.8;
const CRITICAL_THRESHOLD = 0.95;

/**
 * Create and attach a storage quota indicator to the bottom
 * of the default file browser panel.
 */
export async function attachQuotaIndicator(fileBrowser: FileBrowser): Promise<void> {
  const container = document.createElement('div');
  container.className = CSS.container;

  const label = document.createElement('div');
  label.className = CSS.label;
  label.textContent = 'Loading…';

  const barOuter = document.createElement('div');
  barOuter.className = CSS.barOuter;

  const barInner = document.createElement('div');
  barInner.className = CSS.barInner;
  barInner.style.width = '0%';

  barOuter.appendChild(barInner);
  container.appendChild(label);
  container.appendChild(barOuter);

  fileBrowser.node.appendChild(container);

  // Initial load
  await updateQuota(label, barInner);

  // Refresh periodically (every 5 minutes)
  setInterval(
    () => {
      updateQuota(label, barInner);
    },
    5 * 60 * 1000
  );
}

async function updateQuota(label: HTMLElement, barInner: HTMLElement): Promise<void> {
  try {
    const quota: IQuota = await fetchQuota();
    const fraction = quota.total > 0 ? quota.used / quota.total : 0;
    const percent = Math.min(fraction * 100, 100);

    label.textContent = `${formatBytes(quota.used)} / ${formatBytes(quota.total)}`;

    barInner.style.width = `${percent}%`;

    // Remove old threshold classes
    barInner.classList.remove(CSS.barWarning, CSS.barCritical);

    if (fraction >= CRITICAL_THRESHOLD) {
      barInner.classList.add(CSS.barCritical);
    } else if (fraction >= WARN_THRESHOLD) {
      barInner.classList.add(CSS.barWarning);
    }
  } catch {
    label.textContent = 'Quota unavailable';
    barInner.style.width = '0%';
  }
}
