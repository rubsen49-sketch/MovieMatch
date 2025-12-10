import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

export const useFriends = (currentUser) => {
	const [friends, setFriends] = useState([]);
	const [incomingRequests, setIncomingRequests] = useState([]); // Requests sent TO me
	const [outgoingRequests, setOutgoingRequests] = useState([]); // Requests I sent
	const [searchResults, setSearchResults] = useState([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [loading, setLoading] = useState(false);

	const fetchAllRelationships = useCallback(async () => {
		if (!currentUser) return;
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
			const incoming = [];
			const outgoing = [];

			data.forEach(rel => {
				if (rel.status === 'accepted') {
					const isMeRequester = rel.user_id === currentUser.id;
					const friendProfile = isMeRequester ? rel.friend : rel.user;

					// [FIX] Guard against deleted users (rel.friend or rel.user might be null)
					if (friendProfile && friendProfile.id) {
						if (!uniqueFriends.has(friendProfile.id)) {
							uniqueFriends.set(friendProfile.id, { ...friendProfile, friendship_id: rel.id });
						}
					}
				} else if (rel.status === 'pending') {
					if (rel.friend_id === currentUser.id) {
						// Incoming request: I am the friend_id, sender is user_id (rel.user)
						if (rel.user) {
							incoming.push({ ...rel, other: rel.user });
						}
					} else {
						// Outgoing request: I am the user_id, target is friend_id (rel.friend)
						if (rel.friend) {
							outgoing.push({ ...rel, other: rel.friend });
						}
					}
				}
			});

			setFriends(Array.from(uniqueFriends.values()));
			setIncomingRequests(incoming);
			setOutgoingRequests(outgoing);

		} catch (err) {
			console.error("Error fetching relationships:", err);
			toast.error("Erreur chargement amis");
		}
	}, [currentUser]);

	useEffect(() => {
		fetchAllRelationships();
	}, [fetchAllRelationships]);

	const removeFriend = async (friendshipId, friendName) => {
		if (!confirm(`Supprimer ${friendName} de vos amis ?`)) return;

		try {
			const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
			if (error) throw error;
			toast.success(`${friendName} supprimé`);
			fetchAllRelationships();
		} catch (err) {
			console.error(err);
			toast.error("Erreur lors de la suppression");
		}
	};

	const searchUsers = async (query) => {
		if (!query.trim()) {
			setSearchResults([]);
			return;
		}

		setLoading(true);

		try {
			const { data, error } = await supabase
				.from('profiles')
				.select('id, username')
				.ilike('username', `%${query}%`)
				.neq('id', currentUser.id)
				.limit(10);

			if (error) throw error;
			setSearchResults(data);
		} catch (err) {
			console.error("Search error:", err);
			toast.error("Erreur recherche");
		} finally {
			setLoading(false);
		}
	};

	// Debounce search effect using local state
	useEffect(() => {
		const delayDebounceFn = setTimeout(() => {
			if (searchQuery.trim()) {
				searchUsers(searchQuery);
			} else {
				setSearchResults([]);
			}
		}, 500);

		return () => clearTimeout(delayDebounceFn);
	}, [searchQuery]);

	const getRelationshipStatus = (targetUserId) => {
		if (friends.some(f => f.id === targetUserId)) return 'friends';
		if (incomingRequests.some(r => r.other.id === targetUserId)) return 'received';
		if (outgoingRequests.some(r => r.other.id === targetUserId)) return 'sent';
		return 'none';
	};

	const sendRequest = async (targetUser) => {
		try {
			const { error } = await supabase
				.from('friendships')
				.insert({ user_id: currentUser.id, friend_id: targetUser.id });

			if (error) throw error;
			await fetchAllRelationships();
			toast.success(`Demande envoyée à ${targetUser.username}`);
		} catch (err) {
			console.error(err);
			if (err.code === '23505') toast('Déjà demandé', { icon: '⚠️' });
			else toast.error('Erreur envoi');
			await fetchAllRelationships();
		}
	};

	const handleRequest = async (friendshipId, action) => { // action: 'accept' | 'decline'
		try {
			if (action === 'accept') {
				const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
				if (error) throw error;
				toast.success("Ami ajouté !");
			} else {
				const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
				if (error) throw error;
				toast.success("Demande refusée");
			}
			fetchAllRelationships();
		} catch (err) {
			console.error(err);
			toast.error("Une erreur est survenue");
		}
	};

	return {
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
		handleRequest,
		refresh: fetchAllRelationships
	};
};
