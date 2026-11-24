/** Shared reverse-play helpers, used by the generator and by probes. */
export function rngFrom(seed) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const DIRS = [
	{ dx: 0, dy: -1 },
	{ dx: 0, dy: 1 },
	{ dx: -1, dy: 0 },
	{ dx: 1, dy: 0 },
];

export function makeRoom(width, height, pillars, rng) {
	const size = width * height;
	const walls = new Uint8Array(size);
	for (let i = 0; i < size; i += 1) {
		const x = i % width;
		const y = Math.floor(i / width);
		if (x === 0 || y === 0 || x === width - 1 || y === height - 1) walls[i] = 1;
	}
	const interior = [];
	for (let i = 0; i < size; i += 1) if (!walls[i]) interior.push(i);
	const pick = (list) => list[Math.floor(rng() * list.length)];
	for (let n = 0; n < pillars; n += 1) walls[pick(interior)] = 1;

	const floor = [];
	for (let i = 0; i < size; i += 1) if (!walls[i]) floor.push(i);
	if (floor.length < 12) return null;

	const seen = new Set([floor[0]]);
	const stack = [floor[0]];
	while (stack.length) {
		const cell = stack.pop();
		const x = cell % width;
		const y = Math.floor(cell / width);
		for (const d of DIRS) {
			const nx = x + d.dx;
			const ny = y + d.dy;
			if (nx < 1 || ny < 1 || nx >= width - 1 || ny >= height - 1) continue;
			const next = ny * width + nx;
			if (walls[next] || seen.has(next)) continue;
			seen.add(next);
			stack.push(next);
		}
	}
	if (seen.size !== floor.length) return null;
	return { width, height, size, walls, floor };
}

export function reverseWalk(room, goals, steps, rng) {
	const { width, walls } = room;
	const boxes = new Set(goals);
	const pick = (list) => list[Math.floor(rng() * list.length)];
	const candidates = room.floor.filter((cell) => !boxes.has(cell));
	if (!candidates.length) return null;
	let player = pick(candidates);
	const free = (cell) => cell >= 0 && cell < room.size && !walls[cell] && !boxes.has(cell);

	for (let n = 0; n < steps; n += 1) {
		const x = player % width;
		const y = Math.floor(player / width);
		const pulls = [];
		const walksTo = [];
		for (const d of DIRS) {
			const ax = x + d.dx, ay = y + d.dy, bx = x - d.dx, by = y - d.dy;
			const ahead = ay * width + ax;
			const behind = by * width + bx;
			const aIn = ax > 0 && ay > 0 && ax < width - 1 && ay < room.height - 1;
			const bIn = bx > 0 && by > 0 && bx < width - 1 && by < room.height - 1;
			if (aIn && boxes.has(ahead) && bIn && free(behind)) pulls.push({ ahead, behind });
			if (bIn && free(behind)) walksTo.push(behind);
		}
		if (pulls.length && (!walksTo.length || rng() < 0.7)) {
			const { ahead, behind } = pick(pulls);
			boxes.delete(ahead);
			boxes.add(player);
			player = behind;
		} else if (walksTo.length) {
			player = pick(walksTo);
		}
	}
	return { boxes, player };
}

export function render(room, goals, boxes, player) {
	const rows = [];
	for (let y = 0; y < room.height; y += 1) {
		let row = "";
		for (let x = 0; x < room.width; x += 1) {
			const i = y * room.width + x;
			const goal = goals.has(i);
			if (room.walls[i]) row += "#";
			else if (boxes.has(i)) row += goal ? "*" : "$";
			else if (player === i) row += goal ? "+" : "@";
			else if (goal) row += ".";
			else row += " ";
		}
		rows.push(row.replace(/\s+$/, ""));
	}
	return rows;
}

/** One candidate level as text, or null if the room/walk did not work out. */
export function makeProbe(tier, seed) {
	const rng = rngFrom(seed);
	const room = makeRoom(tier.width, tier.height, tier.pillars, rng);
	if (!room) return null;
	const goals = new Set();
	let guard = 0;
	while (goals.size < tier.boxes && guard++ < 200) {
		goals.add(room.floor[Math.floor(rng() * room.floor.length)]);
	}
	if (goals.size < tier.boxes) return null;
	const walked = reverseWalk(room, goals, tier.pulls, rng);
	if (!walked) return null;
	for (const box of walked.boxes) if (goals.has(box)) return null;
	return render(room, goals, walked.boxes, walked.player).join("\n");
}
