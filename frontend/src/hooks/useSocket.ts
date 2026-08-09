import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ConnectionStatus, JobStatus, Verdict, ExecutionResult } from '../types';

export function useSocket() {
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
    const socketRef = useRef<Socket | null>(null);

    const onProgressCallback = useRef<((data: any) => void) | null>(null);
    const onCompleteCallback = useRef<((data: any) => void) | null>(null);

    useEffect(() => {
        setConnectionStatus('connecting');
        
        const socket = io('/', { path: '/socket.io' });
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnectionStatus('connected');
        });

        socket.on('disconnect', () => {
            setConnectionStatus('disconnected');
        });

        socket.on('connect_error', () => {
            setConnectionStatus('disconnected');
        });

        socket.on('job-progress', (data) => {
            if (onProgressCallback.current) {
                onProgressCallback.current(data);
            }
        });

        socket.on('evaluation-complete', (data) => {
            if (onCompleteCallback.current) {
                onCompleteCallback.current(data);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const subscribeToJob = useCallback((jobId: string) => {
        if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('subscribe-to-job', jobId);
        }
    }, []);

    const onProgress = useCallback((cb: (data: any) => void) => {
        onProgressCallback.current = cb;
    }, []);

    const onComplete = useCallback((cb: (data: any) => void) => {
        onCompleteCallback.current = cb;
    }, []);

    return {
        connectionStatus,
        subscribeToJob,
        onProgress,
        onComplete
    };
}
