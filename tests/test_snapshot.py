import importlib.util
import unittest
from pathlib import Path

module_path = Path(__file__).resolve().parents[1] / "scripts" / "build_snapshot.py"
spec = importlib.util.spec_from_file_location("snapshot", module_path)
snapshot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(snapshot)

class TestSnapshot(unittest.TestCase):
    def test_mapping(self):
        self.assertEqual(snapshot.parse_mapping([{"id": 42, "name": "Teste"}])["42"]["name"], "Teste")

    def test_volume(self):
        m = {"42": {"name": "Teste", "members": False, "limit": 1000}}
        p = {"42": {"low": 100, "high": 115, "lowTime": 123, "highTime": 124}}
        v = {"42": {"highPriceVolume": 15, "lowPriceVolume": 25}}
        rows = snapshot.build_rows(m, p, v, v, v)
        self.assertEqual(rows[0]["volume24"], 40)
        self.assertEqual(rows[0]["low"], 100)
        self.assertFalse(rows[0]["members"])

    def test_reject_missing_price(self):
        self.assertEqual(snapshot.build_rows({"1": {"name": "X"}}, {"1": {"low": 0, "high": 3}}, {}, {}, {}), [])

    def test_validate_api(self):
        with self.assertRaises(ValueError):
            snapshot.extract_data({"data": []}, "test")

if __name__ == "__main__":
    unittest.main()
