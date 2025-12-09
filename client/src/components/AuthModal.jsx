import { useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthModal = ({ onClose }) => {
	const [isSignUp, setIsSignUp] = useState(false);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [username, setUsername] = useState('');
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState('');
	const [errorMsg, setErrorMsg] = useState('');

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setMessage('');
		setErrorMsg('');

		try {
			if (isSignUp) {
				// --- INSCRIPTION ---
				const { data, error } = await supabase.auth.signUp({
					email,
					password,
					options: {
						data: { username: username } // Store username in metadata
					}
				});
				if (error) throw error;
				setMessage("Compte créé avec succès ! Vous êtes connecté.");
				setTimeout(onClose, 1500); // Close automatically

			} else {
				// --- CONNEXION ---
				const { data, error } = await supabase.auth.signInWithPassword({
					email,
					password
				});
				if (error) throw error;
				setMessage("Connexion réussie !");
				setTimeout(onClose, 1000);
			}
		} catch (err) {
			setErrorMsg(err.message === "Invalid login credentials"
				? "Email ou mot de passe incorrect."
				: err.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content" onClick={e => e.stopPropagation()} style={{ height: 'auto', padding: '30px' }}>
				<button className="close-modal" onClick={onClose}>✕</button>

				<h2 style={{ textAlign: 'center', marginBottom: 20 }}>
					{isSignUp ? "Créer un compte" : "Se connecter"}
				</h2>

				{message && (
					<div style={{ textAlign: 'center', color: '#4ade80', marginBottom: 15, fontWeight: 'bold' }}>
						{message}
					</div>
				)}

				{errorMsg && (
					<div style={{ textAlign: 'center', color: '#ff4757', marginBottom: 15 }}>
						{errorMsg}
					</div>
				)}

				<form onSubmit={handleSubmit} className="input-group" style={{ boxShadow: 'none', padding: 0 }}>

					{isSignUp && (
						<input
							type="text"
							placeholder="Nom d'utilisateur"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							required
						/>
					)}

					<input
						type="email"
						placeholder="Email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>

					<input
						type="password"
						placeholder="Mot de passe"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						minLength={6}
					/>

					<button className="unified-btn primary" disabled={loading}>
						{loading ? 'Chargement...' : (isSignUp ? "S'inscrire" : "Se connecter")}
					</button>
				</form>

				<p style={{ textAlign: 'center', marginTop: 20, color: '#aaa', fontSize: '0.9rem' }}>
					{isSignUp ? "Déjà un compte ?" : "Pas encore de compte ?"}
					<button
						onClick={() => {
							setIsSignUp(!isSignUp);
							setMessage('');
							setErrorMsg('');
						}}
						style={{
							background: 'none',
							border: 'none',
							color: 'var(--gold)',
							cursor: 'pointer',
							marginLeft: 5,
							fontWeight: 'bold',
							textDecoration: 'underline'
						}}
					>
						{isSignUp ? "Se connecter" : "Créer un compte"}
					</button>
				</p>
			</div>
		</div>
	);
};

export default AuthModal;
