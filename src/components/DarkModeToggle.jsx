import { useState, useCallback, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import { useDarkMode } from "../context/DarkModeContext";

const ease = [0.4, 0, 0.2, 1];

function DarkModeToggle() {
	const { isDark, toggleDarkMode } = useDarkMode();
	const isOn = !isDark;
	const [pulling, setPulling] = useState(false);
	const lampControls = useAnimation();
	const chainControls = useAnimation();
	const entryControls = useAnimation();
	const [entered, setEntered] = useState(false);

	// Opening entrance animation
	useEffect(() => {
		const playEntry = async () => {
			// Drop down from above
			await entryControls.start({
				y: 0,
				transition: {
					type: "spring",
					stiffness: 120,
					damping: 14,
					mass: 0.8,
					delay: 0.3,
				},
			});
			// Settling swing after the drop
			await lampControls.start({
				rotate: [0, 6, -4, 2.5, -1, 0.3, 0],
				transition: { duration: 1.2, ease: "easeOut" },
			});
			setEntered(true);
		};
		playEntry();
	}, [entryControls, lampControls]);

	const handlePull = useCallback(async () => {
		if (pulling || !entered) return;
		setPulling(true);

		// Chain stretches down
		await chainControls.start({
			y: 12,
			scaleY: 1.08,
			transition: { type: "tween", duration: 0.1, ease: "easeOut" },
		});

		toggleDarkMode();

		// Lamp sways from the pull
		lampControls.start({
			rotate: [0, 3.5, -2, 1, -0.3, 0],
			transition: { duration: 0.85, ease: "easeOut" },
		});

		// Chain snaps back
		await chainControls.start({
			y: 0,
			scaleY: 1,
			transition: { type: "spring", stiffness: 320, damping: 18 },
		});

		setPulling(false);
	}, [pulling, entered, toggleDarkMode, lampControls, chainControls]);

	return (
		<motion.div
			className="fixed top-0 right-6 z-50 flex flex-col items-center"
			initial={{ y: -180 }}
			animate={entryControls}
			style={{ willChange: "transform" }}
		>
			{/* Ceiling rose / canopy */}
			<div
				style={{
					width: 28,
					height: 8,
					borderRadius: "0 0 5px 5px",
					background: isDark
						? "linear-gradient(180deg, #1e2533 0%, #2d3748 40%, #232b3a 100%)"
						: "linear-gradient(180deg, #c4ccd8 0%, #b0b8c4 40%, #9ca8b6 100%)",
					boxShadow: isDark
						? "0 2px 6px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,255,255,0.04)"
						: "0 2px 6px rgba(0,0,0,0.1), inset 0 -1px 0 rgba(255,255,255,0.4)",
					position: "relative",
				}}
			>
				{/* Canopy rim */}
				<div
					style={{
						position: "absolute",
						bottom: 0,
						left: 1,
						right: 1,
						height: 1.5,
						borderRadius: "0 0 4px 4px",
						background: isDark
							? "linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.08), rgba(255,255,255,0.03))"
							: "linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.4), rgba(255,255,255,0.15))",
					}}
				/>
			</div>

			{/* Ceiling glow when lamp is on */}
			<motion.div
				className="absolute pointer-events-none"
				style={{
					top: 0,
					left: "50%",
					marginLeft: -35,
					width: 70,
					height: 14,
					borderRadius: "0 0 50% 50%",
					background:
						"linear-gradient(180deg, rgba(251,191,36,0.15) 0%, rgba(251,191,36,0.04) 60%, transparent 100%)",
					willChange: "opacity",
				}}
				initial={false}
				animate={{ opacity: isOn ? 1 : 0 }}
				transition={{ type: "tween", duration: 0.4, ease }}
			/>

			{/* Wire / cord */}
			<div style={{ position: "relative", width: 3, height: 22 }}>
				<div
					style={{
						position: "absolute",
						left: "50%",
						marginLeft: -0.75,
						width: 1.5,
						height: "100%",
						background: isDark
							? "linear-gradient(180deg, #2d3748, #4a5568 50%, #3a4556)"
							: "linear-gradient(180deg, #8895a4, #a0aec0 50%, #8e9aaa)",
					}}
				/>
				{/* Wire highlight stripe */}
				<div
					style={{
						position: "absolute",
						left: "50%",
						marginLeft: 0,
						width: 0.5,
						height: "100%",
						background: isDark
							? "linear-gradient(180deg, transparent, rgba(255,255,255,0.05) 50%, transparent)"
							: "linear-gradient(180deg, transparent, rgba(255,255,255,0.3) 50%, transparent)",
					}}
				/>
			</div>

			{/* Swinging lamp assembly */}
			<motion.div
				animate={lampControls}
				style={{
					transformOrigin: "top center",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					willChange: "transform",
				}}
			>
				{/* Subtle idle sway */}
				<motion.div
					animate={{ rotate: [0, 0.25, 0, -0.25, 0] }}
					transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						willChange: "transform",
					}}
				>
					{/* Lamp clickable area */}
					<motion.button
						onClick={handlePull}
						className="relative cursor-pointer border-none p-0 bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:rounded-lg"
						aria-label={
							isOn ? "Turn off lamp (dark mode)" : "Turn on lamp (light mode)"
						}
						role="switch"
						aria-checked={isOn}
						whileHover={{ scale: 1.04, y: -1 }}
						whileTap={{ scale: 0.98 }}
						transition={{ type: "tween", duration: 0.15 }}
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
						}}
					>
						{/* === LIGHT EFFECTS (below shade) === */}

						{/* Warm ambient glow under lamp */}
						<motion.div
							className="absolute pointer-events-none"
							style={{
								top: 28,
								left: "50%",
								marginLeft: -40,
								width: 80,
								height: 80,
								borderRadius: "50%",
								background:
									"radial-gradient(ellipse at 50% 20%, rgba(251,191,36,0.3) 0%, rgba(251,191,36,0.08) 45%, transparent 70%)",
								willChange: "opacity",
							}}
							initial={false}
							animate={{ opacity: isOn ? 1 : 0 }}
							transition={{ type: "tween", duration: 0.4, ease }}
						/>

						{/* Light cone — trapezoidal projection */}
						<motion.div
							className="absolute pointer-events-none"
							style={{
								top: 34,
								left: "50%",
								marginLeft: -2,
								width: 4,
								height: 40,
								background:
									"linear-gradient(180deg, rgba(255,237,160,0.2) 0%, rgba(251,191,36,0.06) 60%, transparent 100%)",
								clipPath: "polygon(0% 0%, 100% 0%, 280% 100%, -180% 100%)",
								willChange: "opacity",
							}}
							initial={false}
							animate={{ opacity: isOn ? 1 : 0 }}
							transition={{ type: "tween", duration: 0.45, ease }}
						/>

						{/* === LAMP SVG === */}
						<svg
							width="46"
							height="44"
							viewBox="0 0 70 58"
							fill="none"
							style={{ position: "relative", zIndex: 2 }}
						>
							<defs>
								{/* Shade exterior — dark matte material */}
								<linearGradient id="shadeDark" x1="0.2" y1="0" x2="0.8" y2="1">
									<stop offset="0%" stopColor="#3d4a5e" />
									<stop offset="35%" stopColor="#2d3748" />
									<stop offset="70%" stopColor="#232b3a" />
									<stop offset="100%" stopColor="#1a202c" />
								</linearGradient>
								<linearGradient id="shadeLight" x1="0.2" y1="0" x2="0.8" y2="1">
									<stop offset="0%" stopColor="#d4dbe5" />
									<stop offset="35%" stopColor="#b8c2cf" />
									<stop offset="70%" stopColor="#a0aec0" />
									<stop offset="100%" stopColor="#8895a4" />
								</linearGradient>

								{/* Shade left specular — directional light reflection */}
								<linearGradient id="shadeSpecL" x1="0" y1="0" x2="1" y2="0.5">
									<stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
									<stop offset="30%" stopColor="rgba(255,255,255,0.04)" />
									<stop offset="100%" stopColor="rgba(255,255,255,0)" />
								</linearGradient>
								{/* Shade right subtle reflection */}
								<linearGradient id="shadeSpecR" x1="1" y1="0.2" x2="0" y2="0.8">
									<stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
									<stop offset="40%" stopColor="rgba(255,255,255,0)" />
								</linearGradient>

								{/* Inner shade — warm bounce light when on */}
								<linearGradient id="innerWarm" x1="0.5" y1="0" x2="0.5" y2="1">
									<stop offset="0%" stopColor="rgba(251,191,36,0)" />
									<stop offset="50%" stopColor="rgba(251,191,36,0.08)" />
									<stop offset="100%" stopColor="rgba(251,191,36,0.35)" />
								</linearGradient>
								{/* Inner shade — cool ambient when off */}
								<linearGradient id="innerCool" x1="0.5" y1="0" x2="0.5" y2="1">
									<stop
										offset="0%"
										stopColor={isDark ? "#1a202c" : "#8e9aaa"}
									/>
									<stop
										offset="100%"
										stopColor={isDark ? "#232b3a" : "#a0aec0"}
									/>
								</linearGradient>

								{/* Fixture cap metallic */}
								<linearGradient id="capMetal" x1="0" y1="0" x2="1" y2="0.3">
									<stop
										offset="0%"
										stopColor={isDark ? "#4a5568" : "#9ca8b6"}
									/>
									<stop
										offset="25%"
										stopColor={isDark ? "#78859b" : "#cbd5e0"}
									/>
									<stop
										offset="50%"
										stopColor={isDark ? "#8895a4" : "#e2e8f0"}
									/>
									<stop
										offset="75%"
										stopColor={isDark ? "#6b7a8c" : "#c0c8d2"}
									/>
									<stop
										offset="100%"
										stopColor={isDark ? "#4a5568" : "#9ca8b6"}
									/>
								</linearGradient>

								{/* Edison bulb — warm glow */}
								<radialGradient id="edisonOn" cx="0.45" cy="0.3" r="0.55">
									<stop offset="0%" stopColor="#fffef5" />
									<stop offset="25%" stopColor="#fef3c7" />
									<stop offset="55%" stopColor="#fcd34d" />
									<stop offset="80%" stopColor="#f59e0b" />
									<stop offset="100%" stopColor="#d97706" />
								</radialGradient>
								<radialGradient id="edisonOff" cx="0.45" cy="0.3" r="0.55">
									<stop
										offset="0%"
										stopColor={isDark ? "#5a6578" : "#dfe4ea"}
									/>
									<stop
										offset="60%"
										stopColor={isDark ? "#404a5c" : "#c0c8d2"}
									/>
									<stop
										offset="100%"
										stopColor={isDark ? "#2d3748" : "#a8b2bf"}
									/>
								</radialGradient>

								{/* Bulb specular */}
								<radialGradient id="bulbSpec" cx="0.35" cy="0.25" r="0.3">
									<stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
									<stop offset="60%" stopColor="rgba(255,255,255,0.1)" />
									<stop offset="100%" stopColor="rgba(255,255,255,0)" />
								</radialGradient>

								{/* Shade bottom rim highlight */}
								<linearGradient id="rimHL" x1="0" y1="0" x2="1" y2="0">
									<stop
										offset="0%"
										stopColor={
											isDark
												? "rgba(255,255,255,0.04)"
												: "rgba(255,255,255,0.15)"
										}
									/>
									<stop
										offset="50%"
										stopColor={
											isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.3)"
										}
									/>
									<stop
										offset="100%"
										stopColor={
											isDark
												? "rgba(255,255,255,0.04)"
												: "rgba(255,255,255,0.15)"
										}
									/>
								</linearGradient>
							</defs>

							{/* ── Fixture cap ── */}
							<rect
								x="29"
								y="0"
								width="12"
								height="7"
								rx="2.5"
								fill="url(#capMetal)"
							/>
							{/* Cap grooves */}
							<line
								x1="30.5"
								y1="2.5"
								x2="39.5"
								y2="2.5"
								stroke="rgba(255,255,255,0.08)"
								strokeWidth="0.4"
							/>
							<line
								x1="30.5"
								y1="4.5"
								x2="39.5"
								y2="4.5"
								stroke="rgba(0,0,0,0.12)"
								strokeWidth="0.4"
							/>
							{/* Cap bottom edge */}
							<rect
								x="28"
								y="6"
								width="14"
								height="1.5"
								rx="0.5"
								fill={isDark ? "#3d4a5e" : "#a8b5c4"}
							/>

							{/* ── Lamp shade exterior — bell/dome ── */}
							<path
								d="M30 7.5 C28 7.5 26 9 24 12 L12 40 Q10 44 14 45.5 L56 45.5 Q60 44 58 40 L46 12 C44 9 42 7.5 40 7.5 Z"
								fill={isDark ? "url(#shadeDark)" : "url(#shadeLight)"}
							/>
							{/* Left specular band */}
							<path
								d="M30 7.5 C28 7.5 26 9 24 12 L12 40 Q10 44 14 45.5 L56 45.5 Q60 44 58 40 L46 12 C44 9 42 7.5 40 7.5 Z"
								fill="url(#shadeSpecL)"
							/>
							{/* Right subtle reflection */}
							<path
								d="M30 7.5 C28 7.5 26 9 24 12 L12 40 Q10 44 14 45.5 L56 45.5 Q60 44 58 40 L46 12 C44 9 42 7.5 40 7.5 Z"
								fill="url(#shadeSpecR)"
							/>

							{/* Shade outline */}
							<path
								d="M30 7.5 C28 7.5 26 9 24 12 L12 40 Q10 44 14 45.5 L56 45.5 Q60 44 58 40 L46 12 C44 9 42 7.5 40 7.5 Z"
								fill="none"
								stroke={isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)"}
								strokeWidth="0.5"
							/>

							{/* Decorative band near bottom */}
							<path
								d="M14.5 40 L55.5 40"
								stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"}
								strokeWidth="0.6"
							/>
							<path
								d="M13.5 42 L56.5 42"
								stroke={isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"}
								strokeWidth="0.5"
							/>

							{/* ── Shade bottom opening — visible interior ── */}
							{/* Interior depth */}
							<ellipse
								cx="35"
								cy="45.5"
								rx="21"
								ry="3.5"
								fill={isDark ? "#151b26" : "#7a8899"}
							/>
							{/* Inner surface with bounce light */}
							<ellipse
								cx="35"
								cy="45.5"
								rx="21"
								ry="3.5"
								fill="url(#innerWarm)"
								opacity={isOn ? 1 : 0}
								style={{ transition: "opacity 0.35s ease" }}
							/>
							{/* Inner surface cool fill when off */}
							<ellipse
								cx="35"
								cy="45.5"
								rx="21"
								ry="3.5"
								fill="url(#innerCool)"
								opacity={isOn ? 0 : 0.5}
								style={{ transition: "opacity 0.35s ease" }}
							/>

							{/* Rim highlight ring */}
							<ellipse
								cx="35"
								cy="45.5"
								rx="21"
								ry="3.5"
								fill="none"
								stroke="url(#rimHL)"
								strokeWidth="0.7"
							/>

							{/* ── Edison bulb (visible inside) ── */}
							{/* Bulb glow aura */}
							<ellipse
								cx="35"
								cy="42"
								rx="8"
								ry="5"
								fill="rgba(251,191,36,0.2)"
								opacity={isOn ? 1 : 0}
								style={{ transition: "opacity 0.35s ease" }}
							/>

							{/* Bulb body — classic teardrop */}
							<path
								d="M35 33 C31 33 28 36 28 39.5 C28 42 29.5 43.5 31 44 L39 44 C40.5 43.5 42 42 42 39.5 C42 36 39 33 35 33 Z"
								fill={isOn ? "url(#edisonOn)" : "url(#edisonOff)"}
								style={{ transition: "fill 0.35s ease" }}
							/>
							{/* Bulb glass specular */}
							<ellipse
								cx="33"
								cy="36.5"
								rx="2.5"
								ry="3"
								fill="url(#bulbSpec)"
								opacity={isOn ? 0.7 : 0.25}
								style={{ transition: "opacity 0.35s ease" }}
							/>

							{/* Filament wires — visible through glass */}
							<g
								stroke={isOn ? "#f59e0b" : isDark ? "#555e6e" : "#a0aec0"}
								strokeWidth="0.5"
								opacity={isOn ? 0.6 : 0.2}
								style={{ transition: "stroke 0.35s ease, opacity 0.35s ease" }}
							>
								<line x1="33" y1="43.5" x2="33" y2="38" />
								<line x1="37" y1="43.5" x2="37" y2="38" />
								<polyline
									points="33,39 34,37.5 35,39 36,37.5 37,39"
									fill="none"
									strokeWidth="0.6"
									strokeLinecap="round"
								/>
							</g>

							{/* Filament glow core */}
							<ellipse
								cx="35"
								cy="38.5"
								rx="3"
								ry="2"
								fill="rgba(255,245,200,0.5)"
								opacity={isOn ? 1 : 0}
								style={{ transition: "opacity 0.35s ease" }}
							/>

							{/* Screw base of bulb */}
							<rect
								x="32"
								y="44"
								width="6"
								height="3"
								rx="0.8"
								fill={isDark ? "#4a5568" : "#a8b5c4"}
							/>
							<line
								x1="32.5"
								y1="45"
								x2="37.5"
								y2="45"
								stroke="rgba(0,0,0,0.15)"
								strokeWidth="0.4"
							/>
							<line
								x1="32.5"
								y1="46"
								x2="37.5"
								y2="46"
								stroke="rgba(255,255,255,0.06)"
								strokeWidth="0.3"
							/>
						</svg>

						{/* === Pull chain === */}
						<motion.div
							animate={chainControls}
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								zIndex: 2,
								marginTop: -5,
								transformOrigin: "top center",
								willChange: "transform",
							}}
						>
							{/* Thin cord segment */}
							<div
								style={{
									width: 1,
									height: 6,
									background: isDark
										? "linear-gradient(180deg, #4a5568, #5a6578)"
										: "linear-gradient(180deg, #a0aec0, #b8c4d0)",
								}}
							/>

							{/* Ball chain */}
							<svg width="5" height="18" viewBox="0 0 10 34" fill="none">
								<defs>
									<radialGradient id="cBall" cx="0.35" cy="0.28" r="0.45">
										<stop
											offset="0%"
											stopColor={isDark ? "#9aa5b4" : "#e8ecf0"}
										/>
										<stop
											offset="50%"
											stopColor={isDark ? "#6b7a8c" : "#c8d0da"}
										/>
										<stop
											offset="100%"
											stopColor={isDark ? "#3d4a5c" : "#9ca8b6"}
										/>
									</radialGradient>
								</defs>
								{[0, 9, 18].map((y) => (
									<g key={y}>
										<rect
											x="4.2"
											y={y + 4}
											width="1.6"
											height="4.5"
											rx="0.5"
											fill={isDark ? "#4a5568" : "#a0aec0"}
										/>
										<circle cx="5" cy={y + 3.5} r="3" fill="url(#cBall)" />
										<circle
											cx="3.6"
											cy={y + 2.2}
											r="1"
											fill="rgba(255,255,255,0.35)"
										/>
									</g>
								))}
							</svg>

							{/* Pull ornament — acorn/teardrop */}
							<div
								style={{
									width: 10,
									height: 14,
									borderRadius: "50% 50% 50% 50% / 35% 35% 65% 65%",
									background: isDark
										? "radial-gradient(ellipse at 35% 28%, #8895a4, #5a6578 45%, #2d3748)"
										: "radial-gradient(ellipse at 35% 28%, #f0f4f8, #c8d0da 45%, #8e9aaa)",
									boxShadow: isDark
										? "0 2px 5px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 3px rgba(0,0,0,0.25)"
										: "0 2px 5px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 3px rgba(0,0,0,0.05)",
									marginTop: -2,
									position: "relative",
								}}
							>
								{/* Ornament specular */}
								<div
									style={{
										position: "absolute",
										top: 2,
										left: 2,
										width: 4,
										height: 5,
										borderRadius: "50%",
										background:
											"radial-gradient(circle, rgba(255,255,255,0.4), transparent)",
									}}
								/>
							</div>
						</motion.div>
					</motion.button>
				</motion.div>
			</motion.div>
		</motion.div>
	);
}

export default DarkModeToggle;
