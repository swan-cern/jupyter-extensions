#!/bin/bash

# Create the environment
python3 -m venv ${ENV_PATH} 2>&1 | tee -a ${LOG_FILE}

# Activate the environment
_log "Setting up the environment..."
ACTIVATE_ENV_CMD="source ${ENV_PATH}/bin/activate"
eval "${ACTIVATE_ENV_CMD}"

# Install packages in the environment and the same ipykernel that the Jupyter server uses
_log "Installing packages from ${REQ_PATH}..."
pip install -r "${REQ_PATH}" "ipykernel==${IPYKERNEL_VERSION}" 2>&1 | tee -a ${LOG_FILE}
