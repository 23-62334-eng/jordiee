import { motion } from "framer-motion";
import { useDarkMode } from "../context/DarkModeContext";
import portraitDark from "../assets/me/portrait-ascii-dark.svg";
import portraitLight from "../assets/me/portrait-ascii-light.svg";

// ASCII portrait lifted from the fastfetch profile card (art only, no info panel).
// Dark variant = light glyphs, light variant = dark glyphs.
function NeofetchPortrait({ className = "" }) {
	const { isDark } = useDarkMode();

	return (
		<motion.div
			className={`relative ${className}`}
			whileHover={{
				scale: 1.04,
				filter: isDark ? "brightness(1.15)" : "brightness(0.92)",
			}}
			transition={{ duration: 0.4, ease: "easeOut" }}
		>
			<img
				src={isDark ? portraitDark : portraitLight}
				alt="ASCII art portrait of Mark Jordan Javier"
				draggable={false}
				className="w-full h-full object-contain select-none pointer-events-none"
			/>
		</motion.div>
	);
}

export default NeofetchPortrait;
