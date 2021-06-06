import * as React from 'react';
import { observer } from 'mobx-react-lite';

import ReplayIcon from '@material-ui/icons/Replay';
import Button from '@material-ui/core/Button';
import Alert from '@material-ui/lab/Alert';
import AlertTitle from '@material-ui/lab/AlertTitle';

import { Layout, Section } from './common/layout';
import { LogList } from './common/loglist';
import { store } from '../store';

export const ConnectFailedComponent = observer(() => {
  return (
    <Layout>
      <Section title="connection failed" className="jp-SparkConnector-error">
        <Alert severity="error">
          <AlertTitle>Error</AlertTitle>
          {store.currentNotebook.errorMessage}
        </Alert>
      </Section>
      <Section title="logs" className="jp-SparkConnector-logs">
        <LogList />
      </Section>
      <Button
        color="secondary"
        variant="contained"
        onClick={() => {
          store.onClickRestart();
        }}
        startIcon={<ReplayIcon />}
        className="jp-SparkConnector-button-main"
      >
        Restart
      </Button>
    </Layout>
  );
});
