#!/bin/bash

# Create a virtual environment
uv venv ${ENV_PATH} --seed 2>&1

# Activate the environment
_log "Setting up the environment..."
ACTIVATE_ENV_CMD="source ${ENV_PATH}/bin/activate"
eval "${ACTIVATE_ENV_CMD}"

# Install user-requested packages in the environment.
_log "Installing packages from ${REQ_PATH}..."

# If REQ_PATH points to a pyproject.toml, change it to the its parent folder
# so pip doesn't get called with "-r pyproject.toml", which is invalid.
if [[ "${REQ_PATH}" == *pyproject.toml ]]; then
    REQ_PATH="$(dirname "${REQ_PATH}")"
fi

uv pip install ${R_FLAG} "${REQ_PATH}" 2>&1
if [ $? -ne 0 ]; then
    return 1
fi

# Enforce installation of our version of ipykernel and its dependencies
uv pip install ${IPYKERNEL} 2>&1
