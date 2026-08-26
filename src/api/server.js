import express from 'express';
import http from 'http';
import * as dotenv from 'dotenv';
import { initsocket } from './websocket/socket.js';
import { initsubscriber } from './redis/subscriber.js';
import submissionRoutes from './routes/submission.route.js'; 
import cors from 'cors';

import { query } from '../shared/database/db.js';
import { connection as redisConnection } from '../shared/queues/connection.js';
import { logger } from '../shared/utils/logger.js';
import { RedisConnection } from 'bullmq';

dotenv.config();
const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get("/health", async(req, res) => {
    try {
        await query("select 1")

        const redisStatus = redisConnection.status;
        if(redisStatus !== 'ready'){
            throw new Error(`Redis is not ready. Current status : ${redisStatus}`)
        }

        res.status(200).json({
            status: 'OK',
            message: 'Gateway, Database, and Redis are online and healthy'
        });
    } catch (error) {
        logger.error({err: error}, 'Health check failed')
        res.status(503).json({
            status: 'ERROR',
            message: 'Service Unavailable',
            details: error.message
        });
    }
});

const httpServer = http.createServer(app);
const io = initsocket(httpServer)
const redis = initsubscriber(io);
app.use('/api', submissionRoutes);

const port = process.env.PORT || 3000;
httpServer.listen(port, () => {
    console.log(`🚀 Gateway online on port ${port}`);
});