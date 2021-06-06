import React from 'react';
import { observer } from 'mobx-react-lite';

import Button from '@material-ui/core/Button';
import CancelIcon from '@material-ui/icons/Cancel';
import CircularProgress from '@material-ui/core/CircularProgress';

import { store } from '../store';
import { LogList } from './common/loglist';
import { Layout, Section } from './common/layout';

export const Connecting = observer(() => {
  return (
    <Layout>
      <Section title="spark connecting" className="jp-SparkConnector-loading">
        <CircularProgress size={80} />
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
        startIcon={<CancelIcon />}
        className="jp-SparkConnector-button-main"
      >
        Cancel
      </Button>
    </Layout>
  );
});
