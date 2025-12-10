import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useGameSocket } from './hooks/useGameSocket';
import './App.css';
import { Analytics } from "@vercel/analytics/react";
import toast, { Toaster } from 'react-hot-toast';

// Components
import MainLayout from './components/MainLayout'; // [NEW] Wrapper
import ErrorBoundary from './components/ErrorBoundary'; // [NEW] Error Handling
import MovieDetailModal from './components/MovieDetailModal';
import GenreSelector from './components/GenreSelector';
import Lobby from './components/Lobby';
import SwipeDeck from './components/SwipeDeck';
import WelcomeScreen from './components/WelcomeScreen';
import ResultsView from './components/ResultsView'; // Needed for direct tab access
import { seededShuffle } from './utils/gameUtils'; // Restore seeded shuffle logic // Needed for direct tab access
import AuthModal from './components/AuthModal';
import FriendsView from './components/FriendsView'; // [NEW] Import missing component to fix crash

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
  // [AMÉLIORATION] Start on a random page (1-15) to vary content ("Never the same")
  const [page, setPage] = useState(() => Math.floor(Math.random() * 15) + 1);
  const [view, setView] = useState("menu");
  const [showGenreSelector, setShowGenreSelector] = useState(false);
  const [providersDisplay, setProvidersDisplay] = useState([]);

  // [NEW] Navigation State
  const [activeTab, setActiveTab] = useState('home'); // 'home', 'matches', 'friends'

  // Advanced Filter Defaults
  const [yearRange, setYearRange] = useState({ min: 1970, max: new Date().getFullYear() });


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
  // const [showMyMatches, setShowMyMatches] = useState(false); // Deprecated in favor of activeTab
  // const [showFriends, setShowFriends] = useState(false); // Deprecated in favor of activeTab
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
    match, setMatch, // [DEBUG] Check match object here?
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

  const { genre: selectedGenre, rating: minRating, providers: selectedProviders, voteMode, discoveryMode } = settings;

  // NOTE: yearRange is currently local state or needs to be synced via settings? 
  // For simplicity V1: Local to the person fetching (Host drives the API calls mostly).
  // Ideally should be in 'settings' for sync. 
  // Let's assume we treat it as local preference for now OR update syncSettings if requested.
  // User asked for "Filters".


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
      joinRoom(roomCodeToJoin);
    } else if (room) {
      joinRoom(room);
    }
  };

  const generateRoomCode = () => {
    createRoom();
    setView("lobby"); // Safe to set view here?
  };

  const handleSwipe = (direction) => {
    const currentMovie = movies[currentIndex];
    swipe(direction, currentMovie, userId);
    setCurrentIndex((prev) => prev + 1);
  };

  const handleUndo = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      toast("Retour arrière ↩️");
      // TODO: Emit 'undo_vote' if we want to cancel server vote.
    }
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

  const fetchMovies = async () => {
    if (!API_KEY) {
      console.error("API Key missing");
      return;
    }

    // [MODES DE JEU]
    // 1. Populaire (Trending): sort_by=popularity.desc
    // 2. Classique (Top All Time): sort_by=vote_count.desc
    const sortParam = (settings.discoveryMode === 'classic') ? 'vote_count.desc' : 'popularity.desc';

    let endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=fr-FR&sort_by=${sortParam}&page=${page}`;

    // Debug
    console.log(`Fetching mode: ${settings.discoveryMode || 'default'} (Sort: ${sortParam})`);

    if (selectedGenre.length > 0) {
      endpoint += `&with_genres=${selectedGenre.join(',')}`;
    }

    // YEAR FILTER
    endpoint += `&watch_region=FR`;
    if (yearRange.min) endpoint += `&primary_release_date.gte=${yearRange.min}-01-01`;
    if (yearRange.max) endpoint += `&primary_release_date.lte=${yearRange.max}-12-31`;

    // Ensure they are "known" (300+ votes)
    // Note: vote_count.desc implicitly handles this, but if user filters by year/genre, this helps maintain quality
    if (minRating > 0) {
      endpoint += `&vote_average.gte=${minRating}&vote_count.gte=300`;
    } else {
      // Default quality filter even without rating
      endpoint += `&vote_count.gte=300`;
    }

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
        // SEEDED SHUFFLE: Ensure all users see movies in same random order based on room code
        // We incorporate 'page' into the seed so page 2 is also shuffled deterministically but differently from page 1
        const shuffledMovies = seededShuffle(newMovies, `${room}-${page}`);
        setMovies(shuffledMovies);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error("Erreur API:", error);
      toast.error("Erreur chargement films");
    }
  };


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

  const renderContent = () => {
    // 1. MATCH OVERLAY (Top Priority - Global)
    if (match) {
      console.log("Rendering Match Overlay with:", match); // [DEBUG]
      return (
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
      );
    }

    // 2. TABS NAVIGATION (Matches, Friends) - Priority over Lobby/Home
    if (activeTab === 'matches') {
      return (
        <ResultsView
          savedMatches={savedMatches}
          onClose={() => setActiveTab('home')}
          resetMyMatches={resetMyMatches}
          onDetails={(movieData) => setDetailsMovie(movieData)}
          onUpdateStatus={updateMovieStatus}
          onRemove={removeMovie}
          onBulkUpdate={bulkUpdateMovieStatus}
          onBulkRemove={bulkRemoveMovies}
          currentUser={user}
        />
      );
    }

    if (activeTab === 'friends') {
      return (
        <ErrorBoundary>
          <FriendsView
            onClose={() => setActiveTab('home')}
            currentUser={user}
            onViewLibrary={(friend) => {
              console.log("View friend library", friend);
              setFriendLibraryTarget(friend);
            }}
            onInvite={handleInviteFriend}
            isInRoom={isInRoom}
          />
        </ErrorBoundary>
      );
    }

    // 3. HOME TAB (Welcome OR Game/Lobby)
    // If we are in a room, Home tab becomes the Game View
    const [restoreSettingsOnLobbyReturn, setRestoreSettingsOnLobbyReturn] = useState(false);

    // If we are in a room, Home tab becomes the Game View
    if (isInRoom) {
      if (!gameStarted) {
        return showGenreSelector ? (
          <GenreSelector
            selectedGenre={selectedGenre}
            toggleGenre={toggleGenre}
            yearRange={yearRange}
            setYearRange={setYearRange}
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
              genre: selectedGenre,
              discoveryMode: settings.discoveryMode // Direct access or destructured
            }}
            updateSettings={updateSettings}
            startGame={startGame}
            leaveRoom={leaveRoom}
            initialSettingsOpen={restoreSettingsOnLobbyReturn} // Pass restoration flag
            shareCode={async () => {
              if (navigator.share) {
                await navigator.share({ title: 'MovieMatch', text: `Rejoins-moi ! Code : ${room}`, url: window.location.href });
              } else {
                await navigator.clipboard.writeText(room);
                alert("Code copié !");
              }
            }}
            onOpenGenreSelector={(fromSettings = false) => {
              setRestoreSettingsOnLobbyReturn(fromSettings);
              setShowGenreSelector(true);
            }}
          />
        );
      } else {
        return (
          <SwipeDeck
            movies={movies}
            currentIndex={currentIndex}
            handleSwipe={handleSwipe}
            handleUndo={handleUndo}
            setDetailsMovie={setDetailsMovie}
            leaveRoom={leaveRoom}
            providersDisplay={providersDisplay}
          />
        );
      }
    }

    // Default Home (No Game)
    if (showAuthModal) return <AuthModal onClose={() => setShowAuthModal(false)} />;

    return (
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
        setShowFriends={() => setActiveTab('friends')}
        setShowMyMatches={() => setActiveTab('matches')}
      />
    );
  };

  // ... (keep props and logic)

  // --- RENDER CONTENT WRAPPER ---
  const renderAnimatedContent = () => {
    // Unique key determination for animations
    let key = activeTab; // Default key
    if (activeTab === 'home') {
      if (isInRoom && !gameStarted) key = 'lobby';
      else if (isInRoom && gameStarted) key = 'game';
      else if (showAuthModal) key = 'auth';
      else if (match) key = 'match';
      else key = 'dashboard';
    }

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          style={{ width: '100%', height: '100%' }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <MainLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      user={user}
      onLogout={() => supabase.auth.signOut()}
    >
      <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />

      {/* Return to Game Pill */}
      {isInRoom && activeTab !== 'home' && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="return-to-game-pill"
          onClick={() => setActiveTab('home')}
        >
          <span>🔴 Partie en cours</span>
          <strong>Revenir ↩️</strong>
        </motion.div>
      )}

      {renderModal()}

      {/* Animated Content Wrapper */}
      {renderAnimatedContent()}
    </MainLayout>
  );

}

export default App;