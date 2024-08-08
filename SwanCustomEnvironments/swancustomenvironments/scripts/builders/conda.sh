#!/bin/bash

# Create the environment and install packages
${BUILDER_VERSION} create -p ${ENV_PATH} --file ${REQ_PATH} -y | tee -a ${LOG_PATH}

# Activate the environment
_log "Setting up the environment..."
ACTIVATE_ENV_CMD="source activate ${ENV_PATH}"
$(echo ${ACTIVATE_ENV_CMD}) | tee -a ${LOG_PATH}
