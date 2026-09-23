import { INotebookTracker } from "@jupyterlab/notebook";
import { IRenderMimeRegistry } from "@jupyterlab/rendermime";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { Message, Turn } from "./Message";
import { SettingsView } from "./SettingsView";
import { ChatMessage, ProviderInfo, SwanAIConfig, getConfig, getModels, streamChat } from "./api";
import { formatUsage, loadConversation, saveConversation } from "./helpers";

interface VisibilityHost {
  readonly isVisible: boolean;
  onVisibilityChange(listener: (visible: boolean) => void): () => void;
}

/** The conversation sent to the model: the turns that carry text, in order. */
function toChatMessages(turns: Turn[]): ChatMessage[] {
  return turns.filter(turn => turn.content.trim().length > 0).map(({ role, content }) => ({ role, content }));
}

function pickProvider(config: SwanAIConfig): ProviderInfo | undefined {
  return (
    config.providers.find(provider => provider.name === config.default_provider && provider.configured) ??
    config.providers.find(provider => provider.configured) ??
    config.providers.find(provider => provider.name === config.default_provider) ??
    config.providers[0]
  );
}

export function ChatPanel({
  widget,
  rendermime,
  notebooks,
}: {
  widget: VisibilityHost;
  rendermime: IRenderMimeRegistry;
  notebooks: INotebookTracker | null;
}): React.ReactElement {
  const [config, setConfig] = useState<SwanAIConfig | null>(null);
  const [provider, setProvider] = useState<string>("");
  const [chosenModel, setChosenModel] = useState<string>("");
  // Models the vendor advertises to the configured key, per provider, once we have asked.
  const [liveModels, setLiveModels] = useState<Record<string, string[]>>({});
  const [turns, setTurns] = useState<Turn[]>(() => loadConversation());
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedProvider = config?.providers.find(entry => entry.name === provider);
  // The picker offers the live list when we have one, and the offline list until then.
  const models = (liveModels[provider]?.length ? liveModels[provider] : selectedProvider?.models) ?? [];
  const model = models.includes(chosenModel) ? chosenModel : (selectedProvider?.default_model ?? models[0] ?? "");
  const ready = Boolean(selectedProvider?.configured);

  const applyConfig = useCallback((fresh: SwanAIConfig) => {
    setConfig(fresh);
    setProvider(current =>
      current && fresh.providers.some(entry => entry.name === current) ? current : (pickProvider(fresh)?.name ?? ""),
    );
  }, []);

  /** Re-read the configuration after a key was saved or removed. */
  const refreshConfig = useCallback(async () => {
    applyConfig(await getConfig());
  }, [applyConfig]);

  // Load the configuration once the panel is first shown.
  const [isVisible, setIsVisible] = useState(widget.isVisible);
  useEffect(() => widget.onVisibilityChange(setIsVisible), [widget]);
  useEffect(() => {
    if (!isVisible || config) {
      return;
    }
    let cancelled = false;
    getConfig()
      .then(fresh => {
        if (!cancelled) {
          applyConfig(fresh);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isVisible, config, applyConfig]);

  // Ask the selected provider which models its key can use. Failures are silent: the offline
  // list keeps the picker usable and the user has nothing to fix.
  useEffect(() => {
    if (!provider || !selectedProvider?.configured || liveModels[provider]) {
      return;
    }
    let cancelled = false;
    getModels(provider)
      .then(live => {
        if (!cancelled) {
          setLiveModels(current => ({ ...current, [provider]: live }));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [provider, selectedProvider?.configured, liveModels]);

  useEffect(() => saveConversation(toChatMessages(turns)), [turns]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const send = useCallback(async () => {
    const prompt = draft.trim();
    if (!prompt || streaming || !provider || !model) {
      return;
    }

    const history = [...toChatMessages(turns), { role: "user" as const, content: prompt }];
    setTurns(current => [
      ...current,
      { role: "user", content: prompt },
      { role: "assistant", content: "", streaming: true },
    ]);
    setDraft("");
    setError(null);
    setUsage(null);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    /** Update the answer being streamed, which is always the last turn. */
    const updateAnswer = (update: (turn: Turn) => Turn) =>
      setTurns(current => current.map((turn, index) => (index === current.length - 1 ? update(turn) : turn)));

    try {
      for await (const event of streamChat({ provider, model, messages: history }, controller.signal)) {
        switch (event.type) {
          case "delta":
            updateAnswer(turn => ({ ...turn, content: turn.content + event.text }));
            break;
          case "thinking":
            updateAnswer(turn => ({ ...turn, thinking: (turn.thinking ?? "") + event.text }));
            break;
          case "usage":
            setUsage(formatUsage(event.input_tokens, event.output_tokens));
            break;
          case "error":
            setError(event.message);
            break;
          case "start":
          case "done":
            break;
        }
      }
    } catch (err: unknown) {
      // An abort is the user pressing Stop, not a failure.
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      updateAnswer(turn => ({ ...turn, streaming: false }));
      // Drop an answer that never produced anything, so the history stays valid.
      setTurns(current =>
        current.length > 0 &&
        current[current.length - 1].role === "assistant" &&
        !current[current.length - 1].content.trim()
          ? current.slice(0, -1)
          : current,
      );
    }
  }, [draft, streaming, provider, model, turns]);

  const newConversation = useCallback(() => {
    stop();
    setTurns([]);
    setUsage(null);
    setError(null);
  }, [stop]);

  const modelSelect = (
    <select value={model} onChange={event => setChosenModel(event.target.value)} disabled={streaming}>
      {models.map(entry => (
        <option key={entry} value={entry}>
          {entry}
        </option>
      ))}
    </select>
  );

  return (
    <div className="swanai-panel">
      <div className="swanai-header">
        <h2>AI assistant</h2>
        <div className="swanai-header-actions">
          <button onClick={newConversation} title="Start a new conversation" disabled={streaming}>
            New
          </button>
          <button
            onClick={() => setShowSettings(open => !open)}
            title="API keys"
            className={showSettings ? "swanai-toggled" : ""}
          >
            Keys
          </button>
        </div>
      </div>

      {config && (
        <div className="swanai-selectors">
          {config.providers.length > 1 && (
            <select
              value={provider}
              onChange={event => {
                setProvider(event.target.value);
                setChosenModel("");
              }}
              disabled={streaming}
            >
              {config.providers.map(entry => (
                <option key={entry.name} value={entry.name}>
                  {entry.display_name}
                </option>
              ))}
            </select>
          )}
          {modelSelect}
        </div>
      )}

      {error && (
        <div className="swanai-error">
          {error}
          <button className="swanai-error-dismiss" onClick={() => setError(null)} title="Dismiss">
            ✕
          </button>
        </div>
      )}

      {showSettings && config && <SettingsView config={config} onChanged={refreshConfig} onError={setError} />}

      <div className="swanai-conversation">
        {!config && !error && <div className="swanai-placeholder">Loading…</div>}

        {config && !ready && !showSettings && (
          <div className="swanai-placeholder">
            No API key configured for {selectedProvider?.display_name ?? "this provider"}. Open <strong>Keys</strong> to
            add one.
          </div>
        )}

        {config && ready && turns.length === 0 && (
          <div className="swanai-placeholder">
            Ask about your analysis, a traceback, or how to do something in SWAN. The assistant cannot see your files,
            so paste what it needs.
          </div>
        )}

        {turns.map((turn, index) => (
          <Message key={index} turn={turn} rendermime={rendermime} notebooks={notebooks} />
        ))}
        <div ref={bottomRef} />
      </div>

      {usage && <div className="swanai-usage">{usage}</div>}

      <div className="swanai-composer">
        <textarea
          className="swanai-input"
          placeholder={ready ? "Ask something… (Enter to send, Shift+Enter for a new line)" : "Add an API key first"}
          value={draft}
          disabled={!ready}
          rows={3}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        {streaming ? (
          <button className="swanai-send" onClick={stop}>
            Stop
          </button>
        ) : (
          <button className="swanai-send" onClick={() => void send()} disabled={!ready || !draft.trim()}>
            Send
          </button>
        )}
      </div>
    </div>
  );
}
