import React, { useState } from 'react';
import { useFriends } from '../hooks/useFriends';

const FriendsView = ({ onClose, currentUser, onViewLibrary, onInvite, isInRoom }) => {
	const [activeTab, setActiveTab] = useState('list'); // 'list', 'add', 'requests'

	const {
		friends,
		incomingRequests,
		outgoingRequests,
		searchResults,
		loading,
		searchQuery,
		setSearchQuery,
		getRelationshipStatus,
		removeFriend,
		sendRequest,
		handleRequest
	} = useFriends(currentUser);





	return (
		<div className="matches-screen">
			<div className="library-header">
				<button className="btn-utility" onClick={onClose}>
					<span>←</span> Retour
				</button>
				<h2>Amis 👥</h2>
				<div style={{ width: 50 }}></div>
			</div>

			<div className="library-tabs">
				<button className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
					Mes Amis
				</button>
				<button className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`} onClick={() => setActiveTab('add')}>
					Ajouter 🔍
				</button>
				<button className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>
					Demandes {incomingRequests.length > 0 && <span style={{ color: 'var(--red)' }}>({incomingRequests.length})</span>}
				</button>
			</div>



			<div className="matches-grid view-list" style={{ display: 'block' }}>

				{/* --- LISTE AMIS --- */}
				{activeTab === 'list' && (
					<div className="input-group" style={{ background: 'transparent', boxShadow: 'none', border: 'none' }}>
						{friends.length === 0 ? (
							<p style={{ textAlign: 'center', color: '#666' }}>Vous n'avez pas encore d'amis.</p>
						) : (
							friends.map(friend => (
								<div key={friend.id} className="friend-item-row">
									<div className="friend-info-row">
										<div className="friend-avatar-small">
											{friend.username.charAt(0).toUpperCase()}
										</div>
										<span className="friend-name-text">{friend.username}</span>
									</div>

									<div className="friend-actions-row">
										{isInRoom && onInvite && (
											<button
												className="action-icon-btn invite"
												onClick={() => onInvite(friend)}
												title="Inviter"
											>
												📩
											</button>
										)}
										<button
											className="action-icon-btn library"
											onClick={() => onViewLibrary(friend)}
											title="Voir la bibliothèque"
										>
											📚
										</button>
										<button
											className="action-icon-btn delete"
											onClick={() => removeFriend(friend.friendship_id, friend.username)}
											title="Supprimer"
										>
											✖️
										</button>
									</div>
								</div>
							))
						)}

						{/* Show Outgoing Requests in List text? */}
						{outgoingRequests.length > 0 && (
							<div style={{ marginTop: 20, borderTop: '1px solid #333', paddingTop: 10 }}>
								<h3 style={{ fontSize: '0.9rem', color: '#888' }}>En attente ({outgoingRequests.length})</h3>
								{outgoingRequests.map(req => (
									<div key={req.other.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', opacity: 0.7 }}>
										<span>⏳</span>
										<span>{req.other.username}</span>
									</div>
								))}
							</div>
						)}
					</div>
				)}

				{/* --- AJOUTER --- */}
				{activeTab === 'add' && (
					<div className="input-group">
						<div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
							<span style={{ fontSize: '1.5rem' }}>🔎</span>
							<input
								type="text"
								placeholder="Chercher un pseudo..."
								value={searchQuery}
								onChange={e => setSearchQuery(e.target.value)}
								autoFocus
							/>
						</div>

						<div style={{ marginTop: 20 }}>
							{searchResults.map(user => {
								const status = getRelationshipStatus(user.id);
								return (
									<div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', padding: '10px 0' }}>
										<span style={{ color: 'white' }}>{user.username}</span>

										{status === 'none' && (
											<button className="unified-btn secondary" style={{ width: 'auto', padding: '5px 10px' }} onClick={() => sendRequest(user)}>
												Ajouter +
											</button>
										)}

										{status === 'sent' && (
											<span style={{ color: '#888', fontStyle: 'italic' }}>Envoyé ✓</span>
										)}

										{status === 'friends' && (
											<span style={{ color: 'var(--gold)' }}>Déjà amis</span>
										)}

										{status === 'received' && (
											<button className="unified-btn primary" style={{ width: 'auto', padding: '5px 10px' }} onClick={() => setActiveTab('requests')}>
												Voir demande
											</button>
										)}
									</div>
								);
							})}
						</div>
					</div>
				)}

				{/* --- DEMANDES --- */}
				{activeTab === 'requests' && (
					<div className="input-group" style={{ background: 'transparent', boxShadow: 'none', border: 'none' }}>
						{incomingRequests.length === 0 ? (
							<p style={{ textAlign: 'center', color: '#666' }}>Aucune demande en attente.</p>
						) : (
							incomingRequests.map(req => (
								<div key={req.id} className="mini-card" style={{ padding: 15, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
									<span style={{ color: 'white' }}>De <strong>{req.other.username}</strong></span>
									<div style={{ display: 'flex', gap: 10 }}>
										<button className="unified-btn primary" style={{ width: 'auto', padding: '5px 15px', background: 'var(--primary)' }} onClick={() => handleRequest(req.id, 'accept')}>
											Accepter
										</button>
										<button className="unified-btn delete" style={{ width: 'auto', padding: '5px 15px' }} onClick={() => handleRequest(req.id, 'decline')}>
											Refuser
										</button>
									</div>
								</div>
							))
						)}
					</div>
				)}

			</div>
		</div>
	);
};

export default FriendsView;
