const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
  },
});

// Mémoire des likes : { "CODE_SALLE": { "ID_FILM": ["socket_id_1", "socket_id_2"] } }
const roomLikes = {};

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // 1. CRÉATION
  socket.on("create_room", (room) => {
    socket.join(room);
    // On nettoie les anciens likes de cette salle si elle est recréée
    roomLikes[room] = {}; 
    io.to(room).emit("player_count_update", 1);
  });

  // 2. REJOINDRE
  socket.on("join_room", (room, callback) => {
    const roomExists = io.sockets.adapter.rooms.has(room);
    if (roomExists) {
      socket.join(room);
      const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
      io.to(room).emit("player_count_update", roomSize);
      callback({ status: "ok" });
    } else {
      callback({ status: "error" });
    }
  });

  // 3. SWIPE (C'est là qu'on corrige le bug !)
  // 3. SWIPE
  socket.on("swipe_right", (data) => {
    const { room, movieId, userId } = data; // On récupère l'userId

    if (!roomLikes[room]) roomLikes[room] = {};
    if (!roomLikes[room][movieId]) roomLikes[room][movieId] = new Set();

    // ICI : On utilise userId au lieu de socket.id
    // Cela empêche qu'un même téléphone compte pour 2 personnes s'il se reconnecte
    const idToUse = userId || socket.id; 
    roomLikes[room][movieId].add(idToUse);

    if (roomLikes[room][movieId].size >= 2) {
      io.to(room).emit("match_found", data);
    }
  });

  socket.on("update_settings", (data) => {
    socket.to(data.room).emit("settings_update", data);
  });

  socket.on("start_game", (room) => {
    io.to(room).emit("game_started");
  });
  
  socket.on("disconnecting", () => {
    const rooms = socket.rooms;
    rooms.forEach((room) => {
      const roomSize = io.sockets.adapter.rooms.get(room)?.size || 1;
      io.to(room).emit("player_count_update", roomSize - 1);
    });
  });
});

server.listen(3001, () => {
  console.log("SERVER IS RUNNING");
});