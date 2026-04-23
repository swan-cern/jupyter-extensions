import { ServerConnection } from "@jupyterlab/services";
import { URLExt } from "@jupyterlab/coreutils";

export interface PipelineRun {
  id: string;
  name: string;
  state: string;
  created_at: string;
  finished_at: string | null;
  url: string;
}

export interface RunsPage {
  runs: PipelineRun[];
  next_page_token: string | null;
}

/**
 * Fetch pipeline runs from the server extension.
 *
 * @param pageSize  Number of runs per page.
 * @param pageToken Token for the next page (from a previous response).
 */
export async function fetchRuns(pageSize = 20, pageToken?: string): Promise<RunsPage> {
  const settings = ServerConnection.makeSettings();

  const params = new URLSearchParams({ page_size: String(pageSize) });
  if (pageToken) {
    params.set("page_token", pageToken);
  }

  const url = URLExt.join(settings.baseUrl, "api", "mlcern", "runs") + `?${params.toString()}`;

  const response = await ServerConnection.makeRequest(url, {}, settings);

  if (!response.ok) {
    const body = await response.text();
    console.error("Failed to fetch runs:", response.status, body);
    throw new Error(`Failed to fetch runs (HTTP ${response.status}): ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  return {
    runs: data.runs || [],
    next_page_token: data.next_page_token || null,
  };
}
