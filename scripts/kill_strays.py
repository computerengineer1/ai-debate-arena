#!/usr/bin/env python3
"""Kill stray E2E browsers/runners and (optionally) next-server processes.
   Usage: python3 scripts/kill_strays.py [--server]"""
import os
import signal
import sys

me = os.getpid()
ppid = os.getppid()
kill_server = "--server" in sys.argv

targets = ["e2e-visual.cjs", "headless_shell", "chrome-headless"]
if kill_server:
    targets.append("next-server")

for pid in os.listdir("/proc"):
    if not pid.isdigit():
        continue
    p = int(pid)
    if p in (me, ppid):
        continue
    try:
        cmd = open(f"/proc/{pid}/cmdline", "rb").read().decode(errors="ignore")
    except Exception:
        continue
    if any(t in cmd for t in targets) and "kill_strays" not in cmd:
        try:
            os.kill(p, signal.SIGKILL)
            print("killed", p, cmd[:60].replace("\0", " "))
        except Exception:
            pass
print("cleanup done")
