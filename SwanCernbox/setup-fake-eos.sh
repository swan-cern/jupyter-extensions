#!/bin/bash
#
# Create a local directory structure resembling EOS for testing.
#
# Usage: ./setup-fake-spaces.sh [fake-eos-path]

FAKE_EOS="${1:-./fake-eos}"

# Create project folders (CERNBox spaces)
mkdir -p "$FAKE_EOS/project/a/atlas-analysis"/{data,notebooks,results}
mkdir -p "$FAKE_EOS/project/c/cms-opendata"/{datasets,scripts}
mkdir -p "$FAKE_EOS/project/s/swan-dev"/{config,tests}
mkdir -p "$FAKE_EOS/project/l/lattice"/{configs,results}
mkdir -p "$FAKE_EOS/project/a/alice-qgp"/{data,notebooks}

# Create user directories
mkdir -p "$FAKE_EOS/user/t/troun"/{Documents,SWAN_projects}
mkdir -p "$FAKE_EOS/user/j/jdoe"/trigger-studies
mkdir -p "$FAKE_EOS/user/a/asmith"/ml-pipeline
mkdir -p "$FAKE_EOS/user/m/mrossi"/beam-optics-2026
mkdir -p "$FAKE_EOS/user/t/troun"/{Documents,SWAN_projects}

# Drop a sample file in each space so they're not empty
for dir in "$FAKE_EOS"/project/*/; do
  for space in "$dir"*/; do
    if [ ! -f "$space/README.md" ]; then
      name=$(basename "$space")
      echo "# $name" > "$space/README.md"
      echo "Space directory for testing." >> "$space/README.md"
    fi
  done
done

# Drop a sample file in each user directory so they're not empty
for dir in "$FAKE_EOS"/user/*/; do
  for user in "$dir"*/; do
    if [ ! -f "$user/README.md" ]; then
      name=$(basename "$user")
      echo "# $name" > "$user/README.md"
      echo "User home" >> "$user/README.md"
    fi
  done
done

find "$FAKE_EOS/project" -maxdepth 3 -type d | sort
