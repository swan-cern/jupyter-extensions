#!/bin/bash

# Create a middle layer for installing ipykernel, putting it apart from the user environment
uv venv $SWAN_ENV --seed 2>&1
source $SWAN_ENV/bin/activate
uv pip install "ipykernel==${IPYKERNEL_VERSION}"
SWAN_PACKAGES_PATH=$(python3 -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')
deactivate

# If using NXCALS, we need to also install the Spark packages and their dependencies in the SWAN environment
if [ -n "${USE_NXCALS}" ]; then
    SPARKCONNECTOR="sparkconnector==$(python -c 'import sparkconnector; print(sparkconnector.__version__)')"
    SPARKMONITOR="sparkmonitor==$(python -c 'import sparkmonitor; print(sparkmonitor.__version__)')"
    SPARKCONNECTOR_DEPENDENCIES="swanportallocator requests" # TODO: Remove swanportallocator and requests installation when the SparkConnector package gets properly updated
    
    # Activate the SWAN environment for installing the Spark packages
    source $SWAN_ENV/bin/activate
    uv pip install ${SPARKMONITOR} ${SPARKCONNECTOR_DEPENDENCIES} 2>&1

    # -------------- HACK SECTION --------------
    # Install SPARKCONNECTOR_DEPENDENCIES separately, install SparkConnector without its dependencies and change the configuration file
    # TODO: Remove this when the SparkConnector package gets properly updated
    uv pip install ${SPARKCONNECTOR} --no-deps 2>&1
    wget https://raw.githubusercontent.com/swan-cern/jupyter-extensions/refs/heads/swan-on-tn/SparkConnector/sparkconnector/configuration.py -O ${SWAN_PACKAGES_PATH}/sparkconnector/configuration.py 2>&1
fi

# Set up Acc-Py and create the environment
source "${ACCPY_PATH}/base/${BUILDER_VERSION}/setup.sh"
acc-py venv ${ENV_PATH} 2>&1

# Activate the environment
_log "Setting up the environment..."
ACTIVATE_ENV_CMD="source ${ENV_PATH}/bin/activate"
eval "${ACTIVATE_ENV_CMD}"

# Install user-requested packages in the environment.
# Use uv for better performance if environment is fully resolved;
# Otherwise, use pip for resolution (more reliable long-term).
_log "Installing packages from ${REQ_PATH}..."
if [ "${RESOLVED_REQ}" = true ]; then
    # Use the same pip configuration as the Acc-Py default pip
    ACCPY_PIP_CONF="-i $(pip config get global.index-url) --allow-insecure-host $(pip config get global.trusted-host)"
    uv pip install ${ACCPY_PIP_CONF} -r "${REQ_PATH}" 2>&1
else
    pip install -r "${REQ_PATH}" 2>&1
fi
if [ $? -ne 0 ]; then
    exit 1
fi

# Inject middle layer packages into the user environment by adding a .pth file to
# the environment site-packages that contains the path to the middle layer site-packages
USER_PACKAGES_PATH=$(python3 -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')
echo ${SWAN_PACKAGES_PATH} > ${USER_PACKAGES_PATH}/$(basename $SWAN_ENV).pth

