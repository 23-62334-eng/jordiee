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

const techItems = [
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

const containerVariants = {
	hidden: {},
	visible: {
		transition: { staggerChildren: 0.04 },
	},
};

const badgeVariants = {
	hidden: { opacity: 0, scale: 0.8, y: 10 },
	visible: {
		opacity: 1,
		scale: 1,
		y: 0,
		transition: { duration: 0.3, ease: "easeOut" },
	},
};

function TechStack() {
	return (
		<motion.div
			variants={containerVariants}
			initial="hidden"
			whileInView="visible"
			viewport={{ once: true, amount: 0.15 }}
			className="relative rounded-2xl
				bg-gray-100/80 dark:bg-gray-900/80 backdrop-blur-xl
				border border-gray-200/50 dark:border-gray-700/40
				shadow-[0_4px_24px_-6px_rgba(0,0,0,0.15)]
				dark:shadow-[0_4px_24px_-6px_rgba(0,0,0,0.4)]
				overflow-hidden"
		>
			{/* Subtle gradient overlay */}
			<div
				className="absolute inset-0 rounded-2xl pointer-events-none
				bg-gradient-to-br from-white/10 dark:from-gray-700/10 via-transparent to-transparent"
			/>

			<div className="relative p-5">
				{/* Header */}
				<motion.div
					variants={badgeVariants}
					className="flex items-center justify-between mb-4"
				>
					<h3 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
						Tech Stack
					</h3>
					<span
						className="text-xs font-medium text-gray-400 dark:text-gray-500 flex items-center gap-1 cursor-default select-none
						hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
					>
						View All <span aria-hidden="true">→</span>
					</span>
				</motion.div>

				{/* Badges Grid */}
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
					{techItems.map((tech) => {
						const Icon = tech.icon;
						return (
							<motion.div
								key={tech.name}
								variants={badgeVariants}
								whileHover={{ scale: 1.06, y: -2 }}
								whileTap={{ scale: 0.96 }}
								className="group flex items-center gap-2 px-3 py-1.5 rounded-full cursor-default
									bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm
									border border-gray-200/50 dark:border-gray-700/50
									hover:bg-white dark:hover:bg-gray-700/90
									hover:border-gray-300/70 dark:hover:border-gray-600/60
									hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20
									transition-all duration-200 ease-out"
							>
								<Icon
									className="w-3.5 h-3.5 shrink-0 transition-transform duration-200 group-hover:scale-110"
									style={{ color: tech.color }}
								/>
								<span
									className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate
									group-hover:text-gray-900 dark:group-hover:text-white
									transition-colors duration-200"
								>
									{tech.name}
								</span>
							</motion.div>
						);
					})}
				</div>
			</div>
		</motion.div>
	);
}

export default TechStack;
