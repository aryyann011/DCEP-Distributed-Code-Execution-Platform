import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
// You still need to import your controllers and IORedis here

const app = express();
app.use(express.json());

// --- THE BOILERPLATE ---
// 1. Wrap the Express app inside a raw Node.js HTTP server
const httpServer = http.createServer(app);

// 2. Attach Socket.io to that raw HTTP server
const io = new Server(httpServer, {
    cors: { origin: "*" } // Required so Postman doesn't get blocked
});

// 3. Listen for users connecting their pagers
io.on('connection', (socket) => {
    console.log(`🔌 New Pager Connected: ${socket.id}`);
    
    // (Your logic to assign them to a room based on jobId will go here)
});

// 4. INSTEAD of app.listen, we start the httpServer
httpServer.listen(3000, () => {
    console.log('🚀 Gateway online on port 3000');
});