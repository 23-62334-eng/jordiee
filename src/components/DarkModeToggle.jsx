import { motion } from "framer-motion";
import { FiSun, FiMoon } from "react-icons/fi";
import { useDarkMode } from "../context/DarkModeContext";

function DarkModeToggle() {
	const { isDark, toggleDarkMode } = useDarkMode();

	return (
		<motion.button
			onClick={toggleDarkMode}
			className="fixed top-6 right-6 z-50 p-3 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300"
			whileHover={{ scale: 1.05 }}
			whileTap={{ scale: 0.95 }}
			aria-label="Toggle dark mode"
		>
			<motion.div
				initial={false}
				animate={{
					rotate: isDark ? 180 : 0,
					scale: isDark ? 0.9 : 1,
				}}
				transition={{
					duration: 0.4,
					ease: "easeInOut",
				}}
			>
				{isDark ? (
					<FiMoon className="w-5 h-5 text-blue-400" />
				) : (
					<FiSun className="w-5 h-5 text-amber-500" />
				)}
			</motion.div>
		</motion.button>
	);
}

export default DarkModeToggle;
