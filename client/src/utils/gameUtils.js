export const seededRandom = (seed) => {
	let t = seed += 0x6D2B79F5;
	t = Math.imul(t ^ t >>> 15, t | 1);
	t ^= t + Math.imul(t ^ t >>> 7, t | 61);
	return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

// Hashes a string (room code) into a number seed
export const cyrb128 = (str) => {
	let h1 = 1779033703, h2 = 3144134277,
		h3 = 1013904242, h4 = 2773480762;
	for (let i = 0, k; i < str.length; i++) {
		k = str.charCodeAt(i);
		h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
		h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
		h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
		h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
	}
	h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
	h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
	h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
	h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
	return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
};

// Fisher-Yates shuffle with seeded random
export const seededShuffle = (array, seedString) => {
	if (!seedString) return array;

	// Create a numeric seed from the string
	const seed = cyrb128(seedString);
	let rand = seededRandom(seed);

	// We need a generator, seededRandom returns a SINGLE number.
	// Let's make a generator function.
	const random = (() => {
		let s = seed;
		return () => {
			s += 0x6D2B79F5;
			var t = Math.imul(s ^ s >>> 15, s | 1);
			t ^= t + Math.imul(t ^ t >>> 7, t | 61);
			return ((t ^ t >>> 14) >>> 0) / 4294967296;
		};
	})();

	const newArray = [...array];
	for (let i = newArray.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[newArray[i], newArray[j]] = [newArray[j], newArray[i]];
	}
	return newArray;
};
