#!/bin/sh
set -e

echo "=== Starting Erode SSS Bank Core Services on Render ==="

mkdir -p .tmp logs data

# Seed databases if missing
if [ ! -f data/bank-shard-0.db ] || [ ! -f data/bank-shard-1.db ] || [ ! -f data/bank-shard-2.db ]; then
    echo "Seeding cluster SQLite databases..."
    python3 scripts/init_all_dbs.py || true
    python3 scripts/replicate_demo_accounts.py || true
fi

# Launch backend cluster shard nodes
echo "Launching Node 1 (:8081)..."
java -Djava.io.tmpdir=.tmp -Dserver.port=8081 -Dbanking.node-id=1 -Dbanking.shards.db-path=./data/bank-shard-0.db -Xmx128m -jar bank-service/target/bank-service-1.0.0-SNAPSHOT.jar > logs/node-8081.log 2>&1 &

echo "Launching Node 2 (:8082)..."
java -Djava.io.tmpdir=.tmp -Dserver.port=8082 -Dbanking.node-id=2 -Dbanking.shards.db-path=./data/bank-shard-1.db -Xmx128m -jar bank-service/target/bank-service-1.0.0-SNAPSHOT.jar > logs/node-8082.log 2>&1 &

echo "Launching Node 3 (:8083)..."
java -Djava.io.tmpdir=.tmp -Dserver.port=8083 -Dbanking.node-id=3 -Dbanking.shards.db-path=./data/bank-shard-2.db -Xmx128m -jar bank-service/target/bank-service-1.0.0-SNAPSHOT.jar > logs/node-8083.log 2>&1 &

# Brief pause for internal socket readiness
sleep 3

# Launch Gateway on Render's assigned PORT
GATEWAY_PORT=${PORT:-8080}
echo "Launching API Gateway on port ${GATEWAY_PORT}..."
exec java -Djava.io.tmpdir=.tmp -Dserver.port=${GATEWAY_PORT} -Xmx256m -jar gateway/target/gateway-1.0.0-SNAPSHOT.jar
