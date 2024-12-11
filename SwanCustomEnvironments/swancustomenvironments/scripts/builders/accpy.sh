#!/bin/bash

# If using NXCALS, we need to also install the Spark packages and their dependencies in the SWAN environment
if [ -n "${USE_NXCALS}" ]; then
    SPARKCONNECTOR="sparkconnector==$(python -c 'import sparkconnector; print(sparkconnector.__version__)')"
    SPARKMONITOR="sparkmonitor==$(python -c 'import sparkmonitor; print(sparkmonitor.__version__)')"
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
    if [ $? -ne 0 ]; then
        return 1
    fi
    # Enforce installation of our version of ipykernel and its dependencies
    uv pip install ${ACCPY_PIP_CONF} ${IPYKERNEL} 2>&1
else
    pip install -r "${REQ_PATH}" 2>&1
    if [ $? -ne 0 ]; then
        return 1
    fi
    # Enforce installation of our version of ipykernel and its dependencies
    pip install ${IPYKERNEL} 2>&1
fi

if [ -n "${USE_NXCALS}" ]; then
    # For NXCALS, enforce installation of our Spark extensions and their dependencies at certain versions
    if [ "${RESOLVED_REQ}" = true ]; then
        uv pip install ${ACCPY_PIP_CONF} ${SPARKMONITOR} ${SPARKCONNECTOR} 2>&1
    else
        pip install ${SPARKMONITOR} ${SPARKCONNECTOR} 2>&1
    fi

    # -------------- HACK SECTION --------------
    # Replace the configuration file
    # TODO: Remove this when the SparkConnector includes the changes on the configuration file
    USER_PACKAGES_PATH=$(python3 -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')
    wget https://raw.githubusercontent.com/swan-cern/jupyter-extensions/refs/heads/swan-on-tn/SparkConnector/sparkconnector/configuration.py -O ${USER_PACKAGES_PATH}/sparkconnector/configuration.py 2>&1
fi