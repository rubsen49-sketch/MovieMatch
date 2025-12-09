import React, { useState, useEffect, useRef } from 'react';

const ChatBox = ({ messages, onSendMessage, onClose, isOpen, currentUsername, title = "Tchat du Salon 💬" }) => {
	const [inputText, setInputText] = useState('');
	const messagesEndRef = useRef(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		if (isOpen) {
			scrollToBottom();
		}
	}, [messages, isOpen]);

	const handleSubmit = (e) => {
		e.preventDefault();
		if (inputText.trim()) {
			onSendMessage(inputText);
			setInputText('');
		}
	};

	if (!isOpen) return null;

	return (
		<div className="chat-overlay">
			<div className="chat-header">
				<h3>{title}</h3>
				<button className="close-chat" onClick={onClose}>×</button>
			</div>

			<div className="chat-messages">
				{messages.length === 0 ? (
					<div className="empty-chat">Dites bonjour ! 👋</div>
				) : (
					messages.map((msg, index) => {
						const isMyMessage = msg.user === currentUsername;
						const isSystem = msg.type === 'system';

						return (
							<div key={index} className={`chat-message ${isMyMessage ? 'my-message' : ''} ${isSystem ? 'system-message' : ''}`}>
								{!isMyMessage && !isSystem && <span className="chat-user">{msg.user}</span>}
								<span className="chat-text">{msg.text}</span>
							</div>
						);
					})
				)}
				<div ref={messagesEndRef} />
			</div>

			<form className="chat-input-area" onSubmit={handleSubmit}>
				<input
					type="text"
					value={inputText}
					onChange={(e) => setInputText(e.target.value)}
					placeholder="Votre message..."
					autoFocus
				/>
				<button type="submit">➤</button>
			</form>
		</div>
	);
};

export default ChatBox;
