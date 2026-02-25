# Build stage — use Temurin JDK + Gradle wrapper for version consistency
FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /app

# Copy gradle wrapper and build files
COPY gradle gradle
COPY gradlew gradlew.bat gradle.properties build.gradle settings.gradle ./

# Copy source code
COPY src src

# Build the application (wrapper downloads Gradle 8.14.3 on first run)
RUN sed -i 's/\r//' gradlew && chmod +x gradlew && ./gradlew clean build --no-daemon -x test

# Runtime stage
FROM eclipse-temurin:25-jre-alpine

RUN apk upgrade --no-cache

WORKDIR /app

# Copy the built jar from build stage
COPY --from=build /app/build/libs/*-all.jar app.jar

# Expose the default Micronaut port
EXPOSE 8080

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
