import glob
import os

files = glob.glob("docs/results/raw/final/resource_*.csv")
for f in sorted(files):
    with open(f, "r", encoding="utf-8") as fp:
        lines = fp.readlines()
    print(f"{os.path.basename(f):25} -> {len(lines)} lines")
    if len(lines) > 1:
        print("   Header:", lines[0].strip())
        print("   Sample:", lines[1].strip()[:80])
