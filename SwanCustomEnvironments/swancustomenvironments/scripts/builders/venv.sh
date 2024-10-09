#!/bin/bash

# Activate Rust in order to recognize the uv command
. "$HOME/.cargo/env"

# Create the environment
uv venv ${ENV_PATH} | tee -a ${LOG_FILE}

# Activate the environment
_log "Setting up the environment..."
ACTIVATE_ENV_CMD="source ${ENV_PATH}/bin/activate"
eval "${ACTIVATE_ENV_CMD}"

# Install packages in the environment and the same ipykernel that the Jupyter server uses
_log "Installing packages from ${REQ_PATH}..."
uv pip install -r "${REQ_PATH}" "ipykernel==${IPYKERNEL_VERSION}" | tee -a ${LOG_FILE}
