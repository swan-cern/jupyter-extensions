#!/bin/bash

# Author: Rodrigo Sobral 2024
# Copyright CERN
# This script allows to create an environment to use in notebooks and terminals. The environment contains the packages from a provided repository.


# Check if an environment already exists in the session, avoiding multiple environments
CURRENT_ENV_NAME=$(find "/home/$USER" -type d -name "*_env" | head -n 1 | cut -d '/' -f4)
if [ -n "${CURRENT_ENV_NAME}" ]; then
    exit 1
fi

GIT_HOME="$HOME/SWAN_projects" # Path where git repositories are stored

_log () {
    if [ "$*" == "ERROR:"* ] || [ "$*" == "WARNING:"* ] || [ "${JUPYTER_DOCKER_STACKS_QUIET}" == "" ]; then
        echo "$@" 2>&1
    fi
}

# Function to ensure a unique git repository name, instead of overwriting an existing one
define_repo_path() {
    local folder_name=$1
    local counter=0

    local tmp_folder_name=$folder_name

    TMP_REPO_PATH="/tmp/${tmp_folder_name}"
    GIT_REPO_PATH="${GIT_HOME}/${tmp_folder_name}"

    # Main goal: Never overwrite an existing folder
    # If the git folder already exists with same name and its remote points to the same URL, use it
    # Otherwise, increment the counter and try again
    while [ -d "${GIT_REPO_PATH}" ]; do
        LOCAL_REPO_ORIGIN=$(cd "${GIT_REPO_PATH}" && [ -d ".git" ] && git remote get-url origin || echo "")
        if [ "${LOCAL_REPO_ORIGIN%.git}" == "${REPOSITORY%.git}" ]; then
            TMP_REPO_PATH="${GIT_REPO_PATH}"
            break
        else
            counter=$((counter + 1))
            tmp_folder_name="${folder_name}_${counter}"
            TMP_REPO_PATH="/tmp/${tmp_folder_name}"
            GIT_REPO_PATH="${GIT_HOME}/${tmp_folder_name}"
        fi
    done
}

# Function for printing the help page
print_help() {
    _log "Usage: makenv --repository REPOSITORY --builder BUILDER --builder_version VERSION [--help/-h]"
    _log "Options:"
    _log "  --repository REPOSITORY     Path or http link for a public repository"
    _log "  --builder BUILDER           Builder to create the environment"
    _log "  --builder_version VERSION   Version of the builder to use (optional)"
    _log "  --nxcals                    Install NXCALS package and Spark extensions in the environment (optional)"
    _log "  -h, --help                  Print this help page"
}

# --------------------------------------------------------------------------------------------
# Parse command line arguments

while [ $# -gt 0 ]; do
    key="$1"
    case $key in
        --repository)
            REPOSITORY=$2
            # Check if a repository was provided
            if [ -z "$REPOSITORY" ]; then
                _log "ERROR: No repository provided." && _log
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
                _log "ERROR: No builder provided." && _log
                print_help
                exit 1
            # Check if is a valid builder
            elif [ ! -f "${BUILDER_PATH}" ]; then
                _log "ERROR: Invalid builder (${BUILDER})." && _log
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
        --nxcals)
            USE_NXCALS=true
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

# Git URL pattern: https://github.com/<username>/<repo_name>(/?) or https://gitlab.cern.ch/<username>/<repo_name>((/?)|(.git?))
REPO_GIT_PATTERN='^https?:\/\/(github\.com|gitlab\.cern\.ch)\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)(\/|\.git)?$'

# Checks if the provided repository is a valid URL
if [[ "$REPOSITORY" =~ $REPO_GIT_PATTERN ]]; then
    # Extract the repository name
    REPO_NAME=$(basename "${REPOSITORY%.git}")
    ENV_NAME="${REPO_NAME}_env"

    define_repo_path $REPO_NAME
    # If the repository was not previous cloned yet, clone it.
    # Otherwise, use the existing one in the SWAN_projects folder
    if [ ! -d "${GIT_REPO_PATH}" ]; then
        _log "Cloning the repository from ${REPOSITORY}..."
        timeout 45s git clone $REPOSITORY -q "${TMP_REPO_PATH}" 2>&1
        if [ $? -ne 0 ]; then
            _log "ERROR: Failed to clone Git repository" && exit 1
        fi
    fi
else
    _log "ERROR: Invalid Git repository (${REPOSITORY})." && _log
    exit 1
fi

# --------------------------------------------------------------------------------------------
# Create and set up the environment

ENV_PATH="/home/$USER/${ENV_NAME}"
IPYKERNEL="ipykernel==$(python -c 'import ipykernel; print(ipykernel.__version__)')"

if [ -f "${TMP_REPO_PATH}/requirements.txt" ]; then
    # Fully resolved requirements (requirements.txt) take precedence
    RESOLVED_REQ=true
    REQ_PATH="${TMP_REPO_PATH}/requirements.txt"
elif [ -f "${TMP_REPO_PATH}/requirements.in" ]; then
    # If only requirements.in is present, proceed with high-level requirements
    RESOLVED_REQ=false
    REQ_PATH="${TMP_REPO_PATH}/requirements.in"
else
    # There are no requirements files (neither requirements.txt nor requirements.in) in the repository
    _log "ERROR: No requirements file found. You must provide a requirements.in or requirements.txt file." && exit 1
fi

# Check if the requirements file contains the nxcals package, if the user activated the nxcals option
if [ -n "${USE_NXCALS}" ] && ! grep -q "nxcals" "${REQ_PATH}"; then
    _log "ERROR: The NXCALS cluster was selected but the requirements file (${REQ_PATH}) does not contain the nxcals package." && exit 1
fi

_log "Creating environment ${ENV_NAME} using ${BUILDER}${BUILDER_VERSION:+ (${BUILDER_VERSION})}..."
# To prevent builders (e.g. mamba) from caching files on EOS, which slows down the creation of the environment,
# configure HOME to be the user's local directory
HOME=/home/$USER source "${BUILDER_PATH}"
if [ $? -ne 0 ]; then
    _log "ERROR: Failed to create the environment." && exit 1
fi

# Install environment kernel.
# Setting JUPYTER_PATH prevents ipykernel installation from complaining about non-found kernelspec
JUPYTER_PATH=${ENV_PATH}/share/jupyter python -m ipykernel install --name "${ENV_NAME}" --display-name "Python (${ENV_NAME})" --prefix "${ENV_PATH}" 2>&1

# Make sure the Jupyter server finds the new environment kernel in /home/$USER/.local
# We modify the already existing Python3 kernel with the kernel.json of the environment
KERNEL_JSON=${ENV_PATH}/share/jupyter/kernels/${ENV_NAME}/kernel.json
ln -f -s ${KERNEL_JSON} /home/$USER/.local/share/jupyter/kernels/python3/kernel.json

TMP_KERNEL=$(mktemp)
# For NXCALS, configure the environment kernel and terminal with some variables to
# ensure the connection with the cluster works properly.
if [ -n "${USE_NXCALS}" ]; then
    # Kernel configuration
    # - SPARK_HOME: needed to point to the SPARK installation provided by the nxcals package
    # - PYSPARK_PYTHON: needed to point to the Python executable in the environment shipped to the cluster
    # - PATH: needed to point to all the binaries in the environment
    # - VIRTUAL_ENV: needed to point to the Python in the environment
    # - SPARK_DRIVER_EXTRA_JAVA_OPTIONS: needed for gathering extraJavaOptions from the Spark default configuration, so it doesn't get overwritten by the SparkConnector
    export SPARK_HOME="${ENV_PATH}/nxcals-bundle"
    export PYSPARK_PYTHON="./environment/bin/python"
    export SPARK_DRIVER_EXTRA_JAVA_OPTIONS=$(awk '/^spark.driver.extraJavaOptions/ {sub(/^spark.driver.extraJavaOptions /, ""); print}' ${SPARK_HOME}/conf/spark-defaults.conf)

    jq --arg SPARK_HOME "${SPARK_HOME}" \
    --arg PYSPARK_PYTHON "${PYSPARK_PYTHON}" \
    --arg PATH "${PATH}" \
    --arg VIRTUAL_ENV "${ENV_PATH}" \
    --arg SPARK_DRIVER_EXTRA_JAVA_OPTIONS "${SPARK_DRIVER_EXTRA_JAVA_OPTIONS}" \
    '. + {env: {$SPARK_HOME, $PYSPARK_PYTHON, $PATH, $VIRTUAL_ENV, $SPARK_DRIVER_EXTRA_JAVA_OPTIONS}}' \
    ${KERNEL_JSON} > ${TMP_KERNEL}

    # Terminal configuration
    # Only SPARK_HOME and PYSPARK_PYTHON are needed, since PATH and VIRTUAL_ENV are already
    # set when activating the environment in the terminal.
    echo -e "export SPARK_HOME=\"${SPARK_HOME}\"\nexport PYSPARK_PYTHON=\"${PYSPARK_PYTHON}\"" >> /home/$USER/.bash_profile
else
    # Configure the PATH to point to all the binaries in the environment
    jq --arg PATH "${PATH}" '. + {env: {$PATH}}' ${KERNEL_JSON} > ${TMP_KERNEL}
fi
mv -f ${TMP_KERNEL} ${KERNEL_JSON} 2>&1

# Move the repository from /tmp to the $CERNBOX_HOME/SWAN_projects folder
if [ ! -d "${GIT_REPO_PATH}" ]; then
    mkdir -p ${GIT_HOME}
    mv ${TMP_REPO_PATH} ${GIT_HOME}
fi

_log "REPO_PATH:${GIT_REPO_PATH#$HOME}"

# Ensure the terminal loads the environment and cds into the repository path
echo -e "${ACTIVATE_ENV_CMD}\ncd ${GIT_REPO_PATH}" >> /home/$USER/.bash_profile
