import React from 'react';
import { observer } from 'mobx-react-lite';

import { store } from '../store';
import { ThemeProvider } from './theme-provider';
import { Authenticate } from './authenticate';
import { Configuring } from './configuring';
import { Connected } from './connected';
import { ConnectFailedComponent } from './connect-failed';
import { Connecting } from './connecting';
import { Loading } from './loading';
import { NotAttached } from './not-attached';

const SparkConnectorPanel = observer(() => {
  let page: JSX.Element = <div />;
  if (!store.currentNotebook) {
    return <NotAttached />;
  }
  switch (store.currentNotebook.status) {
    case 'configuring':
      page = <Configuring />;
      break;
    case 'auth':
      page = <Authenticate />;
      break;
    case 'connected':
      page = <Connected />;
      break;
    case 'connecting':
      page = <Connecting />;
      break;
    case 'loading':
      page = <Loading />;
      break;
    case 'error':
      page = <ConnectFailedComponent />;
      break;
    case 'notattached':
      page = <Loading />;
      break;
  }

  return <ThemeProvider>{page}</ThemeProvider>;
});

export default SparkConnectorPanel;
