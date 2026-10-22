import json
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

log_path = r'C:\Users\sarav\.gemini\antigravity-ide\brain\72254684-5a10-4ff8-9ded-96a38ec559b2\.system_generated\logs\transcript.jsonl'
user_prompts = []
with open(log_path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        data = json.loads(line)
        if data.get('type') == 'USER_INPUT':
            user_prompts.append((i, data.get('content', '')))

for i, content in user_prompts:
    if i == 4239:
        lines = content.splitlines()
        print("=== LINE 18 ===")
        print(lines[18])
        if len(lines) > 19:
            print("=== LINE 19 ===")
            print(lines[19])
