#!/bin/bash

# If using NXCALS, we need to install the Spark extensions and the nxcals package.
if [ -n "${INSTALL_NXCALS}" ]; then
    SPARKCONNECTOR="sparkconnector==$(python -c 'import sparkconnector; print(sparkconnector.__version__)')"
    SPARKMONITOR="sparkmonitor==$(python -c 'import sparkmonitor; print(sparkmonitor.__version__)')"
    NXCALS="nxcals"
    SPARKCONNECTOR_DEPENDENCIES="swanportallocator requests" # TODO: Remove swanportallocator and requests installation when the SparkConnector package gets properly updated
    
    # Create a middle layer for installing Spark extensions, putting them apart from the user environment
    SWAN_ENV="${HOME}/swan"
    python -m venv ${SWAN_ENV} 2>&1
    source ${SWAN_ENV}/bin/activate
    SWAN_PACKAGES_PATH=$(python3 -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')

    pip install ${SPARKMONITOR} ${SPARKCONNECTOR_DEPENDENCIES} 2>&1

    # -------------- HACK SECTION --------------
    # Install SPARKCONNECTOR_DEPENDENCIES separately, install SparkConnector without its dependencies and change the configuration file
    # TODO: Remove this when the SparkConnector package gets properly updated
    pip install ${SPARKCONNECTOR} --no-deps 2>&1
    wget https://raw.githubusercontent.com/swan-cern/jupyter-extensions/refs/heads/swan-on-tn/SparkConnector/sparkconnector/configuration.py -O ${SWAN_PACKAGES_PATH}/sparkconnector/configuration.py 2>&1
fi

# Set up Acc-Py and create the environment
source "${ACCPY_PATH}/base/${BUILDER_VERSION}/setup.sh"
acc-py venv ${ENV_PATH} 2>&1

# Activate the environment
_log "Setting up the environment..."
ACTIVATE_ENV_CMD="source ${ENV_PATH}/bin/activate"
eval "${ACTIVATE_ENV_CMD}"

# Install packages in the environment and the same ipykernel that the Jupyter server uses
_log "Installing packages from ${REQ_PATH}..."
pip install -r "${REQ_PATH}" "ipykernel==${IPYKERNEL_VERSION}" ${NXCALS} 2>&1
if [ $? -ne 0 ]; then
    exit 1
fi

# Inject middle layer packages into the user environment by adding a .pth file to
# the environment site-packages that contains the path to the middle layer site-packages
if [ -n "${INSTALL_NXCALS}" ]; then
    USER_PACKAGES_PATH=$(python3 -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')
    echo ${SWAN_PACKAGES_PATH} > ${USER_PACKAGES_PATH}/$(basename ${SWAN_ENV}).pth
fi
