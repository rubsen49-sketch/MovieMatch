import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';
import { motion, useMotionValue, useTransform } from 'framer-motion';

const SOCKET_URL = import.meta.env.MODE === 'development' 
  ? "http://localhost:3001" 
  : "https://moviematch-backend-0om3.onrender.com";

const socket = io.connect(SOCKET_URL);
const API_KEY = "14b0ba35c145028146e0adf24bfcfd03"; 

// Fonction utilitaire pour générer ou récupérer un ID unique par appareil
const getUserId = () => {
  let id = localStorage.getItem('userId');
  if (!id) {
    id = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('userId', id);
  }
  return id;
};

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
  const [gameStarted, setGameStarted] = useState(false);
  
  const [movies, setMovies] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [match, setMatch] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [providers, setProviders] = useState([]);
  const [page, setPage] = useState(1);
  const [view, setView] = useState("menu"); 
  const [showMyMatches, setShowMyMatches] = useState(false);
  
  const [isHost, setIsHost] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const userId = useRef(getUserId()).current; // ID unique stable

  const [savedMatches, setSavedMatches] = useState(() => {
    const saved = localStorage.getItem('myMatches');
    return saved ? JSON.parse(saved) : [];
  });

  // --- FONCTIONS LOGIQUES ---

  // Refonte de la fonction rejoindre pour accepter un argument optionnel
  const joinLobby = (roomCodeToJoin = null) => {
    const targetRoom = roomCodeToJoin || room;
    if (targetRoom !== "") {
      if (isHost || roomCodeToJoin) { // Si c'est l'hôte ou une création directe
        socket.emit("create_room", targetRoom);
        setIsInRoom(true);
        setGameStarted(false);
        setView("lobby");
      } else {
        // L'invité REJOINT (avec vérification serveur)
        socket.emit("join_room", targetRoom, (response) => {
          if (response.status === "ok") {
            setIsInRoom(true);
            setGameStarted(false);
            setView("lobby");
          } else {
            alert("Cette salle n'existe pas ou le code est incorrect.");
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
    // On rejoint directement le lobby avec le nouveau code, sans passer par une vue intermédiaire buggée
    joinLobby(result); 
  };

  const updateSettings = (newGenre, newRating) => {
    if (newGenre !== null) setSelectedGenre(newGenre);
    if (newRating !== null) setMinRating(newRating);

    socket.emit("update_settings", {
      room: room,
      genre: newGenre !== null ? newGenre : selectedGenre,
      rating: newRating !== null ? newRating : minRating
    });
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

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    socket.on("player_count_update", (count) => setPlayerCount(count));

    socket.on("settings_update", (data) => {
      setSelectedGenre(data.genre);
      setMinRating(data.rating);
    });

    socket.on("game_started", () => {
      setGameStarted(true);
    });

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

  // --- CHARGEMENT DES FILMS ---
  useEffect(() => {
    if (gameStarted) {
      fetchMovies();
    }
  }, [page, gameStarted]); 

  // --- LOGIQUE INFINIE ---
  useEffect(() => {
    if (gameStarted && movies.length > 0 && currentIndex >= movies.length) {
      setPage(prev => prev + 1);
    }
  }, [currentIndex, movies.length, gameStarted]);


  // --- ACTIONS UTILISATEUR ---

  const startGame = () => {
    socket.emit("start_game", room);
  };

  const leaveRoom = () => {
    setIsInRoom(false);
    setGameStarted(false);
    setMovies([]);
    setCurrentIndex(0);
    setPage(1);
    setRoom("");
    setView("menu");
    setIsHost(false);
    // On recharge pour nettoyer proprement les sockets
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
        userId: userId // 👈 IMPORTANT : On envoie ton ID unique
      });
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

  const resetMyMatches = () => {
    if(confirm("Voulez-vous vraiment effacer tous vos matchs ?")) {
      localStorage.removeItem('myMatches');
      setSavedMatches([]);
    }
  };

  // --- ECRANS D'AFFICHAGE ---

  // 1. ECRAN MES MATCHS
  if (showMyMatches) {
    return (
      <div className="matches-screen">
        <button className="btn-back" onClick={() => setShowMyMatches(false)}>Retour</button>
        <h2>Mes Matchs</h2>
        
        {savedMatches.length > 0 && (
          <button 
            onClick={resetMyMatches}
            style={{
              background: '#333', color: '#ff4757', border: '1px solid #ff4757', 
              padding: '8px 15px', borderRadius: '20px', marginBottom: '15px', cursor: 'pointer'
            }}
          >
            🗑️ Réinitialiser mes matchs
          </button>
        )}

        <div className="matches-grid">
          {savedMatches.map(id => <MatchItem key={id} movieId={id} />)}
        </div>
      </div>
    );
  }

  // 2. POPUP MATCH
  if (match) {
    return (
      <div className="match-overlay">
        <h1 className="match-title">IT'S A MATCH!</h1>
        {match.moviePoster && (
          <img 
            src={`https://image.tmdb.org/t/p/w300${match.moviePoster}`} 
            alt={match.movieTitle} 
            style={{borderRadius: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', margin: '20px 0', maxHeight: '300px'}}
          />
        )}
        <h2 style={{margin: '10px 0 30px 0'}}>{match.movieTitle}</h2>
        <button className="primary-btn" onClick={() => setMatch(null)}>Continuer</button>
      </div>
    );
  }

  // 3. LOBBY
  if (isInRoom && !gameStarted) {
    return (
      <div className="welcome-screen">
        <h1>Salle d'attente</h1>
        
        <div 
          className="room-code-display" 
          onClick={shareCode}
          title="Toucher pour partager"
        >
          <h2 className="code-text">{room}</h2>
          <span className="click-hint">Toucher pour copier</span>
        </div>

        <p style={{color: '#aaa', marginBottom: '20px'}}>
          Joueurs connectés : <strong style={{color: 'white', fontSize: '1.2rem'}}>{playerCount}</strong>
        </p>

        {isHost ? (
          <div className="room-settings">
            <label>Genre :</label>
            <select value={selectedGenre} onChange={(e) => updateSettings(e.target.value, null)}>
              <option value="">Tous les genres</option>
              <option value="28">Action</option>
              <option value="35">Comédie</option>
              <option value="27">Horreur</option>
              <option value="10749">Romance</option>
              <option value="16">Animation</option>
            </select>

            <label>Qualité :</label>
            <select value={minRating} onChange={(e) => updateSettings(null, e.target.value)}>
              <option value="0">Peu importe</option>
              <option value="7">7/10 (Bon)</option>
              <option value="8">8/10 (Excellent)</option>
            </select>

            <button className="primary-btn" style={{marginTop: '30px'}} onClick={startGame}>
              LANCER LA PARTIE
            </button>
          </div>
        ) : (
          <div style={{marginTop: '30px', padding: '20px', background: '#333', borderRadius: '15px'}}>
            <p className="pulse">En attente de l'hôte pour le lancement de la partie...</p>
          </div>
        )}
        
        <button className="btn-back" style={{marginTop: '15px'}} onClick={leaveRoom}>Quitter</button>
      </div>
    );
  }

  // 4. MENU ACCUEIL
  if (!isInRoom) {
    return (
      <div className="welcome-screen">
        <h1>Movie Match</h1>

        {view === "menu" && (
          <div className="menu-buttons">
            <button className="big-btn btn-create" onClick={generateRoomCode}>Créer une salle</button>
            <button className="big-btn btn-join" onClick={() => setView("join")}>Rejoindre</button>
            <button onClick={() => setShowMyMatches(true)} style={{marginTop: '20px', background: 'transparent', border: 'none', color: '#888', textDecoration: 'underline'}}>Voir mes matchs</button>
          </div>
        )}

        {view === "join" && (
          <div className="input-group">
            <input 
              type="text" 
              placeholder="Entrez le code..." 
              onChange={(e) => setRoom(e.target.value.toUpperCase())}
            />
            {/* on passe null pour dire qu'on utilise le state 'room' */}
            <button className="primary-btn" onClick={() => joinLobby(null)}>Valider</button>
            <button className="btn-back" style={{marginTop: '10px'}} onClick={() => setView("menu")}>Annuler</button>
          </div>
        )}
      </div>
    );
  }

  // 5. JEU
  if (currentIndex >= movies.length) return <div className="welcome-screen"><h2>Chargement de la suite...</h2></div>;

  const movie = movies[currentIndex];

  return (
    <div className="card-container">
      <button className="btn-quit" onClick={leaveRoom}>Quitter</button>
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