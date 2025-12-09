import React from 'react';
import Sidebar from './Sidebar';

const MainLayout = ({ children, activeTab, setActiveTab, user, onLogout }) => {
	return (
		<div className="main-layout">
			<Sidebar
				activeTab={activeTab}
				setActiveTab={setActiveTab}
				user={user}
				onLogout={onLogout}
			/>
			<main className="content-area">
				{children}
			</main>
		</div>
	);
};

export default MainLayout;
