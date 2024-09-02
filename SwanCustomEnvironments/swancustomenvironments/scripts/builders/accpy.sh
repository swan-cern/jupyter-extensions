#!/bin/bash

# Checks if the provided Acc-Py version is valid
if [ ! -e "$ACCPY_PATH/base/$BUILDER_VERSION" ]; then
    _error "Invalid Acc-Py version (${BUILDER_VERSION})."
fi

# Set up Acc-Py and create the environment
source "${ACCPY_PATH}/base/${BUILDER_VERSION}/setup.sh"
acc-py venv ${ENV_PATH} | tee -a ${LOG_PATH}

# Activate the environment
_log "Setting up the environment..."
ACTIVATE_ENV_CMD="source ${ENV_PATH}/bin/activate"
eval "${ACTIVATE_ENV_CMD}"

# Install packages in the environment
_log "Installing packages from ${REQ_PATH}..."
pip install -r "${REQ_PATH}" | tee -a ${LOG_PATH}

# Install the same ipykernel that the Jupyter server uses
pip install ipykernel==${IPYKERNEL_VERSION} | tee -a ${LOG_FILE}
