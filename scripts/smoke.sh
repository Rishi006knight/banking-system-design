#!/bin/bash
# Shell wrapper for banking prototype smoke test
python3 scripts/smoke.py "$@" || python scripts/smoke.py "$@"
