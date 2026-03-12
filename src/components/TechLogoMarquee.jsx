import { motion } from "framer-motion";
import {
	SiFigma,
	SiJavascript,
	SiReact,
	SiTailwindcss,
	SiPrettier,
	SiPhp,
	SiMysql,
	SiPython,
	SiDocker,
	SiXampp,
	SiGithub,
	SiIntellijidea,
	SiPycharm,
	SiApachenetbeanside,
	SiXcode,
} from "react-icons/si";
import { FaJava } from "react-icons/fa";
import { TbAutomation, TbCursorText } from "react-icons/tb";
import { VscCode } from "react-icons/vsc";

const techLogos = [
	{ name: "Figma", icon: SiFigma, color: "#F24E1E" },
	{ name: "JavaScript", icon: SiJavascript, color: "#F7DF1E" },
	{ name: "React", icon: SiReact, color: "#61DAFB" },
	{ name: "Tailwind CSS", icon: SiTailwindcss, color: "#06B6D4" },
	{ name: "Prettier", icon: SiPrettier, color: "#F7B93E" },
	{ name: "PHP", icon: SiPhp, color: "#777BB4" },
	{ name: "MySQL", icon: SiMysql, color: "#4479A1" },
	{ name: "Python", icon: SiPython, color: "#3776AB" },
	{ name: "Java", icon: FaJava, color: "#ED8B00" },
	{ name: "Docker", icon: SiDocker, color: "#2496ED" },
	{ name: "XAMPP", icon: SiXampp, color: "#FB7A24" },
	{ name: "n8n", icon: TbAutomation, color: "#EA4B71" },
	{ name: "GitHub", icon: SiGithub, color: "#E6EDF3" },
	{ name: "VS Code", icon: VscCode, color: "#007ACC" },
	{ name: "Cursor", icon: TbCursorText, color: "#A0A0A0" },
	{ name: "IntelliJ IDEA", icon: SiIntellijidea, color: "#FE315D" },
	{ name: "PyCharm", icon: SiPycharm, color: "#21D789" },
	{ name: "NetBeans", icon: SiApachenetbeanside, color: "#1B6AC6" },
	{ name: "Xcode", icon: SiXcode, color: "#147EFB" },
];

// Split logos into 3 rows
const rows = [
	techLogos.slice(0, 7),
	techLogos.slice(7, 13),
	techLogos.slice(13, 19),
];

function MarqueeRow({ items, reverse = false }) {
	// Duplicate items enough times for seamless loop
	const duplicated = [...items, ...items, ...items, ...items];

	return (
		<div className="group relative overflow-hidden py-1.5">
			{/* Fade edges */}
			<div className="pointer-events-none absolute inset-y-0 left-0 w-8 z-10 bg-gradient-to-r from-white/80 dark:from-gray-800/80 to-transparent" />
			<div className="pointer-events-none absolute inset-y-0 right-0 w-8 z-10 bg-gradient-to-l from-white/80 dark:from-gray-800/80 to-transparent" />

			<div
				className={`flex gap-3 w-max ${
					reverse ? "marquee-reverse" : "marquee"
				} group-hover:[animation-play-state:paused]`}
			>
				{duplicated.map((tech, i) => {
					const Icon = tech.icon;
					return (
						<div
							key={`${tech.name}-${i}`}
							className="flex items-center justify-center w-10 h-10 rounded-xl
								bg-gray-100/80 dark:bg-gray-800/60
								border border-gray-200/40 dark:border-gray-700/40
								hover:scale-110 hover:shadow-lg hover:shadow-current/10
								hover:border-gray-300 dark:hover:border-gray-500
								cursor-default transition-all duration-200"
						>
							<Icon className="w-5 h-5" style={{ color: tech.color }} />
						</div>
					);
				})}
			</div>
		</div>
	);
}

function TechLogoMarquee() {
	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true }}
			transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
			className="w-full"
		>
			{/* Animated Rows */}
			<div className="space-y-2">
				{rows.map((row, i) => (
					<MarqueeRow key={i} items={row} reverse={i % 2 === 1} />
				))}
			</div>
		</motion.div>
	);
}

export default TechLogoMarquee;
