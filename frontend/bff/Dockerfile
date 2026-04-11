FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /workspace
COPY frontend/bff/pom.xml frontend/bff/pom.xml
COPY frontend/bff/src frontend/bff/src
RUN mvn -f frontend/bff/pom.xml -DskipTests package

FROM eclipse-temurin:17-jre-jammy

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /workspace/frontend/bff/target/bff-0.0.1-SNAPSHOT.jar /app/app.jar

EXPOSE 9083
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
