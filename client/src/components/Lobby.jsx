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
	onOpenGenreSelector
}) => {
	const [showHostSettings, setShowHostSettings] = useState(false);

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

	if (isHost && showHostSettings) {
		return (
			<div className="welcome-screen">
				<div className="room-settings">
					<h3>Paramètres</h3>

					<label>Vos Abonnements :</label>
					<div className="providers-select">
						{PLATFORMS.map(p => (
							<div
								key={p.id}
								className={`provider-chip ${selectedProviders.includes(p.id) ? 'selected' : ''}`}
								onClick={() => toggleProvider(p.id)}
							>
								<img src={p.logo} alt={p.name} />
							</div>
						))}
					</div>

					{playerCount > 1 ? (
						<>
							<label>Mode de vote :</label>
							<div className="vote-mode-selector">
								<button
									className={voteMode === 'majority' ? 'mode-active' : ''}
									onClick={() => handleSettingChange('voteMode', 'majority')}
								>
									Majorité (50%)
								</button>
								<button
									className={voteMode === 'unanimity' ? 'mode-active' : ''}
									onClick={() => handleSettingChange('voteMode', 'unanimity')}
								>
									Unanimité (100%)
								</button>
							</div>
						</>
					) : (
						<div className="solo-mode-badge">
							Mode Découverte (Solo)
						</div>
					)}

					<label>Genre & Qualité :</label>
					<div className="filters-row-vertical">
						<button
							className="unified-btn secondary"
							onClick={onOpenGenreSelector}
							style={{ marginBottom: '10px' }}
						>
							{genreCount > 0
								? `Genres : ${genreCount} choisi(s)`
								: "Choisir les genres (Tous)"} ✏️
						</button>
						<select value={minRating} onChange={(e) => handleSettingChange('rating', e.target.value)}>
							<option value="0">Toute Note</option>
							<option value="7">7+ (Bon)</option>
							<option value="8">8+ (Top)</option>
						</select>
					</div>

					<button className="unified-btn validate" style={{ marginTop: '20px' }} onClick={() => setShowHostSettings(false)}>
						Valider et Retour
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="welcome-screen">
			<h1>Salle d'attente</h1>

			<div className="room-code-display" onClick={shareCode}>
				<h2 className="code-text">{room}</h2>
				<span className="click-hint">Toucher pour copier</span>
			</div>
			<p style={{ color: '#aaa', marginBottom: '20px' }}>
				Joueurs : <strong style={{ color: 'white', fontSize: '1.2rem' }}>{playerCount}</strong>
			</p>

			{/* PLAYER LIST */}
			<div className="player-list" style={{ display: 'flex', flexDirection: 'column', gap: 5, maxWidth: 300, margin: '10px auto 20px auto' }}>
				{(players || []).map(p => {
					// Check if it's me
					const isMe = currentUser && currentUser.user_metadata?.username === p.username;
					// If not logged in, currentUser is null.
					// If p is me, don't show add button.

					return (
						<div key={p.id} style={{ background: 'rgba(255,255,255,0.1)', padding: '5px 10px', borderRadius: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<span>👤 {p.username}</span>
							{!isMe && currentUser && onAddFriend && (
								<button
									className="unified-btn secondary"
									style={{ padding: '2px 8px', fontSize: '0.8rem', width: 'auto' }}
									onClick={() => onAddFriend(p.username)}
								>
									+ Ami
								</button>
							)}
						</div>
					);
				})}
			</div>

			{isHost ? (
				<div className="host-lobby-menu">
					<button className="unified-btn secondary" onClick={() => setShowHostSettings(true)}>
						Paramètres de la partie
					</button>
					<div style={{ height: '15px' }}></div>
					<button className="unified-btn primary" onClick={startGame}>
						LANCER LA PARTIE
					</button>
				</div>
			) : (
				<div className="waiting-box">
					<p className="pulse">En attente de l'hôte...</p>
					<div className="guest-settings-preview">
						<small>
							{playerCount > 1
								? `Mode: ${voteMode === 'majority' ? 'Majorité' : 'Unanimité'}`
								: 'Mode Solo'}
						</small>
						<br />
						<small>Plateformes: {selectedProviders.length > 0 ? selectedProviders.length + ' choisies' : 'Toutes'}</small>
					</div>
				</div>
			)}

			<button className="unified-btn quit" style={{ marginTop: '15px' }} onClick={leaveRoom}>Quitter</button>
		</div>
	);
};

export default Lobby;
