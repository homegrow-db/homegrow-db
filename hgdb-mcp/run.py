#!/usr/bin/env python3
"""Convenience runner for the Homegrow DB MCP server.

Usage:
    python run.py                     # start MCP over stdio
    python run.py --list-tools        # print generated tools and exit
    HGDB_BASE_URL=... python run.py    # point at a specific backend
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from server import _main  # noqa: E402

if __name__ == "__main__":
    _main()