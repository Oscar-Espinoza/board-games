import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { Rooms } from './rooms.js';
import type { ActionRequest, Reply } from '@board-games/shared';
export function attachSockets(server: HttpServer, rooms: Rooms) {
  const io = new Server(server, {
    maxHttpBufferSize: 16_384,
    serveClient: false,
  });
  const publish = (id: string) => {
    // Never broadcast the canonical state. Each socket gets its own projection.
    for (const socketId of rooms.sockets(id))
      io.to(socketId).emit('snapshot', rooms.view(id, socketId));
  };
  io.on('connection', (socket) => {
    let roomId: string | null = null;
    let count = 0;
    let window = Date.now();
    const handle = (name: string, fn: (request: any) => unknown) =>
      socket.on(name, (request: unknown, ack: unknown) => {
        if (typeof ack !== 'function') return;
        const reply = ack as (value: Reply<unknown>) => void;
        try {
          if (Date.now() - window > 1000) {
            count = 0;
            window = Date.now();
          }
          if (++count > 30) throw new Error('Please slow down');
          if (!request || typeof request !== 'object' || Array.isArray(request))
            throw new Error('Invalid request');
          const data = fn(request);
          reply({ ok: true, data });
        } catch (error) {
          reply({
            ok: false,
            error: error instanceof Error ? error.message : 'Invalid request',
          });
        }
        if (roomId) publish(roomId);
      });
    handle('create', (request) => {
      const credentials = rooms.create(socket.id, request);
      roomId = credentials.roomId;
      void socket.join(roomId);
      return credentials;
    });
    handle('join', (request) => {
      const result = rooms.join(socket.id, request);
      if (result.replacedSocket)
        io.sockets.sockets.get(result.replacedSocket)?.disconnect(true);
      roomId = result.credentials.roomId;
      void socket.join(roomId);
      return result.credentials;
    });
    handle('start', () => {
      if (!roomId) throw new Error('Join first');
      rooms.start(roomId, socket.id);
    });
    handle('action', (request: ActionRequest) => {
      if (!roomId) throw new Error('Join first');
      rooms.action(roomId, socket.id, request);
    });
    socket.on('disconnect', () => {
      const id = rooms.disconnect(socket.id);
      if (id) publish(id);
    });
  });
  const interval = setInterval(() => {
    for (const id of rooms.sweep()) publish(id);
  }, 1000);
  interval.unref();
  const bots = setInterval(() => {
    for (const id of rooms.advanceBots()) publish(id);
  }, 300);
  bots.unref();
  server.once('close', () => {
    clearInterval(interval);
    clearInterval(bots);
  });
  return io;
}
