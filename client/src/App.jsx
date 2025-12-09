import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';
import { Analytics } from "@vercel/analytics/react";

// Components
import MovieDetailModal from './components/MovieDetailModal';
import GenreSelector from './components/GenreSelector';
import Lobby from './components/Lobby';
import SwipeDeck from './components/SwipeDeck';
import ResultsView from './components/ResultsView';
import AuthModal from './components/AuthModal';
import FriendsView from './components/FriendsView';

// ... (existing imports)

import { supabase } from './supabaseClient';

// Constants
import { GENRES_LIST } from './constants';

const SOCKET_URL = import.meta.env.MODE === 'development'
  ? "http://localhost:3001"
  : "https://moviematch-backend-0om3.onrender.com";

const socket = io.connect(SOCKET_URL);
const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

const getUserId = () => {
  let id = localStorage.getItem('userId');
  if (!id) {
    id = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('userId', id);
  }
  return id;
};

function App() {
  const [room, setRoom] = useState("");
  const [isInRoom, setIsInRoom] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [movies, setMovies] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [match, setMatch] = useState(null);
  const [page, setPage] = useState(1);
  const [view, setView] = useState("menu");


  // Settings State
  const [selectedGenre, setSelectedGenre] = useState([]);
  const [showGenreSelector, setShowGenreSelector] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [selectedProviders, setSelectedProviders] = useState([]);
  const [voteMode, setVoteMode] = useState('majority');

  const [providersDisplay, setProvidersDisplay] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [players, setPlayers] = useState([]); // List of { id, username }
  const userId = useRef(getUserId()).current;
  const [savedMatches, setSavedMatches] = useState(() => {
    const saved = localStorage.getItem('myMatches');
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    // Migration: If it's a simple array of IDs, convert to objects
    if (parsed.length > 0 && typeof parsed[0] === 'number') {
      const migrated = parsed.map(id => ({
        id,
        status: 'to_watch',
        addedAt: new Date().toISOString()
      }));
      localStorage.setItem('myMatches', JSON.stringify(migrated));
      return migrated;
    }
    return parsed;
  });
  const [detailsMovie, setDetailsMovie] = useState(null);

  // --- SUPABASE AUTH & SYNC ---
  const [user, setUser] = useState(null);
  const [showMyMatches, setShowMyMatches] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [friendLibraryTarget, setFriendLibraryTarget] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        syncLibraryWithCloud(session.user.id);
        syncUserProfile(session.user);
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        syncLibraryWithCloud(session.user.id);
        syncUserProfile(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const syncUserProfile = async (currentUser) => {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: currentUser.id,
        username: currentUser.user_metadata?.username,
        updated_at: new Date()
      });
    if (error) console.error("Profile sync error:", error);
  };

  const syncLibraryWithCloud = async (userId) => {
    try {
      // 1. Fetch Cloud Data
      const { data, error } = await supabase
        .from('profiles')
        .select('library')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = JSON 0 rows (profile doesn't exist yet)
        console.error("Error fetching cloud library:", error);
      }

      const cloudLibrary = data?.library || [];
      const localLibrary = JSON.parse(localStorage.getItem('myMatches')) || [];

      // 2. Merge (Union of IDs)
      // We prioritize Cloud status if exists, otherwise Local
      const mergedMap = new Map();
      localLibrary.forEach(item => mergedMap.set(item.id, item));
      cloudLibrary.forEach(item => mergedMap.set(item.id, item)); // Cloud overwrites local if duplicate

      const mergedArray = Array.from(mergedMap.values());

      // 3. Update Local & State
      setSavedMatches(mergedArray);
      localStorage.setItem('myMatches', JSON.stringify(mergedArray));

      // 4. Update Cloud (to sync back any local-only items)
      await supabase.from('profiles').upsert({
        id: userId,
        library: mergedArray,
        updated_at: new Date()
      });

    } catch (err) {
      console.error("Sync error:", err);
    }
  };

  const saveToCloud = async (newLibrary) => {
    if (!user) return;
    await supabase.from('profiles').upsert({
      id: user.id,
      library: newLibrary,
      updated_at: new Date()
    });
  };

  useEffect(() => {
    if (user) {
      socket.emit('register_user', user.id);
    }
  }, [user]);

  // --- ACTIONS BIBLIOTHÈQUE ---
  const updateMovieStatus = (movieId, newStatus) => {
    const updated = savedMatches.map(m =>
      m.id === movieId ? { ...m, status: newStatus } : m
    );
    setSavedMatches(updated);
    localStorage.setItem('myMatches', JSON.stringify(updated));
    saveToCloud(updated);
  };

  const bulkUpdateMovieStatus = (movieIds, newStatus) => {
    const updated = savedMatches.map(m =>
      movieIds.includes(m.id) ? { ...m, status: newStatus } : m
    );
    setSavedMatches(updated);
    localStorage.setItem('myMatches', JSON.stringify(updated));
    saveToCloud(updated);
  };

  const removeMovie = (movieId) => {
    if (confirm("Supprimer ce film de la liste ?")) {
      const updated = savedMatches.filter(m => m.id !== movieId);
      setSavedMatches(updated);
      localStorage.setItem('myMatches', JSON.stringify(updated));
      saveToCloud(updated);
    }
  };

  const bulkRemoveMovies = (movieIds) => {
    if (confirm(`Supprimer ces ${movieIds.length} films ?`)) {
      const updated = savedMatches.filter(m => !movieIds.includes(m.id));
      setSavedMatches(updated);
      localStorage.setItem('myMatches', JSON.stringify(updated));
      saveToCloud(updated);
    }
  };

  // --- SOCKET & GAME LOGIC ---

  const joinLobby = (roomCodeToJoin = null) => {
    const targetRoom = roomCodeToJoin || room;
    const currentUsername = user ? (user.user_metadata?.username || 'Utilisateur') : 'Invité';

    if (targetRoom !== "") {
      console.log("Joing/Creating room:", targetRoom);
      const seed = targetRoom.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const randomPage = (seed % 30) + 1;
      setPage(randomPage);

      if (isHost || roomCodeToJoin) {
        console.log("Emitting create_room...", { room: targetRoom, username: currentUsername });
        socket.emit("create_room", { room: targetRoom, username: currentUsername });
        if (user) {
          // Sync Profile to public table for search
          const syncProfile = async () => {
            const { error } = await supabase
              .from('profiles')
              .upsert({
                id: user.id,
                username: user.user_metadata?.username,
                updated_at: new Date()
              });
            if (error) console.error("Profile sync error:", error);
          };
          syncProfile();

          syncLibraryWithCloud(user.id); // Assuming fetchUserMatches is syncLibraryWithCloud
        }
        setIsInRoom(true);
        setGameStarted(false);
        setView("lobby");
      } else {
        socket.emit("join_room", { room: targetRoom, username: currentUsername }, (response) => {
          if (response.status === "ok") {
            setIsInRoom(true);
            setGameStarted(false);
            setView("lobby");
          } else {
            alert("Erreur de salle.");
          }
        });
      }
    }
  };

  const generateRoomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRoom(result);
    setIsHost(true);
    joinLobby(result);
  };

  const syncSettings = (updates) => {
    const newSettings = {
      genre: selectedGenre,
      rating: minRating,
      providers: selectedProviders,
      voteMode: voteMode,
      ...updates
    };

    if (updates.genre !== undefined) setSelectedGenre(updates.genre);
    if (updates.rating !== undefined) setMinRating(updates.rating);
    if (updates.providers !== undefined) setSelectedProviders(updates.providers);
    if (updates.voteMode !== undefined) setVoteMode(updates.voteMode);

    socket.emit("update_settings", {
      room: room,
      settings: newSettings
    });
  };

  const toggleGenre = (id) => {
    let newGenres;
    if (selectedGenre.includes(id)) {
      newGenres = selectedGenre.filter(g => g !== id);
    } else {
      newGenres = [...selectedGenre, id];
    }
    syncSettings({ genre: newGenres });
  };

  const fetchMovies = async () => {
    if (!API_KEY) {
      console.error("API Key missing");
      return;
    }
    let endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=fr-FR&sort_by=popularity.desc&page=${page}`;

    if (selectedGenre.length > 0) {
      endpoint += `&with_genres=${selectedGenre.join(',')}`;
    }
    endpoint += `&watch_region=FR&primary_release_date.lte=${new Date().toISOString().split('T')[0]}`;
    if (minRating > 0) endpoint += `&vote_average.gte=${minRating}&vote_count.gte=300`;

    if (selectedProviders.length > 0) {
      endpoint += `&with_watch_providers=${selectedProviders.join('|')}`;
      endpoint += `&watch_region=FR&with_watch_monetization_types=flatrate`;
    } else {
      endpoint += `&with_watch_monetization_types=flatrate|rent|buy`;
    }

    try {
      const response = await axios.get(endpoint);
      const newMovies = response.data.results;

      if (newMovies.length === 0 && page < 500) {
        setPage(prev => prev + 1);
      } else {
        setMovies(newMovies);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error("Erreur API:", error);
    }
  };

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
        setRoom(roomCode);
        // We need to ensure we leave current room if any? joinLobby handles it?
        // joinLobby checks if roomCodeToJoin is provided.
        // But we can't call joinLobby easily if it's not defined inside useEffect or we need to useCallback.
        // joinLobby IS defined in component scope.
        // But this effect runs on mount. `joinLobby` changes? No, functions are recreated.
        // Ideally, we shouldn't use closure variables in [] effect.
        // But `joinLobby` depends on state?
        // Let's use a ref or just `window.location.reload` with param?
        // Or easier: set a "pendingInvitation" state and handle it?
        // Or just call it, ignoring stale closure if joinLobby is stable enough or we don't care about stale props (it uses `room` state but we pass arg).
        // Actually, `socket` is outside.
        // Let's just emit join directly or trigger a UI state.

        // Cleanest: Trigger a state change that `useEffect` picks up, or just Force Join.
        // Since this is a quick implementation:
        socket.emit("join_room", { room: roomCode, username: user ? (user.user_metadata?.username || 'Invité') : 'Invité' }, (response) => {
          if (response.status === "ok") {
            setIsInRoom(true);
            setGameStarted(false);
            setView("lobby");
            setRoom(roomCode); // Update UI
          }
        });
      }
    });

    socket.on("game_started", () => setGameStarted(true));
    socket.on("match_found", (data) => {
      setMatch(data);
      const currentMatches = JSON.parse(localStorage.getItem('myMatches')) || [];

      // Check if already exists (check by ID)
      const exists = currentMatches.some(m => m.id === data.movieId);

      if (!exists) {
        const newMatch = {
          id: data.movieId,
          status: 'to_watch',
          addedAt: new Date().toISOString()
        };
        const newMatches = [newMatch, ...currentMatches];
        localStorage.setItem('myMatches', JSON.stringify(newMatches));
        setSavedMatches(newMatches);
        saveToCloud(newMatches);
      }
    });

    socket.on("you_are_host", () => {
      setIsHost(true);
      alert("L'hôte a quitté. Vous êtes le nouvel hôte ! 👑");
    });

    socket.on("host_update", (newHostId) => {
      // Just in case we need to know who the new host is, though "you_are_host" handles the permission
      if (socket.id === newHostId) setIsHost(true);
    });

    return () => {
      socket.off("player_count_update");
      socket.off("settings_update");
      socket.off("game_started");
      socket.off("match_found");
      socket.off("you_are_host");
      socket.off("host_update");
    };
  }, []);

  useEffect(() => {
    if (gameStarted) fetchMovies();
  }, [page, gameStarted]);

  useEffect(() => {
    if (gameStarted && movies.length > 0 && currentIndex >= movies.length) {
      setPage(prev => prev + 1);
    }
  }, [currentIndex, movies.length, gameStarted]);

  const startGame = () => socket.emit("start_game", room);

  const leaveRoom = () => {
    setIsInRoom(false);
    setGameStarted(false);
    setMovies([]);
    setCurrentIndex(0);
    setPage(1);
    setRoom("");
    setView("menu");
    setIsHost(false);
    window.location.reload();
  };

  const shareCode = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'MovieMatch', text: `Rejoins-moi ! Code : ${room}`, url: window.location.href });
    } else {
      await navigator.clipboard.writeText(room);
      alert("Code copié !");
    }
  };

  const handleSwipe = (direction) => {
    const currentMovie = movies[currentIndex];
    if (direction === "right") {
      socket.emit("swipe_right", {
        room,
        movieId: currentMovie.id,
        movieTitle: currentMovie.title,
        moviePoster: currentMovie.poster_path,
        overview: currentMovie.overview,
        userId: userId
      });
    }
    setCurrentIndex((prev) => prev + 1);
  };

  const resetMyMatches = () => {
    if (confirm("Vider l'historique ?")) {
      localStorage.removeItem('myMatches');
      setSavedMatches([]);
    }
  };

  useEffect(() => {
    if (movies.length > 0 && currentIndex < movies.length) {
      const currentMovie = movies[currentIndex];
      // Only fetch providers if API key is present
      if (API_KEY) {
        axios.get(`https://api.themoviedb.org/3/movie/${currentMovie.id}/watch/providers?api_key=${API_KEY}`)
          .then(response => {
            const frData = response.data.results.FR;
            setProvidersDisplay(frData && frData.flatrate ? frData.flatrate : []);
          })
          .catch(err => console.error(err));
      }
    }
  }, [currentIndex, movies]);


  const handleAddFriend = async (targetUsername) => {
    if (!user) return alert("Connectez-vous pour ajouter des amis !");

    try {
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', targetUsername)
        .single();

      if (pError || !profiles) return alert("Utilisateur introuvable.");

      const { error: fError } = await supabase
        .from('friendships')
        .insert({ user_id: user.id, friend_id: profiles.id });

      if (fError) {
        if (fError.code === '23505') alert("Déjà demandé ou amis !");
        else throw fError;
      } else {
        alert(`Demande envoyée à ${targetUsername} !`);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'ajout.");
    }
  };

  const handleInviteFriend = (friendProfile) => {
    if (!room) return;
    socket.emit('invite_friend', {
      friendId: friendProfile.id,
      roomCode: room,
      inviterName: user?.user_metadata?.username || 'Un ami'
    });
    alert(`Invitation envoyée à ${friendProfile.username} !`);
  };

  // --- RENDER ---

  const renderModal = () => {
    if (!detailsMovie) return null;

    const libraryItem = savedMatches.find(m => m.id === detailsMovie.id);
    // Handle legacy number format (assume 'to_watch') or object format
    const currentStatus = libraryItem ? (typeof libraryItem === 'number' ? 'to_watch' : libraryItem.status) : null;

    return (
      <MovieDetailModal
        movie={detailsMovie}
        onClose={() => setDetailsMovie(null)}
        currentStatus={currentStatus}
        onUpdateStatus={updateMovieStatus}
      />
    );
  };

  if (showMyMatches) {
    return (
      <>
        {renderModal()}
        <ResultsView
          savedMatches={savedMatches}
          onClose={() => setShowMyMatches(false)}
          resetMyMatches={resetMyMatches}
          onDetails={(movieData) => setDetailsMovie(movieData)}
          onUpdateStatus={updateMovieStatus}
          onRemove={removeMovie}
          onBulkUpdate={bulkUpdateMovieStatus}
          onBulkRemove={bulkRemoveMovies}
        />
      </>
    );
  }

  if (match) {
    return (
      <>
        {renderModal()}
        <div className="match-overlay">
          <h1 className="match-title">IT'S A MATCH!</h1>
          {match.moviePoster && (
            <img
              src={`https://image.tmdb.org/t/p/w500${match.moviePoster}`}
              alt={match.movieTitle}
              className="match-poster clickable"
              onClick={() => setDetailsMovie({
                id: match.movieId,
                title: match.movieTitle,
                poster_path: match.moviePoster,
                overview: match.overview
              })}
            />
          )}
          <div className="match-hint-click">👆 Toucher l'affiche pour infos</div>
          <h2>{match.movieTitle}</h2>
          <button className="unified-btn primary" onClick={() => setMatch(null)}>Continuer</button>
        </div>
      </>
    );
  }

  // --- LOBBY & GENRE ---

  if (isInRoom && !gameStarted) {
    if (showGenreSelector) {
      return (
        <GenreSelector
          selectedGenre={selectedGenre}
          toggleGenre={toggleGenre}
          onValidate={() => setShowGenreSelector(false)}
        />
      );
    }

    console.log("Rendering Lobby. Params:", { room, playerCount, players, isHost });
    return (
      <>
        <Lobby
          room={room}
          playerCount={playerCount}
          players={players}
          currentUser={user}
          isHost={isHost}
          onAddFriend={handleAddFriend}
          settings={{
            providers: selectedProviders,
            voteMode: voteMode,
            rating: minRating,
            genre: selectedGenre
          }}
          updateSettings={syncSettings}
          startGame={startGame}
          leaveRoom={leaveRoom}
          shareCode={shareCode}
          onOpenGenreSelector={() => setShowGenreSelector(true)}
        />
      </>
    );
  }

  // --- RENDER LOGIC for WELCOME SCREEN components ---

  if (!isInRoom) {
    if (showMyMatches) {
      return (
        <ResultsView
          savedMatches={savedMatches}
          onClose={() => setShowMyMatches(false)}
          resetMyMatches={resetMyMatches}
          onDetails={(movieData) => setDetailsMovie(movieData)}
          onUpdateStatus={updateMovieStatus}
          onRemove={removeMovie}
          onBulkUpdate={bulkUpdateMovieStatus}
          onBulkRemove={bulkRemoveMovies}
        />
      );
    }

    if (friendLibraryTarget) {
      return (
        <FriendLibraryView
          friendId={friendLibraryTarget.id}
          friendUsername={friendLibraryTarget.username}
          onClose={() => setFriendLibraryTarget(null)}
          onDetails={(movieId) => {
            // We can reuse the setDetailsMovie to show the modal!
            // However, setDetailsMovie expects a full object usually for the modal?
            // MatchItem fetches it, but onDetails in ResultsView passed the whole object.
            // Here onDetails passes ID. We need to fetch details or rely on MatchItem caching?
            // Actually MatchItem doesn't pass data back easily.
            // We'll let the user simply click for now, maybe simple alert or fetch?
            // Better: Reuse the "Details" logic.
            // For now, let's just allow viewing the list. 
            // EDIT: MovieDetailModal expects {id, title...}.
            // We will implement a quick fetch in App or just pass ID and let Modal handle it?
            // Current Modal: <MovieDetailModal movie={detailsMovie} ... /> 
            // detailsMovie object.
            // Let's rely on the user clicking the movie poster if they want info.
            // Wait, MatchItem has an onClick.
          }}
        />
      );
    }

    if (showFriends) {
      return (
        <FriendsView
          onClose={() => setShowFriends(false)}
          currentUser={user}
          onViewLibrary={(friend) => setFriendLibraryTarget(friend)}
          onInvite={handleInviteFriend}
          isInRoom={isInRoom}
        />
      );
    }

    return (
      <div className="welcome-screen">
        <div className="top-right-auth">
          {!user ? (
            <button onClick={() => setShowAuthModal(true)} className="auth-btn">👤 Compte</button>
          ) : (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={() => setShowFriends(true)}
                className="auth-btn friend-btn-bubble"
              >
                👥 Amis
              </button>

              <div className="auth-status">
                <span>{user.user_metadata?.username || user.email.split('@')[0]}</span>
                <button onClick={() => supabase.auth.signOut()} className="auth-logout">✕</button>
              </div>
            </div>
          )}
        </div>

        <h1>Movie Match 🍿</h1>
        {view === "menu" && (
          <div className="menu-buttons">
            <button className="big-btn btn-create" onClick={generateRoomCode}>Créer une salle</button>
            <button className="big-btn btn-join" onClick={() => setView("join")}>Rejoindre</button>
            <button onClick={() => setShowMyMatches(true)} className="link-matches">Voir mes matchs</button>
          </div>
        )}
        {view === "join" && (
          <div className="input-group">
            <input type="text" placeholder="Code..." onChange={(e) => setRoom(e.target.value.toUpperCase())} />
            <button className="unified-btn primary" onClick={() => joinLobby(null)}>Valider</button>
            <button className="btn-back" onClick={() => setView("menu")}>Annuler</button>
          </div>
        )}

        {/* --- AUTH MODAL --- */}
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      </div>
    );
  }




  // --- GAME ---
  return (
    <>
      {renderModal()}
      <SwipeDeck
        movies={movies}
        currentIndex={currentIndex}
        handleSwipe={handleSwipe}
        setDetailsMovie={setDetailsMovie}
        leaveRoom={leaveRoom}
        providersDisplay={providersDisplay}
      />
    </>
  );
}

export default App;