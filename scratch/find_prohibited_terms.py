import os
import glob

targets = [
    "0.00% errors",
    "0.00% 5xx",
    "across all levels",
    "eliminated",
    "48.12",
    "73.90",
    "proves",
    "100% Resolved",
    "NGINX/HAProxy"
]

docs_files = glob.glob("docs/**/*.md", recursive=True)

for fpath in docs_files:
    with open(fpath, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f):
            for t in targets:
                if t.lower() in line.lower():
                    print(f"{fpath}:{idx+1} [{t}] -> {line.strip()[:120]}")
