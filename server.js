import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import IORedis from 'ioredis';
import { RunTheCode } from './controllers/submission.controller.js'; 
import * as dotenv from 'dotenv'

dotenv.config()
const app = express();
app.use(express.json());

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: { origin: "*" } 
});

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT || 6379;
const redisSubscriber = new IORedis({ host: redisHost, port: redisPort });

redisSubscriber.subscribe('job-results', (err, count) => {
    if (err) {
        console.error("Failed to tune radio:", err);
    } else {
        console.log(`🎧 Gateway is listening to ${count} Redis channel(s).`);
    }
});

redisSubscriber.on('message', (channel, message) => {
    if (channel === 'job-results') {
        const parsedMessage = JSON.parse(message);
        const jobId = parsedMessage.jobId;
        const output = parsedMessage.output;

        console.log(`[${jobId}] Intercom received! Paging the user...`);
        
        io.to(jobId).emit('output', { output: output });
    }
});

io.on('connection', (socket) => {
    console.log(`🔌 New Pager Connected: ${socket.id}`);

    socket.on('subscribe-to-job', (jobId) => {
        socket.join(jobId);
        console.log(`Socket ${socket.id} joined Room: ${jobId}`);
    });
});

app.post('/api/submission', RunTheCode);

const port = process.env.PORT || 3000;
httpServer.listen(port, () => {
    console.log(`🚀 Gateway online on port ${port}`);
});