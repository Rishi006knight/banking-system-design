#!/usr/bin/env python3
"""
Service Manager for Scalable Online Banking Prototype
UCS3513 System Design Laboratory (Mini Project 7)
Manages lifecycle of all 5 microservices:
- Node 1 (:8081)
- Node 2 (:8082)
- Node 3 (:8083)
- Monolithic Baseline (:8090)
- API Gateway (:8080)
"""

import sys
import os
import time
import socket
import subprocess
import signal

SERVICES = [
    {
        "name": "node-8081",
        "port": 8081,
        "cmd": ["java", "-Djava.io.tmpdir=D:/projects/banking/.tmp", "-Dorg.sqlite.tmpdir=D:/projects/banking/.tmp", "-Dserver.port=8081", "-Dbanking.node-id=1", "-Dbanking.shards.db-path=./data/bank-shard-0.db", "-jar", "bank-service/target/bank-service-1.0.0-SNAPSHOT.jar"],
        "stdout": "logs/node-8081.log",
        "stderr": "logs/node-8081-err.log"
    },
    {
        "name": "node-8082",
        "port": 8082,
        "cmd": ["java", "-Djava.io.tmpdir=D:/projects/banking/.tmp", "-Dorg.sqlite.tmpdir=D:/projects/banking/.tmp", "-Dserver.port=8082", "-Dbanking.node-id=2", "-Dbanking.shards.db-path=./data/bank-shard-1.db", "-jar", "bank-service/target/bank-service-1.0.0-SNAPSHOT.jar"],
        "stdout": "logs/node-8082.log",
        "stderr": "logs/node-8082-err.log"
    },
    {
        "name": "node-8083",
        "port": 8083,
        "cmd": ["java", "-Djava.io.tmpdir=D:/projects/banking/.tmp", "-Dorg.sqlite.tmpdir=D:/projects/banking/.tmp", "-Dserver.port=8083", "-Dbanking.node-id=3", "-Dbanking.shards.db-path=./data/bank-shard-2.db", "-jar", "bank-service/target/bank-service-1.0.0-SNAPSHOT.jar"],
        "stdout": "logs/node-8083.log",
        "stderr": "logs/node-8083-err.log"
    },
    {
        "name": "baseline-8090",
        "port": 8090,
        "cmd": ["java", "-Djava.io.tmpdir=D:/projects/banking/.tmp", "-Dorg.sqlite.tmpdir=D:/projects/banking/.tmp", "-Dserver.port=8090", "-Dbaseline.db-path=./data/baseline.db", "-jar", "baseline/target/baseline-1.0.0-SNAPSHOT.jar"],
        "stdout": "logs/baseline.log",
        "stderr": "logs/baseline-err.log"
    },
    {
        "name": "gateway-8080",
        "port": 8080,
        "cmd": ["java", "-Djava.io.tmpdir=D:/projects/banking/.tmp", "-Dorg.sqlite.tmpdir=D:/projects/banking/.tmp", "-Dserver.port=8080", "-jar", "gateway/target/gateway-1.0.0-SNAPSHOT.jar"],
        "stdout": "logs/gateway.log",
        "stderr": "logs/gateway-err.log"
    }
]

PID_FILE = "logs/pids.txt"

def is_port_open(port):
    for host in ('127.0.0.1', 'localhost'):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.5)
            res = s.connect_ex((host, port))
            s.close()
            if res == 0:
                return True
        except Exception:
            pass
    return False

def stop_services():
    print("==========================================================")
    print("   STOPPING ALL BANKING SYSTEM INSTANCES                  ")
    print("==========================================================")
    
    # 1. Stop recorded PIDs
    if os.path.exists(PID_FILE):
        with open(PID_FILE, "r") as f:
            for line in f:
                pid_str = line.strip()
                if pid_str and pid_str.isdigit():
                    pid = int(pid_str)
                    try:
                        if sys.platform == "win32":
                            subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
                        else:
                            os.kill(pid, signal.SIGTERM)
                        print(f"  Terminated PID {pid}")
                    except Exception:
                        pass
        try:
            os.remove(PID_FILE)
        except Exception:
            pass

    # 2. Cleanup ports
    for p in [8080, 8081, 8082, 8083, 8084, 8090]:
        if sys.platform == "win32":
            out = subprocess.run(f"netstat -ano | findstr :{p}", shell=True, capture_output=True, text=True)
            for line in out.stdout.splitlines():
                parts = line.strip().split()
                if len(parts) >= 5 and "LISTENING" in parts:
                    pid = parts[-1]
                    subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
                    print(f"  Killed PID {pid} listening on port {p}")
        else:
            subprocess.run(f"fuser -k {p}/tcp", shell=True, capture_output=True)
            
    time.sleep(1)
    print("All banking services successfully stopped.\n")

def start_services(stay_alive=False):
    stop_services()
    os.makedirs("logs", exist_ok=True)
    
    print("==========================================================")
    print("   STARTING SCALABLE ONLINE BANKING PROTOTYPE             ")
    print("   UCS3513 System Design Laboratory (Mini Project 7)      ")
    print("==========================================================")
    
    procs = []
    pids = []
    
    # Start backend nodes first
    backend_svcs = SERVICES[:4]
    for svc in backend_svcs:
        print(f"Starting {svc['name']} on port {svc['port']}...")
        out_f = open(svc['stdout'], "w")
        err_f = open(svc['stderr'], "w")
        p = subprocess.Popen(svc['cmd'], stdout=out_f, stderr=err_f)
        procs.append(p)
        pids.append(p.pid)
        print(f"  Launched {svc['name']} (PID {p.pid})")

    # Wait for backend nodes to bind
    print("\nWaiting for backend nodes to bind ports (up to 75s)...")
    for svc in backend_svcs:
        port = svc['port']
        start_t = time.time()
        while time.time() - start_t < 75:
            if is_port_open(port):
                print(f"  [READY] {svc['name']} active on port {port}")
                break
            time.sleep(1)
        else:
            print(f"  [ERROR] {svc['name']} failed to bind port {port} within 75 seconds!")
            
    # Start Gateway
    gw_svc = SERVICES[4]
    print(f"\nStarting {gw_svc['name']} on port {gw_svc['port']}...")
    out_f = open(gw_svc['stdout'], "w")
    err_f = open(gw_svc['stderr'], "w")
    p_gw = subprocess.Popen(gw_svc['cmd'], stdout=out_f, stderr=err_f)
    procs.append(p_gw)
    pids.append(p_gw.pid)
    print(f"  Launched {gw_svc['name']} (PID {p_gw.pid})")
    
    # Wait for Gateway to bind
    gw_start = time.time()
    while time.time() - gw_start < 45:
        if is_port_open(8080):
            print(f"  [READY] API Gateway active on port 8080")
            break
        time.sleep(1)
    else:
        print("  [ERROR] API Gateway failed to bind port 8080 within 45 seconds!")
        
    with open(PID_FILE, "w") as f:
        for p in pids:
            f.write(f"{p}\n")
            
    print("\n==========================================================")
    print("   ALL 5 SERVICES SUCCESSFULLY LAUNCHED!                 ")
    print("   - API Gateway:          http://localhost:8080          ")
    print("   - Minimal Web UI:       http://localhost:8080/         ")
    print("   - Bank Service Node 1:  http://localhost:8081          ")
    print("   - Bank Service Node 2:  http://localhost:8082          ")
    print("   - Bank Service Node 3:  http://localhost:8083          ")
    print("   - Monolithic Baseline:  http://localhost:8090          ")
    print("==========================================================\n")
    
    if stay_alive:
        print("Daemon mode active. Keeping services running...")
        try:
            while True:
                time.sleep(1)
        except (KeyboardInterrupt, SystemExit):
            print("\nShutting down services...")
            for p in procs:
                p.terminate()

def check_status():
    print("Service Status:")
    for svc in SERVICES:
        status = "UP" if is_port_open(svc['port']) else "DOWN"
        print(f"  {svc['name']} (port {svc['port']}): {status}")

if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "start"
    if action in ("start", "up"):
        start_services(stay_alive=False)
    elif action in ("run", "daemon"):
        start_services(stay_alive=True)
    elif action == "stop":
        stop_services()
    elif action == "status":
        check_status()
    else:
        print("Usage: python manage_services.py [start|run|stop|status]")
