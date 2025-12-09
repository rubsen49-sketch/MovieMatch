import React from 'react';
import { GENRES_LIST } from '../constants';

const GenreSelector = ({ selectedGenre, toggleGenre, onValidate }) => {
	return (
		<div className="welcome-screen">
			<h2>Choisis tes styles</h2>
			<p style={{ color: '#888', marginBottom: '20px' }}>
				{selectedGenre.length === 0 ? "Tous les genres" : `${selectedGenre.length} sélectionné(s)`}
			</p>

			<div className="genre-grid-container">
				{GENRES_LIST.map((genre) => {
					const isActive = selectedGenre.includes(genre.id);
					return (
						<div
							key={genre.id}
							className={`genre-box ${isActive ? 'active' : ''}`}
							onClick={() => toggleGenre(genre.id)}
						>
							{genre.name}
						</div>
					);
				})}
			</div>

			<button
				className="unified-btn validate"
				style={{ marginTop: '20px' }}
				onClick={onValidate}
			>
				Valider les genres
			</button>
		</div>
	);
};

export default GenreSelector;
