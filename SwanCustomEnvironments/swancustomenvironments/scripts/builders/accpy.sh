#!/bin/bash

# If using NXCALS, we need to install the Spark extensions and the nxcals package.
if [ -n "${INSTALL_NXCALS}" ]; then
    SPARKCONNECTOR="sparkconnector==$(python -c 'import sparkconnector; print(sparkconnector.__version__)')"
    SPARKMONITOR="sparkmonitor==$(python -c 'import sparkmonitor; print(sparkmonitor.__version__)')"
    NXCALS="nxcals"
    SWANPORTALLOCATOR="swanportallocator" # TODO: Remove swanportallocator installation when the SparkConnector package gets properly updated
fi

# Set up Acc-Py and create the environment
source "${ACCPY_PATH}/base/${BUILDER_VERSION}/setup.sh"
acc-py venv ${ENV_PATH} 2>&1 | tee -a ${LOG_FILE}

# Activate the environment
_log "Setting up the environment..."
ACTIVATE_ENV_CMD="source ${ENV_PATH}/bin/activate"
eval "${ACTIVATE_ENV_CMD}"

# Install packages in the environment and the same ipykernel that the Jupyter server uses
_log "Installing packages from ${REQ_PATH}..."
pip install -r "${REQ_PATH}" "ipykernel==${IPYKERNEL_VERSION}" ${NXCALS} ${SPARKMONITOR} ${SWANPORTALLOCATOR} 2>&1 | tee -a ${LOG_FILE} # TODO


# -------------- HACK SECTION --------------
# Install SWANPORTALLOCATOR separately, install SparkConnector without its dependencies and change the configuration file
# TODO: Remove this when the SparkConnector package gets properly updated
if [ -n "${INSTALL_NXCALS}" ]; then
    pip install ${SPARKCONNECTOR} --no-deps 2>&1 | tee -a ${LOG_FILE}
    wget https://raw.githubusercontent.com/swan-cern/jupyter-extensions/refs/heads/swan-on-tn/SparkConnector/sparkconnector/configuration.py -O ${ENV_PATH}/lib/python3.11/site-packages/sparkconnector/configuration.py 2>&1 | tee -a ${LOG_FILE}
fi
