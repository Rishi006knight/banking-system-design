#!/bin/sh
set -e

# Unset any conflicting environment variables passed by the container host
unset JAVA_TOOL_OPTIONS

echo "=== Starting Erode SSS Bank Core Services on Render (Low-Memory Profile) ==="

mkdir -p .tmp logs data

# Optimized low-footprint JVM parameters for 512MB cgroup container:
# - SerialGC: near-zero native memory overhead (unlike G1GC which eats 150MB+ for 4 JVMs)
# - TieredStopAtLevel=1: stops JIT at C1 client compiler, cutting startup memory & CPU
# - Xss256k: reduces thread stack size from default 1024k to 256k
# - MaxMetaspaceSize=64m: caps native class metadata footprint
# - Low tomcat spare threads: avoids allocating dozens of idle worker threads per microservice
JVM_COMMON="-XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xss256k -XX:MaxMetaspaceSize=64m -Djava.io.tmpdir=.tmp -Dorg.sqlite.tmpdir=.tmp -Dlogging.level.com.banking=INFO -Dserver.tomcat.threads.min-spare=4 -Dserver.tomcat.threads.max=20 -Dserver.tomcat.accept-count=20"

# Launch backend cluster shard nodes (20MB initial, 40MB max heap each)
echo "Launching Node 1 (:8081)..."
java $JVM_COMMON -Xms20m -Xmx40m -Dserver.port=8081 -Dbanking.node-id=1 -Dbanking.shards.db-path=./data/bank-shard-0.db -Dbanking.cache.max-capacity=1000 -jar bank-service/target/bank-service-1.0.0-SNAPSHOT.jar > logs/node-8081.log 2>&1 &

sleep 2

echo "Launching Node 2 (:8082)..."
java $JVM_COMMON -Xms20m -Xmx40m -Dserver.port=8082 -Dbanking.node-id=2 -Dbanking.shards.db-path=./data/bank-shard-1.db -Dbanking.cache.max-capacity=1000 -jar bank-service/target/bank-service-1.0.0-SNAPSHOT.jar > logs/node-8082.log 2>&1 &

sleep 2

echo "Launching Node 3 (:8083)..."
java $JVM_COMMON -Xms20m -Xmx40m -Dserver.port=8083 -Dbanking.node-id=3 -Dbanking.shards.db-path=./data/bank-shard-2.db -Dbanking.cache.max-capacity=1000 -jar bank-service/target/bank-service-1.0.0-SNAPSHOT.jar > logs/node-8083.log 2>&1 &

sleep 2

# Launch Gateway on Render's assigned PORT (32MB initial, 96MB max heap)
GATEWAY_PORT=${PORT:-8080}
echo "Launching API Gateway on port ${GATEWAY_PORT} (listening on 0.0.0.0)..."
exec java $JVM_COMMON -Xms32m -Xmx96m -Dserver.port=${GATEWAY_PORT} -Dserver.address=0.0.0.0 -jar gateway/target/gateway-1.0.0-SNAPSHOT.jar
