import { JupyterFrontEnd, JupyterFrontEndPlugin } from "@jupyterlab/application";
import { ICommandPalette, ReactWidget } from "@jupyterlab/apputils";
import { INotebookTracker } from "@jupyterlab/notebook";
import { IRenderMimeRegistry } from "@jupyterlab/rendermime";
import { Message as LuminoMessage } from "@lumino/messaging";
import * as React from "react";

import { ChatPanel } from "./ChatPanel";

import "../style/index.css";

export class ChatWidget extends ReactWidget {
  private _listeners = new Set<(visible: boolean) => void>();

  constructor(
    private _rendermime: IRenderMimeRegistry,
    private _notebooks: INotebookTracker | null,
  ) {
    super();
    this.id = "swanai-chat";
    this.title.label = "AI";
    this.title.caption = "AI assistant";
    this.title.closable = true;
    this.addClass("swanai-chat-widget");
  }

  protected onAfterShow(msg: LuminoMessage): void {
    super.onAfterShow(msg);
    this._listeners.forEach(listener => listener(true));
  }

  protected onAfterHide(msg: LuminoMessage): void {
    super.onAfterHide(msg);
    this._listeners.forEach(listener => listener(false));
  }

  onVisibilityChange(listener: (visible: boolean) => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  render(): React.ReactElement {
    return React.createElement(ChatPanel, {
      widget: this,
      rendermime: this._rendermime,
      notebooks: this._notebooks,
    });
  }
}

const plugin: JupyterFrontEndPlugin<void> = {
  id: "swan-ai:plugin",
  autoStart: true,
  description: "Chat with AI providers from SWAN, through their APIs",
  requires: [IRenderMimeRegistry],
  optional: [INotebookTracker, ICommandPalette],

  activate: (
    app: JupyterFrontEnd,
    rendermime: IRenderMimeRegistry,
    notebooks: INotebookTracker | null,
    palette: ICommandPalette | null,
  ) => {
    const widget = new ChatWidget(rendermime, notebooks);
    app.shell.add(widget, "right", { rank: 900 });

    const command = "swanai:open-chat";
    app.commands.addCommand(command, {
      label: "Open the AI assistant",
      execute: () => {
        if (!widget.isAttached) {
          app.shell.add(widget, "right", { rank: 900 });
        }
        app.shell.activateById(widget.id);
      },
    });
    palette?.addItem({ command, category: "SWAN" });
  },
};

export default plugin;
