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
  socket.on("swipe_right", (data) => {
    const { room, movieId } = data;

    // Si la salle n'a pas encore de mémoire, on la crée
    if (!roomLikes[room]) {
      roomLikes[room] = {};
    }

    // Si le film n'a pas encore de likes, on crée la liste
    if (!roomLikes[room][movieId]) {
      roomLikes[room][movieId] = new Set();
    }

    // On ajoute l'ID du joueur qui a liké
    roomLikes[room][movieId].add(socket.id);

    // VERIFICATION DU MATCH
    // Si il y a 2 likes (ou plus) sur ce film dans cette salle
    if (roomLikes[room][movieId].size >= 2) {
      // ALORS c'est un vrai match, on prévient tout le monde
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