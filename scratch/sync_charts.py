import shutil
import glob
import os

src_dir = "docs/charts"
dest_dirs = ["docs/results/charts", "results/charts"]

for d in dest_dirs:
    os.makedirs(d, exist_ok=True)
    for src_file in glob.glob(os.path.join(src_dir, "*.png")):
        fname = os.path.basename(src_file)
        dest_file = os.path.join(d, fname)
        shutil.copy2(src_file, dest_file)
        print(f"Copied {fname} to {d}")

print("Synchronized all charts successfully.")
