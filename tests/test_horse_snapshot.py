"""Synthetic corrupt-claim checks for the frozen Wikidata pedigree converter."""
import unittest
from scripts.build_horse_snapshot import build


class SnapshotValidationTests(unittest.TestCase):
    def test_conflicts_self_parent_cycle_and_age_are_rejected(self):
        def horse(name, sire=(), dam=()):
            return {'name': name, 'sire': list(sire), 'dam': list(dam)}
        audit = {'entities': {
            'Q1': horse('A', ['Q2']),
            'Q2': horse('B', ['Q1']),
            'Q3': horse('C', ['Q3']),
            'Q4': horse('D', ['Q6', 'Q7']),
            'Q5': horse('E', ['Q8'], ['Q8']),
            'Q6': horse('F'), 'Q7': horse('G'), 'Q8': horse('H'),
            'Q9': horse('I', ['Q10']), 'Q10': horse('J'),
            'Q11': horse('same-name'), 'Q12': horse('same-name'),
        }}
        lineage = {'root_groups': [], 'named_pedigrees': [], 'foal_qids_by_root': {}}
        live = {
            'Q9': {'name': 'I', 'birthYear': 2020},
            'Q10': {'name': 'J', 'birthYear': 2019},
        }
        data, report = build(audit, lineage, live)
        horses = {r['id']: r for r in data['horses']}
        rejected = report['excludedRelationships']
        for reason in ('cycle_edges', 'self_parent', 'ambiguous_sire', 'identical_parents', 'impossible_birth_year'):
            self.assertEqual(rejected[reason], 1, reason)
        self.assertIsNone(horses['Q3']['sire'])
        self.assertIsNone(horses['Q4']['sire'])
        self.assertIsNone(horses['Q5']['sire'])
        self.assertIsNone(horses['Q5']['dam'])
        self.assertIsNone(horses['Q9']['sire'])
        self.assertEqual(report['duplicateNames']['same-name'], ['Q11', 'Q12'])
        self.assertNotEqual(horses['Q11']['id'], horses['Q12']['id'])

    def test_duplicate_source_claims_collapse_without_false_ambiguity(self):
        audit = {'entities': {'Q30': {'name': 'A', 'sire': ['Q31', 'Q31'], 'dam': []},
                              'Q31': {'name': 'B', 'sire': [], 'dam': []}}}
        data, report = build(audit, {'root_groups': [], 'named_pedigrees': [], 'foal_qids_by_root': {}})
        self.assertEqual({h['id']: h for h in data['horses']}['Q30']['sire'], 'Q31')
        self.assertFalse(report['excludedRelationships'])


if __name__ == '__main__':
    unittest.main()
