import { useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthModal = ({ onClose }) => {
	const [email, setEmail] = useState('');
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState('');

	const handleLogin = async (e) => {
		e.preventDefault();
		setLoading(true);
		setMessage('');

		// Magic Link Login
		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: {
				// In local, supabase default redirect works, but we can be explicit if needed
				emailRedirectTo: window.location.origin
			}
		});

		if (error) {
			setMessage(`Erreur: ${error.message}`);
		} else {
			setMessage("💌 Lien magique envoyé ! Vérifiez vos emails.");
		}
		setLoading(false);
	};

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content" onClick={e => e.stopPropagation()} style={{ height: 'auto', padding: '30px' }}>
				<button className="close-modal" onClick={onClose}>✕</button>
				<h2 style={{ textAlign: 'center', marginBottom: 20 }}>Créer un compte / Se connecter</h2>

				{message ? (
					<div style={{ textAlign: 'center', color: '#4ade80', marginBottom: 20 }}>{message}</div>
				) : (
					<form onSubmit={handleLogin} className="input-group" style={{ boxShadow: 'none', padding: 0 }}>
						<p style={{ textAlign: 'center', marginBottom: 20, color: '#aaa', fontSize: '0.9rem' }}>
							Entrez votre email. Si vous n'avez pas de compte, il sera créé automatiquement !
						</p>
						<input
							type="email"
							placeholder="votre@email.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
						<button className="unified-btn primary" disabled={loading}>
							{loading ? 'Envoi...' : 'Envoyer le lien'}
						</button>
					</form>
				)}
			</div>
		</div>
	);
};

export default AuthModal;
