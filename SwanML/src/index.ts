import { JupyterFrontEnd, JupyterFrontEndPlugin } from "@jupyterlab/application";
import { ReactWidget } from "@jupyterlab/apputils";
import { Message } from "@lumino/messaging";
import * as React from "react";

import { RunStatusPanel } from "./RunStatusPanel";

import "../style/index.css";

export class RunStatusWidget extends ReactWidget {
  private _listeners = new Set<(visible: boolean) => void>();

  constructor() {
    super();
    this.id = "mlcern-run-status";
    this.title.label = "ml.cern.ch";
    this.title.caption = "Pipeline Run Status";
    this.title.closable = true;
    this.addClass("mlcern-run-status-widget");
  }

  protected onAfterShow(msg: Message): void {
    super.onAfterShow(msg);
    this._listeners.forEach(l => l(true));
  }

  protected onAfterHide(msg: Message): void {
    super.onAfterHide(msg);
    this._listeners.forEach(l => l(false));
  }

  onVisibilityChange(listener: (visible: boolean) => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  render(): React.ReactElement {
    return React.createElement(RunStatusPanel, { widget: this });
  }
}

const plugin: JupyterFrontEndPlugin<void> = {
  id: "swan-ml:plugin",
  autoStart: true,
  description: "ml.cern.ch pipeline run status sidebar for SWAN",

  activate: (app: JupyterFrontEnd) => {
    const widget = new RunStatusWidget();

    // Add to the right sidebar
    app.shell.add(widget, "right", { rank: 1000 });
  },
};

export default plugin;
