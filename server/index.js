const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // ⚠️ Laisse tout le monde se connecter (plus simple pour le débug)
    methods: ["GET", "POST"]
  }
});

// Stockage temporaire (dans la RAM)
// Structure : { "roomID": { "filmID": count } }
let rooms = {}; 

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on("join_room", (room) => {
    socket.join(room);
    
    // Compter les joueurs dans la salle
    const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
    
    // Prévenir tout le monde dans la salle du nouveau nombre
    io.to(room).emit("player_count_update", roomSize);
  });

  // Quand l'hôte change les réglages, on prévient les autres
  socket.on("update_settings", (data) => {
    // data contient : { room, genre, rating }
    socket.to(data.room).emit("settings_update", data);
  });

  // Quand l'hôte lance la partie
  socket.on("start_game", (room) => {
    io.to(room).emit("game_started");
  });

  socket.on("swipe_right", (data) => {
    socket.to(data.room).emit("match_found", data);
  });
  
  // Gérer la déconnexion pour mettre à jour le compteur
  socket.on("disconnecting", () => {
    const rooms = socket.rooms;
    rooms.forEach((room) => {
      // On prévient la salle qu'un joueur part (le compteur va baisser)
      // Note: On envoie le nombre - 1 car le socket est encore compté à cet instant
      const roomSize = io.sockets.adapter.rooms.get(room)?.size || 1;
      io.to(room).emit("player_count_update", roomSize - 1);
    });
  });
});

server.listen(3001, () => {
  console.log('✅ LE SERVEUR TOURNE SUR LE PORT 3001');
});