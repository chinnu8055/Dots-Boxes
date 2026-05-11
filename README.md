
 # Dots & Boxes

A modern take on the classic Dots & Boxes game with local and online play. The web client is built with React + Vite, and the multiplayer server uses Express + Socket.IO.

**Live Demo:** https://dots-and-boxes-alpha.vercel.app/

## Features

- Local (same device) and online multiplayer modes
- Quickplay matchmaking and room-code matches
- Configurable grid size and turn timer
- Live score updates and rematch flow
- Responsive UI with light/dark theme toggle

## Tech Stack

- React 18, Vite 6, TypeScript
- Tailwind CSS utilities and UI primitives
- Socket.IO for real-time multiplayer
- Express server for matchmaking and game events

## Getting Started

### Client

```bash
pnpm install
pnpm dev
```

The client runs on http://localhost:5173 by default.

### Server

```bash
cd server
pnpm install
pnpm dev
```

The server runs on http://localhost:3001 by default.

## Environment Variables

Create a `.env` file in the project root for the client:

```bash
VITE_SOCKET_URL=http://localhost:3001
```

Create a `.env` file in the `server` folder for the server (optional):

```bash
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
```

`CLIENT_ORIGIN` can be a comma-separated list of allowed origins.

## Scripts

Client (root):

- `pnpm dev` - start the Vite dev server
- `pnpm build` - build the production client
- `pnpm preview` - preview the production build

Server (`server`):

- `pnpm dev` - start the Socket.IO server
- `pnpm start` - start the server in production mode

## Project Structure

```
src/
  app/
    App.tsx
    components/
server/
  index.js
```

## Notes

- Run both client and server for online multiplayer.
- Local mode works with the client only.
  