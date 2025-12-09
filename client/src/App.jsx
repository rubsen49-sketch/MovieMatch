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
  const [showMyMatches, setShowMyMatches] = useState(false);

  // Settings State
  const [selectedGenre, setSelectedGenre] = useState([]);
  const [showGenreSelector, setShowGenreSelector] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [selectedProviders, setSelectedProviders] = useState([]);
  const [voteMode, setVoteMode] = useState('majority');

  const [providersDisplay, setProvidersDisplay] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const userId = useRef(getUserId()).current;
  const [savedMatches, setSavedMatches] = useState(() => {
    const saved = localStorage.getItem('myMatches');
    return saved ? JSON.parse(saved) : [];
  });
  const [detailsMovie, setDetailsMovie] = useState(null);

  // --- SOCKET & GAME LOGIC ---

  const joinLobby = (roomCodeToJoin = null) => {
    const targetRoom = roomCodeToJoin || room;
    if (targetRoom !== "") {
      const seed = targetRoom.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const randomPage = (seed % 30) + 1;
      setPage(randomPage);

      if (isHost || roomCodeToJoin) {
        socket.emit("create_room", targetRoom);
        setIsInRoom(true);
        setGameStarted(false);
        setView("lobby");
      } else {
        socket.emit("join_room", targetRoom, (response) => {
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
    socket.on("settings_update", (settings) => {
      if (settings.genre !== undefined) setSelectedGenre(settings.genre);
      if (settings.rating !== undefined) setMinRating(settings.rating);
      if (settings.providers !== undefined) setSelectedProviders(settings.providers);
      if (settings.voteMode !== undefined) setVoteMode(settings.voteMode);
    });
    socket.on("game_started", () => setGameStarted(true));
    socket.on("match_found", (data) => {
      setMatch(data);
      const currentMatches = JSON.parse(localStorage.getItem('myMatches')) || [];
      if (!currentMatches.includes(data.movieId)) {
        const newMatches = [data.movieId, ...currentMatches];
        localStorage.setItem('myMatches', JSON.stringify(newMatches));
        setSavedMatches(newMatches);
      }
    });

    return () => {
      socket.off("player_count_update");
      socket.off("settings_update");
      socket.off("game_started");
      socket.off("match_found");
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


  // --- RENDER ---

  const renderModal = () => {
    if (!detailsMovie) return null;
    return <MovieDetailModal movie={detailsMovie} onClose={() => setDetailsMovie(null)} />;
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
          <button className="primary-btn" onClick={() => setMatch(null)}>Continuer</button>
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

    return (
      <Lobby
        room={room}
        playerCount={playerCount}
        isHost={isHost}
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
    );
  }

  if (!isInRoom) {
    return (
      <div className="welcome-screen">
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
            <button className="primary-btn" onClick={() => joinLobby(null)}>Valider</button>
            <button className="btn-back" onClick={() => setView("menu")}>Annuler</button>
          </div>
        )}
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