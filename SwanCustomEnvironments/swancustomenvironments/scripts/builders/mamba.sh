#!/bin/bash

# Create the environment, install packages and the same ipykernel that the Jupyter server uses
mamba create -p ${ENV_PATH} --file ${REQ_PATH} "ipykernel==${IPYKERNEL_VERSION}" -y | tee -a ${LOG_FILE}

# Activate the environment
_log "Setting up the environment..."

# Initialize mamba and send its activation script to the user's bash profile
MAMBADIR=$(mktemp -d)
HOME=${MAMBADIR} mamba init
echo "source ${MAMBADIR}/.bashrc" >> /home/$USER/.bash_profile

# Construct the activation command
ACTIVATE_ENV_CMD="mamba activate ${ENV_PATH}"
