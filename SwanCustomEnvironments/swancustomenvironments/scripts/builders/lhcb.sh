#!/bin/bash

# Create the environment, install packages and the same ipykernel that the Jupyter server uses
CVMFS_LOGIN_PATH="/cvmfs/lhcb.cern.ch/etc/login.sh"

# Get most recent version
for version in $(ls -1r /cvmfs/${BUILDER}.cern.ch/conda/envs/default); do
    # /cvmfs/{root}.cern.ch/conda/envs/{env_name}/{version}/{conda-subdir} (root: lhcb, lhcbdev)
    LHCB_PATH="/cvmfs/${BUILDER}.cern.ch/conda/envs/default/${version}/linux-64"
    if find "${LHCB_PATH}/lib" -type d -name "ipykernel" >/dev/null 2>&1; then
        break
    fi
done

# Activate the environment
_log "Setting up the environment..."

# Initialize mamba and send its activation script to the user's bash profile
LOGIN_CMD="source ${CVMFS_LOGIN_PATH}"
echo ${LOGIN_CMD} >> /home/$USER/.bash_profile
eval ${LOGIN_CMD}

# Initialize mamba and send its activation script to the user's bash profile
MAMBADIR=$(mktemp -d)
HOME=${MAMBADIR} mamba init
ACTIVATE_TEMP_MAMBA_CMD="source ${MAMBADIR}/.bashrc"
echo ${ACTIVATE_TEMP_MAMBA_CMD} >> /home/$USER/.bash_profile
eval ${ACTIVATE_TEMP_MAMBA_CMD}

ACTIVATE_MAMBA_CMD="mamba activate ${LHCB_PATH}"
echo ${ACTIVATE_MAMBA_CMD} >> /home/$USER/.bash_profile
eval ${ACTIVATE_MAMBA_CMD}

# Check if mamba has ipykernel installed
if ! mamba list ipykernel | grep ipykernel >/dev/null 2>&1; then
    _log "ERROR: ipykernel is not installed in the LHCB conda environment." && return 1
fi
