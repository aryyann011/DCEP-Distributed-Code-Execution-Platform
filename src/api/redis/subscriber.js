import IORedis from 'ioredis';

export const initsubscriber = (io) => {
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
}