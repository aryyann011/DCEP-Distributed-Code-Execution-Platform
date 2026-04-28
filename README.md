# DCEP — Distributed Code Execution Platform

A high-performance, fault-tolerant system for executing untrusted C++ code securely using containerized sandboxing and asynchronous microservices.

---

## Overview

DCEP is designed to safely execute user-submitted code at scale, similar to backend systems used in platforms like LeetCode or Codeforces.

---

## Key Highlights

* Executes untrusted code inside **isolated Docker containers**
* Uses **Redis + BullMQ** for asynchronous job processing
* Prevents API blocking under heavy load via **queue-based architecture**
* Streams execution results in **real-time using WebSockets**
* Enforces strict sandbox constraints (CPU, memory, network, PID limits)

---

## Architecture

`Client` → `API Gateway` → `Redis Queue` → `Worker Node` → `Docker Sandbox`
Results are persisted in PostgreSQL and streamed via WebSockets.

---

## Design Decisions

* **Queue-based processing** prevents API bottlenecks under load
* **Docker over VMs** for faster startup and lower overhead
* **Stateless API** enables horizontal scaling

---

## Tech Stack

| Layer    | Technology        |
| :------- | :---------------- |
| API      | Node.js + Express |
| Queue    | Redis + BullMQ    |
| Worker   | Node.js           |
| Sandbox  | Docker            |
| Database | PostgreSQL        |
| Realtime | Socket.io         |

---

## Components

* **API Gateway:** Accepts submissions, stores initial state, pushes jobs to the queue, and handles WebSockets
* **Worker Node:** Consumes jobs, orchestrates Docker containers, updates the DB, and publishes results
* **Docker Sandbox:** Runs isolated code with zero network access and strict resource limits

---

## Database Schema

### users

| Field      | Type      |
| :--------- | :-------- |
| id         | UUID      |
| username   | VARCHAR   |
| created_at | TIMESTAMP |

### submissions

| Field          | Type      |
| :------------- | :-------- |
| id             | UUID      |
| user_id        | UUID      |
| language       | VARCHAR   |
| source_code    | TEXT      |
| status         | VARCHAR   |
| stdout         | TEXT      |
| stderr         | TEXT      |
| execution_time | FLOAT     |
| created_at     | TIMESTAMP |

---

## API Contracts

### Submit Code (`POST /api/submissions`)

**Request**

```json
{
  "language": "cpp",
  "source_code": "#include <iostream>\nint main(){return 0;}"
}
```

**Response**

```json
{
  "submission_id": "uuid-string",
  "status": "QUEUED"
}
```

---

### Get Result (`GET /api/submissions/:id`)

```json
{
  "status": "ACCEPTED",
  "stdout": "Hello",
  "execution_time": "12ms"
}
```

---

## Security & Sandbox Limits

| Resource | Limit    |
| :------- | :------- |
| Memory   | 256 MB   |
| CPU      | 0.5 core |
| Network  | Disabled |
| PIDs     | 50       |
| Timeout  | 2000 ms  |

---

## Folder Structure

```
/dcep
├── api-gateway
├── worker-node
├── docker-compose.yml
├── .env
└── README.md
```

---

## Local Setup

**Requirements:** Node.js (v18+), Docker, Redis, PostgreSQL.

### 1. Environment Variables (`.env`)

```
DATABASE_URL=postgresql://user:password@localhost:5432/dcep
REDIS_URL=redis://localhost:6379
```

### 2. Run Infrastructure

```
docker-compose up -d
```

### 3. Start API Gateway

```
cd api-gateway
npm install
npm run dev
```

### 4. Start Worker Node

```
cd worker-node
npm install
npm run dev
```

---

**Author:** Aryan Mishra
