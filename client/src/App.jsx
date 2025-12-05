import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css'; // Tu pourras styliser après

const SOCKET_URL = import.meta.env.MODE === 'development' 
  ? "http://localhost:3001" 
  : "https://moviematch-backend.onrender.com"; // On va créer cette adresse juste après !

const socket = io.connect(SOCKET_URL);

// ⚠️ COLLE TA CLÉ API TMDB ICI ENTRE LES GUILLEMETS ⚠️
const API_KEY = "14b0ba35c145028146e0adf24bfcfd03"; 

function App() {
  const [room, setRoom] = useState("");
  const [isInRoom, setIsInRoom] = useState(false);
  const [movies, setMovies] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [match, setMatch] = useState(null);

  // Écouter les matchs venant du serveur
  useEffect(() => {
    socket.on("match_found", (data) => {
      setMatch(data); // Affiche la popup de match
    });
  }, []);

  // 1. Fonction pour rejoindre la salle
  const joinRoom = () => {
    if (room !== "") {
      socket.emit("join_room", room);
      setIsInRoom(true);
      fetchMovies(); // On charge les films dès qu'on rejoint
    }
  };

  // 2. Récupérer les films populaires via l'API
  const fetchMovies = async () => {
    try {
      const response = await axios.get(
        `https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=fr-FR&page=1`
      );
      setMovies(response.data.results);
    } catch (error) {
      console.error("Erreur API:", error);
    }
  };

  // 3. Gestion du Swipe (J'aime / J'aime pas)
  const handleSwipe = (direction) => {
    const currentMovie = movies[currentIndex];

    if (direction === "right") {
      socket.emit("swipe_right", {
        room,
        movieId: currentMovie.id,
        movieTitle: currentMovie.title
      });
    }

    // Passer au film suivant
    setCurrentIndex((prev) => prev + 1);
  };

  // --- RENDU DE L'INTERFACE ---

  // Écran de Match !
  if (match) {
    return (
      <div className="match-overlay">
        <h1 className="match-title">IT'S A MATCH!</h1>
        <h2 style={{margin: '20px'}}>🍿 {match.title} 🍿</h2>
        <button className="primary-btn" onClick={() => setMatch(null)}>
          Continuer à swiper
        </button>
      </div>
    );
  }

  // Écran d'accueil (Rejoindre une salle)
  if (!isInRoom) {
    return (
      <div className="welcome-screen">
        <h1>Movie Match</h1>
        <p>Trouvez un film à regarder ensemble.</p>
        <div className="input-group">
          <input 
            type="text" 
            placeholder="Code de la salle (ex: PIZZA)" 
            onChange={(event) => setRoom(event.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
          />
          <button className="primary-btn" onClick={joinRoom}>Rejoindre la salle</button>
        </div>
      </div>
    );
  }

  // Écran de fin
  if (currentIndex >= movies.length) {
    return (
        <div className="welcome-screen">
            <h1>Plus de films ! 😢</h1>
            <p>Essayez de relancer l'appli ou changez de filtres.</p>
        </div>
    );
  }

  // Écran de Swipe (Carte du film)
  const movie = movies[currentIndex];
  return (
    <div className="card-container">
      <div className="movie-card">
        <img 
          className="movie-poster"
          src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} 
          alt={movie.title} 
        />
        <div className="movie-info">
          <div>
            <h2>{movie.title}</h2>
            <p className="movie-desc">{movie.overview}</p>
          </div>
          
          <div className="actions">
            <button className="btn-circle btn-pass" onClick={() => handleSwipe("left")}>
              ✖️
            </button>
            <button className="btn-circle btn-like" onClick={() => handleSwipe("right")}>
              ❤️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;