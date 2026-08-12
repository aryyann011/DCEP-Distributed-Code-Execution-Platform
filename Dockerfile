FROM alpine:latest
WORKDIR /app
RUN apk add --no-cache g++ python3 openjdk17-jdk