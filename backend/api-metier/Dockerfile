FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /workspace
COPY backend/api-metier/pom.xml backend/api-metier/pom.xml
COPY backend/api-metier/src backend/api-metier/src
RUN mvn -f backend/api-metier/pom.xml -DskipTests package

FROM eclipse-temurin:17-jre-jammy

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /workspace/backend/api-metier/target/api-metier-0.0.1-SNAPSHOT.jar /app/app.jar

EXPOSE 9082
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
