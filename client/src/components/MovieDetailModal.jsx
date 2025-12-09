import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { API_KEY } from '../utils/constants';

const MovieDetailModal = ({ movie, onClose }) => {
  const [fullDetails, setFullDetails] = useState(null);

  useEffect(() => {
    if(!movie?.id) return;
    axios.get(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${API_KEY}&language=fr-FR&append_to_response=credits,videos`)
      .then(res => setFullDetails(res.data))
      .catch(err => console.error(err));
  }, [movie]);

  if (!fullDetails) return <div className="modal-overlay">Chargement...</div>;

  const title = fullDetails.title;
  const posterSrc = fullDetails.poster_path ? `https://image.tmdb.org/t/p/w500${fullDetails.poster_path}` : "";
  
  const trailer = fullDetails.videos?.results?.find(
    vid => vid.site === "YouTube" && (vid.type === "Trailer" || vid.type === "Teaser")
  );

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

export default MovieDetailModal;