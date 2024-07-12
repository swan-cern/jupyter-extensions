#!/bin/bash

# Author: Rodrigo Sobral 2024
# Copyright CERN
# This script allows to create an environment to use in notebooks and terminals. The environment contains the packages from a provided repository.


LOG_FILE=/tmp/makenv.log # File to keep a backlog of this script output
GIT_HOME="$HOME/SWAN_projects" # Path where git repositories are stored

_log () {
    if [ "$*" == "ERROR:"* ] || [ "$*" == "WARNING:"* ] || [ "${JUPYTER_DOCKER_STACKS_QUIET}" == "" ]; then
        echo "$@" | tee -a ${LOG_FILE}
    fi
}

# Function to ensure a unique folder name, instead of overwriting an existing one
define_repo_path() {
    local folder_name=$1
    local counter=0

    local tmp_folder_name=$folder_name

    REPO_PATH="/tmp/${tmp_folder_name}"

    # Loop to find a unique folder name
    while [ -d "${GIT_HOME}/${tmp_folder_name}" ]; do
        counter=$((counter + 1))
        tmp_folder_name="${folder_name}_${counter}"
        REPO_PATH="/tmp/${tmp_folder_name}"
    done
}

# Function for printing the help page
print_help() {
    _log "Usage: makenv --repo/-r REPOSITORY [--repo_type TYPE] [--accpy ACCPY_VERSION] [--help/-h]"
    _log "Options:"
    _log "  -r, --repo REPOSITORY       Path or http link for a public repository (mandatory)"
    _log "  --repo_type TYPE            Type of repository (git or eos) (mandatory)"
    _log "  --accpy VERSION             Version of Acc-Py to be used"
    _log "  -h, --help                  Print this help page"
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
        --repo_type)
            REPO_TYPE=$2
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
            _log "ERROR: Invalid argument: $1" && _log
            print_help
            exit 1
            ;;
    esac
done

# --------------------------------------------------------------------------------------------
# Validate input arguments

# Git URL pattern: https://github.com/<username>/<repo_name>(/?) or https://gitlab.cern.ch/<username>/<repo_name>(/?)
REPO_GIT_PATTERN='^https?:\/\/(github\.com|gitlab\.cern\.ch)\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\/?$'
# EOS path pattern: $CERNBOX_HOME/<folder1>/<folder2>/...(/?) or /eos/user/<lowercase_first_letter>/<username>/<folder1>/<folder2>/...(/?)
# Note: folders after username are optional
REPO_EOS_PATTERN='^(\$CERNBOX_HOME(\/[^<>|\\:()&;,\/]+)*\/?|\/eos\/user\/[a-z](\/[^<>|\\:()&;,\/]+)+\/?)$'

# Checks if the provided Acc-Py version is valid
if [ -n "$ACCPY_VERSION" ] && [ ! -e "$ACCPY_PATH/base/$ACCPY_VERSION" ]; then
    _log "ERROR: Invalid Acc-Py version (${ACCPY_VERSION})."
    exit 1
fi

# Checks if a repository is provided
if [ -z "$REPOSITORY" ]; then
    _log "ERROR: No repository provided." && _log
    print_help
    exit 1

elif [ -z "$REPO_TYPE" ]; then
    _log "ERROR: No repository type provided." && _log
    print_help
    exit 1

# Checks if the provided repository is a valid URL
elif [[ "$REPO_TYPE" == "git" ]] && [[ "$REPOSITORY" =~ $REPO_GIT_PATTERN ]]; then
    # Extract the repository name
    repo_name=$(basename $REPOSITORY)
    repo_name=${repo_name%.*}

    define_repo_path $repo_name

    # Clone the repository
    _log "Cloning the repository from ${REPOSITORY}..."
    rm -rf "${REPO_PATH}" && git clone $REPOSITORY -q "${REPO_PATH}" || { _log "ERROR: Failed to clone repository"; exit 1; } | tee -a "${LOG_FILE}"
    ENV_NAME="${repo_name}_env"

# Checks if the provided local repository is an EOS path and actually exists
elif [[ "$REPO_TYPE" == "eos" ]] && [[ "$REPOSITORY" =~ $REPO_EOS_PATTERN ]]; then
    # Replace, if necessary, the CERNBOX_HOME variable with the actual path
    if [[ $REPOSITORY == \$CERNBOX_HOME* ]]; then
        REPOSITORY=$(echo $REPOSITORY | sed "s|\$CERNBOX_HOME|$CERNBOX_HOME|g")
    fi

    # Replace eventual multiple slashes with a single one, remove the trailing slash, if any, and remove every "../" and "./"
    REPO_PATH=$(echo "$REPOSITORY" | sed 's|/$||; s|\.\./|/|g; s|\./|/|g; s|/\+|/|g')
    ENV_NAME="$(basename $REPO_PATH)_env"

    if [ ! -d "${REPO_PATH}" ]; then
        _log "ERROR: Invalid ${REPO_TYPE} repository (${REPO_PATH})." && _log
        exit 1
    fi

# The repository is not a valid URL or EOS path
else
    _log "ERROR: Invalid ${REPO_TYPE} repository (${REPOSITORY})." && _log
    exit 1
fi

# --------------------------------------------------------------------------------------------
# Create and set up the environment

ENV_PATH="/home/$USER/${ENV_NAME}"
REQ_PATH="${REPO_PATH}/requirements.txt"
IPYKERNEL_VERSION=$(python -c "import ipykernel; print(ipykernel.__version__)")

# Check if requirements.txt exists in the repository
if [ ! -f "${REQ_PATH}" ]; then
    _log "ERROR: Requirements file not found (${REQ_PATH})."
    exit 1
fi

CURRENT_ENV_NAME=$(find "/home/$USER" -type d -name "*_env" | head -n 1 | cut -d '/' -f4)
CURRENT_REPO_PATH=$(tail -n 1 "/home/$USER/.bash_profile" | cut -d ' ' -f2)

# Check if an environment already exists in the session
if [ -n "${CURRENT_ENV_NAME}" ]; then
    _log "ENVIRONMENT_ALREADY_EXISTS:${CURRENT_ENV_NAME}"
    _log "REPO_PATH:${CURRENT_REPO_PATH#$HOME}"
    exit 1
fi

# Create environment (acc-py or generic)
if [ -n "$ACCPY_VERSION" ]; then
    source $ACCPY_PATH/base/${ACCPY_VERSION}/setup.sh
    acc-py venv ${ENV_PATH}
else
    _log "Creating environment ${ENV_NAME} using Generic Python..."
    python -m venv ${ENV_PATH}
fi

_log "ENV_NAME:${ENV_NAME}"

# Make sure the Jupyter server finds the new environment kernel in /home/$USER/.local
mkdir -p /home/$USER/.local/share/jupyter/kernels
ln -f -s ${ENV_PATH}/share/jupyter/kernels/${ENV_NAME} /home/$USER/.local/share/jupyter/kernels/${ENV_NAME}

# Activate the environment
_log "Setting up the environment..."
source ${ENV_PATH}/bin/activate

# Install packages in the environment and the same ipykernel that the Jupyter server uses
_log "Installing packages from ${REQ_PATH}..."
pip install ipykernel==${IPYKERNEL_VERSION} | tee -a "${LOG_FILE}"
pip install -r "${REQ_PATH}" | tee -a "${LOG_FILE}"

if [[ ${REPO_TYPE} == "git" ]]; then
    # Move the repository from /tmp to the $CERNBOX_HOME/SWAN_projects folder
    mkdir -p ${GIT_HOME}
    mv ${REPO_PATH} ${GIT_HOME}
    REPO_PATH="${GIT_HOME}/$(basename $REPO_PATH)"
fi

_log "REPO_PATH:${REPO_PATH#$HOME}"

# Install a Jupyter kernel for the environment
python -m ipykernel install --name "${ENV_NAME}" --display-name "Python (${ENV_NAME})" --prefix "${ENV_PATH}" | tee -a "${LOG_FILE}"

# Ensure the terminal loads the environment and cds into the repository path
echo -e "source /home/$USER/${ENV_NAME}/bin/activate\ncd ${REPO_PATH}" > /home/$USER/.bash_profile
