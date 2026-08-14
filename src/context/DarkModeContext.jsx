import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

const STORAGE_KEY = "theme";
const MIGRATION_KEY = "theme-mode-v2";
export const THEMES = ["system", "light", "dark"];

const DarkModeContext = createContext(null);

export const useDarkMode = () => {
	const context = useContext(DarkModeContext);
	if (!context) {
		throw new Error("useDarkMode must be used within DarkModeProvider");
	}
	return context;
};

// Storage throws when cookies/storage are blocked; a missing preference is
// never worth breaking the app over.
function readStoredTheme() {
	try {
		// The pre-paint script in index.html performs the one-time reset of
		// legacy "light"/"dark" values; this is the same guard, so the two agree
		// even if the script is bypassed (e.g. a test harness mounting React
		// directly).
		if (!localStorage.getItem(MIGRATION_KEY)) {
			localStorage.removeItem(STORAGE_KEY);
			localStorage.setItem(MIGRATION_KEY, "1");
			return "system";
		}

		const saved = localStorage.getItem(STORAGE_KEY);
		// Values written by the previous two-state toggle ("light"/"dark") are
		// still valid, so no migration is needed.
		return THEMES.includes(saved) ? saved : "system";
	} catch {
		return "system";
	}
}

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

export const DarkModeProvider = ({ children }) => {
	const [theme, setThemeState] = useState(readStoredTheme);
	const [systemDark, setSystemDark] = useState(() => darkQuery().matches);

	// Tracked unconditionally rather than only while theme === "system", so
	// switching back to System is instant instead of waiting for the next OS
	// change to arrive.
	useEffect(() => {
		const query = darkQuery();
		const update = (event) => setSystemDark(event.matches);

		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);

	const isDark = theme === "system" ? systemDark : theme === "dark";

	useEffect(() => {
		document.documentElement.classList.toggle("dark", isDark);
		// Lets native UI — scrollbars, form controls, the caret — follow the
		// theme instead of staying stuck in light.
		document.documentElement.style.colorScheme = isDark ? "dark" : "light";
	}, [isDark]);

	const setTheme = useCallback((next) => {
		if (!THEMES.includes(next)) return;

		setThemeState(next);
		try {
			localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// Preference just will not survive a reload.
		}
	}, []);

	// Kept so anything still calling the old two-state API keeps working; it
	// resolves System to whichever concrete theme is currently showing.
	const toggleDarkMode = useCallback(() => {
		setTheme(isDark ? "light" : "dark");
	}, [isDark, setTheme]);

	const value = useMemo(
		() => ({ theme, isDark, systemDark, setTheme, toggleDarkMode }),
		[theme, isDark, systemDark, setTheme, toggleDarkMode]
	);

	return (
		<DarkModeContext.Provider value={value}>{children}</DarkModeContext.Provider>
	);
};
