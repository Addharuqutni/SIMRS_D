import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useSocket = (room?: string) => {
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        const socket = io(SOCKET_URL, {
            withCredentials: true,
        });

        socket.on('connect', () => {
            setIsConnected(true);
            if (room) {
                socket.emit('join_room', room);
            }
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, [room]);

    return { socket: socketRef.current, isConnected };
};
