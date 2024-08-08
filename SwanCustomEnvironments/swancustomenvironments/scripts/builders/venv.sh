#!/bin/bash

# Create the environment
${BUILDER_VERSION} -m ${BUILDER} ${ENV_PATH} | tee -a ${LOG_PATH}

# Activate the environment
_log "Setting up the environment..."
ACTIVATE_ENV_CMD="source ${ENV_PATH}/bin/activate"
$(echo ${ACTIVATE_ENV_CMD}) | tee -a ${LOG_PATH}

# Install packages in the environment
_log "Installing packages from ${REQ_PATH}..."
pip install -r "${REQ_PATH}" | tee -a ${LOG_PATH}
