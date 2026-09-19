"""Start the localhost API and web UI together; stop both with Ctrl-C."""
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
ROOT=Path(__file__).resolve().parents[1]

def main():
    python=ROOT/'.venv/bin/python'
    if not python.exists() or not (ROOT/'node_modules').exists():
        sys.exit('Install first: uv venv --python 3.12 && uv pip install --python .venv/bin/python -r requirements.lock.txt && npm ci')
    processes=[]
    def stop(*_):
        for p in processes:
            if p.poll() is None:
                p.terminate()
        for p in processes:
            try:p.wait(timeout=8)
            except subprocess.TimeoutExpired:p.kill()
    signal.signal(signal.SIGTERM,lambda *_:sys.exit(0))
    try:
        processes.append(subprocess.Popen([str(python),'-m','uvicorn','services.research.api:app','--host','127.0.0.1','--port','8765'],cwd=ROOT))
        processes.append(subprocess.Popen(['npm','run','dev'],cwd=ROOT))
        while all(p.poll() is None for p in processes):time.sleep(.3)
        failed=next((p.returncode for p in processes if p.poll() is not None),0)
        return failed
    except KeyboardInterrupt:return 0
    finally:stop()

if __name__=='__main__':sys.exit(main())
