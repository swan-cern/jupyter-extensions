import React from 'react';

import CircularProgress from '@material-ui/core/CircularProgress';

import { Layout } from './common/layout';

export const Loading = () => {
  return (
    <Layout>
      <div className="jp-SparkConnector-loading">
        <CircularProgress size={80} />
      </div>
    </Layout>
  );
};
