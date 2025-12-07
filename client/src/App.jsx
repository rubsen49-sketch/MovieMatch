import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';
import { motion, useMotionValue, useTransform } from 'framer-motion';

const SOCKET_URL = import.meta.env.MODE === 'development' 
  ? "http://localhost:3001" 
  : "https://moviematch-backend-0om3.onrender.com";

const socket = io.connect(SOCKET_URL);
const API_KEY = "14b0ba35c145028146e0adf24bfcfd03"; 

// Petit composant pour afficher un film dans la liste des matchs
const MatchItem = ({ movieId }) => {
  const [movieData, setMovieData] = useState(null);

  useEffect(() => {
    axios.get(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&language=fr-FR`)
      .then(res => setMovieData(res.data))
      .catch(err => console.error(err));
  }, [movieId]);

  if (!movieData) return <div className="mini-card">...</div>;

  return (
    <div className="mini-card">
      <img src={`https://image.tmdb.org/t/p/w300${movieData.poster_path}`} alt={movieData.title} />
      <h3>{movieData.title}</h3>
    </div>
  );
};

function App() {
  const [room, setRoom] = useState("");
  const [isInRoom, setIsInRoom] = useState(false);
  const [movies, setMovies] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [match, setMatch] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [providers, setProviders] = useState([]);
  const [page, setPage] = useState(1);
  
  // NOUVEAU : Gère quelle vue afficher (menu, create, join)
  const [view, setView] = useState("menu"); 

  const [showMyMatches, setShowMyMatches] = useState(false);
  
  const [savedMatches, setSavedMatches] = useState(() => {
    const saved = localStorage.getItem('myMatches');
    return saved ? JSON.parse(saved) : [];
  });

  // --- GÉNÉRATEUR DE CODE ALÉATOIRE ---
  const generateRoomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRoom(result);
    setView("create"); // On passe à l'écran de paramétrage
  };

  const fetchMovies = async () => {
    const today = new Date().toISOString().split('T')[0];
    let endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=fr-FR&sort_by=popularity.desc&page=${page}`;
    
    if (selectedGenre) endpoint += `&with_genres=${selectedGenre}`;
    endpoint += `&watch_region=FR&with_watch_monetization_types=flatrate|rent|buy&primary_release_date.lte=${today}`;
    if (minRating > 0) endpoint += `&vote_average.gte=${minRating}&vote_count.gte=300`;

    try {
      const response = await axios.get(endpoint);
      const trophies = JSON.parse(localStorage.getItem('myMatches')) || [];
      const newMovies = response.data.results.filter(movie => !trophies.includes(movie.id));
      
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
    socket.on("match_found", (data) => {
      setMatch(data);
      const currentMatches = JSON.parse(localStorage.getItem('myMatches')) || [];
      if (!currentMatches.includes(data.movieId)) {
        const newMatches = [data.movieId, ...currentMatches];
        localStorage.setItem('myMatches', JSON.stringify(newMatches));
        setSavedMatches(newMatches);
      }
    });
  }, []);

  useEffect(() => {
    if (movies.length > 0 && currentIndex < movies.length) {
      const currentMovie = movies[currentIndex];
      axios.get(`https://api.themoviedb.org/3/movie/${currentMovie.id}/watch/providers?api_key=${API_KEY}`)
        .then(response => {
          const frData = response.data.results.FR;
          if (frData && frData.flatrate) setProviders(frData.flatrate);
          else setProviders([]);
        })
        .catch(err => console.error(err));
    }
  }, [currentIndex, movies]);

  useEffect(() => {
    if (isInRoom && movies.length > 0 && currentIndex >= movies.length) {
      setPage(prev => prev + 1);
    }
  }, [currentIndex, movies.length, isInRoom]);

  useEffect(() => {
    if (isInRoom) {
      fetchMovies();
    }
  }, [page, isInRoom]);

  const joinRoom = () => {
    if (room !== "") {
      socket.emit("join_room", room);
      setIsInRoom(true);
      setPage(1); 
      setMovies([]); 
      setCurrentIndex(0);
    }
  };

  const leaveRoom = () => {
    setIsInRoom(false);
    setMovies([]);
    setCurrentIndex(0);
    setPage(1);
    setRoom("");
    setView("menu"); // Retour au menu principal
  };

  const handleSwipe = (direction) => {
    const currentMovie = movies[currentIndex];
    if (direction === "right") {
      socket.emit("swipe_right", { room, movieId: currentMovie.id, movieTitle: currentMovie.title });
    }
    setCurrentIndex((prev) => prev + 1);
  };

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-30, 30]);
  const opacity = useTransform(x, [-150, 0, 150], [0.5, 1, 0.5]);
  const handleDragEnd = (event, info) => {
    if (info.offset.x > 100) handleSwipe("right");
    else if (info.offset.x < -100) handleSwipe("left");
  };

  // --- ECRAN : MES MATCHS ---
  if (showMyMatches) {
    return (
      <div className="matches-screen">
        <button className="btn-back" onClick={() => setShowMyMatches(false)}>⬅ Retour</button>
        <h2>🏆 Mes Trophées</h2>
        <div className="matches-grid">
          {savedMatches.length === 0 ? (
            <p>Pas encore de match...</p>
          ) : (
            savedMatches.map(id => <MatchItem key={id} movieId={id} />)
          )}
        </div>
      </div>
    );
  }

  // --- ECRAN : C'EST UN MATCH ---
  if (match) {
    return (
      <div className="match-overlay">
        <h1 className="match-title">IT'S A MATCH!</h1>
        <h2 style={{margin: '20px'}}>🍿 {match.title} 🍿</h2>
        <button className="primary-btn" onClick={() => setMatch(null)}>Continuer à swiper</button>
      </div>
    );
  }

  // --- ECRAN : ACCUEIL (Gère les 3 vues) ---
  if (!isInRoom) {
    return (
      <div className="welcome-screen">
        <h1>Movie Match 🍿</h1>

        {/* VUE 1 : MENU PRINCIPAL */}
        {view === "menu" && (
          <div className="menu-buttons">
            <button className="big-btn btn-create" onClick={generateRoomCode}>
              ✨ Créer une salle
            </button>
            <button className="big-btn btn-join" onClick={() => setView("join")}>
              🚀 Rejoindre
            </button>
            <button 
              onClick={() => setShowMyMatches(true)}
              style={{marginTop: '20px', background: 'transparent', border: 'none', color: '#888', textDecoration: 'underline', cursor: 'pointer'}}
            >
              Voir mes trophées 🏆
            </button>
          </div>
        )}

        {/* VUE 2 : REJOINDRE (Juste le code) */}
        {view === "join" && (
          <div className="input-group">
            <input 
              type="text" 
              placeholder="Entrez le code..." 
              onChange={(e) => setRoom(e.target.value.toUpperCase())}
            />
            <button className="primary-btn" onClick={joinRoom}>Valider</button>
            <button className="btn-back" style={{marginTop: '10px'}} onClick={() => setView("menu")}>Annuler</button>
          </div>
        )}

        {/* VUE 3 : CRÉER (Code + Paramètres) */}
        {view === "create" && (
          <div className="input-group">
            <p style={{marginBottom: '5px', color: '#aaa'}}>Voici le code de votre salle :</p>
            <div className="room-code-display">
              <h2 className="code-text">{room}</h2>
            </div>
            
            <div className="room-settings">
              <label>🎬 Genre de film :</label>
              <select onChange={(e) => setSelectedGenre(e.target.value)}>
                <option value="">🎲 Tous les genres</option>
                <option value="28">💥 Action</option>
                <option value="35">😂 Comédie</option>
                <option value="27">👻 Horreur</option>
                <option value="10749">💕 Romance</option>
                <option value="16">🦁 Animation</option>
              </select>

              <label>⭐ Qualité minimum :</label>
              <select onChange={(e) => setMinRating(e.target.value)}>
                <option value="0">🍿 Peu importe</option>
                <option value="7">⭐⭐ 7/10 (Bon)</option>
                <option value="8">💎 8/10 (Excellent)</option>
              </select>
            </div>

            <button className="primary-btn" style={{marginTop: '20px'}} onClick={joinRoom}>Lancer la session !</button>
            <button className="btn-back" style={{marginTop: '10px'}} onClick={() => setView("menu")}>Annuler</button>
          </div>
        )}
      </div>
    );
  }

  // --- ECRAN : CHARGEMENT ---
  if (currentIndex >= movies.length) {
    return <div className="welcome-screen"><h2>Chargement de la suite...</h2></div>;
  }

  const movie = movies[currentIndex];

  // --- ECRAN : CARTE FILM ---
  return (
    <div className="card-container">
      <button className="btn-quit" onClick={leaveRoom}>⬅ Quitter</button>
      <motion.div 
        className="movie-card"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={handleDragEnd}
        style={{ x, rotate, opacity }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <img className="movie-poster" src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={movie.title} draggable="false" />
        <div className="movie-info">
          <div className="text-content">
            <div className="providers-container">
              {providers.map((p) => (
                <img key={p.provider_id} src={`https://image.tmdb.org/t/p/original${p.logo_path}`} className="provider-logo" title={p.provider_name} />
              ))}
            </div>
            <h2>{movie.title}</h2>
            <p className="movie-desc">{movie.overview}</p>
          </div>
          <div className="actions">
            <button className="btn-circle btn-pass" onClick={() => handleSwipe("left")}>✖️</button>
            <button className="btn-circle btn-like" onClick={() => handleSwipe("right")}>❤️</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default App;