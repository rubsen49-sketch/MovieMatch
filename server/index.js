const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Mémoire : { "CODE": { likes: { ID_FILM: Set(userIds) }, settings: {}, hostId: "..." } }
const roomsData = {};

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // 1. CRÉATION
  socket.on("create_room", (room) => {
    try {
      socket.join(room);
      roomsData[room] = {
        likes: {},
        settings: { 
          providers: [], 
          voteMode: 'majority' // 'majority' ou 'unanimity'
        },
        hostId: socket.id
      };
      console.log(`Room created: ${room}`);
      io.to(room).emit("player_count_update", 1);
    } catch (error) {
      console.error("Erreur create:", error);
    }
  });

  // 2. REJOINDRE
  socket.on("join_room", (room, callback) => {
    try {
      const roomExists = io.sockets.adapter.rooms.has(room);
      if (roomExists && roomsData[room]) {
        socket.join(room);
        const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
        io.to(room).emit("player_count_update", roomSize);
        // On envoie les réglages actuels au nouvel arrivant
        socket.emit("settings_update", roomsData[room].settings);
        if (callback) callback({ status: "ok" });
      } else {
        if (callback) callback({ status: "error", message: "Salle introuvable" });
      }
    } catch (error) {
      console.error("Erreur join:", error);
    }
  });

  // 3. MISE À JOUR RÉGLAGES (Host seulement)
  socket.on("update_settings", (data) => {
    try {
      if (roomsData[data.room]) {
        // On fusionne les nouveaux réglages
        roomsData[data.room].settings = { 
          ...roomsData[data.room].settings, 
          ...data.settings 
        };
        // On prévient tout le monde (sauf l'émetteur qui sait déjà)
        socket.to(data.room).emit("settings_update", roomsData[data.room].settings);
      }
    } catch (error) {
      console.error("Erreur settings:", error);
    }
  });

  socket.on("start_game", (room) => {
    io.to(room).emit("game_started");
  });

  // 4. SWIPE INTELLIGENT (Cœur du système)
  socket.on("swipe_right", (data) => {
    try {
      const { room, movieId, userId } = data;
      if (!roomsData[room]) return;

      if (!roomsData[room].likes[movieId]) {
        roomsData[room].likes[movieId] = new Set();
      }

      const idToUse = userId || socket.id;
      roomsData[room].likes[movieId].add(idToUse);

      // CALCUL DU SEUIL DE VICTOIRE
      const roomSize = io.sockets.adapter.rooms.get(room)?.size || 1;
      const votes = roomsData[room].likes[movieId].size;
      const mode = roomsData[room].settings.voteMode;
      
      let isMatch = false;

      if (mode === 'unanimity') {
        isMatch = votes >= roomSize;
      } else {
        // Majorité (50% + 1)
        // Ex: 2 joueurs -> faut 2 votes. 3 joueurs -> faut 2 votes. 4 joueurs -> faut 3 votes.
        const threshold = Math.floor(roomSize / 2) + 1;
        isMatch = votes >= threshold;
      }

      if (isMatch) {
        io.to(room).emit("match_found", data);
      }
    } catch (error) {
      console.error("Erreur swipe:", error);
    }
  });

  socket.on("disconnecting", () => {
    try {
      const rooms = socket.rooms;
      rooms.forEach((room) => {
        const roomSize = io.sockets.adapter.rooms.get(room)?.size || 1;
        io.to(room).emit("player_count_update", roomSize - 1);
        
        // TODO (Phase 3): Gestion de la migration d'hôte ici
      });
    } catch (error) {
      console.error("Erreur disconnect:", error);
    }
  });
});

server.listen(3001, () => console.log("SERVER RUNNING"));