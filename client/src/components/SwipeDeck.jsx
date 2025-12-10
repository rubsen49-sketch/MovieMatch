import React, { useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Analytics } from "@vercel/analytics/react";

const SwipeDeck = ({
	movies,
	currentIndex,
	handleSwipe,
	handleUndo,
	setDetailsMovie, // Used for mobile modal, but on desktop we show details inline
	leaveRoom,
	providersDisplay
}) => {
	const x = useMotionValue(0);
	const rotate = useTransform(x, [-200, 200], [-30, 30]);
	const opacity = useTransform(x, [-150, 0, 150], [0.5, 1, 0.5]);

	const [isDragging, setIsDragging] = React.useState(false);

	const handleDragEnd = (event, info) => {
		setTimeout(() => setIsDragging(false), 50); // Small delay to prevent tap immediately after drag
		if (info.offset.x > 100) handleSwipe("right");
		else if (info.offset.x < -100) handleSwipe("left");
	};

	const handleTap = () => {
		if (!isDragging) {
			setDetailsMovie(movie);
		}
	};

	// Keyboard Support
	useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.key === 'ArrowRight') handleSwipe("right");
			if (e.key === 'ArrowLeft') handleSwipe("left");
			if (e.key === 'Backspace') handleUndo();
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [handleSwipe, handleUndo]);

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
			{/* DESKTOP SPLIT LAYOUT WRAPPER (See App.css media query) */}
			<div className="swipe-split-layout">

				{/* LEFT: CARD (Draggable) */}
				<div className="swipe-card-side">
					<motion.div
						className="movie-card"
						drag="x"
						dragConstraints={{ left: 0, right: 0 }}
						onDragStart={() => setIsDragging(true)}
						onDragEnd={handleDragEnd}
						style={{ x, rotate, opacity }}
						initial={{ scale: 0.8 }} animate={{ scale: 1 }}
						key={movie.id} // Re-mount key for clean transition
						onTap={handleTap} // [NEW] Safe tap handler
						whileTap={{ scale: 0.98 }}
						cursor="pointer"
					>
						<div className="movie-poster-wrapper">
							<img
								className="movie-poster"
								src={`https://image.tmdb.org/t/p/w780${movie.poster_path}`} // Higher res for desktop
								draggable="false"
								alt={movie.title}
							/>
							{/* Overlay only visible on Mobile via CSS */}
							<div className="movie-info-overlay">
								<h2>{movie.title}</h2>
								<div className="movie-meta">
									<span>{movie.release_date?.split('-')[0]}</span>
									<span>★ {movie.vote_average?.toFixed(1)}</span>
								</div>
								<div style={{ fontSize: '0.8rem', marginTop: 5, color: 'var(--gold)' }}>
									ℹ️ Toucher pour plus d'infos
								</div>
							</div>
						</div>
					</motion.div>
				</div>

				{/* RIGHT: DETAILS & ACTIONS (Desktop Only - visible via flex/grid) */}
				<div className="swipe-info-side mobile-hidden">
					<div className="providers-list">
						{providersDisplay.map((p) => (
							<img key={p.provider_id} src={`https://image.tmdb.org/t/p/original${p.logo_path}`} className="provider-logo-small" alt="prov" />
						))}
					</div>

					<h1 className="desktop-movie-title">{movie.title}</h1>

					<div className="desktop-meta-row">
						<span className="text-primary-bold">{movie.release_date?.split('-')[0]}</span>
						<span>•</span>
						<span>{movie.vote_average?.toFixed(1)} / 10</span>
						<span>•</span>
						<span className="text-lg">{movie.original_language?.toUpperCase()}</span>
					</div>

					<p className="desktop-overview">
						{movie.overview || "Aucun résumé disponible pour ce film."}
					</p>

					<div className="desktop-actions">
						<div className="action-hint" onClick={handleUndo}>
							<span className="kbd-key">← BACKSPACE</span>
							<span>Retour</span>
						</div>
						<div className="action-hint" onClick={() => handleSwipe("left")}>
							<span className="kbd-key">← GAUCHE</span>
							<span className="text-red">Passer</span>
						</div>
						<div className="action-hint" onClick={() => handleSwipe("right")}>
							<span className="kbd-key">DROITE →</span>
							<span className="text-gold">Liker</span>
						</div>
					</div>
				</div>

				{/* MOBILE ACTIONS (Floating at bottom, visible only mobile via CSS) */}
				<div className="actions desktop-hidden">
					{/* ORDER: Left (Pass) | Undo (Back) | Right (Like) */}
					<button className="btn-circle btn-pass" onClick={() => handleSwipe("left")}>✖️</button>
					<button className="btn-circle btn-undo btn-undo-mobile" onClick={handleUndo}>↩️</button>
					<button className="btn-circle btn-like" onClick={() => handleSwipe("right")}>❤️</button>
				</div>
			</div>

			<button className="btn-quit-absolute" onClick={leaveRoom}>✕ Quitter</button>



			<Analytics />
		</div>
	);
};

export default SwipeDeck;
