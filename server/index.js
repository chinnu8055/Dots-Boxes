import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 3001;
const ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const ALLOWED_ORIGINS = ORIGIN.split(',').map((value) => value.trim()).filter(Boolean);

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true
  }
});

const rooms = new Map();

const createRoom = (type, idOverride) => {
  const id = idOverride || `room-${Math.random().toString(36).slice(2, 10)}`;
  const room = {
    id,
    type,
    vacant: true,
    players: [],
    config: null
  };
  rooms.set(id, room);
  return room;
};

const roomIdFromCode = (code) => `code-${code}`;

const findRoomBySocketId = (socketId) => {
  for (const room of rooms.values()) {
    const index = room.players.findIndex((player) => player.id === socketId);
    if (index !== -1) return { room, index };
  }
  return null;
};

const findVacantRoom = () => {
  for (const room of rooms.values()) {
    if (room.vacant && room.type === 'quickplay') return room;
  }
  return null;
};

const emitRoomUpdate = (room) => {
  io.to(room.id).emit('room:update', {
    roomId: room.id,
    vacant: room.vacant,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score
    }))
  });
};

const removePlayerFromRoom = (
  socketId,
  {
    notifyOpponent = true,
    deleteRoomOnLeave = false
  } = {}
) => {
  for (const room of rooms.values()) {
    const index = room.players.findIndex((player) => player.id === socketId);
    if (index === -1) continue;

    room.players.splice(index, 1);
    room.vacant = room.players.length < 2;
    if (room.players.length === 0) {
      rooms.delete(room.id);
      return;
    }

    if (notifyOpponent) {
      io.to(room.id).except(socketId).emit('game:opponentLeft');
    }

    if (deleteRoomOnLeave) {
      rooms.delete(room.id);
    } else {
      emitRoomUpdate(room);
    }
    return;
  }
};

io.on('connection', (socket) => {
  socket.on('quickplay:join', ({ name }) => {
    removePlayerFromRoom(socket.id, { notifyOpponent: false, deleteRoomOnLeave: false });
    const room = findVacantRoom() || createRoom('quickplay');

    const existing = room.players.find((player) => player.id === socket.id);
    if (!existing) {
      room.players.push({
        id: socket.id,
        name: name || 'Player',
        score: 0
      });
    }

    room.vacant = room.players.length < 2;

    socket.join(room.id);
    emitRoomUpdate(room);

    const playerNumber = room.players.findIndex((player) => player.id === socket.id) + 1;

    if (room.players.length === 2) {
      io.to(room.id).emit('quickplay:matched', {
        roomId: room.id,
        players: room.players.map((player, index) => ({
          id: player.id,
          name: player.name,
          score: player.score,
          playerNumber: index + 1
        })),
        vacant: room.vacant
      });
    } else {
      socket.emit('quickplay:waiting', {
        roomId: room.id,
        playerNumber
      });
    }
  });

  socket.on('quickplay:cancel', () => {
    removePlayerFromRoom(socket.id, { notifyOpponent: false, deleteRoomOnLeave: true });
  });

  socket.on('room:create', ({ code, name }) => {
    if (!code) {
      socket.emit('room:error', { message: 'Invalid room code.' });
      return;
    }

    const roomId = roomIdFromCode(code);
    const existing = rooms.get(roomId);
    if (existing && existing.players.length > 0) {
      if (existing.players.length === 1 && existing.players[0].id === socket.id) {
        socket.join(existing.id);
        socket.emit('room:waiting', { roomId: existing.id, playerNumber: 1 });
        return;
      }
      socket.emit('room:error', { message: 'Room already exists. Try another code.' });
      return;
    }

    removePlayerFromRoom(socket.id, { notifyOpponent: false, deleteRoomOnLeave: false });
    const room = existing || createRoom('code', roomId);
    room.players = [{ id: socket.id, name: name || 'Player', score: 0 }];
    room.vacant = true;
    socket.join(room.id);
    emitRoomUpdate(room);

    socket.emit('room:waiting', { roomId: room.id, playerNumber: 1 });
  });

  socket.on('room:join', ({ code, name }) => {
    if (!code) {
      socket.emit('room:error', { message: 'Invalid room code.' });
      return;
    }

    const roomId = roomIdFromCode(code);
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('room:error', { message: 'Room not found.' });
      return;
    }

    if (room.players.some((player) => player.id === socket.id)) {
      socket.emit('room:waiting', { roomId: room.id, playerNumber: 1 });
      return;
    }

    if (!room.vacant || room.players.length >= 2) {
      socket.emit('room:error', { message: 'Room is full.' });
      return;
    }

    removePlayerFromRoom(socket.id, { notifyOpponent: false, deleteRoomOnLeave: false });
    room.players.push({ id: socket.id, name: name || 'Player', score: 0 });
    room.vacant = false;
    socket.join(room.id);
    emitRoomUpdate(room);

    if (room.config) {
      io.to(room.id).emit('game:config', room.config);
    }

    io.to(room.id).emit('room:matched', {
      roomId: room.id,
      players: room.players.map((player, index) => ({
        id: player.id,
        name: player.name,
        score: player.score,
        playerNumber: index + 1
      }))
    });
  });

  socket.on('room:cancel', () => {
    removePlayerFromRoom(socket.id, { notifyOpponent: false, deleteRoomOnLeave: true });
  });

  socket.on('game:leave', () => {
    removePlayerFromRoom(socket.id, { notifyOpponent: true, deleteRoomOnLeave: true });
  });

  socket.on('game:move', ({ roomId, lineId, player }) => {
    if (!roomId) return;
    socket.to(roomId).emit('game:move', { lineId, player });
  });

  socket.on('game:nameUpdate', ({ roomId, player, name }) => {
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (room) {
      const target = room.players[player - 1];
      if (target) {
        target.name = name;
        emitRoomUpdate(room);
      }
    }
    socket.to(roomId).emit('game:nameUpdate', { player, name });
  });

  socket.on('game:timerSync', ({ roomId, timeLeft, currentPlayer }) => {
    if (!roomId) return;
    socket.to(roomId).emit('game:timerSync', { timeLeft, currentPlayer });
  });

  socket.on('game:config', ({ roomId, turnTime, gridSize }) => {
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.config = { turnTime, gridSize };
    io.to(roomId).emit('game:config', { turnTime, gridSize });
  });

  socket.on('game:playAgain', ({ roomId }) => {
    if (!roomId) return;
    io.to(roomId).emit('game:playAgain');
  });

  socket.on('disconnect', () => {
    removePlayerFromRoom(socket.id, { notifyOpponent: true, deleteRoomOnLeave: true });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(', ') || 'none'}`);
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

server.listen(PORT, () => {
  console.log(`Socket.IO server running on ${PORT}`);
});
