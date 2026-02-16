# SWAN CERNBox integration

## Quick Start

```bash
# Create fake EOS directories
./setup-fake-eos.sh ./fake-eos

# Install the extension
pip install -e .

# Alternative manual install
# jlpm install
# jlpm build
# jupyter labextension develop . --overwrite

# Verify the extension is loaded
jupyter labextension list

# Start JupyterLab
jupyter lab \
    --ServerApp.root_dir='./fake-eos' \
    --FileContentsManager.preferred_dir='user/t/troun' \
    --ServerApp.token=''
```
