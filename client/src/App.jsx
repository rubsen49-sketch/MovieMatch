import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Analytics } from "@vercel/analytics/react";

// --- IMPORTS DES COMPOSANTS ET CONSTANTES ---
import { SOCKET_URL, API_KEY, PLATFORMS } from './utils/constants';
import MovieDetailModal from './components/MovieDetailModal';
import MatchItem from './components/MatchItem';
import Lobby from './components/Lobby';

// Initialisation du socket avec l'URL importée
const socket = io.connect(SOCKET_URL);

function App() {
  // --- ÉTATS (STATES) ---
  const [roomId, setRoomId] = useState("");
  const [roomInput, setRoomInput] = useState(""); // Pour l'input de l'utilisateur
  const [users, setUsers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  
  const [movies, setMovies] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [gameStarted, setGameStarted] = useState(false);
  const [matches, setMatches] = useState([]); // Liste des IDs de films matchés
  const [showMatches, setShowMatches] = useState(false);
  const [matchAlert, setMatchAlert] = useState(null); // Pour l'overlay de match instantané
  const [detailsMovie, setDetailsMovie] = useState(null); // Pour la modale de détails

  // Filtres
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedProviders, setSelectedProviders] = useState([]);

  // --- LOGIQUE SOCKET ---
  useEffect(() => {
    socket.on("room_created", (id) => {
      setRoomId(id);
      setIsHost(true);
      setUsers(["Moi"]); // L'hôte est le premier user
    });

    socket.on("user_joined", (userList) => {
      setUsers(userList);
    });

    socket.on("game_started", (fetchedMovies) => {
      setMovies(fetchedMovies);
      setGameStarted(true);
      setShowMatches(false);
    });

    socket.on("new_match", (matchData) => {
      // matchData contient { movieId, title, poster }
      setMatches(prev => [...prev, matchData.movieId]);
      setMatchAlert(matchData);
      
      // Cache l'alerte après 3 secondes
      setTimeout(() => setMatchAlert(null), 3000);
    });

    socket.on("error", (msg) => {
      alert(msg);
    });

    return () => {
      socket.off("room_created");
      socket.off("user_joined");
      socket.off("game_started");
      socket.off("new_match");
      socket.off("error");
    };
  }, []);

  // --- FONCTIONS DU JEU ---

  const createRoom = () => {
    socket.emit("create_room");
  };

  const joinRoom = () => {
    if (roomInput.trim()) {
      socket.emit("join_room", roomInput);
      setRoomId(roomInput);
    }
  };

  const leaveRoom = () => {
    setRoomId("");
    setGameStarted(false);
    setMovies([]);
    setMatches([]);
    setUsers([]);
    setIsHost(false);
    setShowMatches(false);
    // Optionnel : déconnecter/reconnecter pour changer d'ID socket si besoin
    window.location.reload(); 
  };

  const startGame = async () => {
    if (!isHost) return;

    // Construction de l'URL de découverte TMDB
    let url = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=fr-FR&sort_by=popularity.desc&page=${page}`;
    
    if (selectedGenres.length > 0) {
      url += `&with_genres=${selectedGenres.join(',')}`;
    }
    
    if (selectedProviders.length > 0) {
      url += `&with_watch_providers=${selectedProviders.join('|')}&watch_region=FR`;
    }

    try {
      const res = await axios.get(url);
      const fetchedMovies = res.data.results;
      // On envoie les films à tout le monde via le serveur
      socket.emit("start_game", { roomId, movies: fetchedMovies });
    } catch (error) {
      console.error("Erreur fetching movies:", error);
      alert("Impossible de charger les films.");
    }
  };

  // Gestion du Swipe
  const handleSwipe = (direction) => {
    if (!movies[currentIndex]) return;
    
    const movie = movies[currentIndex];
    
    // Envoi du vote au serveur
    socket.emit("vote", { 
      roomId, 
      movieId: movie.id, 
      vote: direction === "right" ? "like" : "pass",
      movieData: {
        title: movie.title,
        poster_path: movie.poster_path
      }
    });

    // Passage au film suivant
    if (currentIndex < movies.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      alert("Plus de films ! Rechargement...");
      // Ici on pourrait charger la page suivante (page + 1)
    }
  };

  // Animation Framer Motion pour les cartes
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-30, 30]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  const handleDragEnd = (event, info) => {
    if (info.offset.x > 100) {
      handleSwipe("right");
    } else if (info.offset.x < -100) {
      handleSwipe("left");
    }
  };

  const toggleProvider = (id) => {
    if (selectedProviders.includes(id)) {
      setSelectedProviders(prev => prev.filter(p => p !== id));
    } else {
      setSelectedProviders(prev => [...prev, id]);
    }
  };

  // --- RENDU (JSX) ---

  // 1. Écran de Match Instantané (Overlay)
  if (matchAlert) {
    return (
      <div className="match-overlay" onClick={() => setMatchAlert(null)}>
        <h1 className="match-title">IT'S A MATCH!</h1>
        <img 
          src={`https://image.tmdb.org/t/p/w500${matchAlert.poster_path}`} 
          alt={matchAlert.title} 
          className="match-poster"
        />
        <h2>{matchAlert.title}</h2>
        <p className="click-hint">Clique pour continuer</p>
      </div>
    );
  }

  // 2. Modale de détails
  // Elle s'affiche par dessus tout le reste si 'detailsMovie' est défini
  const renderDetailModal = () => {
    if (!detailsMovie) return null;
    return (
      <MovieDetailModal 
        movie={detailsMovie} 
        onClose={() => setDetailsMovie(null)} 
      />
    );
  };

  // 3. Écran des Matchs (Liste)
  if (showMatches) {
    return (
      <div className="matches-screen">
        {renderDetailModal()}
        <h2>Films Matchés ({matches.length})</h2>
        <button className="btn-back" onClick={() => setShowMatches(false)}>Retour au vote</button>
        
        <div className="matches-grid">
          {matches.map(movieId => (
            <MatchItem 
              key={movieId} 
              movieId={movieId} 
              onClick={(movieData) => setDetailsMovie(movieData)} 
            />
          ))}
          {matches.length === 0 && <p>Aucun match pour le moment...</p>}
        </div>
      </div>
    );
  }

  // 4. Écran de Jeu (Swipe)
  if (gameStarted) {
    const movie = movies[currentIndex];
    // Récupération des plateformes dispos pour ce film (logique simplifiée)
    // Pour une vraie app, il faudrait faire un appel API spécifique pour chaque film ou utiliser les données existantes
    const providersDisplay = PLATFORMS.slice(0, 2); 

    return (
      <div className="app-container">
        {renderDetailModal()}
        <Analytics />
        
        <div className="header-bar" style={{position: 'absolute', top: 10, right: 10, zIndex: 100}}>
          <button className="unified-btn secondary" onClick={() => setShowMatches(true)}>
             Matchs ({matches.length})
          </button>
        </div>

        <div className="card-container">
          <button className="btn-quit" onClick={leaveRoom}>Quitter</button>
          
          {movie ? (
            <motion.div 
              className="movie-card"
              drag="x" 
              dragConstraints={{ left: 0, right: 0 }} 
              onDragEnd={handleDragEnd}
              style={{ x, rotate, opacity }}
              initial={{ scale: 0.8 }} 
              animate={{ scale: 1 }}
            >
              <div className="movie-poster-wrapper" onClick={() => setDetailsMovie(movie)}>
                 <img 
                   className="movie-poster" 
                   src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} 
                   draggable="false" 
                   alt={movie.title}
                 />
                 <div className="info-hint">ℹ️ Infos + Trailer</div>
              </div>
              
              <div className="movie-info">
                <div className="providers-container">
                  {/* Exemple d'affichage statique ou basé sur les données */}
                  {/* Tu pourrais améliorer ça en cherchant les vrais providers dans movie.watch/providers si dispo */}
                </div>
                <h2>{movie.title}</h2>
              </div>
              
              <div className="actions">
                <button className="btn-circle btn-pass" onClick={() => handleSwipe("left")}>✖️</button>
                <button className="btn-circle btn-like" onClick={() => handleSwipe("right")}>❤️</button>
              </div>
            </motion.div>
          ) : (
            <div className="loading-state">Chargement...</div>
          )}
        </div>
      </div>
    );
  }

  // 5. Écran d'Accueil ou Lobby
  return (
    <div className="welcome-screen">
      <Analytics />
      <h1>MovieMatch 🎬</h1>
      
      {!roomId ? (
        // ÉCRAN D'ACCUEIL (LOGIN)
        <div className="menu-buttons">
          <button className="big-btn btn-create" onClick={createRoom}>
            Créer une salle
          </button>
          
          <div className="join-container" style={{display: 'flex', gap: '10px'}}>
            <input 
              type="text" 
              placeholder="Code salle (ex: ABCD)" 
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
            />
            <button className="big-btn btn-join" onClick={joinRoom}>
              Rejoindre
            </button>
          </div>
        </div>
      ) : (
        // LOBBY (SALLE D'ATTENTE)
        // Ici nous utilisons le composant extrait !
        <Lobby 
          roomId={roomId}
          users={users}
          isHost={isHost}
          onStart={startGame}
          selectedGenres={selectedGenres}
          setSelectedGenres={setSelectedGenres}
        />
      )}
      
      {/* Sélecteur de plateformes (Visible seulement pour l'hôte dans le lobby en théorie, 
          mais ici je le laisse accessible si besoin, ou tu peux le déplacer dans le Lobby) */}
      {roomId && isHost && !gameStarted && (
         <div className="providers-select" style={{marginTop: '20px'}}>
           {PLATFORMS.map(p => (
             <button 
               key={p.id} 
               onClick={() => toggleProvider(p.id)}
               className={`provider-chip ${selectedProviders.includes(p.id) ? 'selected' : ''}`}
             >
               <img src={p.logo} alt={p.name} />
             </button>
           ))}
         </div>
      )}
    </div>
  );
}

export default App;