import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Analytics } from "@vercel/analytics/react";

// ... (Garder les constantes SOCKET_URL, API_KEY, PLATFORMS, getUserId inchangées) ...
const SOCKET_URL = import.meta.env.MODE === 'development' 
  ? "http://localhost:3001" 
  : "https://moviematch-backend-0om3.onrender.com";

const socket = io.connect(SOCKET_URL);
const API_KEY = "14b0ba35c145028146e0adf24bfcfd03"; 

const PLATFORMS = [
  { id: 8, name: "Netflix", logo: "https://image.tmdb.org/t/p/w500/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg" },
  { id: 337, name: "Disney+", logo: "https://image.tmdb.org/t/p/w500/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg" },
  { id: 119, name: "Amazon Prime", logo: "https://image.tmdb.org/t/p/w500/emthp39XA2YScoU8t5t7TB38rWO.jpg" },
  { id: 381, name: "Canal+", logo: "https://image.tmdb.org/t/p/w500/cDzkhgvozSr4yGCRPgOlbEbPwze.jpg" }
];

const getUserId = () => {
  let id = localStorage.getItem('userId');
  if (!id) {
    id = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('userId', id);
  }
  return id;
};

// --- NOUVEAU COMPOSANT : MODALE DE DÉTAILS ---
const MovieDetailModal = ({ movie, onClose }) => {
  const [fullDetails, setFullDetails] = useState(null);

  useEffect(() => {
    // On demande : le film + les credits (acteurs) + les vidéos (trailers)
    axios.get(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${API_KEY}&language=fr-FR&append_to_response=credits,videos`)
      .then(res => setFullDetails(res.data))
      .catch(err => console.error(err));
  }, [movie.id]);

  if (!fullDetails) return <div className="modal-overlay">Chargement...</div>;

  const title = fullDetails.title;
  const posterSrc = fullDetails.poster_path ? `https://image.tmdb.org/t/p/w500${fullDetails.poster_path}` : "";
  
  // Logique pour trouver le trailer YouTube
  const trailer = fullDetails.videos?.results?.find(
    vid => vid.site === "YouTube" && (vid.type === "Trailer" || vid.type === "Teaser")
  );

  // Les 5 premiers acteurs
  const cast = fullDetails.credits?.cast?.slice(0, 5) || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <button className="close-modal" onClick={onClose}>✕</button>
        
        <div className="modal-scroll">
          {/* BANDE ANNONCE (si dispo) ou IMAGE */}
          {trailer ? (
            <div className="video-container">
              <iframe
                src={`https://www.youtube.com/embed/${trailer.key}`}
                title="Trailer"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          ) : (
            <img src={posterSrc} alt={title} className="modal-poster" />
          )}

          <div className="modal-text">
            <h2>{title}</h2>
            
            <div className="meta-tags">
               {fullDetails.release_date && <span className="tag">{fullDetails.release_date.split('-')[0]}</span>}
               {fullDetails.runtime && <span className="tag">{fullDetails.runtime} min</span>}
               <span className="tag star">★ {fullDetails.vote_average?.toFixed(1)}</span>
            </div>

            <p className="modal-overview">{fullDetails.overview || "Pas de description."}</p>

            {/* SECTION ACTEURS */}
            {cast.length > 0 && (
              <div className="cast-section">
                <h3>Casting</h3>
                <div className="cast-list">
                  {cast.map(actor => (
                    <div key={actor.id} className="actor-item">
                      <img 
                        src={actor.profile_path 
                          ? `https://image.tmdb.org/t/p/w200${actor.profile_path}` 
                          : "https://via.placeholder.com/100x150?text=?"} 
                        alt={actor.name} 
                      />
                      <span>{actor.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ... (MatchItem reste inchangé) ...
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
  // ... (États existants inchangés) ...
  const [room, setRoom] = useState("");
  const [isInRoom, setIsInRoom] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [movies, setMovies] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [match, setMatch] = useState(null);
  const [page, setPage] = useState(1);
  const [view, setView] = useState("menu"); 
  const [showMyMatches, setShowMyMatches] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [selectedProviders, setSelectedProviders] = useState([]); 
  const [voteMode, setVoteMode] = useState('majority'); 
  const [showHostSettings, setShowHostSettings] = useState(false);
  const [providersDisplay, setProvidersDisplay] = useState([]); 
  const [isHost, setIsHost] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const userId = useRef(getUserId()).current;
  const [savedMatches, setSavedMatches] = useState(() => {
    const saved = localStorage.getItem('myMatches');
    return saved ? JSON.parse(saved) : [];
  });

  // --- NOUVEL ÉTAT ---
  const [detailsMovie, setDetailsMovie] = useState(null); // Le film affiché en détail

  // ... (Fonctions joinLobby, generateRoomCode, syncSettings, toggleProvider, fetchMovies inchangées) ...
  
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

  const toggleProvider = (id) => {
    let newProviders;
    if (selectedProviders.includes(id)) {
      newProviders = selectedProviders.filter(p => p !== id);
    } else {
      newProviders = [...selectedProviders, id];
    }
    syncSettings({ providers: newProviders });
  };

  const fetchMovies = async () => {
    const today = new Date().toISOString().split('T')[0];
    let endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=fr-FR&sort_by=popularity.desc&page=${page}`;
    
    if (selectedGenre) endpoint += `&with_genres=${selectedGenre}`;
    endpoint += `&watch_region=FR&primary_release_date.lte=${today}`;
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
    setShowHostSettings(false); 
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
        // J'ajoute l'overview ici pour l'avoir si ça match tout de suite
        overview: currentMovie.overview,
        userId: userId
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
    if(confirm("Vider l'historique ?")) {
      localStorage.removeItem('myMatches');
      setSavedMatches([]);
    }
  };

  useEffect(() => {
    if (movies.length > 0 && currentIndex < movies.length) {
      const currentMovie = movies[currentIndex];
      axios.get(`https://api.themoviedb.org/3/movie/${currentMovie.id}/watch/providers?api_key=${API_KEY}`)
        .then(response => {
          const frData = response.data.results.FR;
          setProvidersDisplay(frData && frData.flatrate ? frData.flatrate : []);
        })
        .catch(err => console.error(err));
    }
  }, [currentIndex, movies]);


  // --- AFFICHAGE ---

  // 1. GESTION DU MODAL (S'affiche par dessus tout si detailsMovie existe)
  const renderModal = () => {
    if (!detailsMovie) return null;
    return <MovieDetailModal movie={detailsMovie} onClose={() => setDetailsMovie(null)} />;
  };

  if (showMyMatches) {
    return (
      <div className="matches-screen">
        <button className="btn-back" onClick={() => setShowMyMatches(false)}>Retour</button>
        <h2>Mes Matchs</h2>
        {savedMatches.length > 0 && (
          <button onClick={resetMyMatches} className="btn-reset">🗑️ Réinitialiser</button>
        )}
        <div className="matches-grid">
          {savedMatches.map(id => <MatchItem key={id} movieId={id} />)}
        </div>
      </div>
    );
  }

  // 2. MODIFICATION ÉCRAN MATCH
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
              // Au clic, on ouvre les détails. On passe un objet formaté pour que le modal comprenne.
              onClick={() => setDetailsMovie({ 
                id: match.movieId, 
                title: match.movieTitle, 
                poster_path: match.moviePoster,
                overview: match.overview // Si passé par le socket
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

  // --- LOBBY (Reste inchangé) ---
  if (isInRoom && !gameStarted) {
    return (
      <div className="welcome-screen">
        <h1>Salle d'attente</h1>
        
        <div className="room-code-display" onClick={shareCode}>
          <h2 className="code-text">{room}</h2>
          <span className="click-hint">Toucher pour copier</span>
        </div>
        <p style={{color: '#aaa', marginBottom: '20px'}}>
          Joueurs : <strong style={{color: 'white', fontSize: '1.2rem'}}>{playerCount}</strong>
        </p>

        {isHost ? (
          <>
            {!showHostSettings ? (
              <div className="host-lobby-menu">
                <button className="unified-btn secondary" onClick={() => setShowHostSettings(true)}>
                  Paramètres de la partie
                </button>
                <div style={{height: '15px'}}></div>
                <button className="unified-btn primary" onClick={startGame}>
                  LANCER LA PARTIE
                </button>
              </div>
            ) : (
              <div className="room-settings">
                <h3>Paramètres</h3>
                
                <label>Vos Abonnements :</label>
                <div className="providers-select">
                  {PLATFORMS.map(p => (
                    <div 
                      key={p.id} 
                      className={`provider-chip ${selectedProviders.includes(p.id) ? 'selected' : ''}`}
                      onClick={() => toggleProvider(p.id)}
                    >
                      <img src={p.logo} alt={p.name} />
                    </div>
                  ))}
                </div>

                {playerCount > 1 ? (
                  <>
                    <label>Mode de vote :</label>
                    <div className="vote-mode-selector">
                      <button 
                        className={voteMode === 'majority' ? 'mode-active' : ''} 
                        onClick={() => syncSettings({voteMode: 'majority'})}
                      >
                        Majorité (50%)
                      </button>
                      <button 
                        className={voteMode === 'unanimity' ? 'mode-active' : ''} 
                        onClick={() => syncSettings({voteMode: 'unanimity'})}
                      >
                        Unanimité (100%)
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="solo-mode-badge">
                    Mode Découverte (Solo)
                  </div>
                )}

                <label>Genre & Qualité :</label>
                <div className="filters-row">
                  <select value={selectedGenre} onChange={(e) => syncSettings({genre: e.target.value})}>
                    <option value="">Tous Genres</option>
                    <option value="28">Action</option>
                    <option value="35">Comédie</option>
                    <option value="27">Horreur</option>
                    <option value="10749">Romance</option>
                    <option value="16">Animation</option>
                  </select>
                  <select value={minRating} onChange={(e) => syncSettings({rating: e.target.value})}>
                    <option value="0">Toute Note</option>
                    <option value="7">7+ (Bon)</option>
                    <option value="8">8+ (Top)</option>
                  </select>
                </div>

                <button className="unified-btn validate" style={{marginTop: '20px'}} onClick={() => setShowHostSettings(false)}>
                  Valider et Retour
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="waiting-box">
            <p className="pulse">En attente de l'hôte...</p>
            <div className="guest-settings-preview">
               <small>
                 {playerCount > 1 
                   ? `Mode: ${voteMode === 'majority' ? 'Majorité' : 'Unanimité'}` 
                   : 'Mode Solo'}
               </small>
               <br/>
               <small>Plateformes: {selectedProviders.length > 0 ? selectedProviders.length + ' choisies' : 'Toutes'}</small>
            </div>
          </div>
        )}
        
        {!showHostSettings && (
          <button className="unified-btn quit" style={{marginTop: '15px'}} onClick={leaveRoom}>Quitter</button>
        )}
      </div>
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

  if (currentIndex >= movies.length) return <div className="welcome-screen"><h2>Chargement...</h2></div>;
  const movie = movies[currentIndex];

  // ... (Début du fichier inchangé)

// 1. VERSION AMÉLIORÉE DU MODAL (AVEC ACTEURS ET VIDEO)
const MovieDetailModal = ({ movie, onClose }) => {
  const [fullDetails, setFullDetails] = useState(null);

  useEffect(() => {
    // On demande : le film + les credits (acteurs) + les vidéos (trailers)
    axios.get(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${API_KEY}&language=fr-FR&append_to_response=credits,videos`)
      .then(res => setFullDetails(res.data))
      .catch(err => console.error(err));
  }, [movie.id]);

  if (!fullDetails) return <div className="modal-overlay">Chargement...</div>;

  const title = fullDetails.title;
  const posterSrc = fullDetails.poster_path ? `https://image.tmdb.org/t/p/w500${fullDetails.poster_path}` : "";
  
  // Logique pour trouver le trailer YouTube
  const trailer = fullDetails.videos?.results?.find(
    vid => vid.site === "YouTube" && (vid.type === "Trailer" || vid.type === "Teaser")
  );

  // Les 5 premiers acteurs
  const cast = fullDetails.credits?.cast?.slice(0, 5) || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <button className="close-modal" onClick={onClose}>✕</button>
        
        <div className="modal-scroll">
          {/* BANDE ANNONCE (si dispo) ou IMAGE */}
          {trailer ? (
            <div className="video-container">
              <iframe
                src={`https://www.youtube.com/embed/${trailer.key}`}
                title="Trailer"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          ) : (
            <img src={posterSrc} alt={title} className="modal-poster" />
          )}

          <div className="modal-text">
            <h2>{title}</h2>
            
            <div className="meta-tags">
               {fullDetails.release_date && <span className="tag">{fullDetails.release_date.split('-')[0]}</span>}
               {fullDetails.runtime && <span className="tag">{fullDetails.runtime} min</span>}
               <span className="tag star">★ {fullDetails.vote_average?.toFixed(1)}</span>
            </div>

            <p className="modal-overview">{fullDetails.overview || "Pas de description."}</p>

            {/* SECTION ACTEURS */}
            {cast.length > 0 && (
              <div className="cast-section">
                <h3>Casting</h3>
                <div className="cast-list">
                  {cast.map(actor => (
                    <div key={actor.id} className="actor-item">
                      <img 
                        src={actor.profile_path 
                          ? `https://image.tmdb.org/t/p/w200${actor.profile_path}` 
                          : "https://via.placeholder.com/100x150?text=?"} 
                        alt={actor.name} 
                      />
                      <span>{actor.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ... (Le reste du code jusqu'au return final de App) ...

  // 2. CORRECTION DU RENDU FINAL (Déplacer renderModal)
  return (
    <>
      {/* LE MODAL DOIT ÊTRE ICI, À L'EXTÉRIEUR DU CONTAINER */}
      {renderModal()} 

      <div className="card-container">
        <button className="btn-quit" onClick={leaveRoom}>Quitter</button>
        
        <motion.div 
          className="movie-card"
          drag="x" dragConstraints={{ left: 0, right: 0 }} onDragEnd={handleDragEnd}
          style={{ x, rotate, opacity }}
          initial={{ scale: 0.8 }} animate={{ scale: 1 }}
        >
          <div className="movie-poster-wrapper" onClick={() => setDetailsMovie(movie)}>
             <img className="movie-poster clickable" src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} draggable="false" />
             <div className="info-hint">ℹ️ Infos + Trailer</div>
          </div>
          
          <div className="movie-info">
            <div className="providers-container">
              {providersDisplay.map((p) => (
                <img key={p.provider_id} src={`https://image.tmdb.org/t/p/original${p.logo_path}`} className="provider-logo" />
              ))}
            </div>
            <h2>{movie.title}</h2>
          </div>
          
          <div className="actions">
            <button className="btn-circle btn-pass" onClick={() => handleSwipe("left")}>✖️</button>
            <button className="btn-circle btn-like" onClick={() => handleSwipe("right")}>❤️</button>
          </div>
        </motion.div>
        <Analytics />
      </div>
    </>
  );
}
export default App;