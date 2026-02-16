/**
 * Storage quota information for the user's CERNBox home.
 */
export interface IQuota {
  /** Bytes used */
  used: number;
  /** Total bytes available */
  total: number;
}

/**
 * Fetch the user's storage quota.
 *
 * TODO: Replace with a real CS3/CERNBox API call.
 */
export async function fetchQuota(): Promise<IQuota> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 200));

  return {
    used: 6.8 * 1024 * 1024 * 1024, // 6.8 GB
    total: 10 * 1024 * 1024 * 1024 // 10 GB
  };
}

/**
 * Format bytes into a human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = -1;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}
