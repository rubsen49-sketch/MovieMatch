// In-memory storage using a simple object
// In the future, this can be replaced by Redis or a Database

const roomsData = {};

const createRoom = (roomId, hostId) => {
	roomsData[roomId] = {
		likes: {},
		settings: {
			providers: [],
			voteMode: 'majority',
			discoveryMode: 'popular'
		},
		hostId: hostId
	};
	return roomsData[roomId];
};

const getRoom = (roomId) => {
	return roomsData[roomId];
};

const updateRoomSettings = (roomId, newSettings) => {
	if (roomsData[roomId]) {
		roomsData[roomId].settings = {
			...roomsData[roomId].settings,
			...newSettings
		};
		return roomsData[roomId].settings;
	}
	return null;
};

const addLike = (roomId, movieId, userId) => {
	if (!roomsData[roomId]) return null;

	if (!roomsData[roomId].likes[movieId]) {
		roomsData[roomId].likes[movieId] = new Set();
	}

	roomsData[roomId].likes[movieId].add(userId);
	return roomsData[roomId].likes[movieId].size;
};

const removeRoom = (roomId) => {
	delete roomsData[roomId];
};

const migrateHost = (roomId, leftHostId, activeSocketIds) => {
	const room = roomsData[roomId];
	if (!room) return null;

	if (room.hostId === leftHostId) {
		// Current host left, promote someone else
		// activeSocketIds should be an array of socket IDs currently in the room (excluding the leaver if possible)
		const candidates = activeSocketIds.filter(id => id !== leftHostId);

		if (candidates.length > 0) {
			const newHostId = candidates[0]; // Simple logic: promote the first available peer
			room.hostId = newHostId;
			console.log(`Host Migration in room ${roomId}: ${leftHostId} -> ${newHostId}`);
			return newHostId;
		} else {
			// Room empty?
			return null;
		}
	}
	return null; // Host didn't leave, or room empty
};

module.exports = {
	createRoom,
	getRoom,
	updateRoomSettings,
	addLike,
	removeRoom,
	migrateHost
};
