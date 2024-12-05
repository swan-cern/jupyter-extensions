#!/bin/bash

if [ "${RESOLVED_REQ}" = true ]; then
    uv venv ${ENV_PATH} --seed 2>&1
else
    python -m venv ${ENV_PATH} 2>&1
fi

# Activate the environment
_log "Setting up the environment..."
ACTIVATE_ENV_CMD="source ${ENV_PATH}/bin/activate"
eval "${ACTIVATE_ENV_CMD}"

# Install user-requested packages in the environment.
# Use uv for better performance if environment is fully resolved;
# Otherwise, use pip for resolution (more reliable long-term).
_log "Installing packages from ${ORIGINAL_REQ_PATH}..."
if [ "${RESOLVED_REQ}" = true ]; then
    uv pip install -r "${REQ_PATH}" ${IPYKERNEL} 2>&1
else
    pip install -r "${REQ_PATH}" ${IPYKERNEL} 2>&1
fi
if [ $? -ne 0 ]; then
    exit 1
fi
