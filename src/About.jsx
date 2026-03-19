import profileImg from "./assets/me/portrait.png";
import { motion } from "framer-motion";
import { useState } from "react";
import { FiMapPin, FiCalendar, FiMail } from "react-icons/fi";
import TechLogoMarquee from "./components/TechLogoMarquee";

const techColors = {
	Figma: { bg: "#F24E1E", text: "#fff" },
	JavaScript: { bg: "#F7DF1E", text: "#000" },
	React: { bg: "#61DAFB", text: "#000" },
	"Tailwind CSS": { bg: "#38BDF8", text: "#000" },
	Prettier: { bg: "#F7B93E", text: "#000" },
	PHP: { bg: "#777BB4", text: "#fff" },
	MySQL: { bg: "#4479A1", text: "#fff" },
	Python: { bg: "#3776AB", text: "#fff" },
	Java: { bg: "#E76F00", text: "#fff" },
	Docker: { bg: "#2496ED", text: "#fff" },
	XAMPP: { bg: "#FB7A24", text: "#fff" },
	n8n: { bg: "#EA4B71", text: "#fff" },
	GitHub: { bg: "#181717", text: "#fff" },
	"VS Code": { bg: "#007ACC", text: "#fff" },
	Cursor: { bg: "#6B7280", text: "#fff" },
	"IntelliJ IDEA": { bg: "#FE315D", text: "#fff" },
	PyCharm: { bg: "#21D789", text: "#000" },
	NetBeans: { bg: "#1B6AC6", text: "#fff" },
	Xcode: { bg: "#147EFB", text: "#fff" },
};

function TechPill({ tool }) {
	const [hovered, setHovered] = useState(false);
	const brand = techColors[tool];
	const hoverStyle =
		hovered && brand
			? {
					backgroundColor: brand.bg,
					color: brand.text,
					borderColor: brand.bg,
					boxShadow: `0 0 14px 3px ${brand.bg}70`,
					transform: "scale(1.05) translateY(-2px)",
				}
			: { transform: "scale(1) translateY(0)" };

	return (
		<span
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			style={{
				transition:
					"background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, transform 0.2s ease",
				...hoverStyle,
			}}
			className="px-2.5 py-0.5 rounded-full text-[11px] font-medium cursor-default
				bg-gray-100 dark:bg-gray-800
				border border-gray-300 dark:border-gray-600
				text-gray-700 dark:text-gray-300"
		>
			{tool}
		</span>
	);
}

const techCategories = [
	{ label: "UI / UX", items: ["Figma"] },
	{
		label: "Frontend",
		items: ["JavaScript", "React", "Tailwind CSS", "Prettier"],
	},
	{ label: "Backend", items: ["PHP", "MySQL", "Python", "Java"] },
	{ label: "Cloud", items: ["Docker", "XAMPP"] },
	{ label: "CMS & No-Code", items: ["n8n"] },
	{
		label: "Developer Tools",
		items: [
			"GitHub",
			"VS Code",
			"Cursor",
			"IntelliJ IDEA",
			"PyCharm",
			"NetBeans",
			"Xcode",
		],
	},
];

function About() {
	const stagger = {
		hidden: {},
		visible: { transition: { staggerChildren: 0.06 } },
	};

	const fadeUp = {
		hidden: { opacity: 0, y: 14 },
		visible: {
			opacity: 1,
			y: 0,
			transition: { duration: 0.5, ease: "easeOut" },
		},
	};

	return (
		<section id="profile" className="min-h-screen">
			<div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-16">
				<motion.div
					initial={{ opacity: 0, y: 60 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.1 }}
					transition={{ duration: 0.8, ease: "easeOut" }}
					className="relative max-w-5xl w-full rounded-3xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-2xl
						border border-white/50 dark:border-gray-700/50
						shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)]
						overflow-hidden"
				>
					<div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-white/40 dark:from-gray-700/40 via-transparent to-white/10 dark:to-gray-800/10" />

					{/* ── Row 1: Profile Header ── */}
					<motion.div
						variants={stagger}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
						className="flex flex-col sm:flex-row items-center justify-between gap-5 px-7 py-6 sm:px-9 sm:py-7
							border-b border-gray-200/40 dark:border-gray-700/40"
					>
						{/* Profile Info */}
						<motion.div variants={fadeUp} className="flex items-center gap-4">
							<img
								src={profileImg}
								alt="Jordan"
								className="w-16 h-16 rounded-full object-cover ring-2 ring-white/60 dark:ring-gray-600/60 shadow-md"
							/>
							<div>
								<div className="flex items-center gap-1.5">
									<h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
										Mark Jordan Javier
									</h2>
									<motion.div
										className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 cursor-pointer"
										title="Certified Developer"
										whileHover={{ scale: 1.2, rotate: 10 }}
										transition={{ type: "spring", stiffness: 400, damping: 15 }}
									>
										<svg
											fill="#009dff"
											viewBox="-960 -960 3840 3840"
											xmlns="http://www.w3.org/2000/svg"
											className="w-6 h-6"
										>
											<path d="M960 15 693.227 257.027 333.44 243.053 284.693 599.96 0 820.547l192 304.64-76.267 352 342.934 109.973 167.893 318.613L960 1769.56l333.44 136.213 167.893-318.613 342.934-109.973-76.267-352 192-304.64-284.693-220.587-48.747-356.907-359.893 13.974L960 15Zm352.747 616.427 147.84 153.813-600 577.28-402.774-402.773L608.64 808.92l254.933 254.827 449.174-432.32Z" />
										</svg>
									</motion.div>
								</div>
								<p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
									<FiMapPin className="w-3 h-3" />
									Batangas, Philippines
								</p>
								<p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
									Full Stack Web Developer{" "}
									<span className="text-gray-400 dark:text-gray-500">|</span> BS
									Information Technology Student
								</p>
							</div>
						</motion.div>

						{/* Action Buttons */}
						<motion.div variants={fadeUp} className="flex items-center gap-2.5">
							<a
								href="https://calendly.com/javiermarkjordan/30min"
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold
									bg-gray-900 dark:bg-white text-white dark:text-gray-900
									hover:bg-gray-800 dark:hover:bg-gray-100
									shadow-sm hover:shadow-md
									transition-all duration-200 active:scale-95"
							>
								<FiCalendar className="w-3.5 h-3.5" />
								Schedule a Meeting
							</a>
							<a
								href="mailto:javiermarkjordan@gmail.com"
								className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold
									bg-white/70 dark:bg-gray-700/70
									border border-gray-200/60 dark:border-gray-600/50
									text-gray-700 dark:text-gray-200
									hover:bg-white dark:hover:bg-gray-600
									shadow-sm hover:shadow-md
									transition-all duration-200 active:scale-95"
							>
								<FiMail className="w-3.5 h-3.5" />
								Send Email
							</a>
						</motion.div>
					</motion.div>

					{/* ── Row 2: About Text + Animated Logos ── */}
					<div
						className="flex flex-col lg:flex-row gap-6 lg:gap-8 px-7 py-6 sm:px-9 sm:py-7
						border-b border-gray-200/40 dark:border-gray-700/40"
					>
						{/* Left: About Text */}
						<motion.div
							variants={stagger}
							initial="hidden"
							whileInView="visible"
							viewport={{ once: true }}
							className="flex-1 min-w-0"
						>
							<motion.h3
								variants={fadeUp}
								className="text-lg font-bold text-gray-900 dark:text-white mb-3"
							>
								About Me
							</motion.h3>

							<motion.p
								variants={fadeUp}
								className="text-sm leading-6 text-gray-600 dark:text-gray-300 mb-3"
							>
								Hello! I'm{" "}
								<span className="font-semibold text-gray-900 dark:text-white">
									Jordiee
								</span>
								, a passionate Full Stack Web Developer and BS Information
								Technology student. I love building clean, functional, and
								modern web applications that provide great user experiences.
							</motion.p>

							<motion.p
								variants={fadeUp}
								className="text-sm leading-6 text-gray-600 dark:text-gray-300"
							>
								I specialize in frontend and backend development using modern
								tools such as React, Tailwind CSS, PHP, MySQL, and JavaScript. I
								enjoy solving problems, designing interfaces, and continuously
								learning new technologies.
							</motion.p>
						</motion.div>

						{/* Right: Animated Marquee */}
						<div className="w-full lg:w-[320px] shrink-0 flex items-center">
							<TechLogoMarquee />
						</div>
					</div>

					{/* ── Row 3: Tech Stack Categories ── */}
					<motion.div
						variants={stagger}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
						className="px-7 py-6 sm:px-9 sm:py-7"
					>
						<motion.div
							variants={fadeUp}
							className="flex items-center gap-2 mb-4"
						>
							<span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-white" />
							<h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide">
								Tech Stack
							</h3>
						</motion.div>

						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3.5">
							{techCategories.map((category) => (
								<motion.div key={category.label} variants={fadeUp}>
									<p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-widest">
										{category.label}
									</p>
									<div className="flex flex-wrap gap-1.5">
										{category.items.map((tool) => (
											<TechPill key={tool} tool={tool} />
										))}
									</div>
								</motion.div>
							))}
						</div>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}

export default About;
