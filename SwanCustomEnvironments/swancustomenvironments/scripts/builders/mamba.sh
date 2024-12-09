#!/bin/bash

# Create the environment, install packages and the same ipykernel that the Jupyter server uses
mamba create -p ${ENV_PATH} --file ${REQ_PATH} ${IPYKERNEL} -y
if [ $? -ne 0 ]; then
    return 1
fi

# Activate the environment
_log "Setting up the environment..."

# Initialize mamba and send its activation script to the user's bash profile
MAMBADIR=$(mktemp -d)
HOME=${MAMBADIR} mamba init
ACTIVATE_MAMBA_CMD="source ${MAMBADIR}/.bashrc"
echo ${ACTIVATE_MAMBA_CMD} >> /home/$USER/.bash_profile
eval ${ACTIVATE_MAMBA_CMD}

# Activate the environment
ACTIVATE_ENV_CMD="mamba activate ${ENV_PATH}"
eval ${ACTIVATE_ENV_CMD}
