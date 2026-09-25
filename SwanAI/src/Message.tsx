import { INotebookTracker, NotebookActions } from "@jupyterlab/notebook";
import { IRenderMimeRegistry } from "@jupyterlab/rendermime";
import React, { useState } from "react";

import { Markdown } from "./Markdown";
import { Role } from "./api";
import { firstCodeBlock, hasCodeBlock } from "./helpers";

export interface Turn {
  role: Role;
  content: string;
  /** Reasoning summary, when the model exposes one. */
  thinking?: string;
  /** True while this answer is still being written. */
  streaming?: boolean;
}

/** Put text into a new cell below the active one of the current notebook. */
function insertIntoNotebook(tracker: INotebookTracker, text: string): boolean {
  const panel = tracker.currentWidget;
  if (!panel) {
    return false;
  }
  NotebookActions.insertBelow(panel.content);
  const cell = panel.content.activeCell;
  if (!cell) {
    return false;
  }
  cell.model.sharedModel.setSource(text);
  return true;
}

export function Message({
  turn,
  rendermime,
  notebooks,
}: {
  turn: Turn;
  rendermime: IRenderMimeRegistry;
  notebooks: INotebookTracker | null;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const isUser = turn.role === "user";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(turn.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("SwanAI: could not copy to the clipboard", error);
    }
  };

  return (
    <div className={`swanai-message swanai-message-${turn.role}`}>
      <div className="swanai-message-role">{isUser ? "You" : "Assistant"}</div>

      {turn.thinking && (
        <div className="swanai-thinking">
          <button className="swanai-thinking-toggle" onClick={() => setThinkingOpen(open => !open)}>
            {thinkingOpen ? "▾" : "▸"} Thinking
          </button>
          {thinkingOpen && <div className="swanai-thinking-body">{turn.thinking}</div>}
        </div>
      )}

      {isUser ? (
        <div className="swanai-message-body swanai-user-text">{turn.content}</div>
      ) : (
        <div className="swanai-message-body">
          <Markdown rendermime={rendermime} text={turn.content} streaming={turn.streaming ?? false} />
          {turn.streaming && <span className="swanai-caret" aria-hidden />}
        </div>
      )}

      {!turn.streaming && turn.content && (
        <div className="swanai-message-actions">
          <button onClick={copy} title="Copy this message">
            {copied ? "Copied" : "Copy"}
          </button>
          {!isUser && notebooks && (
            <button
              onClick={() => {
                if (!insertIntoNotebook(notebooks, firstCodeBlock(turn.content))) {
                  console.warn("SwanAI: no notebook is open to insert into");
                }
              }}
              title="Insert below the active cell of the current notebook"
            >
              {hasCodeBlock(turn.content) ? "Insert code" : "Insert"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
