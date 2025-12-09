const { createRoom, getRoom, updateRoomSettings, addLike, migrateHost } = require('./roomStore');

module.exports = (io, socket) => {
	console.log(`User Connected: ${socket.id}`);

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

	// --- CHAT EVENTS ---
	socket.on('send_message', ({ roomId, message, username }) => {
		io.to(roomId).emit('receive_message', {
			user: username,
			text: message,
			type: 'user',
			timestamp: new Date().toISOString()
		});
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
					const roomSockets = io.sockets.adapter.rooms.get(room); // Set of socket IDs
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
