#!/bin/bash

# Author: Rodrigo Sobral 2024
# Copyright CERN
# This script allows to create an environment to use in notebooks and terminals. The environment contains the packages from a provided repository.


# Check if an environment already exists in the session, avoiding multiple environments
CURRENT_ENV_NAME=$(find "/home/$USER" -type d -name "*_env" | head -n 1 | cut -d '/' -f4)
CURRENT_REPO_PATH=$(tail -n 1 "/home/$USER/.bash_profile" | cut -d ' ' -f2)
if [ -n "${CURRENT_ENV_NAME}" ]; then
    echo "ENVIRONMENT_ALREADY_EXISTS:${CURRENT_ENV_NAME}"
    echo "REPO_PATH:${CURRENT_REPO_PATH#$HOME}"
    exit 1
fi

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
    _log "Usage: makenv --repo REPOSITORY --repo_type TYPE --builder BUILDER --builder_version VERSION [--help/-h]"
    _log "Options:"
    _log "  --repo REPOSITORY           Path or http link for a public repository"
    _log "  --repo_type TYPE            Type of repository (git or eos)"
    _log "  --builder BUILDER           Builder to create the environment"
    _log "  --builder_version VERSION   Version of the builder to use (optional)"
    _log "  -h, --help                  Print this help page"
}

# --------------------------------------------------------------------------------------------
# Parse command line arguments

while [ $# -gt 0 ]; do
    key="$1"
    case $key in
        --repo)
            REPOSITORY=$2
            # Check if a repository was provided
            if [ -z "$REPOSITORY" ]; then
                _log "ERROR: No repository provided." && log
                print_help
                exit 1
            fi
            shift
            shift
            ;;
        --repo_type)
            REPO_TYPE=$2
            # Check if a repository type was provided
            if [ -z "$REPO_TYPE" ]; then
                _log "ERROR: No repository type provided." && log
                print_help
                exit 1
            fi
            shift
            shift
            ;;
        --builder)
            BUILDER=$2
            BUILDER_PATH="$(dirname "$0")/builders/${BUILDER}.sh"
            # Check if a builder was provided
            if [ -z "$BUILDER" ]; then
                _log "ERROR: No builder provided." && log
                print_help
                exit 1
            # Check if is a valid builder
            elif [ ! -f "${BUILDER_PATH}" ]; then
                _log "ERROR: Invalid builder (${BUILDER})." && log
                print_help
                exit 1
            fi
            shift
            shift
            ;;
        --builder_version)
            BUILDER_VERSION=$2
            shift
            shift
            ;;
        --help|-h)
            print_help
            exit 0
            ;;
        *)
            _log "ERROR: Invalid argument: $1" && log
            print_help
            exit 1
            ;;
    esac
done

# --------------------------------------------------------------------------------------------
# Validate input arguments

# Git URL pattern: https://github.com/<username>/<repo_name>(/?) or https://gitlab.cern.ch/<username>/<repo_name>((/?)|(.git?))
REPO_GIT_PATTERN='^https?:\/\/(github\.com|gitlab\.cern\.ch)\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)(\/|\.git)?$'
# EOS path pattern: $CERNBOX_HOME/<folder1>/<folder2>/...(/?) or /eos/user/<lowercase_first_letter>/<username>/<folder1>?/<folder2>?/...(/?)
REPO_EOS_PATTERN='^(\$CERNBOX_HOME(\/[^<>|\\:()&;,\/]+)*\/?|\/eos\/user\/[a-z](\/[^<>|\\:()&;,\/]+)+\/?)$'

# Checks if the provided repository is a valid URL
if [[ "$REPO_TYPE" == "git" ]]; then
    if [[ "$REPOSITORY" =~ $REPO_GIT_PATTERN ]]; then
        # Extract the repository name
        repo_name=$(basename $REPOSITORY)
        repo_name=${repo_name%.*}

        define_repo_path $repo_name

        # Clone the repository
        _log "Cloning the repository from ${REPOSITORY}..."
        git clone $REPOSITORY -q "${REPO_PATH}"
        if [ $? -ne 0 ]; then
            _log "ERROR: Failed to clone Git repository"
            exit 1
        fi
        ENV_NAME="${repo_name}_env"
    else
        _log "ERROR: Invalid Git repository (${REPOSITORY})." && _log
        exit 1
    fi

# Checks if the provided local repository is an EOS path and actually exists
elif [[ "$REPO_TYPE" == "eos" ]]; then
    if [[ "$REPOSITORY" =~ $REPO_EOS_PATTERN ]]; then
        # Replace, if necessary, the CERNBOX_HOME variable with the actual path
        if [[ $REPOSITORY == \$CERNBOX_HOME* ]]; then
            REPOSITORY=$(echo $REPOSITORY | sed "s|\$CERNBOX_HOME|$CERNBOX_HOME|g")
        fi

        # Replace eventual multiple slashes with a single one, remove the trailing slash, if any, and remove every "../" and "./"
        REPO_PATH=$(echo "$REPOSITORY" | sed 's|/$||; s|\.\./|/|g; s|\./|/|g; s|/\+|/|g')
        ENV_NAME="$(basename $REPO_PATH)_env"

        if [ ! -d "${REPO_PATH}" ]; then
            _log "ERROR: EOS repository not found (${REPO_PATH})." && _log
            exit 1
        fi
    else
        _log "ERROR: Invalid EOS repository (${REPOSITORY})." && _log
        exit 1
    fi

# The repository is not a valid URL or EOS path
else
    _log "ERROR: Invalid repository type (${REPO_TYPE})." && _log
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

if [ -n "${BUILDER_VERSION}" ]; then
    _log "Creating environment ${ENV_NAME} using ${BUILDER} (${BUILDER_VERSION})..."
else
    _log "Creating environment ${ENV_NAME} using ${BUILDER}..."
fi
# To prevent builders (e.g. mamba) from caching files on EOS, which slows down the creation of the environment,
# configure HOME to be the user's local directory
HOME=/home/$USER source "${BUILDER_PATH}"

# Install environment kernel.
# Setting JUPYTER_PATH prevents ipykernel installation from complaining about non-found kernelspec
JUPYTER_PATH=${ENV_PATH}/share/jupyter python -m ipykernel install --name "${ENV_NAME}" --display-name "Python (${ENV_NAME})" --prefix "${ENV_PATH}" | tee -a ${LOG_FILE}

# Make sure the Jupyter server finds the new environment kernel in /home/$USER/.local
# We modify the already existing Python3 kernel with the kernel.json of the environment
ln -f -s ${ENV_PATH}/share/jupyter/kernels/${ENV_NAME}/kernel.json /home/$USER/.local/share/jupyter/kernels/python3/kernel.json | tee -a ${LOG_FILE}

if [[ ${REPO_TYPE} == "git" ]]; then
    # Move the repository from /tmp to the $CERNBOX_HOME/SWAN_projects folder
    mkdir -p ${GIT_HOME}
    mv ${REPO_PATH} ${GIT_HOME}
    REPO_PATH="${GIT_HOME}/$(basename $REPO_PATH)"
fi

_log "ENV_NAME:${ENV_NAME}"
_log "REPO_PATH:${REPO_PATH#$HOME}"

# Ensure the terminal loads the environment and cds into the repository path
echo -e "${ACTIVATE_ENV_CMD}\ncd ${REPO_PATH}" >> /home/$USER/.bash_profile
