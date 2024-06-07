#!/bin/bash

# Author: Rodrigo Sobral 2024
# Copyright CERN
# This script allows to create an environment to use in notebooks and terminals. The environment contains the packages from a provided repository.

_log () {
    if [ "$*" == "ERROR:"* ] || [ "$*" == "WARNING:"* ] || [ "${JUPYTER_DOCKER_STACKS_QUIET}" == "" ]; then
        echo "$@"
    fi
}

# Function to ensure a unique folder name, instead of overwriting an existing one
define_repo_path() {
    local folder_name=$1
    local counter=0
    
    local INIT_REPO_PATH="$HOME/SWAN_projects/${folder_name}"
    REPO_PATH="${INIT_REPO_PATH}"

    # Loop to find a unique folder name
    while [ -d "$REPO_PATH" ]; do
        counter=$((counter + 1))
        REPO_PATH="${INIT_REPO_PATH}_${counter}"
    done
}

# Function for printing the help page
print_help() {
    _log "Usage: makenv --repo/-r REPOSITORY [--accpy ACCPY_VERSION] [--help/-h]"
    _log "Options:"
    _log "  -r, --repo REPOSITORY       Path or http link for a public repository (mandatory)"
    _log "  -h, --help                  Print this help page"
    _log "  --accpy VERSION             Version of Acc-Py to be used"
}

# --------------------------------------------------------------------------------------------
# Parse command line arguments

while [ $# -gt 0 ]; do
    key="$1"
    case $key in
        --repo|-r)
            REPOSITORY=$2
            shift
            shift
            ;;
        --accpy)
            ACCPY_VERSION=$2
            shift
            shift
            ;;
        --help|-h)
            print_help
            exit 0
            ;;
        *)
            >&2 _log "ERROR: Invalid argument: $1" && _log
            print_help
            exit 1
            ;;
    esac
done

# --------------------------------------------------------------------------------------------
# Validate input arguments

# Checks if the provided Acc-Py version is valid
if [ -n "$ACCPY_VERSION" ] && [ ! -e "$ACCPY_PATH/base/$ACCPY_VERSION" ]; then
    >&2 _log "ERROR: Invalid Acc-Py version."
    exit 1
fi

# Checks if a repository is provided
if [ -z "$REPOSITORY" ]; then
    >&2 _log "ERROR: No repository provided." && _log
    print_help
    exit 1

# Checks if the provided repository contains a requirements file
elif [ -d $REPOSITORY ]; then
    REQ_PATH="${REPOSITORY}/requirements.txt"
    if [ ! -f "${REQ_PATH}" ]; then
        >&2 _log "ERROR: Requirements file not found (${REQ_PATH})."
        exit 1
    fi
    REPO_PATH=$REPOSITORY

elif [[ $REPOSITORY == http* ]]; then
    # Extract the repository name from the URL
    repo_name=$(basename $REPOSITORY)
    repo_name=${repo_name%.*}
    
    mkdir -p $HOME/SWAN_projects

    define_repo_path $repo_name

    # Clone the repository
    _log "Cloning the repository from ${REPOSITORY}..."
    git clone $REPOSITORY -q "${REPO_PATH}" || { >&2 _log "ERROR: Failed to clone repository"; exit 1; }

    REQ_PATH=${REPO_PATH}/requirements.txt
    # Check if requirements.txt exists in the repository
    if [ ! -f "${REQ_PATH}" ]; then
        rm -rf ${REPO_PATH}
        >&2 _log "ERROR: ${REQ_PATH} not found in ${REPO_PATH}."
        exit 1
    fi

else
    >&2 _log "ERROR: Invalid repository (${REPOSITORY})."
    exit 1
fi


# --------------------------------------------------------------------------------------------
# Create and set up the environment

# The environment name is the last folder name of the repository
ENV_NAME="$(basename $REPO_PATH)_env"
_log "ENV_NAME:${ENV_NAME}"

# The repository path is the path to the repository without the home directory
_log "REPO_PATH:${REPO_PATH#$HOME}"

# Get the ipykernel version that the Jupyter server uses
IPYKERNEL_VERSION=$(python -c "import ipykernel; print(ipykernel.__version__)")

ENV_PATH="/home/$USER/${ENV_NAME}"
if [ -d "${ENV_PATH}" ]; then
    _log "ENVIRONMENT_ALREADY_EXISTS:${ENV_PATH}"
    exit 1
fi

# Create environment (acc-py or generic)
if [ -n "$ACCPY_VERSION" ]; then
    source $ACCPY_PATH/base/${ACCPY_VERSION}/setup.sh
    acc-py venv ${ENV_PATH}
else
    _log "Creating environment ${ENV_NAME} using Generic Python..."
    python -m venv ${ENV_PATH} --clear --copies
fi

# Make sure the Jupyter server finds the new environment kernel in /home/$USER/.local
mkdir -p /home/$USER/.local/share/jupyter/kernels
ln -f -s ${ENV_PATH}/share/jupyter/kernels/${ENV_NAME} /home/$USER/.local/share/jupyter/kernels/${ENV_NAME}

# Activate the environment
_log "Setting up the environment..."
source ${ENV_PATH}/bin/activate

# Install packages in the environment and the same ipykernel that the Jupyter server uses
_log "Installing packages from ${REQ_PATH}..."
pip install ipykernel==${IPYKERNEL_VERSION}

# Install a Jupyter kernel for the environment
python -m ipykernel install --name ${ENV_NAME} --display-name "Python (${ENV_NAME})" --prefix ${ENV_PATH}

echo -e "source /home/$USER/${ENV_NAME}/bin/activate\ncd ${REPO_PATH}" > /home/$USER/.bash_profile
