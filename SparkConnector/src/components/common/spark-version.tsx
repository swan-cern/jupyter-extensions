import React from 'react';
import { observer } from 'mobx-react-lite';

import { store } from '../../store';

export const SparkConnectionDetails = observer(() => {
  let details: React.ReactNode = '';
  if (
    store.currentNotebook?.clusterName &&
    store.currentNotebook?.sparkVersion
  ) {
    details = (
      <div className="jp-SparkConnector-connectionDetailsContainerInfo">
        Cluster <b>{store.currentNotebook.clusterName}</b> | Version{' '}
        <b>{store.currentNotebook.sparkVersion}</b>
      </div>
    );
  }
  return (
    <div className="jp-SparkConnector-details">
      <div>
        <div className="jp-SparkConnector-connectionDetailsContainer">
          <div className="jp-SparkConnector-logo" />
          {details}
        </div>
      </div>
    </div>
  );
});
