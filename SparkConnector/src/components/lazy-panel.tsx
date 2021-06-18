import React, { Suspense } from 'react';

const SparkConnectorPanel = React.lazy(
  () => import(/* webpackChunkName: "sparkconnectorui" */ './panel')
);

export const LazySparkConnectorPanel = () => {
  return (
    <Suspense fallback={<div>loading</div>}>
      <SparkConnectorPanel />
    </Suspense>
  );
};
