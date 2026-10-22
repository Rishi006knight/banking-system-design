#!/usr/bin/env python3
"""
High-Performance Win32 Process Resource Sampler
Samples CPU % and RSS (WorkingSet MB) once per second with zero subprocess overhead.
Guarantees at least 1 row per second of duration for monitored processes.
"""

import os
import sys
import time
import csv
import threading
import ctypes
from ctypes import wintypes

PROCESS_QUERY_INFORMATION = 0x0400
PROCESS_VM_READ = 0x0010

class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
    _fields_ = [
        ('cb', wintypes.DWORD),
        ('PageFaultCount', wintypes.DWORD),
        ('PeakWorkingSetSize', ctypes.c_size_t),
        ('WorkingSetSize', ctypes.c_size_t),
        ('QuotaPeakPagedPoolUsage', ctypes.c_size_t),
        ('QuotaPagedPoolUsage', ctypes.c_size_t),
        ('QuotaPeakNonPagedPoolUsage', ctypes.c_size_t),
        ('QuotaNonPagedPoolUsage', ctypes.c_size_t),
        ('PagefileUsage', ctypes.c_size_t),
        ('PeakPagefileUsage', ctypes.c_size_t),
    ]

class Win32ProcessMetrics:
    def __init__(self, pid):
        self.pid = pid
        self.handle = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, False, pid)
        self.prev_cpu_time = None
        self.prev_timestamp = None

    def sample(self):
        if not self.handle:
            return 0.0, 0.0
        
        # Working Set
        pmc = PROCESS_MEMORY_COUNTERS()
        pmc.cb = ctypes.sizeof(pmc)
        rss_mb = 0.0
        if ctypes.windll.psapi.GetProcessMemoryInfo(self.handle, ctypes.byref(pmc), pmc.cb):
            rss_mb = round(pmc.WorkingSetSize / (1024 * 1024), 2)

        # CPU Time
        c_time = wintypes.FILETIME()
        e_time = wintypes.FILETIME()
        k_time = wintypes.FILETIME()
        u_time = wintypes.FILETIME()
        now = time.time()
        cpu_pct = 0.0
        if ctypes.windll.kernel32.GetProcessTimes(self.handle, ctypes.byref(c_time), ctypes.byref(e_time), ctypes.byref(k_time), ctypes.byref(u_time)):
            k_u64 = (k_time.dwHighDateTime << 32) + k_time.dwLowDateTime
            u_u64 = (u_time.dwHighDateTime << 32) + u_time.dwLowDateTime
            tot_cpu = (k_u64 + u_u64) / 10000000.0

            if self.prev_cpu_time is not None and self.prev_timestamp is not None:
                delta_cpu = max(0.0, tot_cpu - self.prev_cpu_time)
                delta_t = max(0.001, now - self.prev_timestamp)
                cpu_pct = round((delta_cpu / delta_t) * 100.0, 1)

            self.prev_cpu_time = tot_cpu
            self.prev_timestamp = now

        return cpu_pct, rss_mb

    def close(self):
        if self.handle:
            ctypes.windll.kernel32.CloseHandle(self.handle)
            self.handle = None

def sample_loop(stop_event, target_csv, run_id, system, vus, process_dict, min_duration_sec=0):
    """
    process_dict: { 'service_name': pid }
    columns: run_id,system,vus,t,service,cpu_pct,rss_mb
    """
    samplers = {}
    for name, pid in process_dict.items():
        if pid:
            samplers[name] = Win32ProcessMetrics(pid)

    os.makedirs(os.path.dirname(target_csv), exist_ok=True)
    rows_written = 0
    t_sec = 0

    with open(target_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["run_id", "system", "vus", "t", "service", "cpu_pct", "rss_mb"])
        f.flush()

        # Prime initial CPU times
        for name, s in samplers.items():
            s.sample()
        time.sleep(1.0)

        while not stop_event.is_set():
            t_sec += 1
            for name, s in samplers.items():
                cpu_pct, rss_mb = s.sample()
                writer.writerow([run_id, system, vus, t_sec, name, cpu_pct, rss_mb])
                rows_written += 1
            f.flush()
            time.sleep(1.0)

    for s in samplers.values():
        s.close()

    if min_duration_sec > 0 and t_sec < min_duration_sec:
        raise RuntimeError(f"Resource sampling failed: file {target_csv} has {t_sec} seconds < expected {min_duration_sec}s")
