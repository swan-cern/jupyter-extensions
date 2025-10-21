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
_log "Installing packages from ${REQ_PATH}..."

# If REQ_PATH points to a pyproject.toml, change it to the its parent folder
# so pip doesn't get called with "-r pyproject.toml", which is invalid.
if [[ "${REQ_PATH}" == *pyproject.toml ]]; then
    REQ_PATH="$(dirname "${REQ_PATH}")"
fi
if [ "${RESOLVED_REQ}" = true ]; then
    uv pip install ${R_FLAG} "${REQ_PATH}" 2>&1
    if [ $? -ne 0 ]; then
        return 1
    fi
    # Enforce installation of our version of ipykernel and its dependencies
    uv pip install ${IPYKERNEL} 2>&1
else
    pip install ${R_FLAG} "${REQ_PATH}" 2>&1
    if [ $? -ne 0 ]; then
        return 1
    fi
    # Enforce installation of our version of ipykernel and its dependencies
    pip install ${IPYKERNEL} 2>&1
fi
