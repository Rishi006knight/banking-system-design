#!/usr/bin/env bash
# scripts/start-all.sh
# POSIX Bash entrypoint to launch all banking microservices

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

echo "=========================================================="
echo "   LAUNCHING BANKING SYSTEM MICROSERVICES (POSIX/BASH)    "
echo "=========================================================="

if command -v python3 &>/dev/null; then
    python3 scripts/manage_services.py start
elif command -v python &>/dev/null; then
    python scripts/manage_services.py start
else
    echo "Error: Python runtime not found on PATH." >&2
    exit 1
fi

echo "All services successfully started."
