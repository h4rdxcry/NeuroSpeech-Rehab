"""Metrics computed solely from supplied labels, with participant bootstrap."""
import numpy as np


def evaluate(rows, seed=42, bootstrap_samples=1000, final_test=False):
    if not rows or len(rows) > 100000 or not 1 <= bootstrap_samples <= 10000:
        raise ValueError("Invalid evaluation size")
    splits = {}
    for r in rows:
        for key in ("participant_id", "truth", "prediction", "split"):
            if not isinstance(r.get(key), str) or not r[key]:
                raise ValueError(f"Each row requires {key}")
        if r["split"] not in ("validation", "test"):
            raise ValueError("Evaluation accepts validation or explicit final test only")
        if r["split"] == "test" and not final_test:
            raise ValueError("Locked final test requires explicit final-test command")
        splits.setdefault(r["participant_id"], set()).add(r["split"])
    if any(len(v) > 1 for v in splits.values()) or len({r["split"] for r in rows}) != 1:
        raise ValueError("Do not mix evaluation splits or participants across splits")
    labels = sorted({r[k] for r in rows for k in ("truth", "prediction")})
    index = {v: i for i, v in enumerate(labels)}
    cm = np.zeros((len(labels), len(labels)), dtype=int)
    participants = {}
    for r in rows:
        cm[index[r["truth"]], index[r["prediction"]]] += 1
        participants.setdefault(r["participant_id"], []).append(r["truth"] == r["prediction"])
    tp = np.diag(cm)
    precision = np.divide(tp, cm.sum(0), out=np.zeros(len(labels)), where=cm.sum(0) != 0)
    recall = np.divide(tp, cm.sum(1), out=np.zeros(len(labels)), where=cm.sum(1) != 0)
    f1 = np.divide(2*precision*recall, precision+recall, out=np.zeros(len(labels)), where=(precision+recall) != 0)
    groups = list(participants.values())
    rng = np.random.default_rng(seed)
    bootstrap = []
    for _ in range(bootstrap_samples):
        selected = rng.integers(0, len(groups), size=len(groups))
        bootstrap.append(float(np.mean(np.concatenate([groups[i] for i in selected]))))
    return {"labels": labels, "confusion_matrix": cm.tolist(), "accuracy": float(tp.sum()/cm.sum()),
            "macro_f1": float(f1.mean()), "precision": precision.tolist(), "recall": recall.tolist(),
            "participant_count": len(groups), "sample_count": len(rows),
            "accuracy_ci95": np.quantile(bootstrap, [.025, .975]).tolist() if len(groups) >= 2 else None,
            "bootstrap_unit": "participant", "seed": seed, "bootstrap_samples": bootstrap_samples,
            "pipeline_version": "classification-evaluation-v1", "research_only": True,
            "limitations": "Descriptive label metrics. No clinical efficacy, calibrated confidence or AUROC without probability scores."}
