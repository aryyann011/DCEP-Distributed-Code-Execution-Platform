import { Server } from "socket.io";

export const initsocket = (httpServer) => {

    const io = new Server(httpServer, {
        cors: { origin: "*" } 
    });

    io.on('connection', (socket) => {
        console.log(`🔌 New Pager Connected: ${socket.id}`);

        socket.on('subscribe-to-job', (jobId) => {
            socket.join(jobId);
            console.log(`Socket ${socket.id} joined Room: ${jobId}`);
        });
    });

    return io;
}