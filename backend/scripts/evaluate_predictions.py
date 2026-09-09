"""Explicit evaluation entry point; no dataset is opened without split selection."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.evaluation import evaluate


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--validation", action="store_true")
    mode.add_argument("--final-test", action="store_true")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    raw = args.input.read_bytes()
    rows = json.loads(raw)
    if any(r.get("split") != ("test" if args.final_test else "validation") for r in rows):
        parser.error("Input split does not match explicit evaluation mode")
    result = evaluate(rows, seed=args.seed, final_test=args.final_test)
    result["source_sha256"] = hashlib.sha256(raw).hexdigest()
    with args.output.open("x", encoding="utf-8") as f:
        json.dump(result, f, indent=2, allow_nan=False)


if __name__ == "__main__":
    main()
