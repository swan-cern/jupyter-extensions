import { URLExt } from "@jupyterlab/coreutils";
import { ServerConnection } from "@jupyterlab/services";

export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ProviderInfo {
  name: string;
  display_name: string;
  default_model: string;
  models: string[];
  configured: boolean;
  source: "file" | "env" | null;
  hint: string | null;
  editable: boolean;
}

export interface SwanAIConfig {
  providers: ProviderInfo[];
  default_provider: string;
  default_model: string;
  allow_user_credentials: boolean;
  credentials_path: string;
}

/** The event vocabulary shared with the server extension (see swan_ai/providers/base.py). */
export type ChatEvent =
  | { type: "start"; model: string }
  | { type: "thinking"; text: string }
  | { type: "delta"; text: string }
  | { type: "usage"; input_tokens: number; output_tokens: number }
  | { type: "done"; stop_reason: string | null }
  | { type: "error"; message: string };

const settings = ServerConnection.makeSettings();

function apiUrl(...parts: string[]): string {
  return URLExt.join(settings.baseUrl, "api", "swanai", ...parts);
}

/** Read the message of a JSON error response, falling back to the status code. */
async function errorMessage(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed.message === "string" && parsed.message) {
      return parsed.message;
    }
  } catch {
    // Not JSON: an HTML error page from the proxy, or an empty body.
  }
  return `Request failed (HTTP ${response.status})`;
}

export async function getConfig(): Promise<SwanAIConfig> {
  const response = await ServerConnection.makeRequest(apiUrl("config"), {}, settings);
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
  return response.json();
}

/** Ask a provider for the models its configured key can actually use. */
export async function getModels(provider: string): Promise<string[]> {
  const url = `${apiUrl("models")}?provider=${encodeURIComponent(provider)}`;
  const response = await ServerConnection.makeRequest(url, {}, settings);
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
  const data = await response.json();
  return data.models ?? [];
}

export async function saveCredential(provider: string, apiKey: string): Promise<void> {
  const response = await ServerConnection.makeRequest(
    apiUrl("credentials"),
    { method: "POST", body: JSON.stringify({ provider, api_key: apiKey }) },
    settings,
  );
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
}

export async function deleteCredential(provider: string): Promise<void> {
  const url = `${apiUrl("credentials")}?provider=${encodeURIComponent(provider)}`;
  const response = await ServerConnection.makeRequest(url, { method: "DELETE" }, settings);
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
}

export interface ChatRequest {
  provider: string;
  model: string;
  messages: ChatMessage[];
}

/**
 * Stream one answer.
 *
 * Yields the events the server extension sends. Aborting `signal` closes the connection, which
 * the server notices and uses to stop the generation.
 */
export async function* streamChat(request: ChatRequest, signal: AbortSignal): AsyncGenerator<ChatEvent> {
  const response = await ServerConnection.makeRequest(
    apiUrl("chat"),
    { method: "POST", body: JSON.stringify(request), signal },
    settings,
  );

  if (!response.ok) {
    yield { type: "error", message: await errorMessage(response) };
    return;
  }
  if (!response.body) {
    yield { type: "error", message: "The server returned an empty response." };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      // Server-Sent Events are separated by a blank line. The last chunk of the buffer may be
      // an incomplete frame, so it stays in the buffer until the rest arrives.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const payload = frame
          .split("\n")
          .filter(line => line.startsWith("data:"))
          .map(line => line.slice("data:".length).trim())
          .join("");
        if (!payload) {
          continue; // A `: keepalive` comment frame.
        }
        try {
          yield JSON.parse(payload) as ChatEvent;
        } catch {
          console.error("SwanAI: could not parse a stream frame", payload);
        }
      }
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
}
