import json
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
CONFIG_TEXT = (ROOT / "packages/edl/config.ts").read_text()
def setting(name: str) -> float:
    found = re.search(r"\b" + name + r":\s*(-?[\d.]+)", CONFIG_TEXT)
    if not found:
        raise ValueError("Missing shared setting: " + name)
    return float(found.group(1))
