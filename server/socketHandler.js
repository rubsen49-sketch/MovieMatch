const { createRoom, getRoom, updateRoomSettings, addLike, migrateHost } = require('./roomStore');

// Map to track UserID -> SocketID for invites
const userSockets = new Map();

module.exports = (io, socket) => {
	console.log(`User Connected: ${socket.id}`);

	// AUTH / REGISTRY
	socket.on('register_user', (userId) => {
		userSockets.set(userId, socket.id);
		socket.userId = userId;
		console.log(`User Registered: ${userId} -> ${socket.id}`);
	});

	// Helper to broadcast player list
	const broadcastRoomPlayers = (room) => {
		const roomSockets = io.sockets.adapter.rooms.get(room);
		if (roomSockets) {
			const players = [];
			roomSockets.forEach(socketId => {
				const s = io.sockets.sockets.get(socketId);
				if (s) {
					players.push({
						id: socketId,
						username: s.data.username || "Invité"
					});
				}
			});
			io.to(room).emit("player_list_update", players);
			io.to(room).emit("player_count_update", players.length);
		}
	};

	// 1. CRÉATION SALLE
	socket.on("create_room", ({ room, username }) => {
		try {
			socket.data.username = username; // Store on socket instance
			socket.join(room);
			createRoom(room, socket.id);

			console.log(`Room created: ${room} by ${username}`);
			broadcastRoomPlayers(room);
		} catch (error) {
			console.error("Erreur create:", error);
		}
	});

	// 2. REJOINDRE SALLE
	socket.on("join_room", ({ room, username }, callback) => {
		try {
			const roomExists = io.sockets.adapter.rooms.has(room);
			const roomData = getRoom(room);

			if (roomExists && roomData) {
				socket.data.username = username; // Store on socket instance
				socket.join(room);

				broadcastRoomPlayers(room);

				// Send current settings to new user
				socket.emit("settings_update", roomData.settings);

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
			const updatedSettings = updateRoomSettings(data.room, data.settings);
			if (updatedSettings) {
				// Broadcast to everyone in room EXCEPT sender (optimized)
				// But app logic actually expects broadcast to everyone? 
				// Original code: socket.to(data.room).emit... (excludes sender)

				socket.to(data.room).emit("settings_update", updatedSettings);
			}
		} catch (error) {
			console.error("Erreur settings:", error);
		}
	});

	socket.on("start_game", (room) => {
		io.to(room).emit("game_started");
	});

	// INVITATIONS
	socket.on('invite_friend', ({ friendId, roomCode, inviterName }) => {
		const targetSocketId = userSockets.get(friendId);
		if (targetSocketId) {
			io.to(targetSocketId).emit('invitation_received', {
				roomCode,
				inviterName
			});
		}
	});

	// 4. SWIPE INTELLIGENT (Cœur du système)
	socket.on("swipe_right", (data) => {
		try {
			const { room, movieId, userId } = data;
			const roomData = getRoom(room);

			if (!roomData) return;

			const idToUse = userId || socket.id;
			const votes = addLike(room, movieId, idToUse);

			// CALCUL DU SEUIL DE VICTOIRE
			const roomSize = io.sockets.adapter.rooms.get(room)?.size || 1;
			const mode = roomData.settings.voteMode;

			let isMatch = false;

			if (mode === 'unanimity') {
				isMatch = votes >= roomSize;
			} else {
				// Majorité (50% + 1)
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
		if (socket.userId) {
			userSockets.delete(socket.userId);
		}
		try {
			const rooms = socket.rooms;
			rooms.forEach((room) => {
				// Warning: socket.rooms contains the socket ID itself too usually, but here we iterate
				// 'room' can be the socket.id if not filtered, but usually custom rooms are different.
				if (room === socket.id) return;

				const roomSizeBefore = io.sockets.adapter.rooms.get(room)?.size || 1;
				if (roomSizeBefore > 1) {
					// Broadcast update excluding the disconnecting user
					const roomSockets = io.sockets.adapter.rooms.get(room);
					const players = [];
					if (roomSockets) {
						roomSockets.forEach(sid => {
							if (sid !== socket.id) {
								const s = io.sockets.sockets.get(sid);
								if (s) players.push({ id: sid, username: s.data.username || "Invité" });
							}
						});
					}
					io.to(room).emit("player_list_update", players);
					io.to(room).emit("player_count_update", players.length); // Keep backward compat logic if needed, but list update covers count

					// --- HOST MIGRATION LOGIC ---
					// roomSockets is already defined above
					if (roomSockets) {
						const activeIds = Array.from(roomSockets);
						const newHostId = migrateHost(room, socket.id, activeIds);

						if (newHostId) {
							// Notify everyone new host
							io.to(room).emit("host_update", newHostId);
							// Notify specfic user (optional, but good for UI toast)
							io.to(newHostId).emit("you_are_host");
						}
					}
				}
			});
		} catch (error) {
			console.error("Erreur disconnect:", error);
		}
	});
};
