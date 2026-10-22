# Multi-stage Dockerfile for Erode SSS Bank Deployment on Render
FROM maven:3.9.6-eclipse-temurin-17 AS builder

# Install Node.js 20 for frontend TypeScript build
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

WORKDIR /app

# Copy project manifests
COPY pom.xml ./
COPY common/pom.xml common/
COPY bank-service/pom.xml bank-service/
COPY baseline/pom.xml baseline/
COPY gateway/pom.xml gateway/
COPY frontend/package*.json frontend/

# Install frontend npm dependencies
RUN cd frontend && npm install

# Copy all source trees
COPY common common
COPY bank-service bank-service
COPY baseline baseline
COPY gateway gateway
COPY frontend frontend

# Build frontend TypeScript SPA into gateway/src/main/resources/static
RUN cd frontend && npm run build

# Package backend Spring Boot microservices
RUN mvn clean package -DskipTests

# Runtime Stage
FROM eclipse-temurin:17-jre-jammy

RUN apt-get update && apt-get install -y python3 sqlite3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled executable jars from builder
COPY --from=builder /app/gateway/target/gateway-1.0.0-SNAPSHOT.jar gateway/target/
COPY --from=builder /app/bank-service/target/bank-service-1.0.0-SNAPSHOT.jar bank-service/target/

# Copy orchestration scripts and initial seed data
COPY scripts/ scripts/
COPY data/ data/

# Setup execution permissions
RUN chmod +x scripts/start_render.sh

EXPOSE 8080

CMD ["/bin/sh", "scripts/start_render.sh"]
