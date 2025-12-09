import React from 'react';
import { GENRES_LIST } from '../constants';

const GenreSelector = ({ selectedGenre, toggleGenre, onValidate, yearRange, setYearRange }) => {
	const currentYear = new Date().getFullYear();

	const handleYearChange = (type, value) => {
		setYearRange(prev => ({
			...prev,
			[type]: parseInt(value)
		}));
	};

	return (
		<div className="welcome-screen">
			<h2>Filtres</h2>

			{/* ANNEES */}
			<div className="filter-section" style={{ width: '100%', maxWidth: '400px', marginBottom: '20px' }}>
				<h3>Années</h3>
				<div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
					<input
						type="number"
						min="1900" max={currentYear}
						value={yearRange?.min || 1970}
						onChange={(e) => handleYearChange('min', e.target.value)}
						className="input-code" style={{ width: '80px', fontSize: '1rem' }}
					/>
					<span>à</span>
					<input
						type="number"
						min="1900" max={currentYear}
						value={yearRange?.max || currentYear}
						onChange={(e) => handleYearChange('max', e.target.value)}
						className="input-code" style={{ width: '80px', fontSize: '1rem' }}
					/>
				</div>
			</div>

			<p style={{ color: '#888', marginBottom: '10px' }}>
				{selectedGenre.length === 0 ? "Tous les genres" : `${selectedGenre.length} genres`}
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
				Valider les filtres
			</button>
		</div>
	);
};

export default GenreSelector;
