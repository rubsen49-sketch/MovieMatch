import React from 'react';

class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false, error: null, errorInfo: null };
	}

	static getDerivedStateFromError(error) {
		// Update state so the next render will show the fallback UI.
		return { hasError: true, error };
	}

	componentDidCatch(error, errorInfo) {
		// You can also log the error to an error reporting service
		console.error("ErrorBoundary caught an error", error, errorInfo);
		this.setState({ errorInfo });
	}

	render() {
		if (this.state.hasError) {
			return (
				<div style={{ padding: 20, color: 'white', background: '#333', marginTop: 50 }}>
					<h2>Oups, une erreur est survenue.</h2>
					<details style={{ whiteSpace: 'pre-wrap' }}>
						{this.state.error && this.state.error.toString()}
						<br />
						{this.state.errorInfo && this.state.errorInfo.componentStack}
					</details>
					<button
						onClick={() => window.location.reload()}
						style={{ marginTop: 20, padding: '10px 20px', background: 'red', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
					>
						Recharger la page
					</button>
				</div>
			);
		}

		return this.props.children;
	}
}

export default ErrorBoundary;
