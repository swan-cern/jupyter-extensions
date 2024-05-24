#!/bin/bash

# Author: Rodrigo Sobral 2024
# Copyright CERN
# This script allows to create a venv virtual environment to use in notebooks and terminals. The environment contains the packages from a provided requirements file.

# By default, we use the Python installed in the image
ACCPY_BASE=$ACCPY_PATH/base
ACCPY_ALL_VERSIONS_STR="?"
PYTHON_PATH=$(which python)
if [ -d "$ACCPY_PATH" ]; then
    ACCPY_ALL_VERSIONS=$(ls -tr $ACCPY_BASE)
    ACCPY_ALL_VERSIONS_STR=$(echo $ACCPY_ALL_VERSIONS | tr ' ' ', ')
fi

_log () {
    if [ "$*" == "ERROR:"* ] || [ "$*" == "WARNING:"* ] || [ "${JUPYTER_DOCKER_STACKS_QUIET}" == "" ]; then
        echo "$@"
    fi
}

# Function for printing the help page
print_help() {
    _log "Usage: makenv --env/-e NAME --req/-r REQUIREMENTS [--accpy ACCPY_VERSION] [--clear/-c] [--help/-h]"
    _log "Options:"
    _log "  -e, --env NAME              Name of the custom virtual environment (mandatory)"
    _log "  -r, --req REQUIREMENTS      Path to requirements.txt file or http link for a public repository (mandatory)"
    _log "  -c, --clear                 Clear the current virtual environment, if it exists"
    _log "  -h, --help                  Print this help page"
    _log "  --accpy VERSION             Version of Acc-Py to be used (options: ${ACCPY_ALL_VERSIONS_STR})"
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
        --req|-r)
            REQUIREMENTS=$2
            shift
            shift
            ;;
        --clear|-c)
            CLEAR_ENV=--clear
            shift
            ;;
        --help|-h)
            print_help
            exit 0
            ;;
        --accpy)
            ACCPY_CUSTOM_VERSION=$2
            shift
            shift
            ;;
        *)
            >&2 _log "ERROR: Invalid argument: $1" && _log
            print_help
            exit 1
            ;;
    esac
done

# --------------------------------------------------------------------------------------------

ENV_PATH="/home/$USER/${ENV_NAME}"

# Checks if a name for the environment is given
if [ -z "$ENV_NAME" ]; then
    >&2 _log "ERROR: No virtual environment name provided." && _log
    print_help
    exit 1
fi

# Checks if an environment with the same name was already created, if --clear is not passed
if [ -d "$ENV_PATH" ] && [ -z "$CLEAR_ENV" ]; then
    >&2 _log "ERROR: Virtual environment already exists."
    exit 1
fi

# Checks if the provided Acc-Py version is valid
if [ -n "$ACCPY_CUSTOM_VERSION" ] && [ ! -e "$ACCPY_BASE/$ACCPY_CUSTOM_VERSION" ]; then
    >&2 _log "ERROR: Invalid Acc-Py version. Options: ${ACCPY_ALL_VERSIONS_STR}"
    exit 1
fi

# Checks if a requirements file is given
if [ -z "$REQUIREMENTS" ]; then
    >&2 _log "ERROR: No requirements provided." && _log
    print_help
    exit 1
# Checks if the provided requirements source is found
elif [ -f $REQUIREMENTS ]; then
    if [[ ${REQUIREMENTS##*.} != "txt" ]]; then
        >&2 _log "ERROR: Invalid requirements file."
        exit 1
    fi
    REQ_PATH=$REQUIREMENTS
elif [[ $REQUIREMENTS == http* ]]; then
    # Extract the repository name from the URL
    repo_name=$(basename $REQUIREMENTS)
    repo_name=${repo_name%.*}
    
    mkdir -p $HOME/SWAN_projects
    REPO_PATH=$HOME/SWAN_projects/${repo_name}

    # Checks if the repository already exists in the home directory
    if [ -d "${REPO_PATH}" ]; then
        if [ -z "$CLEAR_ENV" ]; then
            >&2 _log "ERROR: ${REPO_PATH} already exists. Use --clear to reclone the repository."
            exit 1
        else
            rm -rf ${REPO_PATH}
        fi
    fi

    echo "Cloning the repository from ${REQUIREMENTS}..."
    # Clone the repository
    git clone $REQUIREMENTS -q --template /usr/share/git-core/templates "${REPO_PATH}" || { >&2 _log "ERROR: Failed to clone repository"; exit 1; }

    REQ_PATH=${REPO_PATH}/requirements.txt
    # Check if requirements.txt exists in the repository
    if [ ! -f "${REQ_PATH}" ]; then
        rm -rf ${REPO_PATH}
        >&2 _log "ERROR: requirements.txt not found in the repository"
        exit 1
    fi
else
    >&2 _log "ERROR: Invalid requirements file (${REQUIREMENTS})."
    exit 1
fi

# Checks if the requirements file is not empty
if [ ! -s "$REQ_PATH" ]; then
    >&2 echo "ERROR: Requirements file is empty."
    exit 1
fi



# --------------------------------------------------------------------------------------------


# Credentials for the bash process to have access to EOS
OAUTH2_FILE=$OAUTH2_FILE
OAUTH2_TOKEN=$OAUTH2_TOKEN
KRB5CCNAME=$KRB5CCNAME
KRB5CCNAME_NB_TERM=$KRB5CCNAME_NB_TERM
ACTIVATE_BIN_TEMPLATE="
# This file must be used with \"source bin/activate\" *from bash*
# you cannot run it directly

deactivate () {
    # reset old environment variables
    if [ -n \"\${_OLD_VIRTUAL_PATH:-}\" ] ; then
        PATH=\"\${_OLD_VIRTUAL_PATH:-}\"
        export PATH
        unset _OLD_VIRTUAL_PATH
    fi
    if [ -n \"\${_OLD_VIRTUAL_PYTHONHOME:-}\" ] ; then
        PYTHONHOME=\"\${_OLD_VIRTUAL_PYTHONHOME:-}\"
        export PYTHONHOME
        unset _OLD_VIRTUAL_PYTHONHOME
    fi
    if [ -n \"\${_OLD_VIRTUAL_PYTHONPATH:-}\" ] ; then # added line
        PYTHONPATH=\"\${_OLD_VIRTUAL_PYTHONPATH:-}\" # added line
        export PYTHONPATH # added line
        unset _OLD_VIRTUAL_PYTHONPATH # added line
    fi

    # This should detect bash and zsh, which have a hash command that must
    # be called to get it to forget past commands.  Without forgetting
    # past commands the \$PATH changes we made may not be respected
    if [ -n \"\${BASH:-}\" -o -n \"\${ZSH_VERSION:-}\" ] ; then
        hash -r 2> /dev/null
    fi

    if [ -n \"\${_OLD_VIRTUAL_PS1:-}\" ] ; then
        PS1=\"\${_OLD_VIRTUAL_PS1:-}\"
        export PS1
        unset _OLD_VIRTUAL_PS1
    fi

    unset VIRTUAL_ENV
    if [ ! \"\${1:-}\" = \"nondestructive\" ] ; then
    # Self destruct!
        unset -f deactivate
    fi
}

# unset irrelevant variables
deactivate nondestructive

VIRTUAL_ENV=\"${ENV_PATH}\"
export VIRTUAL_ENV

_OLD_VIRTUAL_PATH=\"\$PATH\"
PATH=\"\$VIRTUAL_ENV/bin:\$PATH\"
export PATH

# unset PYTHONHOME if set
# this will fail if PYTHONHOME is set to the empty string (which is bad anyway)
# could use \`if (set -u; : \$PYTHONHOME) ;\` in bash
if [ -n \"\${PYTHONHOME:-}\" ] ; then
    _OLD_VIRTUAL_PYTHONHOME=\"\${PYTHONHOME:-}\"
    unset PYTHONHOME
fi
if [ -n \"\${PYTHONPATH:-}\" ] ; then # added line
    _OLD_VIRTUAL_PYTHONPATH=\"\${PYTHONPATH:-}\" # added line
    unset PYTHONPATH # added line
fi # added line

if [ -z \"\${VIRTUAL_ENV_DISABLE_PROMPT:-}\" ] ; then
    _OLD_VIRTUAL_PS1=\"\${PS1:-}\"
    PS1=\"(${ENV_NAME}) \${PS1:-}\"
    export PS1
fi

# This should detect bash and zsh, which have a hash command that must
# be called to get it to forget past commands.  Without forgetting
# past commands the \$PATH changes we made may not be respected
if [ -n \"\${BASH:-}\" -o -n \"\${ZSH_VERSION:-}\" ] ; then
    hash -r 2> /dev/null
fi
"

# Create a new bash session to avoid conflicts with the current environment in the background
env -i bash --noprofile --norc << EOF

export OAUTH2_FILE=${OAUTH2_FILE}
export OAUTH2_TOKEN=${OAUTH2_TOKEN}
export KRB5CCNAME=${KRB5CCNAME}
export KRB5CCNAME_NB_TERM=${KRB5CCNAME_NB_TERM}
# Create virtual environment (acc-py or generic)
if [ -n "$ACCPY_CUSTOM_VERSION" ]; then
    source ${ACCPY_BASE}/${ACCPY_CUSTOM_VERSION}/setup.sh
    if [ -d "${ENV_PATH}" ] && [ -n "${CLEAR_ENV}" ]; then
        rm -rf ${ENV_PATH}
    fi
    acc-py venv ${ENV_PATH}
else
    if [ -d "${ENV_PATH}" ]; then
        echo "Recreating (--clear) virtual environment ${ENV_NAME} using Python (${PYTHON_PATH})..."
    else
        echo "Creating virtual environment ${ENV_NAME} using Python (${PYTHON_PATH})..."
    fi
    ${PYTHON_PATH} -m venv ${ENV_PATH} ${CLEAR_ENV} --copies
fi
# Make sure the Jupyter server finds the new environment kernel in /home/$USER/.local
mkdir -p /home/$USER/.local/share/jupyter/kernels
ln -f -s ${ENV_PATH}/share/jupyter/kernels/${ENV_NAME} /home/$USER/.local/share/jupyter/kernels/${ENV_NAME}
Activate the environment
echo "Setting up the virtual environment..."
source ${ENV_PATH}/bin/activate

# Check if ACCPY_CUSTOM_VERSION is not set and ipykernel is on the requirements file, if not, add the latest version
if [ -z "$ACCPY_CUSTOM_VERSION" ] && [ -z "$(grep -i 'ipykernel' ${REQ_PATH})" ]; then
    echo -e "\nipykernel" >> ${REQ_PATH}
fi
Install packages in the environment
echo "Installing packages from ${REQ_PATH}..."
pip install -r ${REQ_PATH}

python -m ipykernel install --name ${ENV_NAME} --display-name "Python (${ENV_NAME})" --prefix ${ENV_PATH}

# Remove ipykernel package from the requirements file, if it was added
if [ -z "$ACCPY_CUSTOM_VERSION" ] && [ -z "$(grep -i 'ipykernel' ${REQ_PATH})" ]; then
    sed -i '/\nipykernel/d' ${REQ_PATH}
fi

# Copy the requirements file to the virtual environment
cp ${REQ_PATH} ${ENV_PATH}

# Get (de)activate script to be independent from the PYTHONPATH, only if ACCPY_CUSTOM_VERSION is not set
if [ -z "$ACCPY_CUSTOM_VERSION" ]; then
    echo '${ACTIVATE_BIN_TEMPLATE}' > ${ENV_PATH}/bin/activate
fi

# Check if the virtual environment gets activated automatically when the terminal is opened
if [ "$AUTOENV" = "true" ] || [ "$AUTOENV" = "on" ]; then
    echo -e "source /home/$USER/${ENV_NAME}/bin/activate\ncd $HOME" > /home/$USER/.bash_profile
fi

echo "Virtual environment ${ENV_NAME} created successfully."

EOF
