import React from 'react';
import { observer } from 'mobx-react-lite';

import { store } from '../../store';
import { SparkConnectionDetails } from './spark-version';

const Title = observer(() => {
  let notebookName = '';
  if (store?.currentNotebook?.title) {
    notebookName = '| ' + store?.currentNotebook?.title;
  }
  return (
    <div className="jp-SparkConnector-panel">
      <span className="jp-SparkConnector-panelLabel">
        Apache Spark {notebookName}
      </span>
    </div>
  );
});

export const Layout = (props: { children: React.ReactNode }) => {
  return (
    <div className="jp-SparkConnector">
      <Title />
      <SparkConnectionDetails />
      {props.children}
    </div>
  );
};

export const Section = (props: {
  title: string;
  children?: React.ReactNode;
  extraActions?: React.ReactNode;
  className?: string;
}) => {
  return (
    <>
      <header className="jp-SparkConnector-section-header">
        {props.title}
        {props.extraActions}
      </header>
      <div className={'jp-SparkConnector-details ' + props.className || ''}>
        {props.children}
      </div>
    </>
  );
};
