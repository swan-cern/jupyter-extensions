# Switch Cluster Extension

### Instructions to run the extension using Docker

First clone this repository and then run the following commands in the terminal

``` bash
docker build -t custom_extension .
docker-compose -f docker-compose.yml up
```

**Note**: Please make sure you change the Envionment variables and volume mounts inside the `docker-compose.yml` file according to your local PC.
