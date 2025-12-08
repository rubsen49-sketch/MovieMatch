const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // En prod, remplace "*" par l'URL de ton site Vercel pour plus de sécurité
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // 1. CRÉATION DE SALLE (Pour l'Hôte)
  socket.on("create_room", (room) => {
    socket.join(room);
    console.log(`Room created: ${room} by ${socket.id}`);
    
    // On renvoie le compte (1 joueur)
    io.to(room).emit("player_count_update", 1);
  });

  // 2. REJOINDRE UNE SALLE (Pour l'Invité) - AVEC VÉRIFICATION
  socket.on("join_room", (room, callback) => {
    // Vérifier si la salle existe (si elle a des gens dedans)
    const roomExists = io.sockets.adapter.rooms.has(room);

    if (roomExists) {
      socket.join(room);
      
      // Récupérer le nombre de joueurs
      const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
      
      // Prévenir tout le monde
      io.to(room).emit("player_count_update", roomSize);
      
      // Dire au client "C'est bon, tu peux entrer"
      callback({ status: "ok" });
    } else {
      // Dire au client "Erreur, salle inconnue"
      callback({ status: "error", message: "Cette salle n'existe pas ou est vide." });
    }
  });

  // Synchronisation des réglages (L'hôte envoie, les autres reçoivent)
  socket.on("update_settings", (data) => {
    socket.to(data.room).emit("settings_update", data);
  });

  // Lancement du jeu
  socket.on("start_game", (room) => {
    io.to(room).emit("game_started");
  });

  // Swipe
  socket.on("swipe_right", (data) => {
    socket.to(data.room).emit("match_found", data);
  });
  
  // Déconnexion
  socket.on("disconnecting", () => {
    const rooms = socket.rooms;
    rooms.forEach((room) => {
      // On calcule le nombre RESTANT après le départ
      const roomSize = io.sockets.adapter.rooms.get(room)?.size || 1;
      io.to(room).emit("player_count_update", roomSize - 1);
    });
  });
});

server.listen(3001, () => {
  console.log("SERVER IS RUNNING");
});