import sys
from pathlib import Path

_backend_dir = Path(__file__).resolve().parents[1]
_root_dir = Path(__file__).resolve().parents[2]

for _dir in (_backend_dir, _root_dir):
    _dir_str = str(_dir)
    if _dir_str not in sys.path:
        sys.path.insert(0, _dir_str)
