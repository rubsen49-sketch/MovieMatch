import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_KEY } from '../utils/constants';

const MatchItem = ({ movieId, onClick }) => {
  const [movieData, setMovieData] = useState(null);
  
  useEffect(() => {
    axios.get(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&language=fr-FR`)
      .then(res => setMovieData(res.data))
      .catch(err => console.error(err));
  }, [movieId]);

  if (!movieData) return <div className="mini-card">...</div>;

  return (
    <div className="mini-card clickable" onClick={() => onClick(movieData)}>
      <img src={`https://image.tmdb.org/t/p/w300${movieData.poster_path}`} alt={movieData.title} />
      <h3>{movieData.title}</h3>
    </div>
  );
};

export default MatchItem;