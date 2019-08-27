Create cluster
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
**Note**: `--labels "keystone_auth_enabled=true"` is important for openstack token authentication
<br><br>

Obtain Configuration
```bash
mkdir -p $HOME/<cluster-name>
cd $HOME/<cluster-name>
openstack coe cluster config k8s-pkothuri > env.sh
. env.sh
```
<br>

Install tiller
```bash
kubectl --namespace kube-system create serviceaccount tiller
kubectl create clusterrolebinding tiller-kube-system --clusterrole cluster-admin --serviceaccount=kube-system:tiller
helm init --service-account tiller --wait
helm version
```
<br>

Deploy Spark Services
```bash
helm install \
    --wait \
    --name spark \
    --set spark.shuffle.enable=true \
    --set cvmfs.enable=true https://gitlab.cern.ch/db/spark-service/spark-service-charts/raw/master/cern-spark-services-1.0.0.tgz
```
<br>

Deploy Admin. Namespace should be of the form `spark-$USER`
```bash
helm install \
    --wait \
    --kubeconfig "${KUBECONFIG}" \
    --set cvmfs.enable=true \
    --set user.name=$USER \
    --set user.admin=true \
    --name "spark-admin-$USER" https://gitlab.cern.ch/db/spark-service/spark-service-charts/raw/spark_user_accounts/cern-spark-user-1.1.0.tgz
```

<br>

Config to add to k8sselection (name, server, certificate-authority-data)
```bash
kubectl config view --flatten
```