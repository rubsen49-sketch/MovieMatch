import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css'; // Tu pourras styliser après

const SOCKET_URL = import.meta.env.MODE === 'development' 
  ? "http://localhost:3001" 
  : "https://moviematch-backend-0om3.onrender.com"; // On va créer cette adresse juste après !

const socket = io.connect(SOCKET_URL);

// ⚠️ COLLE TA CLÉ API TMDB ICI ENTRE LES GUILLEMETS ⚠️
const API_KEY = "14b0ba35c145028146e0adf24bfcfd03"; 

function App() {
  const [room, setRoom] = useState("");
  const [isInRoom, setIsInRoom] = useState(false);
  const [movies, setMovies] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [match, setMatch] = useState(null);

  const [selectedGenre, setSelectedGenre] = useState("");
  const [providers, setProviders] = useState([]); // Stocke les logos (Netflix, etc.)

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
// 2. Récupérer les films (Version Intelligente : Genre + Historique)
  const fetchMovies = async () => {
    // Choix de l'URL : Soit "Populaire", soit "Filtré par genre"
    const endpoint = selectedGenre 
      ? `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_genres=${selectedGenre}&language=fr-FR&page=1`
      : `https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=fr-FR&page=1`;

    try {
      const response = await axios.get(endpoint);
      
      // -- GESTION HISTORIQUE --
      // On récupère la liste des films déjà vus dans la mémoire du téléphone
      const history = JSON.parse(localStorage.getItem('watchedMovies')) || [];
      
      // On ne garde que les films dont l'ID N'EST PAS dans l'historique
      const newMovies = response.data.results.filter(movie => !history.includes(movie.id));
      
      setMovies(newMovies);
    } catch (error) {
      console.error("Erreur API:", error);
    }
  };
  // --- NOUVEAU : CHARGER LES PLATEFORMES DE STREAMING ---
useEffect(() => {
  if (movies.length > 0 && currentIndex < movies.length) {
    const currentMovie = movies[currentIndex];

    // On demande les providers pour la France (FR)
    axios.get(`https://api.themoviedb.org/3/movie/${currentMovie.id}/watch/providers?api_key=${API_KEY}`)
      .then(response => {
        const frData = response.data.results.FR;
        // On cherche "flatrate" (Streaming par abonnement)
        if (frData && frData.flatrate) {
          setProviders(frData.flatrate);
        } else {
          setProviders([]); // Rien trouvé
        }
      })
      .catch(err => console.error(err));
  }
}, [currentIndex, movies]); // Se déclenche quand on change de film

  // 3. Gestion du Swipe (Avec sauvegarde dans l'historique)
  const handleSwipe = (direction) => {
    const currentMovie = movies[currentIndex];

    if (direction === "right") {
      socket.emit("swipe_right", {
        room,
        movieId: currentMovie.id,
        movieTitle: currentMovie.title
      });
    }

    // -- SAUVEGARDE --
    // On ajoute ce film à la liste "déjà vu" pour ne plus jamais le proposer
    const history = JSON.parse(localStorage.getItem('watchedMovies')) || [];
    if (!history.includes(currentMovie.id)) {
      history.push(currentMovie.id);
      localStorage.setItem('watchedMovies', JSON.stringify(history));
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
// Écran d'accueil (Rejoindre une salle)
  if (!isInRoom) {
    return (
      <div className="welcome-screen">
        <h1>Movie Match 🍿</h1>
        <p>Trouvez un film à regarder ensemble.</p>
        
        <div className="input-group">
          <input 
            type="text" 
            placeholder="Code de la salle (ex: CINE)" 
            onChange={(event) => setRoom(event.target.value)}
          />

          {/* 👇 LE SÉLECTEUR DE GENRE AJOUTÉ ICI 👇 */}
          <select 
            onChange={(e) => setSelectedGenre(e.target.value)}
            style={{padding: '15px', borderRadius: '10px', border: 'none', background: '#333', color: 'white'}}
          >
            <option value="">🎲 Tous les genres (Aléatoire)</option>
            <option value="28">💥 Action</option>
            <option value="35">😂 Comédie</option>
            <option value="27">👻 Horreur</option>
            <option value="10749">💕 Romance</option>
            <option value="878">👽 Science-Fiction</option>
            <option value="16">🦁 Animation</option>
          </select>

          <button className="primary-btn" onClick={joinRoom}>Rejoindre</button>
          
          {/* Petit bouton caché pour vider l'historique si besoin */}
          <button 
            onClick={() => {localStorage.removeItem('watchedMovies'); alert('Historique effacé !');}}
            style={{marginTop: '20px', background: 'transparent', border: '1px solid #555', color: '#555', padding: '5px', fontSize: '0.8rem'}}
          >
            🗑️ Reset Historique
          </button>
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
        {/* INFO EN BAS */}
        <div className="movie-info">
          <div className="text-content">
            
            {/* 👇 AJOUTE CE BLOC ICI 👇 */}
            <div className="providers-container">
              {providers.map((provider) => (
                <img 
                  key={provider.provider_id}
                  src={`https://image.tmdb.org/t/p/original${provider.logo_path}`} 
                  alt={provider.provider_name}
                  className="provider-logo"
                  title={provider.provider_name} // Affiche le nom au survol
                />
              ))}
            </div>
            {/* 👆 FIN DU BLOC 👆 */}

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