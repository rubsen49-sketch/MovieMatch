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
    // On récupère les infos du film (Image + Titre)
    axios.get(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&language=fr-FR`)
      .then(res => setMovieData(res.data))
      .catch(err => console.error(err));
  }, [movieId]);

  if (!movieData) return <div className="mini-card">Chargement...</div>;

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
  
  // NOUVEAU : État pour afficher la page "Mes Matchs"
  const [showMyMatches, setShowMyMatches] = useState(false);
  const [savedMatches, setSavedMatches] = useState(() => {
    const saved = localStorage.getItem('myMatches');
    return saved ? JSON.parse(saved) : [];
  });

  // Écouter les matchs (Et les sauvegarder !)
  useEffect(() => {
    socket.on("match_found", (data) => {
      setMatch(data);
      
      // SAUVEGARDE DU MATCH
      const currentMatches = JSON.parse(localStorage.getItem('myMatches')) || [];
      // On évite les doublons
      if (!currentMatches.includes(data.movieId)) {
        const newMatches = [data.movieId, ...currentMatches];
        localStorage.setItem('myMatches', JSON.stringify(newMatches));
        setSavedMatches(newMatches);
      }
    });
  }, []);

  // Charger les plateformes de streaming
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

  const joinRoom = () => {
    if (room !== "") {
      socket.emit("join_room", room);
      setIsInRoom(true);
      fetchMovies();
    }
  };

  const fetchMovies = async () => {
    const today = new Date().toISOString().split('T')[0];
    let endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=fr-FR&sort_by=popularity.desc&page=1`;
    
    if (selectedGenre) endpoint += `&with_genres=${selectedGenre}`;
    endpoint += `&watch_region=FR&with_watch_monetization_types=flatrate|rent|buy&primary_release_date.lte=${today}`;
    if (minRating > 0) endpoint += `&vote_average.gte=${minRating}&vote_count.gte=300`;

    try {
      const response = await axios.get(endpoint);
      const history = JSON.parse(localStorage.getItem('watchedMovies')) || [];
      const newMovies = response.data.results.filter(movie => !history.includes(movie.id));
      setMovies(newMovies);
    } catch (error) {
      console.error("Erreur API:", error);
    }
  };

  const handleSwipe = (direction) => {
    const currentMovie = movies[currentIndex];
    if (direction === "right") {
      socket.emit("swipe_right", { room, movieId: currentMovie.id, movieTitle: currentMovie.title });
    }
    const history = JSON.parse(localStorage.getItem('watchedMovies')) || [];
    if (!history.includes(currentMovie.id)) {
      history.push(currentMovie.id);
      localStorage.setItem('watchedMovies', JSON.stringify(history));
    }
    setCurrentIndex((prev) => prev + 1);
  };

  // Animation
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
        <h1>🏆 Mes Trophées</h1>
        <div className="matches-grid">
          {savedMatches.length === 0 ? (
            <p>Pas encore de match... Au boulot !</p>
          ) : (
            savedMatches.map(id => <MatchItem key={id} movieId={id} />)
          )}
        </div>
        <button 
          onClick={() => {localStorage.removeItem('myMatches'); setSavedMatches([]);}}
          style={{background: 'transparent', border: '1px solid #555', color: '#888', padding: '10px', marginTop: '30px'}}
        >
          🗑️ Vider la liste
        </button>
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

  // --- ECRAN : ACCUEIL ---
  if (!isInRoom) {
    return (
      <div className="welcome-screen">
        <h1>Movie Match 🍿</h1>
        <div className="input-group">
          <input type="text" placeholder="Code (ex: CINE)" onChange={(e) => setRoom(e.target.value)} />
          
          <select onChange={(e) => setSelectedGenre(e.target.value)} style={{padding: '15px', borderRadius: '10px', background: '#333', color: 'white', border: 'none'}}>
            <option value="">🎲 Tous les genres</option>
            <option value="28">💥 Action</option>
            <option value="35">😂 Comédie</option>
            <option value="27">👻 Horreur</option>
            <option value="10749">💕 Romance</option>
            <option value="16">🦁 Animation</option>
          </select>

          <select onChange={(e) => setMinRating(e.target.value)} style={{padding: '15px', borderRadius: '10px', background: '#222', color: '#ffd700', border: 'none', fontWeight: 'bold'}}>
            <option value="0">🍿 Qualité : Peu importe</option>
            <option value="7">⭐⭐ 7/10 (Bon film)</option>
            <option value="8">💎 8/10 (Pépite)</option>
          </select>

          <button className="primary-btn" onClick={joinRoom}>Rejoindre</button>
          
          {/* BOUTON POUR VOIR MES MATCHS */}
          <button 
            onClick={() => setShowMyMatches(true)}
            style={{marginTop: '15px', background: '#333', border: 'none', color: 'white', padding: '15px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold'}}
          >
            🏆 Voir mes Matchs ({savedMatches.length})
          </button>

          <button onClick={() => {localStorage.removeItem('watchedMovies'); alert('Reset !');}} style={{marginTop: '10px', background: 'transparent', border: 'none', color: '#555'}}>🗑️ Reset Historique</button>
        </div>
      </div>
    );
  }

  // --- ECRAN : PLUS DE FILMS ---
  if (currentIndex >= movies.length) {
    return <div className="welcome-screen"><h1>Plus de films !</h1></div>;
  }

  const movie = movies[currentIndex];

  // --- ECRAN : CARTE FILM ---
  return (
    <div className="card-container">
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