# Build stage
FROM gradle:8.5-jdk21 AS build

WORKDIR /app

# Copy gradle files
COPY build.gradle settings.gradle gradle.properties ./
COPY gradle gradle

# Copy source code
COPY src src

# Build the application
RUN gradle clean build --no-daemon -x test

# Runtime stage
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Copy the built jar from build stage
COPY --from=build /app/build/libs/*-all.jar app.jar

# Expose the default Micronaut port
EXPOSE 8080

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
