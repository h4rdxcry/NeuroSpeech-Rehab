import hashlib
from pathlib import Path
from typing import Optional


def sha256_file(path: Path, block_size: int = 65536) -> Optional[str]:
    if not path.exists() or not path.is_file():
        return None
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            data = f.read(block_size)
            if not data:
                break
            h.update(data)
    return f"sha256:{h.hexdigest()}"


def md5_file(path: Path, block_size: int = 65536) -> Optional[str]:
    if not path.exists() or not path.is_file():
        return None
    h = hashlib.md5()
    with path.open("rb") as f:
        while True:
            data = f.read(block_size)
            if not data:
                break
            h.update(data)
    return f"md5:{h.hexdigest()}"
