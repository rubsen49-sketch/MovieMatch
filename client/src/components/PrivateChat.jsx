import React, { useState, useEffect } from 'react';
import ChatBox from './ChatBox';
import { supabase } from '../supabaseClient';

const PrivateChat = ({ currentUser, targetUser, onClose }) => {
	const [messages, setMessages] = useState([]);
	const [isOpen, setIsOpen] = useState(true);

	useEffect(() => {
		if (!currentUser || !targetUser) return;

		// 1. Fetch History
		const fetchHistory = async () => {
			const { data, error } = await supabase
				.from('messages')
				.select('*')
				.or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${targetUser.id}),and(sender_id.eq.${targetUser.id},receiver_id.eq.${currentUser.id})`)
				.order('created_at', { ascending: true })
				.limit(100);

			if (error) console.error("Error fetching messages:", error);
			else {
				const formatted = data.map(m => ({
					user: m.sender_id === currentUser.id ? currentUser.user_metadata?.username || 'Moi' : targetUser.username,
					text: m.content,
					type: 'user',
					timestamp: m.created_at
				}));
				setMessages(formatted);
			}
		};

		fetchHistory();

		// 2. Subscribe to Realtime
		const channel = supabase
			.channel(`room:chat:${currentUser.id}-${targetUser.id}`)
			.on('postgres_changes',
				{ event: 'INSERT', schema: 'public', table: 'messages' },
				(payload) => {
					const newMsg = payload.new;
					// Check if relevant
					if (
						(newMsg.sender_id === currentUser.id && newMsg.receiver_id === targetUser.id) ||
						(newMsg.sender_id === targetUser.id && newMsg.receiver_id === currentUser.id)
					) {
						const formattedMsg = {
							user: newMsg.sender_id === currentUser.id ? currentUser.user_metadata?.username || 'Moi' : targetUser.username,
							text: newMsg.content,
							type: 'user',
							timestamp: newMsg.created_at
						};
						setMessages(prev => [...prev, formattedMsg]);
					}
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [currentUser, targetUser]);

	const sendMessage = async (text) => {
		try {
			const { error } = await supabase
				.from('messages')
				.insert({
					sender_id: currentUser.id,
					receiver_id: targetUser.id,
					content: text
				});

			if (error) throw error;
			// Optimistic update not strictly needed as subscription handles it, but feels faster? 
			// Actually dangerous if sub is fast. Let's rely on sub or just append manually if sub is laggy.
			// Supabase Realtime is fast. Let's wait for sub.
		} catch (err) {
			console.error("Error sending private message:", err);
		}
	};

	return (
		<ChatBox
			isOpen={isOpen}
			onClose={() => { setIsOpen(false); onClose(); }}
			messages={messages}
			onSendMessage={sendMessage}
			currentUsername={currentUser.user_metadata?.username}
			title={`Chat avec ${targetUser.username} 💌`}
		/>
	);
};

export default PrivateChat;
