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

io.on('connection', (socket) => {
  console.log(`Utilisateur connecté : ${socket.id}`);

  // 1. Rejoindre une salle
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`User ${socket.id} a rejoint la salle : ${room}`);
  });

  // 2. Gestion du Swipe
  socket.on('swipe_right', ({ room, movieId, movieTitle }) => {
    // Initialiser la salle si elle n'existe pas
    if (!rooms[room]) {
      rooms[room] = {};
    }

    // Initialiser le compteur de likes pour ce film
    if (!rooms[room][movieId]) {
      rooms[room][movieId] = 0;
    }

    // Ajouter un like
    rooms[room][movieId] += 1;

    // VÉRIFICATION DU MATCH (Si 2 personnes ont liké)
    if (rooms[room][movieId] >= 2) {
      io.to(room).emit('match_found', { 
        movieId, 
        title: movieTitle 
      });
    }
  });
});

server.listen(3001, () => {
  console.log('✅ LE SERVEUR TOURNE SUR LE PORT 3001');
});