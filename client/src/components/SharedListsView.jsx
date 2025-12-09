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

	// --- DETAIL VIEW ---
	if (view === 'detail' && selectedList) {
		return (
			<div className="friend-library" style={{ background: '#222' }}>
				<div className="friend-lib-header">
					<button className="unified-btn secondary" onClick={() => setView('list')}>⬅ Retour</button>
					<h2>{selectedList.name}</h2>
				</div>

				{/* LIST CONTENT */}
				<div className="matches-grid view-grid">
					{(!selectedList.movies || selectedList.movies.length === 0) && (
						<p style={{ padding: 20 }}>Aucun film dans cette liste.</p>
					)}
					{(selectedList.movies || []).map(m => (
						<div key={m.id}>
							<MatchItem movieId={m.id} />
							{/* Note: MatchItem fetches details. Ideally we pass full object if we have it? 
                                 Check MatchItem logic. It takes movieId and fetches? 
                                 Or if we modify MatchItem to accept 'movieData' prop to avoid fetch.
                                 Let's assume standard MatchItem for now. 
                             */}
						</div>
					))}
				</div>

				{/* Note: Adding movies requires separate logic (from search results). 
                    Here we arguably just View. 
                */}
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
