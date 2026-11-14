#!/usr/bin/env python3
"""Convert the CC0 Wikidata audits into an immutable, game-ready horse graph.

Offline by default: python3 scripts/build_horse_snapshot.py --horse-audit ... --lineage-audit ...
--enrich requests live Wikidata entities for the complete union of recorded IDs.
Never guesses parentage from sire-line descriptions. Human verification is separate.
"""
import argparse
import collections
import datetime
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
QID = re.compile(r'^Q[1-9]\d*$')
VERSION = 'wikidata-pedigree-v1'


def read(path):
    with open(path, encoding='utf-8') as handle:
        return json.load(handle)


def valid(qid):
    return isinstance(qid, str) and bool(QID.fullmatch(qid))


def year_of(entity):
    for claim in entity.get('claims', {}).get('P569', []):
        t = claim.get('mainsnak', {}).get('datavalue', {}).get('value', {})
        if isinstance(t, dict):
            m = re.match(r'^\+?(\d{3,4})-', t.get('time', ''))
            if m:
                return int(m.group(1))
    return None


def build(horse_audit, lineage_audit, enriched=None):
    collected = {}
    rejects = collections.Counter()
    issues = collections.defaultdict(list)

    def row(qid):
        if not valid(qid):
            rejects['invalid_qid'] += 1
            return None
        return collected.setdefault(qid, {
            'id': qid, 'name': qid, 'birthYear': None,
            '_sire': set(), '_dam': set(), '_sources': set(), '_groups': set(),
        })

    def names(qid, name, source):
        r = row(qid)
        if not r:
            return
        if isinstance(name, str) and name.strip() and name != qid:
            if r['name'] != qid and r['name'] != name:
                issues[qid].append('conflicting_display_names')
            # Wikidata-entity labels have priority over prior seed names.
            if r['name'] == qid or source == 'live':
                r['name'] = name.strip()
        r['_sources'].add(source)

    def add_claim(child, prop, parent, origin):
        r = row(child)
        if r is None or not valid(parent):
            rejects['invalid_parent_reference'] += 1
            return
        row(parent)
        r['_' + prop].add(parent)
        r['_sources'].add(origin)

    for id, horse in sorted(horse_audit.get('entities', {}).items()):
        names(id, horse.get('name'), 'horse-audit')
        for prop in ('sire', 'dam'):
            for parent in horse.get(prop, []):
                add_claim(id, prop, parent, 'horse-audit')

    roots = {}
    for item in lineage_audit.get('root_groups', []):
        id = item.get('qid')
        if valid(id):
            roots[item['name']] = {'qid': id, 'group': item.get('group', '')}
            names(id, item['name'], 'lineage-root')
    for horse in lineage_audit.get('named_pedigrees', []):
        id = horse.get('qid')
        if not valid(id):
            continue
        names(id, horse.get('name'), 'lineage-named')
        for prop in ('sire', 'dam'):
            for item in horse.get(prop, []):
                parent = item.get('qid')
                if valid(parent):
                    names(parent, item.get('name'), 'lineage-named')
                    add_claim(id, prop, parent, 'lineage-named')

    for name, children in sorted(lineage_audit.get('foal_qids_by_root', {}).items()):
        if name not in roots:
            rejects['missing_lineage_root'] += 1
            continue
        parent = roots[name]['qid']
        for prop in ('sire', 'dam'):
            for child in children.get(prop, []):
                add_claim(child, prop, parent, 'lineage-direct')
                if valid(child):
                    collected[child]['_groups'].add(name)

    for id, horse in sorted((enriched or {}).items()):
        if horse.get('missing'):
            issues[id].append('missing_wikidata_entity')
            continue
        names(id, horse.get('name'), 'live')
        if horse.get('birthYear') is not None:
            collected[id]['birthYear'] = horse['birthYear']
        for prop in ('sire', 'dam'):
            for parent in horse.get(prop, []):
                add_claim(id, prop, parent, 'live')

    parents = {}
    for id, r in sorted(collected.items()):
        p = {}
        for prop in ('sire', 'dam'):
            ids = sorted(r['_' + prop])
            if len(ids) > 1:
                issues[id].append(f'multiple_{prop}_claims')
                rejects['ambiguous_' + prop] += 1
                ids = []
            if id in ids:
                issues[id].append(f'self_{prop}')
                rejects['self_parent'] += 1
                ids = []
            p[prop] = ids[0] if ids else None
        if p['sire'] and p['sire'] == p['dam']:
            p['sire'] = p['dam'] = None
            issues[id].append('identical_sire_and_dam')
            rejects['identical_parents'] += 1
        parents[id] = p

    # Drop only the offending edge (not the whole horse) for cycles / known age impossibilities.
    def invalid_edge(child, parent):
        if parent is None:
            return False
        py, cy = collected[parent]['birthYear'], collected[child]['birthYear']
        if py is not None and cy is not None and cy - py < 2:
            rejects['impossible_birth_year'] += 1
            issues[child].append('impossible_birth_year')
            return True
        return False

    for id, p in parents.items():
        for prop in ('sire', 'dam'):
            if invalid_edge(id, p[prop]):
                p[prop] = None

    def cycle_edge():
        colors = {}
        def visit(id):
            colors[id] = 1
            for prop in ('sire', 'dam'):
                parent = parents[id][prop]
                if parent is None:
                    continue
                if colors.get(parent) == 1:
                    return id, prop
                if not colors.get(parent):
                    edge = visit(parent)
                    if edge:
                        return edge
            colors[id] = 2
            return None
        for id in sorted(parents):
            if not colors.get(id):
                edge = visit(id)
                if edge:
                    return edge
        return None

    for _ in range(len(parents) * 2 + 1):
        edge = cycle_edge()
        if not edge:
            break
        child, prop = edge
        parents[child][prop] = None
        rejects['cycle_edges'] += 1
        issues[child].append('cycle_edge_removed')
    else:
        raise RuntimeError('Cycle removal did not converge')

    display = collections.defaultdict(list)
    records = []
    for id, r in sorted(collected.items()):
        display[r['name']].append(id)
        p = parents[id]
        records.append({
            'id': id, 'name': r['name'],
            'sire': p['sire'], 'dam': p['dam'],
            'birthYear': r['birthYear'],
            'named': r['name'] != id,
            'lineages': sorted(r['_groups']),
            'source': 'https://www.wikidata.org/wiki/' + id,
        })
    duplicates = {name:ids for name,ids in display.items() if len(ids) > 1 and not QID.fullmatch(name)}
    audit = {
        'totalRecords': len(records),
        'namedRecords': sum(r['named'] for r in records),
        'unresolvedNames': sum(not r['named'] for r in records),
        'knownSires': sum(bool(r['sire']) for r in records),
        'knownDams': sum(bool(r['dam']) for r in records),
        'bothParents': sum(bool(r['sire']) and bool(r['dam']) for r in records),
        'duplicateNames': duplicates,
        'excludedRelationships': dict(sorted(rejects.items())),
        'flaggedEntities': dict(sorted(issues.items())),
        'warning': 'Wikidata claims are not independently verified real-world pedigrees; unknown is not absence.',
    }
    data = {
        'version': VERSION,
        'sources': {
            'horseAuditUtc': horse_audit.get('retrieved_at_utc'),
            'lineageAuditUtc': lineage_audit.get('retrieved_at_utc'),
            'liveEntityRefresh': bool(enriched),
            'license': 'Wikidata structured data (CC0)',
            'method': 'scripts/build_horse_snapshot.py',
        },
        'roots': roots,
        'horses': records,
    }
    return data, audit


def enrich(ids):
    sys.path.insert(0, str(ROOT / 'scripts'))
    from research_wikidata_horses import get_entities, claims_one, label
    entities = get_entities(sorted(ids))
    return {id: {
        'name': label(e), 'sire': claims_one(e, 'P22'),
        'dam': claims_one(e, 'P25'), 'birthYear': year_of(e),
        'missing': e.get('missing', False),
    } for id, e in entities.items()}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--horse-audit', type=pathlib.Path, required=True)
    ap.add_argument('--lineage-audit', type=pathlib.Path, required=True)
    ap.add_argument('--enrich', action='store_true', help='Live Wikidata API refresh of all known QIDs')
    ap.add_argument('--enriched-input', type=pathlib.Path, help='Frozen normalized live Wikidata records')
    ap.add_argument('--save-enriched', type=pathlib.Path, help='Store live API records for reproducible offline rebuild')
    ap.add_argument('--output', type=pathlib.Path, default=ROOT / 'data/horse-pedigree.v1.json')
    ap.add_argument('--audit-output', type=pathlib.Path, default=ROOT / 'docs/horse-data-audit-2026-11-12.json')
    args = ap.parse_args()
    a, b = read(args.horse_audit), read(args.lineage_audit)
    preliminary, _ = build(a, b)
    if args.enrich and args.enriched_input:
        ap.error('Specify either --enrich or --enriched-input')
    live = enrich([r['id'] for r in preliminary['horses']]) if args.enrich else None
    if args.enriched_input:
        live = read(args.enriched_input)['entities']
    if args.save_enriched and live is not None:
        args.save_enriched.parent.mkdir(parents=True, exist_ok=True)
        args.save_enriched.write_text(json.dumps({'retrieved_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'entities':live}, ensure_ascii=False, sort_keys=True, separators=(',', ':'))+'\n',encoding='utf-8')
    data, audit = build(a, b, live)
    for path, value in ((args.output, data), (args.audit_output, audit)):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n', encoding='utf-8')
    print('SNAPSHOT_RESULT=' + json.dumps({k:v for k,v in audit.items() if k not in ('duplicateNames','flaggedEntities')}, ensure_ascii=False))
    print('Output:', args.output)

if __name__ == '__main__':
    main()
