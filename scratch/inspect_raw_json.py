import json

for fname in ["raw_prop_50.json", "raw_base_50.json", "raw_base_800.json", "raw_base_1000.json"]:
    path = f"docs/results/raw/final/{fname}"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    print("="*50)
    print("FILE:", fname)
    metrics = data.get("metrics", {})
    for k in ["http_req_duration", "http_req_duration{expected_response:true}"]:
        if k in metrics:
            print(k, metrics[k].get("values", {}))
        else:
            print(k, "NOT FOUND")
