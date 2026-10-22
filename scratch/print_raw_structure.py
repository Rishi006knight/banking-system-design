import json

with open("docs/results/raw/final/raw_prop_50.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print("Root keys:", list(data.keys()))
metrics = data.get("metrics", {})
print("Metrics keys:", list(metrics.keys())[:15])
for k in ["http_req_duration", "http_req_duration{expected_response:true}"]:
    print(k, "->", data["metrics"].get(k))
