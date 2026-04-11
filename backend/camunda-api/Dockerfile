FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /workspace
COPY backend/camunda-api/pom.xml backend/camunda-api/pom.xml
COPY backend/camunda-api/src backend/camunda-api/src
RUN mvn -f backend/camunda-api/pom.xml -DskipTests package

FROM eclipse-temurin:17-jre-jammy

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /workspace/backend/camunda-api/target/camunda-api-0.0.1-SNAPSHOT.jar /app/app.jar

EXPOSE 9081
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
