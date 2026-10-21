#!/usr/bin/env python3
"""
loadtest/test_app_scaleout.py
UCS3513 System Design Lab - Task 6: App-Server Scale-Out
Dynamically registers a 4th bank-service instance (node-8084) behind the API Gateway,
records load distribution per node before and after scale-out across 1,000 sample keys,
calculates % of keys remapped under Consistent Hashing (Ring) vs Modulo-N,
and exports results to docs/results/scaleout_distribution.csv and docs/charts/scaleout_remapping.png.
"""

import os
import sys
import json
import csv
import time
import urllib.request
import urllib.parse
import matplotlib.pyplot as plt

def get_consistent_hash(key):
    # Java String.hashCode / Murmur64 simulation for deterministic routing
    h = 0
    for ch in key:
        h = (31 * h + ord(ch)) & 0xFFFFFFFFFFFFFFFF
    return h

def main():
    print("==================================================================")
    print("   APP-SERVER SCALE-OUT EXPERIMENT (3 -> 4 NODES)                 ")
    print(f"   Execution Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("==================================================================")

    keys = [f"ACC-{i:07d}" for i in range(1, 1001)]

    # 1. Measure initial distribution across 3 nodes (node-8081, node-8082, node-8083)
    print("\n[Step 1] Querying Initial 3-Node Topology from API Gateway (:8080)...")
    try:
        with urllib.request.urlopen("http://localhost:8080/gateway/routes", timeout=3) as resp:
            routes_data = json.loads(resp.read().decode())
            print(f"  Active Servers: {routes_data.get('activeServers')}")
            print(f"  Virtual Nodes per Node: {routes_data.get('virtualNodesPerNode')}")
            print(f"  Total Ring Virtual Nodes: {routes_data.get('totalVirtualNodesOnRing')}")
    except Exception as e:
        print(f"  [Error] Gateway not reachable: {e}")

    # Query initial distribution from gateway
    with urllib.request.urlopen("http://localhost:8080/gateway/distribution", timeout=3) as resp:
        dist_3 = json.loads(resp.read().decode())
    print(f"  Initial 3-Node Load Distribution: {dist_3}")

    # Track per-key assignments for 3 nodes
    initial_ring_map = {}
    initial_mod_map = {}
    for i, k in enumerate(keys):
        # We query the gateway or compute deterministic ring hash
        initial_mod_map[k] = f"node-{8081 + (i % 3)}"

    # 2. Add 4th Node (node-8084) to Gateway Live Router
    print("\n[Step 2] Dynamically Adding 4th Bank Node (node-8084, :8084) to Gateway...")
    add_url = "http://localhost:8080/gateway/servers/add"
    post_data = urllib.parse.urlencode({
        "serverId": "node-8084",
        "url": "http://localhost:8084"
    }).encode("utf-8")

    req = urllib.request.Request(add_url, data=post_data)
    with urllib.request.urlopen(req, timeout=3) as resp:
        reg_result = json.loads(resp.read().decode())
        print(f"  [Registration Result] {reg_result}")

    # 3. Query new 4-Node distribution from gateway
    print("\n[Step 3] Querying Post-Scaleout 4-Node Topology from API Gateway...")
    with urllib.request.urlopen("http://localhost:8080/gateway/distribution", timeout=3) as resp:
        dist_4 = json.loads(resp.read().decode())
    print(f"  Post-Scaleout 4-Node Load Distribution: {dist_4}")

    # 4. Calculate Key Remapping (Ring vs Modulo-N)
    # Total keys = 1000
    n4_count = dist_4.get("node-8084", 0)
    ring_remapped_pct = round((n4_count / len(keys)) * 100, 2)
    ring_preserved_pct = round(100.0 - ring_remapped_pct, 2)

    # Modulo-N remapping: (i % 3) != (i % 4)
    mod_remapped_count = sum(1 for i in range(len(keys)) if (i % 3) != (i % 4))
    mod_remapped_pct = round((mod_remapped_count / len(keys)) * 100, 2)
    mod_preserved_pct = round(100.0 - mod_remapped_pct, 2)

    print(f"\n[Step 4] Key Remapping Efficiency Analysis (1,000 Keys):")
    print(f"  Consistent Hash Ring Remapped: {n4_count} keys ({ring_remapped_pct}%) | Preserved: {1000 - n4_count} ({ring_preserved_pct}%)")
    print(f"  Naive Modulo-N Remapped:       {mod_remapped_count} keys ({mod_remapped_pct}%) | Preserved: {1000 - mod_remapped_count} ({mod_preserved_pct}%)")
    print(f"  Theoretical Optimal Migration: ~25.00% (1/(N+1) = 1/4)")

    # 5. Export CSV
    csv_rows = [
        ["node-8081", dist_3.get("node-8081", 0), f"{round(dist_3.get('node-8081', 0)/10, 1)}%", dist_4.get("node-8081", 0), f"{round(dist_4.get('node-8081', 0)/10, 1)}%"],
        ["node-8082", dist_3.get("node-8082", 0), f"{round(dist_3.get('node-8082', 0)/10, 1)}%", dist_4.get("node-8082", 0), f"{round(dist_4.get('node-8082', 0)/10, 1)}%"],
        ["node-8083", dist_3.get("node-8083", 0), f"{round(dist_3.get('node-8083', 0)/10, 1)}%", dist_4.get("node-8083", 0), f"{round(dist_4.get('node-8083', 0)/10, 1)}%"],
        ["node-8084 (New)", 0, "0.0%", dist_4.get("node-8084", 0), f"{round(dist_4.get('node-8084', 0)/10, 1)}%"],
    ]

    headers = ["Node_ID", "Keys_3_Nodes", "Share_3_Nodes_Pct", "Keys_4_Nodes", "Share_4_Nodes_Pct"]
    for d in ['results', 'docs/results']:
        os.makedirs(d, exist_ok=True)
        csv_path = os.path.join(d, "scaleout_distribution.csv")
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(headers)
            w.writerows(csv_rows)
        print(f"  [SAVED] {csv_path}")

        # Also write remapping summary CSV
        remap_path = os.path.join(d, "scaleout_remapping_summary.csv")
        with open(remap_path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["Algorithm", "Remapped_Keys", "Remapped_Pct", "Preserved_Keys", "Preserved_Pct"])
            w.writerow(["Consistent Hash Ring (150 vnodes)", n4_count, f"{ring_remapped_pct}%", 1000 - n4_count, f"{ring_preserved_pct}%"])
            w.writerow(["Naive Modulo-N (hash % N)", mod_remapped_count, f"{mod_remapped_pct}%", 1000 - mod_remapped_count, f"{mod_preserved_pct}%"])
        print(f"  [SAVED] {remap_path}")

    # 6. Generate Chart
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

    nodes = ["node-8081", "node-8082", "node-8083", "node-8084"]
    counts_3 = [dist_3.get("node-8081", 0), dist_3.get("node-8082", 0), dist_3.get("node-8083", 0), 0]
    counts_4 = [dist_4.get("node-8081", 0), dist_4.get("node-8082", 0), dist_4.get("node-8083", 0), dist_4.get("node-8084", 0)]

    x = [0, 1, 2, 3]
    w = 0.35

    ax1.bar([i - w/2 for i in x], counts_3, width=w, label="3 Nodes (Before)", color="#64748b", edgecolor="#334155")
    ax1.bar([i + w/2 for i in x], counts_4, width=w, label="4 Nodes (After)", color="#0284c7", edgecolor="#0369a1")
    ax1.set_xticks(x)
    ax1.set_xticklabels(nodes, rotation=15)
    ax1.set_ylabel("Assigned Keys (out of 1,000)")
    ax1.set_title("Node Load Distribution (Scale-Out 3 -> 4 Nodes)")
    ax1.legend()
    ax1.grid(True, linestyle="--", alpha=0.5)

    # Chart 2: Remapping Comparison
    categories = ["Consistent Hash Ring\n(150 Virtual Nodes)", "Naive Modulo-N\n(hash % N)"]
    remapped = [ring_remapped_pct, mod_remapped_pct]
    preserved = [ring_preserved_pct, mod_preserved_pct]

    ax2.bar(categories, preserved, label="Preserved Cache State (%)", color="#10b981", width=0.45)
    ax2.bar(categories, remapped, bottom=preserved, label="Remapped Keys (%)", color="#ef4444", width=0.45)
    ax2.set_ylabel("Key Allocation (%)")
    ax2.set_title("Cache Invalidation on Scale-Out (Ring vs Mod-N)")
    ax2.legend(loc="lower right")
    ax2.grid(True, linestyle="--", alpha=0.5)

    for i in range(2):
        ax2.text(i, preserved[i] / 2, f"{preserved[i]}%\nPreserved", ha="center", va="center", color="white", fontweight="bold")
        ax2.text(i, preserved[i] + remapped[i] / 2, f"{remapped[i]}%\nRemapped", ha="center", va="center", color="white", fontweight="bold")

    plt.tight_layout()
    for d in ['results/charts', 'docs/charts']:
        os.makedirs(d, exist_ok=True)
        img_path = os.path.join(d, "scaleout_remapping.png")
        plt.savefig(img_path, dpi=300, bbox_inches='tight')
        print(f"  [SAVED] {img_path}")
    plt.close()

    print("\n==================================================================")
    print("   APP SCALE-OUT EXPERIMENT COMPLETED SUCCESSFULLY!              ")
    print("==================================================================")

if __name__ == "__main__":
    main()
