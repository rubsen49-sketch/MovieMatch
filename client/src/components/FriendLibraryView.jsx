import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import MatchItem from './MatchItem';

const FriendLibraryView = ({ friendId, friendUsername, onClose, onDetails }) => {
	const [library, setLibrary] = useState([]);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState('to_watch'); // 'to_watch' | 'watched'
	const [viewMode, setViewMode] = useState('list'); // Default to list for better reading

	useEffect(() => {
		fetchFriendLibrary();
	}, [friendId]);

	const fetchFriendLibrary = async () => {
		try {
			const { data, error } = await supabase
				.from('profiles')
				.select('library')
				.eq('id', friendId)
				.single();

			if (error) throw error;

			// Data format in DB is the array of match objects
			setLibrary(data?.library || []);
		} catch (err) {
			console.error("Error fetching friend library:", err);
		} finally {
			setLoading(false);
		}
	};

	const matchesToShow = library.filter(item => {
		// Handle legacy data (numbers) or objects
		if (typeof item === 'number') return activeTab === 'to_watch';
		// If item has no status, assume 'to_watch'
		return (item.status || 'to_watch') === activeTab;
	});

	return (
		<div className="matches-screen" style={{ background: '#1a1a1a' }}>
			<div className="library-header">
				<button className="btn-back" onClick={onClose}>Retour</button>
				<div style={{ flex: 1, textAlign: 'center' }}>
					<h2 style={{ margin: 0, fontSize: '1rem', color: '#888' }}>Bibliothèque de</h2>
					<h1 style={{ margin: 0, fontSize: '1.4rem' }}>{friendUsername}</h1>
				</div>

				<div className="view-toggles">
					<button
						className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
						onClick={() => setViewMode('grid')}
						title="Grille"
					>
						⊞
					</button>
					<button
						className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
						onClick={() => setViewMode('list')}
						title="Liste"
					>
						☰
					</button>
				</div>
			</div>

			<div className="library-tabs">
				<button
					className={`tab-btn ${activeTab === 'to_watch' ? 'active' : ''}`}
					onClick={() => setActiveTab('to_watch')}
				>
					À voir
				</button>
				<button
					className={`tab-btn ${activeTab === 'watched' ? 'active' : ''}`}
					onClick={() => setActiveTab('watched')}
				>
					Vus
				</button>
			</div>

			{loading ? (
				<div style={{ textAlign: 'center', marginTop: 50 }}>Chargement...</div>
			) : (
				<div className={`matches-grid ${viewMode === 'list' ? 'view-list' : 'view-grid'}`}>
					{matchesToShow.length === 0 ? (
						<p style={{ color: '#666', width: '100%', textAlign: 'center' }}>Aucun film dans cette liste.</p>
					) : (
						matchesToShow.map(item => {
							const movieId = typeof item === 'number' ? item : item.id;
							return (
								<div key={movieId} onClick={() => onDetails(movieId)}>
									<MatchItem movieId={movieId} onClick={() => onDetails(movieId)} />
									{/* Read Only - No buttons */}
								</div>
							);
						})
					)}
				</div>
			)}
		</div>
	);
};

export default FriendLibraryView;
