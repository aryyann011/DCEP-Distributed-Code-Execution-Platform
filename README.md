# Distributed Code Execution Platform (DCEP) - V1

A decoupled proof-of-concept backend for remote C++ compilation and execution. 

This system separates the API ingestion layer from the execution environment to prevent main-thread blocking and ensure horizontal fault tolerance. Code submissions are pushed to a Redis message broker, processed asynchronously by isolated Node.js workers, and executed inside ephemeral Docker sandboxes.

## Current Architecture
* **API Gateway:** Express.js + Socket.io
* **Message Queue:** BullMQ + Redis
* **Execution Engine:** Node.js Worker + Dockerode API
* **Event Broadcasting:** Redis Pub/Sub

## Local Setup
1. Ensure Docker and Redis are running.
2. Clone the repository and run `npm install`.
3. Copy `.env.example` to `.env` and configure your ports.
4. Start the API Gateway: `node server.js`
5. Start the Execution Worker: `node worker.js`