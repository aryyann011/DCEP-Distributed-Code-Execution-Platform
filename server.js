import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import IORedis from 'ioredis';
import * as dotenv from 'dotenv';

import submissionRoutes from './routes/submission.route.js'; 

dotenv.config();
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
        
        const { jobId, status, executionTime, error } = parsedMessage;

        console.log(`[${jobId}] Intercom received! Verdict: ${status}`);
        
        io.to(jobId).emit('evaluation-complete', { 
            status: status,
            executionTime: executionTime,
            error: error || null
        });
    }
});

io.on('connection', (socket) => {
    console.log(`🔌 New Pager Connected: ${socket.id}`);

    socket.on('subscribe-to-job', (jobId) => {
        socket.join(jobId);
        console.log(`Socket ${socket.id} joined Room: ${jobId}`);
    });
});

app.use('/api', submissionRoutes);

const port = process.env.PORT || 3000;
httpServer.listen(port, () => {
    console.log(`🚀 Gateway online on port ${port}`);
});