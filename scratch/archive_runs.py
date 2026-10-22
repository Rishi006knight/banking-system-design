import os
import shutil

os.makedirs('docs/results/raw/before_tuning', exist_ok=True)
os.makedirs('docs/results/raw/after_tuning', exist_ok=True)
os.makedirs('results/raw/before_tuning', exist_ok=True)
os.makedirs('results/raw/after_tuning', exist_ok=True)

for src_dir in ['docs/results/raw', 'results/raw']:
    if not os.path.exists(src_dir):
        continue
    for f in os.listdir(src_dir):
        p = os.path.join(src_dir, f)
        if os.path.isfile(p):
            target = os.path.join(src_dir, 'before_tuning', f)
            shutil.copy2(p, target)

print("Archived old runs successfully!")
