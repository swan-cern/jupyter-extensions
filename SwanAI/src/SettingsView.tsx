import React, { useState } from "react";

import { ProviderInfo, SwanAIConfig, deleteCredential, saveCredential } from "./api";

function statusLabel(provider: ProviderInfo): string {
  if (!provider.configured) {
    return "No API key";
  }
  if (provider.source === "env") {
    return "Key provided by this SWAN session";
  }
  return `Key saved · ${provider.hint}`;
}

function ProviderRow({
  provider,
  onChanged,
  onError,
}: {
  provider: ProviderInfo;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}): React.ReactElement {
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      setApiKey("");
      await onChanged();
    } catch (error: unknown) {
      onError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="swanai-provider-row">
      <div className="swanai-provider-head">
        <span className="swanai-provider-name">{provider.display_name}</span>
        <span className={`swanai-provider-status${provider.configured ? " swanai-provider-status-ok" : ""}`}>
          {statusLabel(provider)}
        </span>
      </div>

      {provider.editable ? (
        <div className="swanai-provider-form">
          <input
            type="password"
            className="swanai-key-input"
            placeholder="Paste an API key"
            value={apiKey}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            onChange={event => setApiKey(event.target.value)}
          />
          <button disabled={busy || !apiKey.trim()} onClick={() => run(() => saveCredential(provider.name, apiKey))}>
            Save
          </button>
          {provider.configured && (
            <button disabled={busy} onClick={() => run(() => deleteCredential(provider.name))}>
              Remove
            </button>
          )}
        </div>
      ) : (
        !provider.configured && <div className="swanai-provider-note">This provider cannot be configured here.</div>
      )}
    </div>
  );
}

export function SettingsView({
  config,
  onChanged,
  onError,
}: {
  config: SwanAIConfig;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}): React.ReactElement {
  return (
    <div className="swanai-settings">
      <p className="swanai-settings-intro">
        SwanAI talks to the providers below from your session, using your own API key. Keys are stored only in{" "}
        <code>{config.credentials_path}</code>, readable by you alone, and are never sent to your browser.
      </p>

      {config.providers.map(provider => (
        <ProviderRow key={provider.name} provider={provider} onChanged={onChanged} onError={onError} />
      ))}

      {!config.allow_user_credentials && (
        <p className="swanai-settings-intro">API keys are managed centrally in this SWAN session.</p>
      )}
    </div>
  );
}
