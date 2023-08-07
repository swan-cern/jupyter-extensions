import * as React from 'react';
import { observer } from 'mobx-react-lite';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import AssessmentIcon from '@material-ui/icons/Assessment';
import WebAssetIcon from '@material-ui/icons/WebAsset';
import LinkOffIcon from '@material-ui/icons/LinkOff';
import Button from '@material-ui/core/Button';
import Alert from '@material-ui/lab/Alert';
import AlertTitle from '@material-ui/lab/AlertTitle';
import IconButton from '@material-ui/core/IconButton';
import RefreshIcon from '@material-ui/icons/Refresh';

import { store } from '../store';
import { Layout, Section } from './common/layout';
import { LogList } from './common/loglist';

const YouAreConnecedTo = observer(() => {
  return (
    <Alert severity="success" style={{ margin: '8px' }}>
      <AlertTitle>
        Connected to <b>{store.currentNotebook.clusterName}</b>
      </AlertTitle>
      Variables available in the notebook
      <li>
        sc:{' '}
        <a
          href="https://spark.apache.org/docs/latest/api/python/reference/api/pyspark.SparkContext.html"
          target="_blank"
          rel="noreferrer"
        >
          <u>
            <b>SparkContext</b>
          </u>
        </a>
      </li>
      <li>
        spark:{' '}
        <a
          href="https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.SparkSession.html"
          target="_blank"
          rel="noreferrer"
        >
          <u>
            <b>SparkSession</b>
          </u>
        </a>
      </li>
    </Alert>
  );
});

export const Connected = observer(() => {
  return (
    <Layout>
      <YouAreConnecedTo />
      <Section title="connection resources">
        <List dense>
          <ListItem
            button
            component="a"
            target="_blank"
            href={
              store.currentNotebook?.connectionResources?.sparkWebuiUrl
            }
          >
            <ListItemIcon>
              <WebAssetIcon />
            </ListItemIcon>
            <ListItemText primary="Spark Web UI" />
          </ListItem>
          <ListItem
            button
            component="a"
            target="_blank"
            href={store.currentNotebook.connectionResources?.sparkMetricsUrl}
            disabled={
              !store.currentNotebook.connectionResources?.sparkMetricsUrl
            }
          >
            <ListItemIcon>
              <AssessmentIcon />
            </ListItemIcon>
            <ListItemText
              primary={
                'Spark Metrics Dashboard' +
                (!store.currentNotebook.connectionResources?.sparkMetricsUrl
                  ? '(bundle not added)'
                  : '')
              }
            />
          </ListItem>
        </List>
      </Section>
      <Section
        title="logs"
        className="jp-SparkConnector-logs"
        extraActions={
          <IconButton
            size="small"
            className="jp-SparkConnector-logrefresh"
            onClick={() => {
              store.onRefreshLogs();
            }}
          >
            <RefreshIcon />
          </IconButton>
        }
      >
        <LogList />
      </Section>

      <Button
        color="secondary"
        variant="contained"
        onClick={() => {
          store.onClickRestart();
        }}
        startIcon={<LinkOffIcon />}
        className="jp-SparkConnector-button-main"
      >
        Disconnect
      </Button>
    </Layout>
  );
});
