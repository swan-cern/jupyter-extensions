#!/bin/bash

# Create the environment and install packages
mamba create -p ${ENV_PATH} --file ${REQ_PATH} -y | tee -a ${LOG_PATH}

# Activate the environment
_log "Setting up the environment..."

# Needed to use mamba activate without creating a new shell process
MAMBADIR=$(mktemp -d)
HOME=${MAMBADIR} mamba init
ACTIVATE_MAMBA_CMD="source ${MAMBADIR}/.bashrc"
eval "${ACTIVATE_MAMBA_CMD}"

# Then activate the environment using mamba
ACTIVATE_ENV_CMD="mamba activate ${ENV_PATH}"
eval "${ACTIVATE_ENV_CMD}"

# Install the same ipykernel that the Jupyter server uses
mamba install "ipykernel==${IPYKERNEL_VERSION}" -y | tee -a ${LOG_PATH}

# Source the mamba init script in the user's bash profile
echo "${ACTIVATE_MAMBA_CMD}" >> /home/$USER/.bash_profile