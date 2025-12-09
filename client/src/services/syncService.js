import { supabase } from '../supabaseClient';

export const syncUserProfile = async (currentUser) => {
	if (!currentUser) return;
	const { error } = await supabase
		.from('profiles')
		.upsert({
			id: currentUser.id,
			username: currentUser.user_metadata?.username,
			updated_at: new Date()
		});
	if (error) console.error("Profile sync error:", error);
};

export const syncLibraryWithCloud = async (user) => {
	try {
		if (!user) return [];
		const userId = user.id;

		// 1. Fetch Cloud Data
		const { data, error } = await supabase
			.from('profiles')
			.select('library')
			.eq('id', userId)
			.single();

		if (error && error.code !== 'PGRST116') {
			console.error("Error fetching cloud library:", error);
		}

		const cloudLibrary = data?.library || [];
		const localLibrary = JSON.parse(localStorage.getItem('myMatches')) || [];

		// 2. Merge (Union of IDs)
		const mergedMap = new Map();
		localLibrary.forEach(item => mergedMap.set(item.id, item));
		cloudLibrary.forEach(item => mergedMap.set(item.id, item)); // Cloud overwrites local if duplicate

		const mergedArray = Array.from(mergedMap.values());

		// 3. Update Cloud (to sync back any local-only items)
		await supabase.from('profiles').upsert({
			id: userId,
			library: mergedArray,
			updated_at: new Date()
		});

		return mergedArray;

	} catch (err) {
		console.error("Sync error:", err);
		return [];
	}
};

export const saveToCloud = async (user, newLibrary) => {
	if (!user) return;
	await supabase.from('profiles').upsert({
		id: user.id,
		library: newLibrary,
		updated_at: new Date()
	});
};
