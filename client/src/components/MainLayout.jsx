import React, { useState } from 'react';
import Sidebar from './Sidebar';

const MainLayout = ({ children, activeTab, setActiveTab, user, onLogout }) => {
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	return (
		<div className="main-layout">
			{/* Mobile Header / Hamburger (Visible only on mobile via CSS) */}
			<div className="mobile-header">
				<button
					className="hamburger-btn"
					onClick={() => setIsMobileMenuOpen(true)}
				>
					☰
				</button>
				<span className="mobile-logo-text">MovieMatch</span>
			</div>

			<Sidebar
				activeTab={activeTab}
				setActiveTab={(tab) => {
					setActiveTab(tab);
					setIsMobileMenuOpen(false); // Close on selection
				}}
				user={user}
				onLogout={onLogout}
				isOpen={isMobileMenuOpen}
				onClose={() => setIsMobileMenuOpen(false)}
			/>

			<main className="content-area">
				{children}
			</main>
		</div>
	);
};

export default MainLayout;
