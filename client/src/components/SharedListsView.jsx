import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import MatchItem from './MatchItem';

const SharedListsView = ({ currentUser }) => {
	const [lists, setLists] = useState([]);
	const [view, setView] = useState('list'); // 'list' | 'detail'
	const [selectedList, setSelectedList] = useState(null);
	const [newListParam, setNewListParam] = useState("");
	const [loading, setLoading] = useState(false);

	// Fetch lists I am a member of (including owned)
	const fetchLists = async () => {
		setLoading(true);
		// We select via shared_lists directly, policy ensures we only see what we are members of
		const { data, error } = await supabase
			.from('shared_lists')
			.select('*')
			.order('created_at', { ascending: false });

		if (error) console.error("Error fetching shared lists:", error);
		else setLists(data || []);
		setLoading(false);
	};

	useEffect(() => {
		fetchLists();

		// Subscribe to changes? For simplicity, just fetch on mount.
		// Or simple realtime refresh
		const subscription = supabase
			.channel('public:shared_lists')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'shared_lists' }, fetchLists)
			.subscribe();

		return () => {
			supabase.removeChannel(subscription);
		};
	}, []);

	const createList = async () => {
		if (!newListParam.trim()) return;
		if (!currentUser) return alert("Connectez-vous !");

		const { error } = await supabase
			.from('shared_lists')
			.insert({ name: newListParam, owner_id: currentUser.id }); // Trigger will ideally add member, but let's be safe and insert member too if trigger not set?
		// Actually, RLS policy "Members can view shared lists" relies on shared_list_members.
		// If I insert into shared_lists, I am owner. But can I SELECT it immediately if I am not in shared_list_members?
		// My policy says: exists(... shared_list_members ...)
		// So I MUST insert into shared_list_members immediately.

		if (error) {
			console.error(error);
			alert("Erreur création.");
			return;
		}

		// We need the ID of the new list. Insert returns data.
		// Let's redo.
		const { data, error: insertError } = await supabase
			.from('shared_lists')
			.insert({ name: newListParam, owner_id: currentUser.id })
			.select()
			.single();

		if (insertError) {
			console.error(insertError);
			return;
		}

		// Add self as member
		const { error: memberError } = await supabase
			.from('shared_list_members')
			.insert({ list_id: data.id, user_id: currentUser.id });

		if (memberError) console.error("Error adding self:", memberError);

		setNewListParam("");
		fetchLists();
	};

	const deleteList = async (listId) => {
		if (!confirm("Supprimer cette liste partagée ?")) return;
		const { error } = await supabase.from('shared_lists').delete().eq('id', listId);
		if (error) alert("Erreur suppression (Êtes-vous propriétaire ?)");
		else fetchLists();
	};

	// --- MEMBER LOGIC ---
	const [members, setMembers] = useState([]);
	const [showAddMember, setShowAddMember] = useState(false);
	const [myFriends, setMyFriends] = useState([]);

	const fetchMembers = async (listId) => {
		// Fetch members with profiles
		const { data, error } = await supabase
			.from('shared_list_members')
			.select('user_id, profiles(username)')
			.eq('list_id', listId);

		if (error) console.error(error);
		else setMembers(data.map(d => ({ id: d.user_id, username: d.profiles?.username })));
	};

	const fetchMyFriends = async () => {
		// Reusing logic from FriendsView roughly
		// Get friends where I am user_id OR friend_id (complex if bidirectional, schema assumes direction?)
		// Schema: user_id, friend_id. Usually we check both directions or duplicate.
		// Let's assume user_id = me.
		const { data, error } = await supabase
			.from('friendships')
			.select('friend_id, profiles!friendships_friend_id_fkey(username, id)')
			.eq('user_id', currentUser.id);

		if (data) {
			setMyFriends(data.map(d => d.profiles));
		}
	};

	const addMember = async (friendId) => {
		if (!selectedList) return;
		const { error } = await supabase
			.from('shared_list_members')
			.insert({ list_id: selectedList.id, user_id: friendId });

		if (error) alert("Erreur ajout (déjà membre ?)");
		else {
			alert("Membre ajouté !");
			setShowAddMember(false);
			fetchMembers(selectedList.id);
		}
	};

	useEffect(() => {
		if (view === 'detail' && selectedList) {
			fetchMembers(selectedList.id);
		}
	}, [view, selectedList]);

	useEffect(() => {
		if (showAddMember) {
			fetchMyFriends();
		}
	}, [showAddMember]);

	// --- DETAIL VIEW ---
	if (view === 'detail' && selectedList) {
		return (
			<div className="friend-library" style={{ background: '#222' }}>
				<div className="friend-lib-header">
					<button className="unified-btn secondary" onClick={() => setView('list')}>⬅ Retour</button>
					<div>
						<h2 style={{ margin: 0 }}>{selectedList.name}</h2>
						<small style={{ color: '#aaa', display: 'flex', alignItems: 'center', gap: 5 }}>
							Membres: {members.map(m => m.username || 'Inconnu').join(', ')}
							{selectedList.owner_id === currentUser?.id && (
								<button
									className="unified-btn secondary"
									style={{ padding: '2px 8px', fontSize: 12 }}
									onClick={() => setShowAddMember(true)}
								>
									+
								</button>
							)}
						</small>
					</div>
				</div>

				{showAddMember && (
					<div className="modal-overlay" style={{ zIndex: 1100 }}>
						<div className="modal-content" style={{ maxWidth: 350, background: '#333', color: 'white' }}>
							<h3>Ajouter un membre</h3>
							<div className="friend-list" style={{ maxHeight: 200, overflowY: 'auto' }}>
								{myFriends.length === 0 && <p>Aucun ami à ajouter.</p>}
								{myFriends.map(f => (
									<div key={f.id} className="friend-item" onClick={() => addMember(f.id)} style={{ cursor: 'pointer' }}>
										<span>{f.username}</span>
										<span>➕</span>
									</div>
								))}
							</div>
							<button className="unified-btn secondary" style={{ marginTop: 10, width: '100%' }} onClick={() => setShowAddMember(false)}>Annuler</button>
						</div>
					</div>
				)}

				{/* LIST CONTENT */}
				<div className="matches-grid view-grid">
					{(!selectedList.movies || selectedList.movies.length === 0) && (
						<p style={{ padding: 20 }}>Aucun film dans cette liste.</p>
					)}
					{(selectedList.movies || []).map(m => (
						<div key={m.id}>
							<MatchItem movieId={m.id} />
						</div>
					))}
				</div>
			</div>
		);
	}

	// --- MAIN LIST VIEW ---
	return (
		<div className="friend-library-content">
			<div className="input-group" style={{ marginBottom: 20 }}>
				<input
					type="text"
					placeholder="Nom de la liste..."
					value={newListParam}
					onChange={e => setNewListParam(e.target.value)}
				/>
				<button className="unified-btn primary" onClick={createList}>Créer</button>
			</div>

			<div className="friend-list">
				{lists.map(lst => (
					<div key={lst.id} className="friend-item" onClick={() => { setSelectedList(lst); setView('detail'); }}>
						<div className="friend-info">
							<span className="friend-name">{lst.name}</span>
							<small>{lst.movies?.length || 0} films</small>
						</div>
						{lst.owner_id === currentUser?.id && (
							<button className="unified-btn secondary" onClick={(e) => { e.stopPropagation(); deleteList(lst.id); }}>
								🗑️
							</button>
						)}
					</div>
				))}
			</div>
		</div>
	);
};

export default SharedListsView;
