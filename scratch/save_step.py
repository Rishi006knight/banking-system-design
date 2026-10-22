import json

log_path = r'C:\Users\sarav\.gemini\antigravity-ide\brain\72254684-5a10-4ff8-9ded-96a38ec559b2\.system_generated\logs\transcript_full.jsonl'
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        if data.get('type') == 'USER_INPUT' and data.get('step_index') == 3755:
            with open(r'd:\projects\banking\scratch\step_3755.txt', 'w', encoding='utf-8') as out:
                out.write(data.get('content', ''))
            print("WROTE STEP 3755")
            break
