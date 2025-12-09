import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const FriendsView = ({ onClose, currentUser, onViewLibrary }) => {
	const [activeTab, setActiveTab] = useState('list'); // 'list', 'add', 'requests'
	const [friends, setFriends] = useState([]);
	const [incomingRequests, setIncomingRequests] = useState([]); // Requests sent TO me
	const [outgoingRequests, setOutgoingRequests] = useState([]); // Requests I sent
	const [searchResults, setSearchResults] = useState([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState('');

	useEffect(() => {
		fetchAllRelationships();
	}, [currentUser]);

	const fetchAllRelationships = async () => {
		try {
			// Fetch ALL friendships where I am involved
			const { data, error } = await supabase
				.from('friendships')
				.select(`
          id, 
          status,
          user_id,
          friend_id,
          friend:friend_id(username, id),
          user:user_id(username, id)
        `)
				.or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`);

			if (error) throw error;

			const uniqueFriends = new Map();

			data.forEach(rel => {
				if (rel.status === 'accepted') {
					const isMeRequester = rel.user_id === currentUser.id;
					const friendProfile = isMeRequester ? rel.friend : rel.user;
					// Deduplicate based on ID
					if (!uniqueFriends.has(friendProfile.id)) {
						uniqueFriends.set(friendProfile.id, { ...friendProfile, friendship_id: rel.id });
					}
				} else if (rel.status === 'pending') {
					if (rel.friend_id === currentUser.id) {
						incoming.push({ ...rel, other: rel.user });
					} else {
						outgoing.push({ ...rel, other: rel.friend });
					}
				}
			});

			setFriends(Array.from(uniqueFriends.values()));
			setIncomingRequests(incoming);
			setOutgoingRequests(outgoing);

		} catch (err) {
			console.error("Error fetching relationships:", err);
		}
	};

	const removeFriend = async (friendshipId, friendName) => {
		if (!confirm(`Supprimer ${friendName} de vos amis ?`)) return;

		try {
			const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
			if (error) throw error;
			fetchAllRelationships();
		} catch (err) {
			console.error(err);
			setMessage("Erreur lors de la suppression");
		}
	};


	// Debounced Search
	useEffect(() => {
		const delayDebounceFn = setTimeout(() => {
			if (searchQuery.trim()) {
				searchUsers();
			} else {
				setSearchResults([]);
			}
		}, 500);

		return () => clearTimeout(delayDebounceFn);
	}, [searchQuery]);

	const searchUsers = async (e) => {
		if (e) e.preventDefault();
		if (!searchQuery.trim()) return;

		setLoading(true);

		try {
			const { data, error } = await supabase
				.from('profiles')
				.select('id, username')
				.ilike('username', `%${searchQuery}%`)
				.neq('id', currentUser.id)
				.limit(10);

			if (error) throw error;
			setSearchResults(data);
		} catch (err) {
			console.error("Search error:", err);
		} finally {
			setLoading(false);
		}
	};

	const getRelationshipStatus = (targetUserId) => {
		// Check friends
		if (friends.some(f => f.id === targetUserId)) return 'friends';
		// Check incoming
		if (incomingRequests.some(r => r.other.id === targetUserId)) return 'received';
		// Check outgoing
		if (outgoingRequests.some(r => r.other.id === targetUserId)) return 'sent';

		return 'none';
	};

	const sendRequest = async (targetUser) => {
		try {
			// Optimistic Update
			setOutgoingRequests(prev => [...prev, { other: targetUser, status: 'pending' }]);

			const { error } = await supabase
				.from('friendships')
				.insert({ user_id: currentUser.id, friend_id: targetUser.id });

			if (error) throw error;
			await fetchAllRelationships(); // Sync real state
			setMessage('Demande envoyée !');
			setTimeout(() => setMessage(''), 2000);
		} catch (err) {
			console.error(err);
			if (err.code === '23505') setMessage('Déjà demandé');
			else setMessage('Erreur envoi');
			await fetchAllRelationships(); // Rollback/Sync
		}
	};

	const handleRequest = async (friendshipId, action) => { // action: 'accept' | 'decline'
		try {
			if (action === 'accept') {
				const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
				if (error) throw error;
			} else {
				const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
				if (error) throw error;
			}
			fetchAllRelationships();
		} catch (err) {
			console.error(err);
		}
	};

	return (
		<div className="matches-screen">
			<div className="library-header">
				<button className="btn-back" onClick={onClose}>Retour</button>
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

			{message && <div style={{ textAlign: 'center', color: 'var(--gold)', marginBottom: 10 }}>{message}</div>}

			<div className="matches-grid view-list" style={{ display: 'block' }}>

				{/* --- LISTE AMIS --- */}
				{activeTab === 'list' && (
					<div className="input-group" style={{ background: 'transparent', boxShadow: 'none', border: 'none' }}>
						{friends.length === 0 ? (
							<p style={{ textAlign: 'center', color: '#666' }}>Vous n'avez pas encore d'amis.</p>
						) : (
							friends.map(friend => (
								<div key={friend.id} className="mini-card friend-card">
									<div className="friend-info">
										<div className="checkbox-circle" style={{ background: 'var(--bg-card)', border: '1px solid #444' }}>👤</div>
										<span className="friend-name">{friend.username}</span>
									</div>
									<div className="friend-actions">
										<button
											className="unified-btn secondary btn-library"
											onClick={() => onViewLibrary(friend)}
										>
											<span className="btn-text">Voir Bibliothèque</span>
											<span className="btn-icon">📚</span>
										</button>
										<button
											className="unified-btn delete-icon-btn"
											onClick={() => removeFriend(friend.friendship_id, friend.username)}
											title="Supprimer"
										>
											✕
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
