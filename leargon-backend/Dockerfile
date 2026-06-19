FROM eclipse-temurin:25-jdk-alpine AS build

ARG APP_VERSION=vdev

WORKDIR /app

COPY gradle gradle
COPY gradlew gradlew.bat gradle.properties build.gradle settings.gradle ./
COPY src src

RUN sed -i 's/\r//' gradlew && chmod +x gradlew && ./gradlew shadowJar --no-daemon -x test -Pversion=${APP_VERSION}

FROM eclipse-temurin:25-jre-alpine

RUN apk upgrade --no-cache && apk add --no-cache wget

WORKDIR /app

COPY --from=build /app/build/libs/leargon-backend-*-all.jar app.jar

RUN addgroup -S leargon && adduser -S leargon -G leargon && \
    mkdir -p /app/logs && chown -R leargon:leargon /app

USER leargon

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
