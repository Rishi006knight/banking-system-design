package com.banking.common.hashing;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Interface for generating 64-bit hashes for consistent hashing.
 */
public interface HashFunction {

    /**
     * Hashes an arbitrary string key to a 64-bit signed integer.
     */
    long hash(String key);

    /**
     * MD5 based 64-bit hash (uses the upper 8 bytes of the 128-bit digest).
     * Provides cryptographic distribution across the ring.
     */
    HashFunction MD5 = key -> {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(key.getBytes(StandardCharsets.UTF_8));
            long h = 0;
            for (int i = 0; i < 8; i++) {
                h = (h << 8) | (digest[i] & 0xFFL);
            }
            return h;
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("MD5 algorithm not found in JVM", e);
        }
    };

    /**
     * Murmur3 64-bit hash implementation from scratch (no external library).
     * Extremely fast, non-cryptographic hash with avalanche properties and low collision.
     */
    HashFunction MURMUR3 = key -> {
        byte[] data = key.getBytes(StandardCharsets.UTF_8);
        long c1 = 0x87c37b91114253d5L;
        long c2 = 0x4cf5ad432745937fL;
        long h1 = 0x123456789abcdef0L;
        long h2 = 0x0fedcba987654321L;

        int length = data.length;
        int nblocks = length / 16;

        for (int i = 0; i < nblocks; i++) {
            int index = i * 16;
            long k1 = getLong(data, index);
            long k2 = getLong(data, index + 8);

            k1 *= c1;
            k1 = Long.rotateLeft(k1, 31);
            k1 *= c2;
            h1 ^= k1;

            h1 = Long.rotateLeft(h1, 27);
            h1 += h2;
            h1 = h1 * 5 + 0x52dce729;

            k2 *= c2;
            k2 = Long.rotateLeft(k2, 33);
            k2 *= c1;
            h2 ^= k2;

            h2 = Long.rotateLeft(h2, 31);
            h2 += h1;
            h2 = h2 * 5 + 0x38495ab5;
        }

        // Tail processing
        int tailIndex = nblocks * 16;
        long k1 = 0;
        long k2 = 0;
        int tailLength = length & 15;

        switch (tailLength) {
            case 15: k2 ^= (long) (data[tailIndex + 14] & 0xFF) << 48;
            case 14: k2 ^= (long) (data[tailIndex + 13] & 0xFF) << 40;
            case 13: k2 ^= (long) (data[tailIndex + 12] & 0xFF) << 32;
            case 12: k2 ^= (long) (data[tailIndex + 11] & 0xFF) << 24;
            case 11: k2 ^= (long) (data[tailIndex + 10] & 0xFF) << 16;
            case 10: k2 ^= (long) (data[tailIndex + 9] & 0xFF) << 8;
            case 9:  k2 ^= (long) (data[tailIndex + 8] & 0xFF);
                     k2 *= c2; k2 = Long.rotateLeft(k2, 33); k2 *= c1; h2 ^= k2;
            case 8:  k1 ^= (long) (data[tailIndex + 7] & 0xFF) << 56;
            case 7:  k1 ^= (long) (data[tailIndex + 6] & 0xFF) << 48;
            case 6:  k1 ^= (long) (data[tailIndex + 5] & 0xFF) << 40;
            case 5:  k1 ^= (long) (data[tailIndex + 4] & 0xFF) << 32;
            case 4:  k1 ^= (long) (data[tailIndex + 3] & 0xFF) << 24;
            case 3:  k1 ^= (long) (data[tailIndex + 2] & 0xFF) << 16;
            case 2:  k1 ^= (long) (data[tailIndex + 1] & 0xFF) << 8;
            case 1:  k1 ^= (long) (data[tailIndex] & 0xFF);
                     k1 *= c1; k1 = Long.rotateLeft(k1, 31); k1 *= c2; h1 ^= k1;
        }

        h1 ^= length;
        h2 ^= length;

        h1 += h2;
        h2 += h1;

        // Finalization avalanche
        h1 = fmix64(h1);
        h2 = fmix64(h2);

        h1 += h2;
        return h1;
    };

    private static long getLong(byte[] data, int index) {
        long result = 0;
        for (int i = 0; i < 8; i++) {
            result |= ((long) (data[index + i] & 0xFF)) << (i * 8);
        }
        return result;
    }

    private static long fmix64(long k) {
        k ^= k >>> 33;
        k *= 0xff51afd7ed558ccdL;
        k ^= k >>> 33;
        k *= 0xc4ceb9fe1a85ec53L;
        k ^= k >>> 33;
        return k;
    }
}
