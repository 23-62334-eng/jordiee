import { createContext, useContext, useEffect, useState } from "react";

const DarkModeContext = createContext();

export const useDarkMode = () => {
	const context = useContext(DarkModeContext);
	if (!context) {
		throw new Error("useDarkMode must be used within DarkModeProvider");
	}
	return context;
};

export const DarkModeProvider = ({ children }) => {
	const [isDark, setIsDark] = useState(() => {
		// Check localStorage first
		const saved = localStorage.getItem("theme");
		if (saved) {
			return saved === "dark";
		}
		// Fall back to system preference
		return window.matchMedia("(prefers-color-scheme: dark)").matches;
	});

	useEffect(() => {
		// Update document class and localStorage
		if (isDark) {
			document.documentElement.classList.add("dark");
			localStorage.setItem("theme", "dark");
		} else {
			document.documentElement.classList.remove("dark");
			localStorage.setItem("theme", "light");
		}
	}, [isDark]);

	const toggleDarkMode = () => {
		setIsDark((prev) => !prev);
	};

	return (
		<DarkModeContext.Provider value={{ isDark, toggleDarkMode }}>
			{children}
		</DarkModeContext.Provider>
	);
};
