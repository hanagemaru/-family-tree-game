#!/usr/bin/env python3
"""Fill dam display names where the mother QID exists but has no readable label.

Uses the same QID-verified Japanese Wikipedia infobox extractor as the first
pass. Never changes the source snapshot or invents a parent ID.
"""
import json
from collections import Counter
from harvest_wikipedia_dams import (
    SNAPSHOT, AUDIT, MODULE, fetch_verified_jawiki_dams, generate_module
)

def main():
    snapshot=json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    audit=json.loads(AUDIT.read_text(encoding="utf-8"))
    by_id={h["id"]:h for h in snapshot["horses"]}
    targets=[h for h in snapshot["horses"] if h.get("named") and h.get("dam")
       and not by_id.get(h["dam"],{}).get("named")]
    previous=audit["records"]
    remaining=[h for h in targets if h["id"] not in previous]
    counts=Counter()
    added=fetch_verified_jawiki_dams(remaining,counts)
    merged=dict(sorted({**previous,**added}.items()))
    total_missing_no_qid=sum(1 for h in snapshot["horses"] if h.get("named") and not h.get("dam"))
    total_missing_label_with_qid=len(targets)
    counts_new=audit["counts"]
    counts_new.update({
      "withoutMotherQid":total_missing_no_qid,
      "withUnnamedMotherQid":total_missing_label_with_qid,
      "sourceMissing":total_missing_no_qid+total_missing_label_with_qid,
      "scanned":total_missing_no_qid+total_missing_label_with_qid,
      "found":len(merged),
      "unresolved":total_missing_no_qid+total_missing_label_with_qid-len(merged),
      "addedNamesForExistingQids":len(added),
      "existingQidWithoutNameStillUnresolved":total_missing_label_with_qid-len(added),
      "supplementalArticleBatches":counts["page_batches"]
    })
    audit["records"]=merged
    AUDIT.write_text(json.dumps(audit,ensure_ascii=False,sort_keys=True,indent=2)+"\n",encoding="utf-8")
    MODULE.write_text(generate_module(merged),encoding="utf-8")
    print("TOTAL MOTHER NAMES",len(merged),
          "ADDED EXISTING ID UNKNOWN NAME",len(added),
          "STILL UNRESOLVED",counts_new["unresolved"],flush=True)
    print("UPDATED",AUDIT,MODULE,flush=True)

if __name__=="__main__":
    main()
