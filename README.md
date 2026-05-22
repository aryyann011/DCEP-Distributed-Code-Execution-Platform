# Distributed Code Execution Engine

A decoupled, scalable remote code execution (RCE) API. This system processes untrusted C++ code in ephemeral, hardened Docker sandboxes. It utilizes a Redis-backed message queue to manage concurrent load and a Pub/Sub WebSocket bridge to stream execution results directly to the client, eliminating the need for synchronous HTTP polling.

## 🛠️ Tech Stack

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![C++](https://img.shields.io/badge/C++-00599C?style=for-the-badge&logo=cplusplus&logoColor=white)

## 🏗️ System Architecture

The architecture is split into two isolated Node.js processes communicating strictly through Redis:

1. **API Gateway (`server.js`):** Handles incoming HTTP traffic, enqueues jobs, and manages persistent WebSocket connections.
2. **Execution Worker (`worker.js`):** Consumes jobs from the queue, provisions Docker containers, compiles/executes the payload, and enforces strict security constraints.

```text
[Client] 
   │
   ├── (1) POST /api/submission ──► [Express API] ──► (2) Push Job ──► [Redis Queue]
   │                                     │                                 │
   ├── (5) Connect WebSocket             │                                 ▼
   │                                     │                         (3) Pull Job
   ▼                                     ▼                                 │
[Socket.io Room] ◄── (7) Push Output ── [Redis Pub/Sub] ◄── (4) Execute ── [Node Worker]
                                                                           │
                                                                           ▼
                                                                   [Docker Sandbox]

```

## ⚡ Core Infrastructure

* **Asynchronous Task Queuing:** Built with BullMQ. The API Gateway never waits for code compilation. Jobs are instantly queued, preventing server memory exhaustion during high traffic spikes.
* **Ephemeral Containerization:** Every job is executed inside a fresh, isolated `cpp-sandbox` Docker container and immediately destroyed upon completion.
* **Real-Time Delivery:** The worker publishes execution outputs to a Redis intercom (`job-results` channel). The API Gateway listens to this channel and routes the data to the specific WebSocket room associated with the job ID.
* **Security & Resource Constraints:**
* **Memory Limit:** Containers are hard-capped at 256MB of RAM.
* **Network Isolation:** Containers run with `NetworkMode: 'none'` to prevent outbound requests.
* **Execution Timeouts:** A `Promise.race` implementation enforces a strict 2000ms CPU timeout. Rogue processes (e.g., infinite `while(true)` loops) are forcefully terminated via `SIGKILL`.



---

## 📖 API Documentation

### 1. Submit Code (HTTP POST)

Enqueues the C++ code for execution.

**Endpoint:** `POST /api/submission`

**Headers:** `Content-Type: application/json`

**Request Payload:**

```json
{
  "code": "#include <iostream>\nint main() {\n  std::cout << \"Hello World\";\n  return 0;\n}"
}

```

**Response (200 OK):**

```json
{
  "jobId": "ab2be2c4-60e7-479f-9d52-ba931913712b",
  "status": "queued"
}

```

### 2. Receive Output (WebSocket)

Connect to the Socket.io server to receive the output asynchronously.

**Connection URL:** `ws://localhost:3000`

**Emit Event:**
To subscribe to a specific job result, emit the following event with the raw UUID string:

* **Event Name:** `subscribe-to-job`
* **Data:** `"ab2be2c4-60e7-479f-9d52-ba931913712b"`

**Listen Event:**
Listen for the `output` event to receive the execution result or timeout errors.

```json
{
  "output": "Hello World"
}

```

*(Note: System errors such as `Error : Execution Time Limit Exceeded(2.0s)` will also be routed through this event).*

---

## 🚀 Local Deployment

**Prerequisites:** Docker and Redis must be running locally.

**1. Start the Execution Worker:**

```bash
node worker.js

```

**2. Start the API Gateway:**

```bash
node server.js

```

*The system is now ready to accept HTTP traffic on port 3000 and WebSocket connections.*

```

```
