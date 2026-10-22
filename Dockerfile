# Multi-stage Dockerfile for Erode SSS Bank Deployment on Render
FROM maven:3.9.6-eclipse-temurin-17 AS builder

# Install Node.js 20 for frontend TypeScript build
RUN apt-get update && apt-get install -y curl && \
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

# Copy source trees
COPY common common
COPY data-tools data-tools
COPY bank-service bank-service
COPY baseline baseline
COPY gateway gateway
COPY frontend frontend

# Build frontend TypeScript bundle into gateway/src/main/resources/static
RUN cd frontend && npm run build

# Package all backend Java microservices
RUN mvn clean package -DskipTests

# =========================================================================
# Runtime Stage
# =========================================================================
FROM eclipse-temurin:17-jre-jammy

RUN apt-get update && apt-get install -y python3 sqlite3 procps && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled executable JARs from builder
COPY --from=builder /app/gateway/target/gateway-1.0.0-SNAPSHOT.jar gateway/target/
COPY --from=builder /app/bank-service/target/bank-service-1.0.0-SNAPSHOT.jar bank-service/target/

# Copy pre-seeded SQLite databases and runtime scripts from repository
COPY data/ data/
COPY scripts/ scripts/

# Setup execution permissions
RUN chmod +x scripts/start_render.sh

EXPOSE 8080

CMD ["/bin/sh", "scripts/start_render.sh"]
