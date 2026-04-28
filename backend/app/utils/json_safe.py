import math
from typing import Any


def make_json_safe(obj: Any) -> Any:
    """Convert pandas/numpy/NaN to plain JSON-safe Python values."""
    if obj is None:
        return None
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, int):
        return obj
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, str):
        return obj
    if isinstance(obj, dict):
        return {k: make_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [make_json_safe(v) for v in obj]
    if hasattr(obj, "item"):
        return obj.item()
    if hasattr(obj, "to_dict"):
        return make_json_safe(obj.to_dict())
    return obj
