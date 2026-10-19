import sys
import numpy as np
from PIL import Image
before = np.array(Image.open(sys.argv[1]).convert("RGB"), dtype=float)
after = np.array(Image.open(sys.argv[2]).convert("RGB"), dtype=float)
if before.shape != after.shape:
    raise SystemExit("Frame dimensions changed")
error = float(np.sqrt(np.mean((before-after)**2)))
if error > 1.5:
    raise SystemExit(f"Visual regression: RMS {error:.3f} exceeds 1.5")
