import React from 'react';
import { observer } from 'mobx-react-lite';

import { store } from '../../store';

/*
  Display a list of log output in monospace font.
*/
export const LogList = observer(() => {
  const logEndDivRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    logEndDivRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [store.currentNotebook.logs]);
  return (
    <div className="jp-SparkConnector-confDetailsContainer-sparkLogs info">
      {store.currentNotebook.logs.map((log: string, idx: number) => {
        return <pre key={idx}>{log}</pre>;
      })}
      <div ref={logEndDivRef} />
    </div>
  );
});
