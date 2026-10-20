import { ChatMessage } from "./api";

const STORAGE_KEY = "swan-ai:conversation";

/**
 * Return the first fenced code block of an answer, or the whole text when it has none.
 * Used by the "Insert into notebook" action.
 */
export function firstCodeBlock(text: string): string {
  const match = /```[\w+-]*\n([\s\S]*?)```/.exec(text);
  return match ? match[1].replace(/\n$/, "") : text;
}

export function hasCodeBlock(text: string): boolean {
  return /```[\w+-]*\n[\s\S]*?```/.test(text);
}

/** Keep the current conversation across page reloads. Best effort: storage may be unavailable. */
export function loadConversation(): ChatMessage[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (entry): entry is ChatMessage =>
        entry && (entry.role === "user" || entry.role === "assistant") && typeof entry.content === "string",
    );
  } catch {
    return [];
  }
}

export function saveConversation(messages: ChatMessage[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Private browsing, blocked site data: losing the history on reload is acceptable.
  }
}

export function formatUsage(inputTokens: number, outputTokens: number): string {
  return `${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out tokens`;
}
