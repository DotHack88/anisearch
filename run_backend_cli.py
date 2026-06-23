#!/usr/bin/env python
"""
Direct CLI launcher - launches uvicorn via sys.argv
"""
import sys
import os

os.chdir('/c/Users/Emanuele/anisearch')
sys.argv = ['uvicorn', 'backend.main:app', '--port', '8000', '--host', '127.0.0.1']

from uvicorn.main import run

if __name__ == "__main__":
    run()
