import React, { useState } from 'react';
import MatchItem from './MatchItem';
import SharedListsView from './SharedListsView';

const ResultsView = ({ savedMatches, onClose, resetMyMatches, onDetails, onUpdateStatus, onRemove, onBulkUpdate, onBulkRemove, currentUser }) => {
	const [activeTab, setActiveTab] = useState('to_watch');
	const [isSelectionMode, setIsSelectionMode] = useState(false);
	const [selectedIds, setSelectedIds] = useState([]);
	const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

	// Filter logic: handle both new objects and old IDs (fallback)
	const getFilteredMatches = () => {
		return savedMatches.filter(item => {
			// If item is number (old format), treat as 'to_watch'
			if (typeof item === 'number') return activeTab === 'to_watch';
			return item.status === activeTab;
		});
	};

	const matchesToShow = getFilteredMatches();

	const toggleSelection = (id) => {
		if (selectedIds.includes(id)) {
			setSelectedIds(selectedIds.filter(itemId => itemId !== id));
		} else {
			setSelectedIds([...selectedIds, id]);
		}
	};

	const handleBulkAction = (action) => {
		if (action === 'move') {
			const targetStatus = activeTab === 'to_watch' ? 'watched' : 'to_watch';
			onBulkUpdate(selectedIds, targetStatus);
		} else if (action === 'delete') {
			onBulkRemove(selectedIds);
		}
		setIsSelectionMode(false);
		setSelectedIds([]);
	};

	return (
		<div className="matches-screen">
			<div className="library-header">
				<button className="btn-utility" onClick={onClose}>
					<span>←</span> Retour
				</button>

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

				<button
					className={`unified-btn ${isSelectionMode ? 'primary' : 'secondary'}`}
					style={{ width: 'auto', padding: '5px 15px', borderRadius: 20 }}
					onClick={() => {
						setIsSelectionMode(!isSelectionMode);
						setSelectedIds([]);
					}}
				>
					{isSelectionMode ? 'OK' : 'Sélection'}
				</button>
			</div>

			<div className="library-tabs">
				<button
					className={`tab-btn ${activeTab === 'to_watch' ? 'active' : ''}`}
					onClick={() => { setActiveTab('to_watch'); setIsSelectionMode(false); }}
				>
					À voir ({savedMatches.filter(m => typeof m === 'number' || m.status === 'to_watch').length})
				</button>
				<button
					className={`tab-btn ${activeTab === 'watched' ? 'active' : ''}`}
					onClick={() => { setActiveTab('watched'); setIsSelectionMode(false); }}
				>
					Vus ({savedMatches.filter(m => typeof m === 'object' && m.status === 'watched').length})
				</button>
				{currentUser && (
					<button
						className={`tab-btn ${activeTab === 'shared' ? 'active' : ''}`}
						onClick={() => { setActiveTab('shared'); setIsSelectionMode(false); }}
					>
						Partagées 👥
					</button>
				)}
			</div>

			{activeTab === 'shared' ? (
				<div style={{ padding: '0 20px', height: '100%', overflowY: 'auto' }}>
					<SharedListsView currentUser={currentUser} savedMatches={savedMatches} />
				</div>
			) : (
				<div className={`matches-grid ${viewMode === 'list' ? 'view-list' : 'view-grid'}`}>
					{matchesToShow.map(item => {
						const movieId = typeof item === 'number' ? item : item.id;
						const isSelected = selectedIds.includes(movieId);

						return (
							<div
								key={movieId}
								style={{ position: 'relative' }}
								className={isSelectionMode && isSelected ? 'item-selected' : ''}
								onClick={() => isSelectionMode && toggleSelection(movieId)}
							>
								<MatchItem
									movieId={movieId}
									onClick={isSelectionMode ? () => toggleSelection(movieId) : onDetails}
								/>

								{/* Checkbox Overlay in Selection Mode */}
								{isSelectionMode && (
									<div className={`selection-overlay ${isSelected ? 'checked' : ''}`}>
										<div className="checkbox-circle">
											{isSelected && '✓'}
										</div>
									</div>
								)}

								{/* Standard Actions (Only if NOT in selection mode) */}
								{!isSelectionMode && (
									<div className="card-actions">
										{activeTab === 'to_watch' && (
											<button
												className="action-btn check"
												title="Marquer comme vu"
												onClick={(e) => { e.stopPropagation(); onUpdateStatus(movieId, 'watched'); }}
											>
												✔️
											</button>
										)}
										{activeTab === 'watched' && (
											<button
												className="action-btn"
												title="Remettre à voir"
												onClick={(e) => { e.stopPropagation(); onUpdateStatus(movieId, 'to_watch'); }}
											>
												↩️
											</button>
										)}
										<button
											className="action-btn delete"
											title="Supprimer"
											onClick={(e) => { e.stopPropagation(); onRemove(movieId); }}
										>
											🗑️
										</button>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* BULK ACTION BAR */}
			{isSelectionMode && selectedIds.length > 0 && (
				<div className="bulk-action-bar">
					<span className="selection-count">{selectedIds.length} sélectionné(s)</span>
					<div className="bulk-buttons">
						<button className="bulk-btn move" onClick={() => handleBulkAction('move')}>
							{activeTab === 'to_watch' ? '✅ Marquer Vus' : '↩️ Remettre à voir'}
						</button>
						<button className="bulk-btn delete" onClick={() => handleBulkAction('delete')}>
							🗑️ Supprimer
						</button>
					</div>
				</div>
			)}

			{savedMatches.length === 0 && (
				<p style={{ color: '#666', marginTop: 50 }}>Aucun film pour le moment...</p>
			)}
		</div>
	);
};

export default ResultsView;
