import IORedis from 'ioredis';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT || 6379;

export const connection = new IORedis({ host: redisHost, port: redisPort, maxRetriesPerRequest: null });
export const redisPublisher = new IORedis({ host: redisHost, port: redisPort });