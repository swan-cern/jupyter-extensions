# Switch Cluster Extension

## Instructions for Admin to create an Openstack cluster and use the extension

* First create the cluster using the below command.
    ``` bash
    openstack coe cluster create   --cluster-template kubernetes   --master-flavor m2.small --node-count 2 --flavor m2.small --keypair robotkey --labels "keystone_auth_enabled=true" <name_of_cluster>
    ```
    **Note**: `--labels "keystone_auth_enabled=true"` this   peice is important for token authentication

* Create a directory and cd into it. You can give it any name, I have given it `tutorial-k8s-keystone-auth`
    ``` bash
    mkdir -p $HOME/tutorial-k8s-keystone-auth
    cd $HOME/tutorial-k8s-keystone-auth
    ```

* Generate a KUBECONFIG file for the above created cluster
    ``` bash
    openstack coe cluster config <above_create_cluster_name> --dir $HOME/<above_created_dir>
    ```

* Set the path of above generated KUBECONFIG file in $KUBECONFIG env variable
    ``` bash
    export KUBECONFIG="$HOME/tutorial-k8s-keystone-auth/config"
    ```

* Create your namespace in the cluster. Namespace should be of the form `swan-$USER`
    ``` bash
    kubectl create namespace <namespace_name>
    ```

* Create clusterolebinding. Clusterolebinding should be of the form `admin-cluster-swan-$USER`
    ``` bash
    kubectl create clusterrolebinding <name> --clusterrole=cluster-admin --user=$USER --namespace=<namespace_name>
    ```

* Then go to the swan notebook and add the cluster using `certificate-authority-data`, `server-ip` and `cluster-name` from the above generated KUBECONFIG file. Below is the sample of the KUBECONFIG file
    ``` yaml
    - cluster:
        certificate-authority-data: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUM1ekNDQWMrZ0F3SUJBZ0lCQVRBTkJna3Foa2lHOXcwQkFRc0ZBREFWTVJNd0VRWURWUVFERXdwdGFXlpjdWhhbFJJbGxadUtSRVltWi9qTQp1Q2hMd25Zd1k5RWhhWUhtVWRhOGlXcHBzUjVram9YaXBmQnU0QXd1N1hucXRKUE8wdzFTdG9HK2lBMVJEcjQ5Cmh3bVR4czRhQ2prYXd2TEhRdlh2TWRBbG9pYXJMMkhZUC9kagotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0tCg==
        server: https://192.168.99.103:8443
        name: jajodia
    ```

## Instructions for User to use the extension

You will receive the credentials of the cluster from the admin on your CERN email. Get the credential from there and go to the extension to add the cluster onto your KUBECONFIG file.


## Instructions to run the extension using Docker on your local

First clone this repository and then run the following commands in the terminal

``` bash
docker build -t custom_extension .
docker-compose -f docker-compose.yml up
```

**Note**: Please make sure you change the Envionment variables and volume mounts inside the `docker-compose.yml` file according to your local PC.
