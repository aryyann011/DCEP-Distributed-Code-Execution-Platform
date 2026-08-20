import { redisPublisher } from "../shared/queues/connection.js";

export const broadcastProgress = (jobId, payload) => {
    // Automatically injects the jobId and stringifies the payload
    redisPublisher.publish('job-progress', JSON.stringify({ 
        jobId, 
        ...payload 
    }));
};

export const broadcastResult = (jobId, payload) => {
    redisPublisher.publish('job-results', JSON.stringify({ 
        jobId, 
        ...payload 
    }));
};