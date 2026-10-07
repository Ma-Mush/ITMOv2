import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import {
  PHYSICS_TICK_RATE,
  SERVER_PORT,
  SERVER_TICK_RATE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../shared/constants.js';
import { ClientMessage, ServerMessage } from '../shared/types.js';
import { GameRoom } from './GameRoom.js';

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// Serve client dist if built
const clientDistPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(clientDistPath));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', players: gameRoom.getSnapshot(Date.now()).lizards.length });
});

const gameRoom = new GameRoom();

interface ClientSession {
  ws: WebSocket;
  playerId: string;
  name: string;
  isAlive: boolean;
}

const sessions = new Map<string, ClientSession>();
let nextSessionId = 1;

wss.on('connection', (ws: WebSocket) => {
  const sessionId = `player_${nextSessionId++}`;
  const session: ClientSession = {
    ws,
    playerId: sessionId,
    name: 'Lizard' + sessionId.slice(-3),
    isAlive: false,
  };
  sessions.set(sessionId, session);

  // Send init message
  const initMsg: ServerMessage = {
    type: 'init',
    selfId: sessionId,
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
  };
  ws.send(JSON.stringify(initMsg));

  ws.on('message', (data: string) => {
    try {
      const msg: ClientMessage = JSON.parse(data.toString());
      if (msg.type === 'join') {
        session.name = msg.name || session.name;
        gameRoom.addPlayer(sessionId, session.name, msg.color, msg.secondaryColor);
        session.isAlive = true;
      } else if (msg.type === 'input') {
        if (session.isAlive) {
          gameRoom.handlePlayerInput(sessionId, msg.targetAngle, msg.isBoosting);
        }
      } else if (msg.type === 'respawn') {
        session.name = msg.name || session.name;
        gameRoom.respawnPlayer(sessionId, session.name);
        session.isAlive = true;
      }
    } catch (err) {
      console.error('Error handling message from client:', err);
    }
  });

  ws.on('close', () => {
    gameRoom.removePlayer(sessionId);
    sessions.delete(sessionId);
  });
});

// Physics Loop (60 Hz)
let lastPhysicsTime = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastPhysicsTime) / 1000);
  lastPhysicsTime = now;

  gameRoom.update(dt, Date.now());

  // Check deaths for active sessions
  for (const session of sessions.values()) {
    if (session.isAlive) {
      const lizard = gameRoom.getLizard(session.playerId);
      if (!lizard || lizard.isDead) {
        session.isAlive = false;
        const diedMsg: ServerMessage = {
          type: 'died',
          killerName: 'A wild predator',
          finalScore: lizard ? Math.round(lizard.score) : 0,
        };
        if (session.ws.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify(diedMsg));
        }
      }
    }
  }
}, 1000 / PHYSICS_TICK_RATE);

// Network Broadcast Loop (30 Hz)
setInterval(() => {
  if (sessions.size === 0) return;

  const snapshot = gameRoom.getSnapshot(Date.now());
  const packet = JSON.stringify({ type: 'snapshot', data: snapshot });

  for (const session of sessions.values()) {
    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(packet);
    }
  }
}, 1000 / SERVER_TICK_RATE);

httpServer.listen(SERVER_PORT, () => {
  console.log(`🐊 Lizard Arena server running on http://localhost:${SERVER_PORT}`);
});
