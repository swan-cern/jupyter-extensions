import { IRenderMimeRegistry, MimeModel } from "@jupyterlab/rendermime";
import React, { useEffect, useRef } from "react";

// Markdown is re-rendered at most this often while an answer streams in. Rendering every token
// would spend more time in the renderer than in the network.
const RENDER_INTERVAL = 150;

/**
 * Render markdown with JupyterLab's own renderer, so answers get the same markdown, code
 * highlighting and LaTeX support as a notebook, and the same sanitisation.
 *
 * The rendered markdown is plain DOM owned by the renderer widget, not React children, so the
 * throttling needed while streaming is done here rather than through React state.
 */
export function Markdown({
  rendermime,
  text,
  streaming,
}: {
  rendermime: IRenderMimeRegistry;
  text: string;
  streaming: boolean;
}): React.ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const lastRender = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const render = () => {
      const node = host.current;
      if (!node) {
        return;
      }
      lastRender.current = Date.now();
      const renderer = rendermime.createRenderer("text/markdown");
      renderer
        .renderModel(new MimeModel({ data: { "text/markdown": text } }))
        .then(() => {
          if (cancelled) {
            renderer.dispose();
            return;
          }
          node.replaceChildren(renderer.node);
        })
        .catch(error => {
          console.error("SwanAI: markdown rendering failed", error);
          if (!cancelled) {
            node.textContent = text;
          }
        });
    };

    // The final text is rendered immediately; intermediate ones wait out the interval.
    const delay = streaming ? Math.max(0, RENDER_INTERVAL - (Date.now() - lastRender.current)) : 0;
    const timer = setTimeout(render, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [rendermime, text, streaming]);

  return <div className="swanai-markdown" ref={host} />;
}
