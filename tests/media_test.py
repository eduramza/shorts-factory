import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/media-worker"))
from main import smooth_crop, sampled_frames, cached_json, save_json
class CropTest(unittest.TestCase):
    def test_bounds_and_velocity(self):
        points = [{"t": i/5, "cx": i%2, "cy": (i+1)%2} for i in range(100)]
        crop = smooth_crop(points)
        self.assertTrue(all(0 <= p["cx"] <= 1 for p in crop))
        self.assertTrue(all(abs(a["cx"]-b["cx"]) <= .22/5+1e-8 for a,b in zip(crop,crop[1:])))
    def test_sampling_decodes_sequentially_without_seeking(self):
        class Capture:
            position = -1
            reads = 0
            def grab(self):
                self.position += 1
                return self.position < 60
            def retrieve(self):
                self.reads += 1
                return True, self.position
        cap = Capture()
        frames = list(sampled_frames(cap, 60, 6))
        self.assertEqual([index for index, _ in frames], list(range(0, 60, 6)))
        self.assertEqual(cap.reads, 10)
    def test_json_cache_recovers_from_incomplete_write(self):
        import tempfile
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "cache.json"
            path.write_text('{')
            self.assertIsNone(cached_json(path))
            save_json(path, {"ok": True})
            self.assertEqual(cached_json(path), {"ok": True})
            self.assertFalse(path.with_name(path.name + '.tmp').exists())
    def test_empty(self):
        self.assertEqual(smooth_crop([]), [])
if __name__ == "__main__":
    unittest.main()
