import express from 'express';
import http from 'http';
import * as dotenv from 'dotenv';
import { initsocket } from './websocket/socket.js';
import { initsubscriber } from './redis/subscriber.js';
import submissionRoutes from './routes/submission.route.js'; 

dotenv.config();
const app = express();
app.use(express.json());

const httpServer = http.createServer(app);
const io = initsocket(httpServer)
const redis = initsubscriber(io);

app.use('/api', submissionRoutes);

const port = process.env.PORT || 3000;
httpServer.listen(port, () => {
    console.log(`🚀 Gateway online on port ${port}`);
});