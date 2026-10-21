#!/usr/bin/env bash
set -e

SHARDS=${1:-3}
DATA_DIR=${2:-"./data"}
CUSTOMERS=${3:-1000}
ACCOUNTS=${4:-2000}
TRANSACTIONS=${5:-10000}

echo "=========================================================="
echo "Initializing Database Shards for Online Banking Prototype"
echo "=========================================================="

mkdir -p "$DATA_DIR"

echo "Building project and installing modules..."
mvn clean install -DskipTests

echo "Running Synthetic Data Generator..."
mvn exec:java -pl data-tools -Dexec.mainClass="com.banking.datatools.DataGeneratorCli" -Dexec.args="--shards $SHARDS --data-dir $DATA_DIR --customers $CUSTOMERS --accounts $ACCOUNTS --transactions $TRANSACTIONS"

echo "Shard initialization complete!"
ls -lh "$DATA_DIR"/*.db
