# Multi-stage Dockerfile for Erode SSS Bank Deployment on Render
FROM maven:3.9.6-eclipse-temurin-17 AS builder

# Install Node.js 20 and Python 3 for build-time operations
RUN apt-get update && apt-get install -y curl python3 sqlite3 && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Maven POMs
COPY pom.xml ./
COPY common/pom.xml common/
COPY data-tools/pom.xml data-tools/
COPY bank-service/pom.xml bank-service/
COPY baseline/pom.xml baseline/
COPY gateway/pom.xml gateway/
COPY frontend/package*.json frontend/

# Install frontend dependencies
RUN cd frontend && npm install

# Copy source code and scripts
COPY common common
COPY data-tools data-tools
COPY bank-service bank-service
COPY baseline baseline
COPY gateway gateway
COPY frontend frontend
COPY scripts scripts

# Build frontend TypeScript bundle
RUN cd frontend && npm run build

# Build all backend Java microservices
RUN mvn clean package -DskipTests

# Seed and replicate sharded database cluster inside builder
RUN python3 scripts/init_all_dbs.py && python3 scripts/replicate_demo_accounts.py

# =========================================================================
# Runtime Stage
# =========================================================================
FROM eclipse-temurin:17-jre-jammy

RUN apt-get update && apt-get install -y python3 sqlite3 procps && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled executable JARs from builder
COPY --from=builder /app/gateway/target/gateway-1.0.0-SNAPSHOT.jar gateway/target/
COPY --from=builder /app/bank-service/target/bank-service-1.0.0-SNAPSHOT.jar bank-service/target/

# Copy pre-seeded database cluster and scripts
COPY --from=builder /app/data /app/data
COPY scripts/ scripts/

# Setup execution permissions
RUN chmod +x scripts/start_render.sh

EXPOSE 8080

CMD ["/bin/sh", "scripts/start_render.sh"]
