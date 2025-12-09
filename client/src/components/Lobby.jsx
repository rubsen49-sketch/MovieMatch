import { motion } from 'framer-motion';
import GenreSelector from './GenreSelector';

const Lobby = ({ roomId, users, isHost, onStart, selectedGenres, setSelectedGenres }) => {

  const copyLink = () => {
    const url = `${window.location.origin}/?room=${roomId}`;
    navigator.clipboard.writeText(url);
    alert("Lien copié dans le presse-papier !");
  };

  const handleGenreToggle = (id) => {
    if (selectedGenres.includes(id)) {
      setSelectedGenres(selectedGenres.filter(g => g !== id));
    } else {
      setSelectedGenres([...selectedGenres, id]);
    }
  };

  return (
    <div className="input-group" style={{ textAlign: "center", maxWidth: "500px" }}>
      <h2>Salle : <span style={{ color: "var(--primary)" }}>{roomId}</span></h2>
      
      <div className="users-list" style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
        {users.map((u, i) => (
          <motion.div 
            key={i} 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            className="user-badge"
            style={{ padding: "8px 15px", background: "#333", borderRadius: "20px", fontSize: "0.9rem" }}
          >
            👤 {u}
          </motion.div>
        ))}
      </div>

      <p style={{ fontSize: "0.9rem", color: "#aaa", marginBottom: "15px" }}>
        Partage ce lien avec tes amis :
      </p>
      <button className="btn-secondary" onClick={copyLink} style={{ marginBottom: "20px" }}>
        🔗 Copier le lien d'invitation
      </button>

      {isHost ? (
        <>
          <h3 style={{ marginBottom: "15px" }}>Choisis les genres (optionnel)</h3>
          <GenreSelector selectedGenres={selectedGenres} onToggle={handleGenreToggle} />
          
          <button className="btn-primary" onClick={onStart} style={{ marginTop: "20px", width: "100%", padding: "15px", fontSize: "1.2rem" }}>
            🚀 Lancer la session
          </button>
        </>
      ) : (
        <div className="waiting-message" style={{ marginTop: "30px" }}>
          <p>L'hôte choisit les filtres...</p>
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
};

export default Lobby;