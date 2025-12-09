import React from 'react';
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
	setShowFriends,
	showMyMatches,
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

	// Logic specific to nested views within the "Welcome" phase
	if (showMyMatches) {
		return (
			<ResultsView
				savedMatches={savedMatches}
				onClose={() => setShowMyMatches(false)}
				resetMyMatches={resetMyMatches}
				onDetails={(movieData) => setDetailsMovie(movieData)}
				onUpdateStatus={updateMovieStatus}
				onRemove={removeMovie}
				onBulkUpdate={bulkUpdateMovieStatus}
				onBulkRemove={bulkRemoveMovies}
			/>
		);
	}

	if (friendLibraryTarget) {
		return (
			<FriendLibraryView
				friendId={friendLibraryTarget.id}
				friendUsername={friendLibraryTarget.username}
				onClose={() => setFriendLibraryTarget(null)}
				onDetails={(movieId) => {
					// Logic to be handled cleanly - for now passed as is
					// This might need refinement in parent if setDetailsMovie expects objects always
					console.log("Friend movie clicked:", movieId);
				}}
			/>
		);
	}

	if (showFriends) {
		return (
			<FriendsView
				onClose={() => setShowFriends(false)}
				currentUser={user}
				onViewLibrary={(friend) => setFriendLibraryTarget(friend)}
				onInvite={handleInviteFriend}
				isInRoom={isInRoom}
			/>
		);
	}

	return (
		<div className="welcome-screen">
			<div className="top-right-auth">
				{!user ? (
					<button onClick={() => setShowAuthModal(true)} className="auth-btn">👤 Compte</button>
				) : (
					<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
						<button
							onClick={() => setShowFriends(true)}
							className="auth-btn friend-btn-bubble"
						>
							👥 Amis
						</button>

						<div className="auth-status">
							<span>{user.user_metadata?.username || user.email.split('@')[0]}</span>
							<button onClick={() => supabase.auth.signOut()} className="auth-logout">✕</button>
						</div>
					</div>
				)}
			</div>

			<h1>Movie Match 🍿</h1>
			<p className="welcome-sub">Trouvez le film parfait ce soir, ensemble ou en solo.</p>

			{view === "menu" && (
				<div className="menu-buttons">
					<button className="unified-btn primary" onClick={generateRoomCode}>
						<span>✨</span> Créer une salle
					</button>
					<button className="unified-btn secondary" onClick={() => setView("join")}>
						<span>🚀</span> Rejoindre
					</button>
					<button onClick={() => setShowMyMatches(true)} style={{ background: 'transparent', border: 'none', color: '#888', textDecoration: 'underline', marginTop: '20px', cursor: 'pointer' }}>
						Voir mes matchs
					</button>
				</div>
			)}
			{view === "join" && (
				<div className="menu-buttons fade-in">
					<input type="text" placeholder="CODE DE LA SALLE" value={room} onChange={(e) => setRoom(e.target.value.toUpperCase())} style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '2px', textTransform: 'uppercase' }} />
					<button className="unified-btn primary" onClick={() => joinLobby(null)}>Rejoindre</button>
					<button className="unified-btn secondary" onClick={() => setView("menu")}>Annuler</button>
				</div>
			)}

			{/* --- AUTH MODAL --- */}
			{showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
		</div>
	);
};

export default WelcomeScreen;
