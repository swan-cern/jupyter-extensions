"""Detect which top-level packages are touched by the current PR/push.

Writes a JSON array of changed package names to ``$GITHUB_OUTPUT``.
"""

import json
import os
import subprocess
from pathlib import Path


PACKAGES = sorted(
    pkg.name for pkg in Path.cwd().glob("*/") if (pkg / "pyproject.toml").exists()
)


def main():
    base = os.environ["BASE_SHA"]
    head = os.environ["HEAD_SHA"]

    diff = subprocess.run(
        ["git", "diff", "--name-only", base, head],
        check=True,
        capture_output=True,
        text=True,
    )
    changed = diff.stdout.splitlines()

    print("Changed files:")
    for path in changed:
        print(f"  {path}")

    matched = [
        pkg for pkg in PACKAGES if any(path.startswith(f"{pkg}/") for path in changed)
    ]
    print("Matched packages:")
    for pkg in matched:
        print(f"  {pkg}")

    with open(os.environ["GITHUB_OUTPUT"], "a") as f:
        f.write(f"packages={json.dumps(matched)}\n")


if __name__ == "__main__":
    main()
