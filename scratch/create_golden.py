import shutil

for f in ['bank-shard-0.db', 'bank-shard-1.db', 'bank-shard-2.db', 'baseline.db']:
    shutil.copy2(f'data/{f}', f'data/golden_{f}')
print('Golden snapshots created successfully!')
