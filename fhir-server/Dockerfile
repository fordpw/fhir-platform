FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests -B

FROM eclipse-temurin:17-jre

# SyntheaService invokes Synthea as a `java -jar` subprocess, so the JAR must
# exist inside this image. Pinned to a tagged release for reproducible builds;
# override with --build-arg SYNTHEA_VERSION=... if needed.
ARG SYNTHEA_VERSION=v4.0.0
ARG SYNTHEA_URL=https://github.com/synthetichealth/synthea/releases/download/${SYNTHEA_VERSION}/synthea-with-dependencies.jar

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /opt/synthea \
    && curl -fsSL --retry 3 -o /opt/synthea/synthea-with-dependencies.jar "${SYNTHEA_URL}" \
    && test -s /opt/synthea/synthea-with-dependencies.jar

WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

# Consumed by application.yaml (app.synthea.*)
ENV SYNTHEA_JAR_PATH=/opt/synthea/synthea-with-dependencies.jar \
    SYNTHEA_OUTPUT_DIR=/app/output

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
