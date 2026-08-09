import IORedis from 'ioredis';

export const initsubscriber = (io) => {
    const redisHost = process.env.REDIS_HOST || '127.0.0.1';
    const redisPort = process.env.REDIS_PORT || 6379;
    const redisSubscriber = new IORedis({ host: redisHost, port: redisPort });

    redisSubscriber.subscribe('job-results', 'job-progress', (err, count) => {
        if (err) {
            console.error("Failed to subscribe:", err);
        } else {
            console.log(`🎧 Gateway listening to ${count} Redis channel(s).`);
        }
    });

    redisSubscriber.on('message', (channel, message) => {
        const data = JSON.parse(message);

        if (channel === 'job-progress') {
            console.log(`[${data.jobId}] Progress: ${data.stage}`);
            io.to(data.jobId).emit('job-progress', data);
        }

        if (channel === 'job-results') {
            const { jobId, status, executionTime, error } = data;
            console.log(`[${jobId}] Verdict: ${status}`);
            io.to(jobId).emit('evaluation-complete', {
                status,
                executionTime,
                error: error || null,
            });
        }
    });
}