import json
import os


def has_project_file(path):
    """
    Method to check if .swanproject exists
    path: path to check
    """
    return os.path.exists(path + os.path.sep + ".swanproject")


def get_project_info(path):
    if has_project_file(path):
        swanfile = path + os.path.sep + ".swanproject"
        try:
            with open(swanfile) as json_file:
                data = json.load(json_file)
            return data
        except Exception as e:
            print(e)
            return {}
    else:
        return {}


def get_project_path(cwd):
    if cwd.startswith('/'):
        cwd = cwd[1:]

    paths = cwd.split(os.path.sep)
    cwd_current = cwd
    for i in range(len(paths)):
        if has_project_file(cwd_current):
            return cwd_current
        cwd_current = cwd_current[:-(len(paths[len(paths) - i - 1]) + 1)]
    return None


def get_project_readme(project_path):
    readme_path = project_path + os.path.sep + "README.md"
    if os.path.exists(readme_path):
        f = open(readme_path, "r")
        text = f.read()
        f.close()
        return text
    else:
        return None


def get_user_script_content(project_path):
    user_script_path = project_path + os.path.sep + ".userscript"
    if os.path.exists(user_script_path):
        f = open(user_script_path, "r")
        text = f.read()
        f.close()
        return text
    else:
        return ""


def get_project_name(project_path):
    path = get_project_path(project_path)
    name = None
    if path is not None:
        name = path.split('/')[-1]
    return name


def check_project_info(project_info):
    """
    Allows to check if the .swanproject file content is corrupted.
    """
    project_keys = ["stack", "platform", "release",
                    "user_script", "python3", "python2", "kernel_dirs"]
    not_found = []
    status = True
    for key in project_keys:
        if key not in project_info.keys():
            status = False
            not_found.append(key)
    return {"status": status, "not_found": not_found}


def get_env_isolated():
    """
    Command line required with environmental variables to isolate the environment.
    """
    command = ["env", "-i", "HOME=%s" % os.environ["HOME"]]
    # checking if we are on EOS to add the env variables
    # we required this to read/write in a isolate environment with EOS
    if "OAUTH2_FILE" in os.environ:
        command.append("OAUTH2_FILE=%s" % os.environ["OAUTH2_FILE"])
    if "OAUTH2_TOKEN" in os.environ:
        command.append("OAUTH2_TOKEN=%s" % os.environ["OAUTH2_TOKEN"])
    if "OAUTH_INSPECTION_ENDPOINT" in os.environ:
        command.append("OAUTH_INSPECTION_ENDPOINT=%s" %
                       os.environ["OAUTH_INSPECTION_ENDPOINT"])

    # special case when the package was not installed like root, useful for development
    command.append(
        "PATH=/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin:{}/.local/bin/".format(os.environ["HOME"]))
    command.append(
        "LD_LIBRARY_PATH=/usr/lib:/usr/local/lib"
        )

    return command
