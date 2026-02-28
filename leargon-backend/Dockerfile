# Build stage — Liberica NIK (GraalVM-based JDK 21 with native-image on musl/Alpine)
FROM bellsoft/liberica-native-image-kit-container:jdk-21-nik-23-musl AS build

WORKDIR /app

# Copy gradle wrapper and build files
COPY gradle gradle
COPY gradlew gradlew.bat gradle.properties build.gradle settings.gradle ./

# Copy source code
COPY src src

# Compile to native binary using Micronaut AOT-optimized native image
RUN sed -i 's/\r//' gradlew && chmod +x gradlew && ./gradlew nativeOptimizedCompile --no-daemon -x test

# Runtime stage — minimal Alpine image (no JVM required)
FROM alpine:3.21

RUN apk upgrade --no-cache && apk add --no-cache libstdc++

WORKDIR /app

# Copy the native binary from build stage
COPY --from=build /app/build/native/nativeOptimizedCompile/leargon-backend .

# Expose the default Micronaut port
EXPOSE 8080

# Run the native binary directly — no JVM flags needed
ENTRYPOINT ["./leargon-backend"]
