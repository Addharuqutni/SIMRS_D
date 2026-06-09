import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useSocket = (room?: string) => {
    const [isConnected, setIsConnected] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        const nextSocket = io(SOCKET_URL, {
            withCredentials: true,
        });

        nextSocket.on('connect', () => {
            setIsConnected(true);
            if (room) {
                nextSocket.emit('join_room', room);
            }
        });

        nextSocket.on('disconnect', () => {
            setIsConnected(false);
        });

        setSocket(nextSocket);

        return () => {
            nextSocket.disconnect();
            setSocket(null);
        };
    }, [room]);

    return { socket, isConnected };
};
