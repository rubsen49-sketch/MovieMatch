import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const FriendsView = ({ onClose, currentUser, onViewLibrary }) => {
	const [activeTab, setActiveTab] = useState('list'); // 'list', 'add', 'requests'
	const [friends, setFriends] = useState([]);
	const [requests, setRequests] = useState([]);
	const [searchResults, setSearchResults] = useState([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState('');

	useEffect(() => {
		fetchFriends();
		fetchRequests();
	}, [currentUser]);

	const fetchFriends = async () => {
		try {
			const { data, error } = await supabase
				.from('friendships')
				.select(`
          id, 
          status,
          friend:friend_id(username, id),
          user:user_id(username, id)
        `)
				.or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`)
				.eq('status', 'accepted');

			if (error) throw error;

			// Normalize data: get the "other" person
			const formatted = data.map(f => {
				const isMeRequester = f.user.id === currentUser.id;
				return isMeRequester ? f.friend : f.user;
			});
			setFriends(formatted);
		} catch (err) {
			console.error("Error fetching friends:", err);
		}
	};

	const fetchRequests = async () => {
		try {
			const { data, error } = await supabase
				.from('friendships')
				.select(`
          id, 
          status,
          user:user_id(username, id)
        `)
				.eq('friend_id', currentUser.id) // Only requests sent TO me
				.eq('status', 'pending');

			if (error) throw error;
			setRequests(data.map(r => ({ id: r.id, requester: r.user })));
		} catch (err) {
			console.error("Error fetching requests:", err);
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
		}, 500); // 500ms delay

		return () => clearTimeout(delayDebounceFn);
	}, [searchQuery]);

	const searchUsers = async (e) => {
		if (e) e.preventDefault();
		if (!searchQuery.trim()) return;

		setLoading(true);
		// setSearchResults([]); // Don't clear immediately to avoid flickering

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

	const sendRequest = async (targetId) => {
		try {
			const { error } = await supabase
				.from('friendships')
				.insert({ user_id: currentUser.id, friend_id: targetId });

			if (error) throw error;
			setMessage('Demande envoyée !');
			setTimeout(() => setMessage(''), 2000);
		} catch (err) {
			if (err.code === '23505') setMessage('Déjà amis ou demande en cours');
			else setMessage('Erreur lors de l\'envoi');
		}
	};

	const acceptRequest = async (friendshipId) => {
		try {
			const { error } = await supabase
				.from('friendships')
				.update({ status: 'accepted' })
				.eq('id', friendshipId);
			if (error) throw error;
			// Refresh
			fetchRequests();
			fetchFriends();
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
					Demandes {requests.length > 0 && <span style={{ color: 'var(--red)' }}>({requests.length})</span>}
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
								<div key={friend.id} className="mini-card" style={{ padding: 15, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
									<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
										<div className="checkbox-circle" style={{ background: 'var(--bg-card)', border: '1px solid #444' }}>👤</div>
										<span style={{ color: 'white', fontWeight: 'bold' }}>{friend.username}</span>
									</div>
									<button
										className="unified-btn secondary"
										style={{ width: 'auto', padding: '5px 15px', fontSize: '0.8rem' }}
										onClick={() => onViewLibrary(friend)}
									>
										Voir Bibliothèque
									</button>
								</div>
							))
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
							{searchResults.map(user => (
								<div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', padding: '10px 0' }}>
									<span style={{ color: 'white' }}>{user.username}</span>
									<button className="unified-btn secondary" style={{ width: 'auto', padding: '5px 10px' }} onClick={() => sendRequest(user.id)}>
										Ajouter +
									</button>
								</div>
							))}
						</div>
					</div>
				)}

				{/* --- DEMANDES --- */}
				{activeTab === 'requests' && (
					<div className="input-group" style={{ background: 'transparent', boxShadow: 'none', border: 'none' }}>
						{requests.length === 0 ? (
							<p style={{ textAlign: 'center', color: '#666' }}>Aucune demande en attente.</p>
						) : (
							requests.map(req => (
								<div key={req.id} className="mini-card" style={{ padding: 15, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
									<span style={{ color: 'white' }}>Demande de <strong>{req.requester.username}</strong></span>
									<button className="unified-btn primary" style={{ width: 'auto', padding: '5px 15px', background: 'var(--primary)' }} onClick={() => acceptRequest(req.id)}>
										Accepter
									</button>
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
