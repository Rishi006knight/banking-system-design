package com.banking.common.hashing;

import java.util.*;

/**
 * Naive Hash % N router for academic and performance comparison with Consistent Hashing.
 * Illustrates the fundamental flaw of simple modulo sharding:
 * When N changes to N+1 or N-1, almost all existing keys are remapped (~(N-1)/N).
 *
 * @param <T> Type of node
 */
public class NaiveModuloRouter<T> {

    private final List<T> nodes = new ArrayList<>();
    private final HashFunction hashFunction;

    public NaiveModuloRouter() {
        this(HashFunction.MURMUR3);
    }

    public NaiveModuloRouter(HashFunction hashFunction) {
        this.hashFunction = Objects.requireNonNull(hashFunction, "HashFunction cannot be null");
    }

    public synchronized void addNode(T node) {
        if (node != null && !nodes.contains(node)) {
            nodes.add(node);
        }
    }

    public synchronized void removeNode(T node) {
        nodes.remove(node);
    }

    public synchronized T getNode(String key) {
        if (nodes.isEmpty() || key == null) {
            return null;
        }
        long hash = hashFunction.hash(key);
        int index = (int) Math.floorMod(hash, (long) nodes.size());
        return nodes.get(index);
    }

    public synchronized List<T> getNodes() {
        return new ArrayList<>(nodes);
    }

    public synchronized int size() {
        return nodes.size();
    }
}
