#!/bin/bash

# Activate Rust in order to recognize the uv command
. "$HOME/.cargo/env"

# Set up Acc-Py and create the environment
source "${ACCPY_PATH}/base/${BUILDER_VERSION}/setup.sh"
acc-py venv ${ENV_PATH} | tee -a ${LOG_FILE}

# Activate the environment
_log "Setting up the environment..."
ACTIVATE_ENV_CMD="source ${ENV_PATH}/bin/activate"
eval "${ACTIVATE_ENV_CMD}"

# Install packages in the environment and the same ipykernel that the Jupyter server uses
_log "Installing packages from ${REQ_PATH}..."
uv pip install -i https://acc-py-repo.cern.ch/repository/vr-py-releases/simple --allow-insecure-host acc-py-repo.cern.ch -r "${REQ_PATH}" ${SPARKCONNECTOR} ${SPARKMONITOR} ${PY4J} | tee -a ${LOG_FILE}
