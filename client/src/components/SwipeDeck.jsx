import React from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Analytics } from "@vercel/analytics/react";

const SwipeDeck = ({
	movies,
	currentIndex,
	handleSwipe,
	handleUndo,
	setDetailsMovie,
	leaveRoom,
	providersDisplay
}) => {
	const x = useMotionValue(0);
	const rotate = useTransform(x, [-200, 200], [-30, 30]);
	const opacity = useTransform(x, [-150, 0, 150], [0.5, 1, 0.5]);

	const handleDragEnd = (event, info) => {
		if (info.offset.x > 100) handleSwipe("right");
		else if (info.offset.x < -100) handleSwipe("left");
	};

	if (currentIndex >= movies.length) {
		return (
			<div className="welcome-screen">
				<h2>Chargement de la suite...</h2>
			</div>
		);
	}

	const movie = movies[currentIndex];

	return (
		<div className="deck-container">
			<div className="card-container">
				<button className="btn-quit" onClick={leaveRoom}>Quitter</button>

				<motion.div
					className="movie-card"
					drag="x" dragConstraints={{ left: 0, right: 0 }} onDragEnd={handleDragEnd}
					style={{ x, rotate, opacity }}
					initial={{ scale: 0.8 }} animate={{ scale: 1 }}
				>
					<div className="movie-poster-wrapper" onClick={() => setDetailsMovie(movie)}>
						<img
							className="movie-poster clickable"
							src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
							draggable="false"
							alt={movie.title}
						/>
						<div className="movie-info-overlay">
							<div className="providers-container" style={{ marginBottom: 10, display: 'flex', gap: 5 }}>
								{providersDisplay.map((p) => (
									<img
										key={p.provider_id}
										src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
										style={{ width: 25, height: 25, borderRadius: 4, margin: 0 }}
										alt="provider"
									/>
								))}
							</div>
							<h2>{movie.title}</h2>
							<div className="movie-meta">
								<span>{movie.release_date?.split('-')[0]}</span>
								<span>★ {movie.vote_average?.toFixed(1)}</span>
							</div>
						</div>
					</div>

					<div className="actions">
						<button className="btn-circle btn-undo" onClick={handleUndo} style={{ background: '#333', fontSize: '1.2rem', width: 50, height: 50 }}>↩️</button>
						<button className="btn-circle btn-pass" onClick={() => handleSwipe("left")}>✖️</button>
						<button className="btn-circle btn-like" onClick={() => handleSwipe("right")}>❤️</button>
					</div>
				</motion.div>
				<Analytics />
			</div>
		</div>
	);
};

export default SwipeDeck;
