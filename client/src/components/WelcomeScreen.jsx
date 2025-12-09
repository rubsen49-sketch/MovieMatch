import React, { useState } from 'react'; // Added useState for local UI states if needed
import { supabase } from '../supabaseClient';
import AuthModal from './AuthModal';
import FriendsView from './FriendsView';
import ResultsView from './ResultsView';
import FriendLibraryView from './FriendLibraryView';

const WelcomeScreen = ({
	user,
	view,
	setView,
	room,
	setRoom,
	generateRoomCode,
	joinLobby,
	showAuthModal,
	setShowAuthModal,
	showFriends,
	setShowFriends, // Still accepted but might redirect via tabs in App.jsx
	showMyMatches, // Still accepted
	setShowMyMatches,
	savedMatches,
	resetMyMatches,
	setDetailsMovie,
	updateMovieStatus,
	removeMovie,
	bulkUpdateMovieStatus,
	bulkRemoveMovies,
	friendLibraryTarget,
	setFriendLibraryTarget,
	handleInviteFriend,
	isInRoom
}) => {

	// If App.jsx passes activeTab-based rendering, these checks might be redundant but safe to keep
	// However, we want the "Dashboard" look when no modal is active.

	return (
		<div className="welcome-screen">
			{/* AUTH WIDGET (Top Right) */}
			<div className="top-right-auth">
				{!user ? (
					<button onClick={() => setShowAuthModal(true)} className="auth-btn">👤 Connexion</button>
				) : (
					<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
						<div className="auth-status">
							<span>{user.user_metadata?.username || user.email?.split('@')[0]}</span>
						</div>
					</div>
				)}
			</div>

			{/* HERO SECTION */}
			<div className="hero-section">
				<div className="hero-content">
					<h1 className="hero-title">Movie Match</h1>
					<p className="hero-subtitle">
						Ne perdez plus des heures à choisir un film.
						Matchez avec vos amis ou découvrez des pépites en solo.
					</p>

					{view === "menu" && (
						<div className="hero-actions">
							<button className="unified-btn primary hero-btn" onClick={generateRoomCode}>
								✨ Créer une salle
							</button>
							<button className="unified-btn secondary hero-btn" onClick={() => setView("join")}>
								🚀 Rejoindre
							</button>
						</div>
					)}

					{view === "join" && (
						<div className="join-form fade-in">
							<input
								type="text"
								placeholder="CODE SALLE"
								value={room}
								onChange={(e) => setRoom(e.target.value.toUpperCase())}
								className="input-room-code"
								style={{ background: 'transparent', border: 'none', fontSize: '1.2rem' }}
							/>
							<button className="unified-btn primary" onClick={() => joinLobby(null)} style={{ width: 'auto' }}>GO</button>
							<button className="unified-btn secondary" onClick={() => setView("menu")} style={{ width: 'auto' }}>X</button>
						</div>
					)}
				</div>
			</div>

			{/* DASHBOARD CONTENT */}
			<div className="dashboard-content">
				<div className="section-title">Quoi de neuf ?</div>

				<div className="features-grid">
					{/* Card 1: Matches History */}
					<div className="feature-card" onClick={() => setShowMyMatches(true)}>
						<div className="feature-icon">🎬</div>
						<div className="feature-title">Mes Matchs</div>
						<div className="feature-desc">
							Retrouvez tous les films que vous avez validés.
							{savedMatches?.length > 0 && <span style={{ display: 'block', marginTop: '5px', color: 'var(--gold)' }}> {savedMatches.length} films en attente !</span>}
						</div>
					</div>

					{/* Card 2: Friends Activity (Placeholder) */}
					<div className="feature-card" onClick={() => setShowFriends(true)}>
						<div className="feature-icon">👥</div>
						<div className="feature-title">Amis</div>
						<div className="feature-desc">
							Voyez ce que regardent vos amis et partagez vos listes.
						</div>
					</div>

					{/* Card 3: Discovery (Future) */}
					<div className="feature-card">
						<div className="feature-icon">🔥</div>
						<div className="feature-title">Tendances</div>
						<div className="feature-desc">
							Les films les plus populaires sur MovieMatch cette semaine.
						</div>
					</div>
				</div>
			</div>

			{/* --- AUTH MODAL --- */}
			{showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
		</div>
	);
};

export default WelcomeScreen;
