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

	console.log("Lobby Render. Players:", players);

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
		<div className="lobby-container fade-in">
			<h1 style={{ textAlign: 'center', fontSize: '2rem' }}>Salle d'attente</h1>

			<div className="room-code-box" onClick={shareCode}>
				<h2 className="code-display">{room}</h2>
				<span className="click-hint">Toucher pour copier</span>
			</div>

			<p style={{ textAlign: 'center', color: 'var(--text-sub)', marginBottom: '10px' }}>
				{playerCount} Joueur{playerCount > 1 ? 's' : ''} connecté{playerCount > 1 ? 's' : ''}
			</p>

			{/* PLAYER LIST */}
			<div className="player-list" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 400, margin: '0 auto 20px auto', width: '100%' }}>
				{(players || []).map(p => {
					// Check if it's me
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

			{isHost ? (
				<div className="host-lobby-menu" style={{ marginTop: 'auto' }}>
					<button className="unified-btn secondary" onClick={() => setShowHostSettings(true)} style={{ marginBottom: '10px' }}>
						⚙️ Paramètres
					</button>
					<button className="unified-btn primary" onClick={startGame}>
						LANCER LA PARTIE 🎬
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

			<button className="unified-btn secondary" style={{ marginTop: '10px', background: 'transparent', border: 'none', color: '#666' }} onClick={leaveRoom}>Quitter</button>
		</div>
	);
};

export default Lobby;
