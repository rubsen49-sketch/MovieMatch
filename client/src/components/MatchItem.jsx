import { useState, useEffect } from 'react';
import axios from 'axios';

const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

const MatchItem = ({ movieId, onClick, movie }) => {
	const [fetchedData, setFetchedData] = useState(null);

	const movieData = movie || fetchedData;

	useEffect(() => {
		if (movie) return;
		if (!API_KEY || !movieId) return;
		axios.get(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&language=fr-FR`)
			.then(res => setFetchedData(res.data))
			.catch(err => console.error(err));
	}, [movieId, movie]);

	if (!movieData) return <div className="mini-card">...</div>;

	return (
		<div className="mini-card clickable" onClick={() => onClick && onClick(movieData)}>
			<img src={`https://image.tmdb.org/t/p/w300${movieData.poster_path}`} alt={movieData.title} />
			<h3>{movieData.title}</h3>
		</div>
	);
};

export default MatchItem;
