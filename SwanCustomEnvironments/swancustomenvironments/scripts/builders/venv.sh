#!/bin/bash

# Check if there are any constraints on the Python version
PYTHON_VERSION=""
if [[ "${REQ_PATH}" == *pyproject.toml ]]; then
    # Extract requires-python from pyproject.toml
    PYTHON_VERSION=$(python -c "
import sys
import tomllib

with open('${REQ_PATH}', 'rb') as f:
    data = tomllib.load(f)

rp = data.get('project', {}).get('requires-python', '')
if rp:
    print(rp)
" 2>/dev/null)
fi

# Create venv
if [ -n "${PYTHON_VERSION}" ]; then
    _log "Detected requires-python: ${PYTHON_VERSION}"
    uv venv ${ENV_PATH} --seed --python "${PYTHON_VERSION}" 2>&1
else
    uv venv ${ENV_PATH} --seed 2>&1
fi

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
