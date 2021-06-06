import React from 'react';

import LinkIcon from '@material-ui/icons/Link';
import Button from '@material-ui/core/Button';

import { store } from '../../store';
import { Layout } from '../common/layout';
import { InputSparkConfiguration } from './input-spark-configuration';
import { ChooseBundles } from './choose-bundles';
import { SelectedConfiguration } from './selected-configuration';

export const Configuring = () => {
  return (
    <Layout>
      <div className="jp-SparkConnector-scrollable">
        <ChooseBundles />
        <InputSparkConfiguration />
        <SelectedConfiguration />
      </div>
      <Button
        color="primary"
        variant="contained"
        onClick={() => {
          store.onClickConnect();
        }}
        startIcon={<LinkIcon />}
        className="jp-SparkConnector-button-main"
      >
        Connect
      </Button>
    </Layout>
  );
};
