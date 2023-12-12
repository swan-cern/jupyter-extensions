from jupyter_client.kernelspec import get_kernel_spec

from ._version import __version__


def get_env():
    env = get_kernel_spec("python3").env
    # jupyter-proxy-server will try to format the env strings, which might fail
    # i.e, we have '"EOS_PATH_FORMAT": "/eos/user/{username[0]}/{username}/"', which fails
    # looking for 'username'
    for key in env:
        env[key] = env[key].replace("{", "{{").replace("}", "}}")

    return env


def setup_proxy():
    # SwanDask needs to run with the LCG python
    python_bin = get_kernel_spec("python3").argv[0]
    return {
        "command": [python_bin, "-m", "swandask", "--port", "{port}", "--base_url", "{base_url}"],
        "absolute_url": True,
        "timeout": 10,
        "launcher_entry": {"enabled": False},
        "environment": get_env,
    }
