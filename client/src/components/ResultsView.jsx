import React, { useState } from 'react';
import MatchItem from './MatchItem';

const ResultsView = ({ savedMatches, onClose, resetMyMatches, onDetails, onUpdateStatus, onRemove }) => {
	const [activeTab, setActiveTab] = useState('to_watch');

	// Filter logic: handle both new objects and old IDs (fallback)
	const getFilteredMatches = () => {
		return savedMatches.filter(item => {
			// If item is number (old format), treat as 'to_watch'
			if (typeof item === 'number') return activeTab === 'to_watch';
			return item.status === activeTab;
		});
	};

	const matchesToShow = getFilteredMatches();

	return (
		<div className="matches-screen">
			<button className="btn-back" onClick={onClose}>Retour</button>

			<h2>Ma Bibliothèque</h2>

			<div className="library-tabs">
				<button
					className={`tab-btn ${activeTab === 'to_watch' ? 'active' : ''}`}
					onClick={() => setActiveTab('to_watch')}
				>
					À voir ({savedMatches.filter(m => typeof m === 'number' || m.status === 'to_watch').length})
				</button>
				<button
					className={`tab-btn ${activeTab === 'watched' ? 'active' : ''}`}
					onClick={() => setActiveTab('watched')}
				>
					Vus ({savedMatches.filter(m => typeof m === 'object' && m.status === 'watched').length})
				</button>
			</div>

			<div className="matches-grid">
				{matchesToShow.map(item => {
					const movieId = typeof item === 'number' ? item : item.id;
					return (
						<div key={movieId} style={{ position: 'relative' }}>
							<MatchItem
								movieId={movieId}
								onClick={onDetails}
							/>
							<div className="card-actions">
								{activeTab === 'to_watch' && (
									<button
										className="action-btn check"
										title="Marquer comme vu"
										onClick={(e) => {
											e.stopPropagation();
											onUpdateStatus(movieId, 'watched');
										}}
									>
										✔️
									</button>
								)}
								{activeTab === 'watched' && (
									<button
										className="action-btn"
										title="Remettre à voir"
										onClick={(e) => {
											e.stopPropagation();
											onUpdateStatus(movieId, 'to_watch');
										}}
									>
										↩️
									</button>
								)}
								<button
									className="action-btn delete"
									title="Supprimer"
									onClick={(e) => {
										e.stopPropagation();
										onRemove(movieId);
									}}
								>
									🗑️
								</button>
							</div>
						</div>
					);
				})}
			</div>

			{savedMatches.length === 0 && (
				<p style={{ color: '#666', marginTop: 50 }}>Aucun film pour le moment...</p>
			)}
		</div>
	);
};

export default ResultsView;
