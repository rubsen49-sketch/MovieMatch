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
			<h2 style={{ padding: '0 var(--space-md)' }}>Filtres</h2>

			{/* ANNEES */}
			<div className="filter-section" style={{ width: '100%', marginBottom: '20px', textAlign: 'center' }}>
				<h3 style={{ marginBottom: 10, color: 'var(--text-sub)' }}>Années de sortie</h3>
				<div className="input-year-group">
					<input
						type="number"
						min="1900" max={currentYear}
						value={yearRange?.min || 1970}
						onChange={(e) => handleYearChange('min', e.target.value)}
						className="input-year"
					/>
					<span style={{ color: '#666' }}>à</span>
					<input
						type="number"
						min="1900" max={currentYear}
						value={yearRange?.max || currentYear}
						onChange={(e) => handleYearChange('max', e.target.value)}
						className="input-year"
					/>
				</div>
			</div>

			<p style={{ color: 'var(--text-sub)', marginBottom: '15px', fontSize: '0.9rem', padding: '0 var(--space-md)' }}>
				{selectedGenre.length === 0 ? "Tous les genres sélectionnés" : `${selectedGenre.length} genres sélectionnés`}
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
				style={{ marginTop: '20px', width: 'auto', minWidth: '200px', margin: '20px auto', display: 'flex' }}
				onClick={onValidate}
			>
				Valider les filtres
			</button>
		</div>
	);
};

export default GenreSelector;
