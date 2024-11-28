#!/bin/bash

# Create a middle layer for installing ipykernel, putting it apart from the user environment
uv venv $SWAN_ENV --seed 2>&1
source $SWAN_ENV/bin/activate
uv pip install "ipykernel==${IPYKERNEL_VERSION}"
SWAN_PACKAGES_PATH=$(python3 -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')
deactivate

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
if [ "${RESOLVED_REQ}" = true ]; then
    uv pip install -r "${REQ_PATH}" 2>&1
else
    pip install -r "${REQ_PATH}" 2>&1
fi
if [ $? -ne 0 ]; then
    exit 1
fi

# Inject middle layer packages into the user environment by adding a .pth file to
# the environment site-packages that contains the path to the middle layer site-packages
USER_PACKAGES_PATH=$(python3 -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')
echo ${SWAN_PACKAGES_PATH} > ${USER_PACKAGES_PATH}/$(basename $SWAN_ENV).pth
