"""Parser regression tests for source-safe Wikipedia broodmare names."""
import unittest
from scripts.harvest_wikipedia_dams import clean_mother, dam_from_article

class TestWikiMotherExtraction(unittest.TestCase):
    def test_infobox_mother_with_citations(self):
        article="{{競走馬\n|馬名 = ウオッカ\n| 母 = タニノシスター<ref name=\"JBIS\"/>\n|母の父 = ルション\n}}\n==競走成績==\n"
        self.assertEqual(dam_from_article(article),"タニノシスター")
    def test_linked_name_and_templated_footnotes(self):
        article="{{競走馬\n| 母 = [[タニノシスター|タニノシスター]]{{sfn|source|p=1}}\n}}"
        self.assertEqual(dam_from_article(article),"タニノシスター")
    def test_ambiguous_or_unknown_not_guessed(self):
        self.assertIsNone(clean_mother("不詳"))
        self.assertIsNone(clean_mother("{{仮リンク|馬の名前|en|Foal}}"))
        self.assertIsNone(dam_from_article("{{競走馬\n|母 = 馬A\n|母 = 馬B\n}}"))
    def test_dont_extract_unrelated_second_section(self):
        article="{{競走馬\n|父 = 父馬\n}}\n==親族==\n|母 = ここの名は違う\n"
        self.assertIsNone(dam_from_article(article))

if __name__=="__main__":
    unittest.main()
