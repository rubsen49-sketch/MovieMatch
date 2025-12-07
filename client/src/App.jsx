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

function App() {
  const [room, setRoom] = useState("");
  const [isInRoom, setIsInRoom] = useState(false);
  const [movies, setMovies] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [match, setMatch] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [providers, setProviders] = useState([]);

  // Écouter les matchs
  useEffect(() => {
    socket.on("match_found", (data) => {
      setMatch(data);
    });
  }, []);

  // Charger les plateformes
  useEffect(() => {
    if (movies.length > 0 && currentIndex < movies.length) {
      const currentMovie = movies[currentIndex];
      axios.get(`https://api.themoviedb.org/3/movie/${currentMovie.id}/watch/providers?api_key=${API_KEY}`)
        .then(response => {
          const frData = response.data.results.FR;
          if (frData && frData.flatrate) {
            setProviders(frData.flatrate);
          } else {
            setProviders([]);
          }
        })
        .catch(err => console.error(err));
    }
  }, [currentIndex, movies]);

  // Rejoindre
  const joinRoom = () => {
    if (room !== "") {
      socket.emit("join_room", room);
      setIsInRoom(true);
      fetchMovies();
    }
  };

  // Récupérer films
  // 2. Récupérer les films (FILTRÉS : Dispo en France uniquement)
  // 2. Récupérer les films (Version ULTIME : Genre + Dispo FR + Anti-Navet)
  const fetchMovies = async () => {
    const today = new Date().toISOString().split('T')[0];

    let endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=fr-FR&sort_by=popularity.desc&page=1`;
    
    // Filtre Genre
    if (selectedGenre) endpoint += `&with_genres=${selectedGenre}`;

    // Filtre Dispo France (Streaming/VOD)
    endpoint += `&watch_region=FR`;
    endpoint += `&with_watch_monetization_types=flatrate|rent|buy`;
    endpoint += `&primary_release_date.lte=${today}`;

    // 👇 LE FILTRE ANTI-NAVETS 👇
    if (minRating > 0) {
      endpoint += `&vote_average.gte=${minRating}`; // Note supérieure à X
      endpoint += `&vote_count.gte=300`; // Au moins 300 votes (pour la fiabilité)
    }

    try {
      const response = await axios.get(endpoint);
      const history = JSON.parse(localStorage.getItem('watchedMovies')) || [];
      const newMovies = response.data.results.filter(movie => !history.includes(movie.id));
      setMovies(newMovies);
    } catch (error) {
      console.error("Erreur API:", error);
    }
  };

  // Swipe
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

  if (match) {
    return (
      <div className="match-overlay">
        <h1 className="match-title">IT'S A MATCH!</h1>
        <h2 style={{margin: '20px'}}>🍿 {match.title} 🍿</h2>
        <button className="primary-btn" onClick={() => setMatch(null)}>Continuer</button>
      </div>
    );
  }

  if (!isInRoom) {
    return (
      <div className="welcome-screen">
        <h1>Movie Match 🍿</h1>
        <div className="input-group">
          <input 
            type="text" 
            placeholder="Code de la salle (ex: CINE)" 
            onChange={(event) => setRoom(event.target.value)}
          />
          
          {/* SÉLECTEUR DE GENRE */}
          <select 
            onChange={(e) => setSelectedGenre(e.target.value)}
            style={{padding: '15px', borderRadius: '10px', background: '#333', color: 'white', border: 'none'}}
          >
            <option value="">🎲 Tous les genres</option>
            <option value="28">💥 Action</option>
            <option value="35">😂 Comédie</option>
            <option value="27">👻 Horreur</option>
            <option value="10749">💕 Romance</option>
            <option value="878">👽 Science-Fiction</option>
            <option value="16">🦁 Animation</option>
          </select>

          {/* 👇 SÉLECTEUR ANTI-NAVET (NOUVEAU) 👇 */}
          <select 
            onChange={(e) => setMinRating(e.target.value)}
            style={{padding: '15px', borderRadius: '10px', background: '#333', color: 'white', border: 'none', fontWeight: 'bold'}}
          >
            <option value="0">🍿 Qualité : Peu importe</option>
            <option value="6">⭐ 6/10 (Correct)</option>
            <option value="7">⭐⭐ 7/10 (Bon film)</option>
            <option value="7.5">⭐⭐⭐ 7.5/10 (Très bon)</option>
            <option value="8">💎 8/10 (Chef d'oeuvre)</option>
          </select>

          <button className="primary-btn" onClick={joinRoom}>Rejoindre</button>
          
          <button 
            onClick={() => {localStorage.removeItem('watchedMovies'); alert('Historique effacé !');}}
            style={{marginTop: '10px', background: 'transparent', border: 'none', color: '#555'}}
          >
            🗑️ Reset Historique
          </button>
        </div>
      </div>
    );
  }

  if (currentIndex >= movies.length) {
    return <div className="welcome-screen"><h1>Plus de films !</h1></div>;
  }

  const movie = movies[currentIndex];

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