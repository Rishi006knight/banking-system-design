package com.banking.common.hashing;

import java.util.*;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * Thread-safe Consistent Hash Ring using a TreeMap and Virtual Nodes.
 *
 * Properties:
 * 1. Virtual Nodes (default 150 per physical node) ensure balanced load distribution.
 * 2. Minimizes key remapping when nodes are added or removed (only ~1/N keys remapped).
 * 3. Murmur3 / MD5 hashing avoids clustering inherent in default Object.hashCode().
 * 4. ReadWriteLock enables high-throughput concurrent reads with safe mutations.
 *
 * @param <T> Type of physical node (e.g., ServerInstance, Shard)
 */
public class ConsistentHashRing<T> {

    public static final int DEFAULT_VIRTUAL_NODES = 150;

    private final HashFunction hashFunction;
    private final int virtualNodesPerNode;
    private final TreeMap<Long, T> ring = new TreeMap<>();
    private final Set<T> physicalNodes = new HashSet<>();
    private final ReentrantReadWriteLock rwLock = new ReentrantReadWriteLock();

    public ConsistentHashRing() {
        this(DEFAULT_VIRTUAL_NODES, HashFunction.MURMUR3);
    }

    public ConsistentHashRing(int virtualNodesPerNode) {
        this(virtualNodesPerNode, HashFunction.MURMUR3);
    }

    public ConsistentHashRing(int virtualNodesPerNode, HashFunction hashFunction) {
        if (virtualNodesPerNode <= 0) {
            throw new IllegalArgumentException("Virtual nodes count must be positive");
        }
        this.virtualNodesPerNode = virtualNodesPerNode;
        this.hashFunction = Objects.requireNonNull(hashFunction, "HashFunction cannot be null");
    }

    /**
     * Adds a physical node to the ring with its virtual replica nodes.
     */
    public void addNode(T node) {
        if (node == null) return;
        rwLock.writeLock().lock();
        try {
            if (physicalNodes.add(node)) {
                for (int i = 0; i < virtualNodesPerNode; i++) {
                    String vNodeKey = node.toString() + "#VN#" + i;
                    long hash = hashFunction.hash(vNodeKey);
                    ring.put(hash, node);
                }
            }
        } finally {
            rwLock.writeLock().unlock();
        }
    }

    /**
     * Removes a physical node and all its virtual replicas from the ring.
     */
    public void removeNode(T node) {
        if (node == null) return;
        rwLock.writeLock().lock();
        try {
            if (physicalNodes.remove(node)) {
                for (int i = 0; i < virtualNodesPerNode; i++) {
                    String vNodeKey = node.toString() + "#VN#" + i;
                    long hash = hashFunction.hash(vNodeKey);
                    ring.remove(hash);
                }
            }
        } finally {
            rwLock.writeLock().unlock();
        }
    }

    /**
     * Finds the primary node responsible for the specified key.
     */
    public T getNode(String key) {
        if (key == null) return null;
        rwLock.readLock().lock();
        try {
            if (ring.isEmpty()) {
                return null;
            }
            long hash = hashFunction.hash(key);
            Map.Entry<Long, T> entry = ring.ceilingEntry(hash);
            if (entry == null) {
                // Wrap around the circle
                entry = ring.firstEntry();
            }
            return entry.getValue();
        } finally {
            rwLock.readLock().unlock();
        }
    }

    /**
     * Returns up to 'count' distinct physical nodes for the key (used for replication or failover).
     */
    public List<T> getNodes(String key, int count) {
        if (key == null || count <= 0) return Collections.emptyList();
        rwLock.readLock().lock();
        try {
            if (ring.isEmpty()) return Collections.emptyList();
            int max = Math.min(count, physicalNodes.size());
            List<T> result = new ArrayList<>(max);
            Set<T> seen = new HashSet<>();

            long hash = hashFunction.hash(key);
            NavigableMap<Long, T> tailMap = ring.tailMap(hash, true);
            for (T node : tailMap.values()) {
                if (seen.add(node)) {
                    result.add(node);
                    if (result.size() == max) return result;
                }
            }

            // Wrap around head of ring
            for (T node : ring.values()) {
                if (seen.add(node)) {
                    result.add(node);
                    if (result.size() == max) return result;
                }
            }
            return result;
        } finally {
            rwLock.readLock().unlock();
        }
    }

    /**
     * Computes the distribution of given keys across physical nodes.
     */
    public Map<T, Integer> getNodeLoad(Collection<String> keys) {
        Map<T, Integer> load = new HashMap<>();
        rwLock.readLock().lock();
        try {
            for (T node : physicalNodes) {
                load.put(node, 0);
            }
            for (String key : keys) {
                T node = getNode(key);
                if (node != null) {
                    load.put(node, load.getOrDefault(node, 0) + 1);
                }
            }
            return load;
        } finally {
            rwLock.readLock().unlock();
        }
    }

    public Set<T> getPhysicalNodes() {
        rwLock.readLock().lock();
        try {
            return new HashSet<>(physicalNodes);
        } finally {
            rwLock.readLock().unlock();
        }
    }

    public int getNodeCount() {
        rwLock.readLock().lock();
        try {
            return physicalNodes.size();
        } finally {
            rwLock.readLock().unlock();
        }
    }

    public int getVirtualNodeCount() {
        rwLock.readLock().lock();
        try {
            return ring.size();
        } finally {
            rwLock.readLock().unlock();
        }
    }

    public int getVirtualNodesPerNode() {
        return virtualNodesPerNode;
    }
}
