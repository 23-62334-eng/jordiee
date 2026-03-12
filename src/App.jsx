import NavBar from "./components/NavBar.jsx";
import Home from "./Home.jsx";
import About from "./About.jsx";
import Education from "./Education.jsx";
import Job from "./Job.jsx";
import Certificate from "./Certificate.jsx";
import Footer from "./components/Footer.jsx";
import DarkModeToggle from "./components/DarkModeToggle.jsx";
import { motion } from "framer-motion";

function App() {
	return (
		<motion.div
			initial={{ opacity: 0, y: 24 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.7, ease: "easeOut" }}
			className="bg-white dark:bg-gray-900 min-h-screen transition-colors duration-500"
		>
			<DarkModeToggle />
			<Home />
			<About />
			<NavBar />
			<Education />
			<Job />
			<Certificate />
			<Footer />
		</motion.div>
	);
}

export default App;
