import React from 'react';

const Sidebar = ({ activeTab, setActiveTab, user, onLogout, isOpen, onClose }) => {

	const navItems = [
		{ id: 'home', label: 'Accueil', icon: '🏠' },
		{ id: 'matches', label: 'Mes Matchs', icon: '🎬' },
		{ id: 'friends', label: 'Amis', icon: '👥' },
	];

	return (
		<>
			{/* Mobile Overlay */}
			<div
				className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
				onClick={onClose}
			/>

			<aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
				<div className="sidebar-header-row">
					<div className="sidebar-logo">
						<h1>MM</h1>
						<span className="logo-text">MovieMatch</span>
					</div>
					<button className="close-sidebar-btn" onClick={onClose}>✕</button>
				</div>

				<nav className="sidebar-nav">
					{navItems.map(item => (
						<button
							key={item.id}
							className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
							onClick={() => setActiveTab(item.id)}
						>
							<span className="nav-icon">{item.icon}</span>
							<span className="nav-label">{item.label}</span>
						</button>
					))}
				</nav>

				<div className="sidebar-footer">
					{user && (
						<div className="user-profile">
							<div className="user-avatar">
								{user.user_metadata?.username?.[0]?.toUpperCase() || 'U'}
							</div>
							<div className="user-info">
								<span className="username">{user.user_metadata?.username || 'Utilisateur'}</span>
								<button onClick={onLogout} className="logout-btn">Déconnexion</button>
							</div>
						</div>
					)}
				</div>
			</aside>
		</>
	);
};

export default Sidebar;
