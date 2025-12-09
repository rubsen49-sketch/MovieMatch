import React from 'react';
import MatchItem from './MatchItem';

const ResultsView = ({ savedMatches, onClose, resetMyMatches, onDetails }) => {
	return (
		<div className="matches-screen">
			<button className="btn-back" onClick={onClose}>Retour</button>
			<h2>Mes Matchs</h2>
			{savedMatches.length > 0 && (
				<button onClick={resetMyMatches} className="btn-reset">🗑️ Réinitialiser</button>
			)}
			<div className="matches-grid">
				{savedMatches.map(id => (
					<MatchItem
						key={id}
						movieId={id}
						onClick={onDetails}
					/>
				))}
			</div>
		</div>
	);
};

export default ResultsView;
