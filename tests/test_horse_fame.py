import importlib.util
import pathlib
import unittest
from unittest.mock import patch

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "collect_horse_fame.py"
spec = importlib.util.spec_from_file_location("collect_horse_fame", SCRIPT)
fame = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fame)


class HorseFameTests(unittest.TestCase):
    def test_curated_hall_of_fame_uses_official_name_list(self):
        self.assertIn("ディープインパクト", fame.JRA_HALL_NAMES)
        self.assertIn("オジュウチョウサン", fame.JRA_HALL_NAMES)
        self.assertNotIn("サンデーサイレンス", fame.JRA_HALL_NAMES)

    def test_exact_qid_match_and_twelve_complete_months(self):
        pedigree = {"version": "pedigree-test", "horses": [
            {"id": "Q1", "name": "ディープインパクト", "named": True},
            {"id": "Q2", "name": "架空の馬", "named": True},
            {"id": "Q3", "name": "Q3", "named": False},
        ]}
        links = {
            "Q1": {"project": "ja.wikipedia.org", "article": "ディープインパクト", "sitelinks": 10},
            "Q2": {"project": None, "article": None, "sitelinks": 0},
        }
        with patch.object(fame, "wikidata_sitelinks", return_value=links), \
                patch.object(fame, "views_for", side_effect=lambda item, start, end: 1234 if item["project"] else None) as pageviews:
            result = fame.collect(pedigree, "2026-10", workers=1)
        self.assertEqual(result["period"], {"from": "2025-11-01", "through": "2026-10-31"})
        self.assertEqual(result["coverage"]["named"], 2)
        self.assertEqual(result["coverage"]["observedViews"], 1)
        self.assertEqual([x["id"] for x in result["horses"]], ["Q1", "Q2"])
        self.assertEqual(result["horses"][0]["views12m"], 1234)
        self.assertEqual(result["horses"][1]["views12m"], None)
        self.assertTrue(result["horses"][0]["jraHall"])
        self.assertEqual(result["horses"][1]["articleUrl"], None)
        self.assertEqual(pageviews.call_count, 2)


if __name__ == "__main__":
    unittest.main()
