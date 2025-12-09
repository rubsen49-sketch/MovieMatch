import React, { useState } from 'react';
import { PLATFORMS } from '../constants';

const Lobby = ({
	room,
	playerCount,
	isHost,
	settings,
	updateSettings, // Function to sync settings ({ key: value })
	startGame,
	leaveRoom,
	shareCode,
	onOpenGenreSelector,
	players,
	currentUser,
	onAddFriend
}) => {
	// Local state for mobile settings toggle
	const [showHostSettingsMobile, setShowHostSettingsMobile] = useState(false);

	// Helper to handle specific setting updates
	const handleSettingChange = (key, value) => {
		updateSettings({ [key]: value });
	};

	const toggleProvider = (id) => {
		const current = settings.providers || [];
		let newProviders;
		if (current.includes(id)) {
			newProviders = current.filter(p => p !== id);
		} else {
			newProviders = [...current, id];
		}
		handleSettingChange('providers', newProviders);
	};

	const selectedProviders = settings.providers || [];
	const voteMode = settings.voteMode || 'majority';
	const minRating = settings.rating || 0;
	const genreCount = (settings.genre || []).length;

	// SHARED SETTINGS PANEL (Used in Desktop Right col & Mobile Modal)
	const SettingsPanel = () => (
		<div className="room-settings">
			<h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 15, marginBottom: 20 }}>
				Paramètres de la partie
			</h3>

			<label className="settings-label">Vos Abonnements</label>
			<div className="providers-select">
				{PLATFORMS.map(p => (
					<div
						key={p.id}
						className={`provider-chip ${selectedProviders.includes(p.id) ? 'selected' : ''}`}
						onClick={() => isHost && toggleProvider(p.id)} // Only host can toggle
						style={{ cursor: isHost ? 'pointer' : 'default', opacity: isHost ? (selectedProviders.includes(p.id) ? 1 : 0.5) : (selectedProviders.includes(p.id) ? 1 : 0.2) }}
					>
						<img src={p.logo} alt={p.name} />
					</div>
				))}
			</div>

			<label className="settings-label">Mode de vote</label>
			<div className="vote-mode-selector">
				<button
					className={voteMode === 'majority' ? 'mode-active' : ''}
					onClick={() => isHost && handleSettingChange('voteMode', 'majority')}
					disabled={!isHost}
				>
					Majorité (50%)
				</button>
				<button
					className={voteMode === 'unanimity' ? 'mode-active' : ''}
					onClick={() => isHost && handleSettingChange('voteMode', 'unanimity')}
					disabled={!isHost}
				>
					Unanimité (100%)
				</button>
			</div>

			<label className="settings-label">Filtres</label>
			<div className="filters-row-vertical">
				<button
					className="unified-btn secondary"
					onClick={isHost ? onOpenGenreSelector : null}
					style={{ marginBottom: '10px', opacity: isHost ? 1 : 0.7 }}
				>
					{genreCount > 0
						? `Genres : ${genreCount} choisi(s)`
						: "Genres : Tous"} {isHost && "✏️"}
				</button>

				<div className="rating-selector" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
					<span style={{ color: '#888' }}>Note Min:</span>
					<select
						value={minRating}
						onChange={(e) => handleSettingChange('rating', e.target.value)}
						disabled={!isHost}
						style={{ flex: 1 }}
					>
						<option value="0">Toute Note</option>
						<option value="7">7+ (Bon)</option>
						<option value="8">8+ (Top)</option>
					</select>
				</div>
			</div>

			{!isHost && <div style={{ marginTop: 20, color: 'var(--text-sub)', fontStyle: 'italic', fontSize: '0.9rem' }}>Seul l'hôte peut modifier ces réglages.</div>}
		</div>
	);

	// MOBILE HOST SETTINGS MODAL
	if (isHost && showHostSettingsMobile) {
		return (
			<div className="welcome-screen">
				<SettingsPanel />
				<button className="unified-btn validate" style={{ marginTop: '20px' }} onClick={() => setShowHostSettingsMobile(false)}>
					Valider et Retour
				</button>
			</div>
		);
	}

	return (
		<div className="lobby-container fade-in">
			{/* LEFT COLUMN: Players & Code */}
			<div className="lobby-left">
				<h1 style={{ fontSize: '2rem' }}>Salle d'attente</h1>

				<div className="room-code-box" onClick={shareCode}>
					<h2 className="code-display">{room}</h2>
					<span className="click-hint">Toucher pour copier</span>
				</div>

				<p style={{ color: 'var(--text-sub)' }}>
					{playerCount} Joueur{playerCount > 1 ? 's' : ''} connecté{playerCount > 1 ? 's' : ''}
				</p>

				<div className="player-list" style={{ width: '100%', maxHeight: '300px', overflowY: 'auto' }}>
					{(players || []).map(p => {
						const isMe = currentUser && currentUser.user_metadata?.username === p.username;
						return (
							<div key={p.id} className="player-list-item">
								<span style={{ fontWeight: 'bold' }}>👤 {p.username}</span>
								{!isMe && currentUser && onAddFriend && (
									<button
										className="unified-btn secondary"
										style={{ padding: '5px 10px', fontSize: '0.7rem', width: 'auto', borderRadius: '20px' }}
										onClick={() => onAddFriend(p.username)}
									>
										+ Ami
									</button>
								)}
							</div>
						);
					})}
				</div>

				{/* MOBILE: Settings & Start Buttons (Only visible under desktop breakpoint via CSS or logical check? 
				    Actually, on Desktop we want Start Button on Left too? Or Right? 
					Let's put actions on Left for consistency.
				*/}
				<div className="lobby-actions" style={{ marginTop: 'auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
					{isHost ? (
						<>
							{/* Mobile Only Settings Button - Hide on Desktop via CSS if possible, or just conditionally render based on width (hard in React without hook).
								We will rely on CSS display:none for .mobile-settings-btn in desktop query if we added it.
								For now, simple approach: Show "Configurer (Mobile)" button only if needed?
								Actually, we can show settings ALWAYS in right col on desktop.
							*/}
							{/* Simple hack: We'll render layout effectively. */}
							<button className="unified-btn secondary mobile-only-btn" onClick={() => setShowHostSettingsMobile(true)}>
								⚙️ Paramètres
							</button>
							<button className="unified-btn primary" onClick={startGame}>
								LANCER LA PARTIE 🎬
							</button>
						</>
					) : (
						<div className="waiting-box">
							<p className="pulse">En attente de l'hôte...</p>
						</div>
					)}
					<button className="unified-btn secondary" onClick={leaveRoom} style={{ background: 'transparent', border: 'none', color: '#666' }}>Quitter</button>
				</div>
			</div>

			{/* RIGHT COLUMN: Settings (Desktop Only) */}
			<div className="lobby-right mobile-hidden">
				<SettingsPanel />
			</div>

			{/* On mobile, lobby-right is hidden via CSS or flow? 
			    We need to ensure .mobile-hidden class logic exists or use media query in App.css
				I'll assume I can add a quick utility or inline style.
				Actually relying on the @media in App.css: .lobby-container grid layout.
				When not in grid (mobile), divs stack. 
				We want SettingsPanel to BE HIDDEN on mobile default to avoid clutter.
				So we need a class "desktop-only" for lobby-right.
			*/}
			<style>{`
				@media (max-width: 1023px) {
					.lobby-right { display: none; }
					.mobile-only-btn { display: block; }
					.lobby-container { display: block; } /* Reset grid */
				}
				@media (min-width: 1024px) {
					.mobile-only-btn { display: none; }
				}
			`}</style>
		</div>
	);
};

export default Lobby;
