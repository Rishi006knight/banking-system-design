import json
import glob
import os

files = sorted(glob.glob("docs/results/raw/final/raw_*.json"))
for f in files:
    with open(f, "r", encoding="utf-8") as fp:
        d = json.load(fp)
    fname = os.path.basename(f)
    m_all = d["metrics"].get("http_req_duration", {})
    m_exp = d["metrics"].get("http_req_duration{expected_response:true}", {})
    
    print(f"{fname:20} ALL: med={m_all.get('med', 0):.2f}, p95={m_all.get('p(95)', 0):.2f} | 2XX-ONLY: med={m_exp.get('med', 0):.2f}, p95={m_exp.get('p(95)', 0):.2f}")
