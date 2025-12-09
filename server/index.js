const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const socketHandler = require("./socketHandler");

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  socketHandler(io, socket);
});

server.listen(3001, () => console.log("SERVER RUNNING"));
