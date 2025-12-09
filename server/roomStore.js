// In-memory storage using a simple object
// In the future, this can be replaced by Redis or a Database

const roomsData = {};

const createRoom = (roomId, hostId) => {
	roomsData[roomId] = {
		likes: {},
		settings: {
			providers: [],
			voteMode: 'majority' // 'majority' or 'unanimity'
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

module.exports = {
	createRoom,
	getRoom,
	updateRoomSettings,
	addLike,
	removeRoom
};
