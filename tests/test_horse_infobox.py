#!/usr/bin/env python3
"""Unit tests for source-safe Wikipedia infobox-only horse fact extraction."""
import sys,unittest,pathlib
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/"scripts"))
from collect_horse_profiles import wiki_infobox_facts

class InfoboxFacts(unittest.TestCase):
 def test_japan_record_and_medals(self):
  sample='''{{競走馬
|名 = ゴールドシップ
|績 = 28戦13勝<br />（中央）27戦13勝
|medaltemplates = {{MedalGI|[[菊花賞]]|2012年}}
{{MedalGII|[[宝塚記念]]|2013年}}
}}
敗戦の[[ジャパンカップ]]を語る。'''
  record,wins=wiki_infobox_facts(sample,"ja")
  self.assertEqual(record,{"starts":28,"wins":13})
  self.assertEqual(wins,[{"race":"菊花賞","year":2012},{"race":"宝塚記念","year":2013}])
 def test_eng_record(self):
  record,wins=wiki_infobox_facts("{{Infobox racehorse\n| record = 18: 14–2–2\n}}","en")
  self.assertEqual(record,{"starts":18,"wins":14})
  self.assertEqual(wins,[])
 def test_no_inference_from_narrative_or_parent(self):
  sample="父馬は20戦10勝。\nこの馬は菊花賞に出走し2着。\n[[母]]は繁殖牝馬。"
  self.assertEqual(wiki_infobox_facts(sample,"ja"),(None,[]))
 def test_reject_invalid_total(self):
  self.assertEqual(wiki_infobox_facts("|績 = 3戦5勝","ja"),(None,[]))
 def test_no_regional_race_substring(self):
  _,wins=wiki_infobox_facts("|績 = 10戦2勝\n{{MedalGI|[[兵庫菊花賞]]|2012年}}","ja")
  self.assertEqual(wins,[{"race":"兵庫菊花賞","year":2012}])

if __name__=="__main__":unittest.main()
