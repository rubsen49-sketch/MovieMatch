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

// Mémoire des likes
const roomLikes = {};

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // 1. CRÉATION DE SALLE
  socket.on("create_room", (room) => {
    try {
      socket.join(room);
      roomLikes[room] = {}; 
      console.log(`Room created: ${room}`);
      io.to(room).emit("player_count_update", 1);
    } catch (error) {
      console.error("Erreur create_room:", error);
    }
  });

  // 2. REJOINDRE UNE SALLE
  socket.on("join_room", (room, callback) => {
    try {
      const roomExists = io.sockets.adapter.rooms.has(room);

      if (roomExists) {
        socket.join(room);
        const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
        io.to(room).emit("player_count_update", roomSize);
        if (callback) callback({ status: "ok" });
      } else {
        if (callback) callback({ status: "error", message: "Salle introuvable" });
      }
    } catch (error) {
      console.error("Erreur join_room:", error);
    }
  });

  // 3. SYNCHRO RÉGLAGES
  socket.on("update_settings", (data) => {
    try {
      if (data && data.room) {
        socket.to(data.room).emit("settings_update", data);
      }
    } catch (error) {
      console.error("Erreur update_settings:", error);
    }
  });

  // 4. LANCEMENT JEU
  socket.on("start_game", (room) => {
    try {
      io.to(room).emit("game_started");
    } catch (error) {
      console.error("Erreur start_game:", error);
    }
  });

  // 5. GESTION DES SWIPES (LA CORRECTION CRITIQUE EST ICI)
  socket.on("swipe_right", (data) => {
    try {
      // Sécurité : Si les données sont incomplètes, on arrête tout de suite
      if (!data || !data.room || !data.movieId) return;

      const { room, movieId, userId } = data;

      // Initialisation sécurisée
      if (!roomLikes[room]) {
        roomLikes[room] = {};
      }
      if (!roomLikes[room][movieId]) {
        roomLikes[room][movieId] = new Set();
      }

      // On utilise l'ID unique (userId) s'il existe, sinon le socket.id
      const idToUse = userId || socket.id;

      // On ajoute le like
      roomLikes[room][movieId].add(idToUse);

      // LOGIQUE DE MATCH
      if (roomLikes[room][movieId].size >= 2) {
        io.to(room).emit("match_found", data);
      }
    } catch (error) {
      // Si une erreur arrive ici, le serveur l'affiche mais NE CRASH PLUS
      console.error("Erreur swipe_right (CRASH EVITÉ):", error);
    }
  });
  
  // 6. DÉCONNEXION
  socket.on("disconnecting", () => {
    try {
      const rooms = socket.rooms;
      rooms.forEach((room) => {
        const roomSize = io.sockets.adapter.rooms.get(room)?.size || 1;
        io.to(room).emit("player_count_update", roomSize - 1);
      });
    } catch (error) {
      console.error("Erreur deconnexion:", error);
    }
  });
});

server.listen(3001, () => {
  console.log("SERVER IS RUNNING");
});