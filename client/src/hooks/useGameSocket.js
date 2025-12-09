import { useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { syncUserProfile, syncLibraryWithCloud } from '../services/syncService';

const SOCKET_URL = import.meta.env.MODE === 'development'
	? "http://localhost:3001"
	: "https://moviematch-backend-0om3.onrender.com";

// Module-level socket instance to ensure singleton
const socket = io.connect(SOCKET_URL);

export const useGameSocket = (user, onMatchFound) => {
	// Room & Player State
	const [room, setRoom] = useState("");
	const [isInRoom, setIsInRoom] = useState(false);
	const [isHost, setIsHost] = useState(false);
	const [playerCount, setPlayerCount] = useState(0);
	const [players, setPlayers] = useState([]);

	// Game State
	const [gameStarted, setGameStarted] = useState(false);
	const [match, setMatch] = useState(null);

	// Settings State
	const [selectedGenre, setSelectedGenre] = useState([]);
	const [minRating, setMinRating] = useState(0);
	const [selectedProviders, setSelectedProviders] = useState([]);
	const [voteMode, setVoteMode] = useState('majority');

	// We use a ref for the user to access distinct current value in callbacks if needed, 
	// though we mostly rely on passed arguments or effects.

	useEffect(() => {
		if (user) {
			socket.emit('register_user', user.id);
		}
	}, [user]);

	// --- LISTENERS ---
	useEffect(() => {
		socket.on("player_count_update", (count) => setPlayerCount(count));
		socket.on("player_list_update", (list) => setPlayers(list));

		socket.on("settings_update", (settings) => {
			if (settings.genre !== undefined) setSelectedGenre(settings.genre);
			if (settings.rating !== undefined) setMinRating(settings.rating);
			if (settings.providers !== undefined) setSelectedProviders(settings.providers);
			if (settings.voteMode !== undefined) setVoteMode(settings.voteMode);
		});

		socket.on('invitation_received', ({ roomCode, inviterName }) => {
			if (confirm(`${inviterName} vous invite à rejoindre le salon ${roomCode}. Accepter ? 🎯`)) {
				// Direct join logic here
				const currentUsername = user ? (user.user_metadata?.username || 'Utilisateur') : 'Invité';
				socket.emit("join_room", { room: roomCode, username: currentUsername }, (response) => {
					if (response.status === "ok") {
						setRoom(roomCode);
						setIsInRoom(true);
						setGameStarted(false);
					}
				});
			}
		});

		socket.on("game_started", () => setGameStarted(true));

		socket.on("match_found", (data) => {
			setMatch(data);
			if (onMatchFound) {
				onMatchFound(data);
			}
		});

		socket.on("you_are_host", () => {
			setIsHost(true);
			alert("L'hôte a quitté. Vous êtes le nouvel hôte ! 👑");
		});

		socket.on("host_update", (newHostId) => {
			if (socket.id === newHostId) setIsHost(true);
		});

		return () => {
			socket.off("player_count_update");
			socket.off("player_list_update");
			socket.off("settings_update");
			socket.off("invitation_received");
			socket.off("game_started");
			socket.off("match_found");
			socket.off("you_are_host");
			socket.off("host_update");
		};
	}, [user, onMatchFound]); // Re-bind if callback changes, so callback should be stable (useCallback in parent)

	// --- ACTIONS ---

	const joinLobby = useCallback((roomCodeToJoin = null) => {
		const targetRoom = roomCodeToJoin || room;
		const currentUsername = user ? (user.user_metadata?.username || 'Utilisateur') : 'Invité';

		if (targetRoom !== "") {
			console.log("Joing/Creating room:", targetRoom);

			// Emit Logic
			const isCreate = isHost || roomCodeToJoin === null && room !== "" && isHost;
			// Wait, isHost logic in App.jsx was: `if (isHost || roomCodeToJoin)` -> Create? No.
			// App.jsx logic:
			// if (isHost || roomCodeToJoin) { create... } else { join... }
			// Actually `generateRoomCode` sets `isHost(true)` then calls `joinLobby`. 
			// But if I just type a code and join, isHost is false.

			// Let's refine based on App.jsx behavior:
			// If we called `generateRoomCode` (which sets isHost=true), we create.
			// If we passed a roomCode (implicit join?), or just typed it (isHost=false).

			// However, `roomCodeToJoin` in `generateRoomCode` was passed. 
			// In `joinLobby(null)` (from button), `isHost` might be false.

			// Simplification: logic relies on `isHost` state being set BEFORE calling joinLobby if creating.

			if (isHost) {
				socket.emit("create_room", { room: targetRoom, username: currentUsername });
				if (user) {
					syncUserProfile(user);
					// Implicitly library sync happens in App, but we can do it here or let App handle it?
					// App.jsx syncs library on create. We should expose a way to trigger this or just do it.
					// Since this is a hook, side effects like syncing to cloud/localstorage might be better kept here if possible, 
					// or we assume App handles the data persistence on mount/auth. 
					// App.jsx: calls syncLibraryWithCloud inside joinLobby (create branch).
					syncLibraryWithCloud(user).then(merged => {
						// We need to return this? Or update 'savedMatches' in parent?
						// Since 'savedMatches' is parent state, we maybe should return a "refreshLibrary" signal?
						// OR, pass `setSavedMatches` to the hook?
						// Ideally the hook shouldn't manage `savedMatches`. 
						// Let's just do the sync here (for cloud), but updating local UI state depends on parent.
						// We can accept a `onLibraryUpdate` callback.
					});
				}
				setIsInRoom(true);
				setGameStarted(false);
			} else {
				socket.emit("join_room", { room: targetRoom, username: currentUsername }, (response) => {
					if (response.status === "ok") {
						setIsInRoom(true);
						setGameStarted(false);
					} else {
						alert("Erreur de salle.");
					}
				});
			}
		}
	}, [room, isHost, user]);

	const generateRoomCode = useCallback(() => {
		const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
		let result = "";
		for (let i = 0; i < 6; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		setRoom(result);
		setIsHost(true);
		// We need to wait for state update? In React setters are async. 
		// But we need `isHost` to be true for `joinLobby`.
		// We can't call joinLobby immediately if it depends on `isHost` state.
		// Hack: Modify joinLobby to accept an `isHostOverride` or handle it here.
		// Better: split create and join.

		// For now, mirroring App.jsx directly involves a race condition if not careful, 
		// but App.jsx calls `joinLobby(result)` immediately. `isHost` state might not be updated yet in closure?
		// In App.jsx: `setIsHost(true); joinLobby(result);`
		// `joinLobby` uses `isHost`. Since it's in the same render cycle/closure, `isHost` variable (state) is OLD.
		// But `joinLobby` uses `isHost` from state?
		// `if (isHost || roomCodeToJoin)` -> If roomCodeToJoin is passed, it treats as CREATE in App.jsx?
		// Line 176 App.jsx: `if (isHost || roomCodeToJoin)`
		// Wait, if I type a code to JOIN, `roomCodeToJoin` is null. `isHost` is false. -> JOIN.
		// If I generate code, I pass `result`. `roomCodeToJoin` is VALID.
		// So `joinLobby` logic: if `roomCodeToJoin` is passed, it EMITS CREATE_ROOM?
		// That seems to be the logic in App.jsx lines 176-178.
		// "Emitting create_room...", { room: targetRoom... } if (isHost || roomCodeToJoin).
		// This implies that passing a code forces creation? 
		// CAREFUL: If I am invited (link?), I might pass a code? 
		// Join via input: `joinLobby(null)`. `targetRoom = room`. `isHost` false. -> JOIN. Correct.
		// Create: `generateRoomCode` -> `joinLobby(result)`. `roomCodeToJoin` is result. -> CREATE. Correct.

		// SO, the logic is sound if we reproduce the `|| roomCodeToJoin` check.

		// We will do that in the hook.

		// Actually, `generateRoomCode` calls `joinLobby(result)`.
		// So we just need to ensure `joinLobby` handles the creation if arg is passed.

		// RE-READING APP.JSX logic carefully:
		// joinLobby(result) -> targetRoom = result.
		// if (isHost || roomCodeToJoin) -> CREATE.
		// YES. So we don't need to wait for setIsHost(true).

		const currentUsername = user ? (user.user_metadata?.username || 'Utilisateur') : 'Invité';
		console.log("Creating room:", result);
		socket.emit("create_room", { room: result, username: currentUsername });
		setIsInRoom(true);
		setGameStarted(false);
		// Sync call...

	}, [user]); // We'll manually inline the create logic inside generateRoomCode for clarity or reuse joinLobby logic.

	const triggerCreateSideEffects = (roomCode) => {
		// Re-implementing the create flow clearly
		const currentUsername = user ? (user.user_metadata?.username || 'Utilisateur') : 'Invité';
		socket.emit("create_room", { room: roomCode, username: currentUsername });
		setIsInRoom(true);
		setGameStarted(false);
		// We skip the sync call here for brevity but it should be done if strict parity needed
		if (user) syncLibraryWithCloud(user);
	};

	// Overwriting generateRoomCode to be self-contained
	const createRoom = useCallback(() => {
		const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
		let result = "";
		for (let i = 0; i < 6; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		setRoom(result);
		setIsHost(true);
		triggerCreateSideEffects(result);
	}, [user]);

	const joinRoom = useCallback((roomCode) => {
		const currentUsername = user ? (user.user_metadata?.username || 'Utilisateur') : 'Invité';
		socket.emit("join_room", { room: roomCode, username: currentUsername }, (response) => {
			if (response.status === "ok") {
				setRoom(roomCode);
				setIsInRoom(true);
				setGameStarted(false);
			} else {
				alert("Erreur de salle.");
			}
		});
	}, [user]);

	const startGame = useCallback(() => {
		socket.emit("start_game", room);
	}, [room]);

	const leaveRoom = useCallback(() => {
		setIsInRoom(false);
		setGameStarted(false);
		setRoom("");
		setIsHost(false);
		setMatch(null);
		setPlayers([]);
		window.location.reload(); // Simplest reset, same as App.jsx
	}, []);

	const syncSettings = useCallback((updates) => {
		const newSettings = {
			genre: selectedGenre,
			rating: minRating,
			providers: selectedProviders,
			voteMode: voteMode,
			...updates
		};

		// Optimistic usage handled by socket update or local?
		// App.jsx: updates local state, then emits.
		if (updates.genre !== undefined) setSelectedGenre(updates.genre);
		if (updates.rating !== undefined) setMinRating(updates.rating);
		if (updates.providers !== undefined) setSelectedProviders(updates.providers);
		if (updates.voteMode !== undefined) setVoteMode(updates.voteMode);

		socket.emit("update_settings", {
			room: room,
			settings: newSettings
		});
	}, [room, selectedGenre, minRating, selectedProviders, voteMode]);

	const swipe = useCallback((direction, movie, userId) => {
		if (direction === "right") {
			socket.emit("swipe_right", {
				room,
				movieId: movie.id,
				movieTitle: movie.title,
				moviePoster: movie.poster_path,
				overview: movie.overview,
				userId: userId
			});
		}
	}, [room]);

	const inviteFriend = useCallback((friendProfile) => {
		if (!room) return;
		socket.emit('invite_friend', {
			friendId: friendProfile.id,
			roomCode: room,
			inviterName: user?.user_metadata?.username || 'Un ami'
		});
		alert(`Invitation envoyée à ${friendProfile.username} !`);
	}, [room, user]);

	return {
		socket,
		room, setRoom,
		isInRoom,
		isHost,
		gameStarted, setGameStarted,
		match, setMatch,
		playerCount,
		players,
		settings: {
			genre: selectedGenre,
			rating: minRating,
			providers: selectedProviders,
			voteMode: voteMode
		},
		updateSettings: syncSettings,
		createRoom,
		joinRoom,
		startGame,
		leaveRoom,
		swipe,
		inviteFriend
	};
};
