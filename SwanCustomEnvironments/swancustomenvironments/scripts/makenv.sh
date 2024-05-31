#!/bin/bash

# Author: Rodrigo Sobral 2024
# Copyright CERN
# This script allows to create a venv virtual environment to use in notebooks and terminals. The environment contains the packages from a provided repository.

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

    # Warn the backend of the new folder name
    if [ $counter -ne 0 ]; then
        echo "FOLDER_NAME_CHANGE:${folder_name}_${counter}"
    fi
}

# Function for printing the help page
print_help() {
    _log "Usage: makenv --env/-e NAME --repo/-r REPOSITORY [--accpy ACCPY_VERSION] [--help/-h]"
    _log "Options:"
    _log "  -e, --env NAME              Name of the custom virtual environment (mandatory)"
    _log "  -r, --repo REPOSITORY       Path or http link for a public repository (mandatory)"
    _log "  -h, --help                  Print this help page"
    _log "  --accpy VERSION             Version of Acc-Py to be used"
}

# --------------------------------------------------------------------------------------------

# Parse command line arguments
while [ $# -gt 0 ]; do
    key="$1"
    case $key in
        --env|-e)
            ENV_NAME=$2
            shift
            shift
            ;;
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

# Checks if a name for the environment is given
if [ -z "$ENV_NAME" ]; then
    >&2 _log "ERROR: No virtual environment name provided." && _log
    print_help
    exit 1
fi

# Checks if the provided Acc-Py version is valid
if [ -n "$ACCPY_VERSION" ] && [ ! -e "$ACCPY_PATH/base/$ACCPY_VERSION" ]; then
    >&2 _log "ERROR: Invalid Acc-Py version."
    exit 1
fi

# Checks if a repository file is given
if [ -z "$REPOSITORY" ]; then
    >&2 _log "ERROR: No repository provided." && _log
    print_help
    exit 1
# Checks if the provided repository source is found
elif [ -d $REPOSITORY ]; then
    REQ_PATH="${REPOSITORY}/requirements.txt"
    if [ ! -f "${REQ_PATH}" ]; then
        >&2 _log "ERROR: Requirements file not found (${REQ_PATH})."
        exit 1
    fi
elif [[ $REPOSITORY == http* ]]; then
    # Extract the repository name from the URL
    repo_name=$(basename $REPOSITORY)
    repo_name=${repo_name%.*}
    
    mkdir -p $HOME/SWAN_projects

    define_repo_path $repo_name

    # Clone the repository
    echo "Cloning the repository from ${REPOSITORY}..."
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

ENV_PATH="/home/$USER/${ENV_NAME}"

# Create virtual environment (acc-py or generic)
if [ -n "$ACCPY_VERSION" ]; then
    source $ACCPY_PATH/base/${ACCPY_VERSION}/setup.sh
    if [ -d "${ENV_PATH}" ]; then
        rm -rf ${ENV_PATH}
    fi
    acc-py venv ${ENV_PATH}
else
    message="Creating"
    [ -d "${ENV_PATH}" ] && message="Recreating"
    echo "${message} virtual environment ${ENV_NAME} using Generic Python..."
    
    python -m venv ${ENV_PATH} --clear --copies
fi

# Make sure the Jupyter server finds the new environment kernel in /home/$USER/.local
mkdir -p /home/$USER/.local/share/jupyter/kernels
ln -f -s ${ENV_PATH}/share/jupyter/kernels/${ENV_NAME} /home/$USER/.local/share/jupyter/kernels/${ENV_NAME}

# Activate the environment
echo "Setting up the virtual environment..."
source ${ENV_PATH}/bin/activate

# Install packages in the environment
echo "Installing packages from ${REQ_PATH}..."
pip install ipykernel
pip install -r ${REQ_PATH}

# Install a Jupyter kernel for the environment
python -m ipykernel install --name ${ENV_NAME} --display-name "Python (${ENV_NAME})" --prefix ${ENV_PATH}

echo "source /home/$USER/${ENV_NAME}/bin/activate" > /home/$USER/.bash_profile
