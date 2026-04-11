FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /workspace
COPY backend/camunda-engine/pom.xml backend/camunda-engine/pom.xml
COPY backend/camunda-engine/src backend/camunda-engine/src
RUN mvn -f backend/camunda-engine/pom.xml -DskipTests package

FROM eclipse-temurin:17-jre-jammy

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /workspace/backend/camunda-engine/target/camunda-engine-0.0.1-SNAPSHOT.jar /app/app.jar

EXPOSE 9080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
