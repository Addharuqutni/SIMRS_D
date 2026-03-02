import { Server, Socket } from 'socket.io';
import http from 'http';
import { logger } from './utils/logger';

let io: Server;

export const initSocket = (server: http.Server, allowedOrigins: string[]) => {
    io = new Server(server, {
        cors: {
            origin: allowedOrigins,
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    io.on('connection', (socket: Socket) => {
        logger.info(`🔌 Client connected: ${socket.id}`);

        socket.on('join_room', (room: string) => {
            socket.join(room);
            logger.debug(`Socket ${socket.id} joined room ${room}`);
        });

        socket.on('disconnect', () => {
            logger.info(`❌ Client disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io is not initialized!');
    }
    return io;
};
