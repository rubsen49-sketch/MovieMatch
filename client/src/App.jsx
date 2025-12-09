import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useGameSocket } from './hooks/useGameSocket';
import './App.css';
import { Analytics } from "@vercel/analytics/react";
import toast, { Toaster } from 'react-hot-toast';

// Components
import MovieDetailModal from './components/MovieDetailModal';
import GenreSelector from './components/GenreSelector';
import Lobby from './components/Lobby';
import SwipeDeck from './components/SwipeDeck';
import WelcomeScreen from './components/WelcomeScreen';

// ... (existing imports)

import { supabase } from './supabaseClient';
import { syncUserProfile, syncLibraryWithCloud, saveToCloud } from './services/syncService';

// Constants
import { GENRES_LIST } from './constants';

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
  const [movies, setMovies] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [view, setView] = useState("menu");
  const [showGenreSelector, setShowGenreSelector] = useState(false);
  const [providersDisplay, setProvidersDisplay] = useState([]);

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
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);
  const [showMyMatches, setShowMyMatches] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [friendLibraryTarget, setFriendLibraryTarget] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        syncUserProfile(session.user);
        syncLibraryWithCloud(session.user).then(merged => {
          setSavedMatches(merged);
          localStorage.setItem('myMatches', JSON.stringify(merged));
        });
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        syncUserProfile(session.user);
        syncLibraryWithCloud(session.user).then(merged => {
          setSavedMatches(merged);
          localStorage.setItem('myMatches', JSON.stringify(merged));
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);



  // --- SOCKET HOOK ---

  const onMatchFoundCB = (data) => {
    const currentMatches = JSON.parse(localStorage.getItem('myMatches')) || [];
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
      saveToCloud(userRef.current, newMatches);
    }
  };

  const {
    room, setRoom,
    isInRoom,
    isHost,
    gameStarted, setGameStarted,
    match, setMatch,
    playerCount,
    players,
    settings,
    updateSettings,
    createRoom,
    joinRoom, // We use this for manual joins
    startGame,
    leaveRoom,
    swipe,
    inviteFriend
  } = useGameSocket(user, onMatchFoundCB);

  const { genre: selectedGenre, rating: minRating, providers: selectedProviders, voteMode } = settings;

  // --- ACTIONS BIBLIOTHÈQUE ---
  const updateMovieStatus = (movieId, newStatus) => {
    const updated = savedMatches.map(m =>
      m.id === movieId ? { ...m, status: newStatus } : m
    );
    setSavedMatches(updated);
    localStorage.setItem('myMatches', JSON.stringify(updated));
    saveToCloud(user, updated);
  };

  const bulkUpdateMovieStatus = (movieIds, newStatus) => {
    const updated = savedMatches.map(m =>
      movieIds.includes(m.id) ? { ...m, status: newStatus } : m
    );
    setSavedMatches(updated);
    localStorage.setItem('myMatches', JSON.stringify(updated));
    saveToCloud(user, updated);
  };

  /* Removed removeMovie confirm logic for later UI improvement or kept as is, but replacing native alert/confirm */
  // NOTE: Native 'confirm' is blocking and reliable for deletes. keeping it distinct from 'toasts'.

  const removeMovie = (movieId) => {
    if (confirm("Supprimer ce film de la liste ?")) {
      const updated = savedMatches.filter(m => m.id !== movieId);
      setSavedMatches(updated);
      localStorage.setItem('myMatches', JSON.stringify(updated));
      saveToCloud(user, updated);
      toast.success("Film supprimé");
    }
  };

  const bulkRemoveMovies = (movieIds) => {
    if (confirm(`Supprimer ces ${movieIds.length} films ?`)) {
      const updated = savedMatches.filter(m => !movieIds.includes(m.id));
      setSavedMatches(updated);
      localStorage.setItem('myMatches', JSON.stringify(updated));
      saveToCloud(user, updated);
    }
  };

  // --- SOCKET & GAME LOGIC ---

  // --- SOCKET & GAME LOGIC Replaced by Hook ---

  // Wrapper for WelcomeScreen to use hook's joinRoom cleanly
  const joinLobby = (roomCodeToJoin = null) => {
    if (roomCodeToJoin) {
      // Explicit join/create logic handled inside hook if we called createRoom?
      // Wait, App.jsx joinLobby was mixing create vs join.
      // The hook has createRoom and joinRoom.
      // If we generate code -> createRoom.
      // If we type code -> joinRoom.
      joinRoom(roomCodeToJoin);
    } else if (room) {
      joinRoom(room);
    }
  };

  const generateRoomCode = () => {
    createRoom();
    // createRoom in hook handles updating `room` state and emitting events.
    // However, createRoom generates its own code internally in the hook version I wrote.
    // So we just call it. But wait, `createRoom` in hook sets the room state.
    // Does it switch view to lobby? hook updates `isInRoom`. 
    // App.jsx effect observes `isInRoom`.
    setView("lobby"); // Safe to set view here?
  };

  const handleSwipe = (direction) => {
    const currentMovie = movies[currentIndex];
    swipe(direction, currentMovie, userId);
    setCurrentIndex((prev) => prev + 1);
  };

  const toggleGenre = (id) => {
    let newGenres;
    if (selectedGenre.includes(id)) {
      newGenres = selectedGenre.filter(g => g !== id);
    } else {
      newGenres = [...selectedGenre, id];
    }
    updateSettings({ genre: newGenres });
  };

  // Side effect to update view when entering room
  useEffect(() => {
    if (isInRoom) setView("lobby");
  }, [isInRoom]);

  // Clean up socket listeners is handled by hook.  


  useEffect(() => {
    if (gameStarted) fetchMovies();
  }, [page, gameStarted]);

  useEffect(() => {
    if (gameStarted && movies.length > 0 && currentIndex >= movies.length) {
      setPage(prev => prev + 1);
    }
  }, [currentIndex, movies.length, gameStarted]);



  const resetMyMatches = () => {
    if (confirm("Vider l'historique ?")) {
      localStorage.removeItem('myMatches');
      setSavedMatches([]);
      toast.success("Historique vidé");
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
    if (!user) return toast.error("Connectez-vous !");

    try {
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', targetUsername)
        .single();

      if (pError || !profiles) return toast.error("Utilisateur introuvable.");

      const { error: fError } = await supabase
        .from('friendships')
        .insert({ user_id: user.id, friend_id: profiles.id });

      if (fError) {
        if (fError.code === '23505') toast("Déjà demandé ou amis !");
        else throw fError;
      } else {
        toast.success(`Demande envoyée à ${targetUsername} !`);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'ajout.");
    }
  };

  const handleInviteFriend = (friendProfile) => {
    inviteFriend(friendProfile);
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

  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />
      {renderModal()}

      {match ? (
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
      ) : isInRoom && !gameStarted ? (
        showGenreSelector ? (
          <GenreSelector
            selectedGenre={selectedGenre}
            toggleGenre={toggleGenre}
            onValidate={() => setShowGenreSelector(false)}
          />
        ) : (
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
            updateSettings={updateSettings}
            startGame={startGame}
            leaveRoom={leaveRoom}
            shareCode={async () => {
              if (navigator.share) {
                await navigator.share({ title: 'MovieMatch', text: `Rejoins-moi ! Code : ${room}`, url: window.location.href });
              } else {
                await navigator.clipboard.writeText(room);
                alert("Code copié !");
              }
            }}
            onOpenGenreSelector={() => setShowGenreSelector(true)}
          />
        )
      ) : !isInRoom ? (
        <WelcomeScreen
          user={user}
          view={view}
          setView={setView}
          room={room}
          setRoom={setRoom}
          generateRoomCode={generateRoomCode}
          joinLobby={joinLobby}
          showAuthModal={showAuthModal}
          setShowAuthModal={setShowAuthModal}
          showFriends={showFriends}
          setShowFriends={setShowFriends}
          showMyMatches={showMyMatches}
          setShowMyMatches={setShowMyMatches}
          savedMatches={savedMatches}
          resetMyMatches={resetMyMatches}
          setDetailsMovie={setDetailsMovie}
          updateMovieStatus={updateMovieStatus}
          removeMovie={removeMovie}
          bulkUpdateMovieStatus={bulkUpdateMovieStatus}
          bulkRemoveMovies={bulkRemoveMovies}
          friendLibraryTarget={friendLibraryTarget}
          setFriendLibraryTarget={setFriendLibraryTarget}
          handleInviteFriend={handleInviteFriend}
          isInRoom={isInRoom}
        />
      ) : (
        <SwipeDeck
          movies={movies}
          currentIndex={currentIndex}
          handleSwipe={handleSwipe}
          setDetailsMovie={setDetailsMovie}
          leaveRoom={leaveRoom}
          providersDisplay={providersDisplay}
        />
      )}
    </>
  );

  export default App;