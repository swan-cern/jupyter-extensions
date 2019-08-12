# K8sSelection Extension

## Instructions to create and intialize an Openstack K8s cluster to use it with K8sSelection extension

* Create cluster
    ```bash
    openstack coe cluster create \
        --cluster-template kubernetes-1.13.3-3 \
        --master-flavor m2.small \
        --node-count 4 \
        --flavor m2.small \
        --keypair pkothuri_new \
        --labels keystone_auth_enabled="true" \
        --labels influx_grafana_dashboard_enabled="false" \
        --labels manila_enabled="true" \
        --labels kube_tag="v1.13.3-12" \
        --labels kube_csi_enabled="true" \
        --labels kube_csi_version="v0.3.2" \
        --labels container_infra_prefix="gitlab-registry.cern.ch/cloud/atomic-system-containers/" \
        --labels cgroup_driver="cgroupfs" \
        --labels cephfs_csi_enabled="true" \
        --labels flannel_backend="vxlan" \
        --labels cvmfs_csi_version="v0.3.0" \
        --labels admission_control_list="NamespaceLifecycle,LimitRanger,ServiceAccount,DefaultStorageClass,DefaultTolerationSeconds,MutatingAdmissionWebhook,ValidatingAdmissionWebhook,ResourceQuota,Priority" \
        --labels ingress_controller="traefik" \
        --labels manila_version="v0.3.0" \
        --labels cvmfs_csi_enabled="true" \
        --labels cvmfs_tag="qa" \
        --labels cephfs_csi_version="v0.3.0" \
        --labels monitoring_enabled="true" \
        --labels tiller_enabled="true" \
  <cluster-name>
    ```
    **Note**: `--labels "keystone_auth_enabled=true"` is important for token authentication

* Obtain Configuration
    ```bash
    mkdir -p $HOME/<cluster-name>
    cd $HOME/<cluster-name>
    openstack coe cluster config k8s-pkothuri > env.sh
    . env.sh
    ```

* Install tiller
    ```bash
    kubectl --namespace kube-system create serviceaccount tiller
    kubectl create clusterrolebinding tiller-kube-system --clusterrole cluster-admin --serviceaccount=kube-system:tiller
    helm init --service-account tiller --wait
    helm version
    ```

* Deploy Spark Services
    ```bash
    helm install \
        --wait \
        --name spark \
        --set spark.shuffle.enable=true \
        --set cvmfs.enable=true https://gitlab.cern.ch/db/spark-service/spark-service-charts/raw/master/cern-spark-services-1.0.0.tgz
    ```

* Deploy User. Namespace should be of the form `spark-$USER`
    ```bash
    helm install \
        --wait \
        --kubeconfig "${KUBECONFIG}" \
        --set namespace=spark-$USER \
        --set cvmfs.enable=true \
        --name "spark-user-USER" https://gitlab.cern.ch/db/spark-service/spark-service-charts/raw/master/cern-spark-user-1.0.0.tgz
    ```

* Create clusterolebinding. Clusterolebinding should be of the form `admin-cluster-spark-$USER`
    ```bash
    kubectl create clusterrolebinding cluster-admin-$USER --clusterrole=cluster-admin --user=$USER
    ```

* Config to add to k8sselection (name, server, certificate-authority-data)
    ```bash
    kubectl config view --flatten
    ```

## Instructions for User to use the extension

You will receive the credentials of the cluster from the admin on your CERN email. Get the credential from there and go to the extension to add the cluster onto your KUBECONFIG file.


## Instructions to run the extension using Docker on your local

First clone this repository and then run the following commands in the terminal

```bash
docker build -t custom_extension .
docker-compose -f docker-compose.yml up
```

**Note**: Please make sure you change the Envionment variables and volume mounts inside the `docker-compose.yml` file according to your local PC.

## Testing - running spark pi with selected cluster

```python
import os
from pyspark import SparkContext, SparkConf
from pyspark.sql import SparkSession

ports = os.getenv("SPARK_PORTS").split(",")

# change to SPARK_MASTER_IP
swan_spark_conf.set("spark.master", "k8s://" + os.getenv("K8S_MASTER_IP"))
swan_spark_conf.set("spark.kubernetes.container.image", "gitlab-registry.cern.ch/db/spark-service/docker-registry/swan:v1")
swan_spark_conf.set("spark.kubernetes.namespace", "swan-"+os.getenv("USER"))
swan_spark_conf.set("spark.driver.host", os.getenv("SERVER_HOSTNAME"))
swan_spark_conf.set("spark.executor.instances", 1)
swan_spark_conf.set("spark.executor.core", 1)
swan_spark_conf.set("spark.kubernetes.executor.request.cores", "100m")
swan_spark_conf.set("spark.executor.memory", "500m")
swan_spark_conf.set("spark.kubernetes.authenticate.oauthToken", os.getenv("OS_TOKEN"))
swan_spark_conf.set("spark.logConf", True)
swan_spark_conf.set("spark.driver.port", ports[0])
swan_spark_conf.set("spark.blockManager.port", ports[1])
swan_spark_conf.set("spark.ui.port", ports[2])
swan_spark_conf.set("spark.kubernetes.executorEnv.PYSPARK_PYTHON", "python3")
swan_spark_conf.set("spark.kubernetes.executor.volumes.persistentVolumeClaim.sft-cern-ch.mount.path","/cvmfs/sft.cern.ch")
swan_spark_conf.set("spark.kubernetes.executor.volumes.persistentVolumeClaim.sft-cern-ch.mount.readOnly", True)
swan_spark_conf.set("spark.kubernetes.executor.volumes.persistentVolumeClaim.sft-cern-ch.options.claimName", "cvmfs-sft-cern-ch-pvc")
swan_spark_conf.set("spark.kubernetes.executor.volumes.persistentVolumeClaim.sft-nightlies-cern-ch.mount.path", "/cvmfs/sft-nightlies.cern.ch")
swan_spark_conf.set("spark.kubernetes.executor.volumes.persistentVolumeClaim.sft-nightlies-cern-ch.mount.readOnly", True)
swan_spark_conf.set("spark.kubernetes.executor.volumes.persistentVolumeClaim.sft-nightlies-cern-ch.options.claimName", "cvmfs-sft-nightlies-cern-ch-pvc")
swan_spark_conf.set('spark.executorEnv.PYTHONPATH', os.environ.get('PYTHONPATH'))
swan_spark_conf.set('spark.executorEnv.JAVA_HOME', os.environ.get('JAVA_HOME'))
swan_spark_conf.set('spark.executorEnv.SPARK_HOME', os.environ.get('SPARK_HOME'))
swan_spark_conf.set('spark.executorEnv.SPARK_EXTRA_CLASSPATH', os.environ.get('SPARK_DIST_CLASSPATH'))

sc = SparkContext(conf=swan_spark_conf)
spark = SparkSession(sc)

import random
NUM_SAMPLES = 100
def inside(p):
    x, y = random.random(), random.random()
    return x*x + y*y < 1
count = sc.parallelize(range(0, NUM_SAMPLES)).filter(inside).count()
print("Pi is roughly %f" % (4.0 * count / NUM_SAMPLES))
```