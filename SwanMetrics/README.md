# SwanMetrics

SWAN Metrics extension to add metrics for specific user actions, such as opening editors.


## Requirements

* jupyter_server
* jupyter_events

## Install

```bash
pip install swanmetrics
```

## Observations

* The `/metrics` route was added to direct the `PrometheusMetricsHandler` to the root url, so that Prometheus always scrapes the same endpoint,
without having to access the `/user/<username>/metrics` endpoint every time. Otherwise, the username would have to be parsed each time Prometheus
would scrape the metrics from the user pod.
