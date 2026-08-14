import { motion } from "framer-motion";
import {
	SiTypescript,
	SiJavascript,
	SiPython,
	SiPhp,
	SiSharp,
	SiReact,
	SiFlutter,
	SiNextdotjs,
	SiTailwindcss,
	SiNodedotjs,
	SiExpress,
	SiPrisma,
	SiPostgresql,
	SiMysql,
	SiMongodb,
	SiSupabase,
	SiTensorflow,
	SiN8N,
	SiDocker,
	SiXampp,
	SiFigma,
	SiPrettier,
	SiGit,
	SiGithub,
	SiPostman,
	SiIntellijidea,
	SiPycharm,
	SiApachenetbeanside,
	SiXcode,
} from "react-icons/si";
import { FaJava } from "react-icons/fa";
import { TbBrandReactNative, TbChartBar, TbCursorText } from "react-icons/tb";
import { VscCode } from "react-icons/vsc";

const techLogos = [
	{ name: "TypeScript", icon: SiTypescript, color: "#3178C6" },
	{ name: "JavaScript", icon: SiJavascript, color: "#F7DF1E" },
	{ name: "Python", icon: SiPython, color: "#3776AB" },
	{ name: "PHP", icon: SiPhp, color: "#777BB4" },
	{ name: "Java", icon: FaJava, color: "#ED8B00" },
	{ name: "C#", icon: SiSharp, color: "#8B5CF6" },
	{ name: "React", icon: SiReact, color: "#61DAFB" },
	{ name: "Next.js", icon: SiNextdotjs, color: "#E6EDF3" },
	{ name: "React Native", icon: TbBrandReactNative, color: "#61DAFB" },
	{ name: "Flutter", icon: SiFlutter, color: "#02569B" },
	{ name: "Tailwind CSS", icon: SiTailwindcss, color: "#06B6D4" },
	{ name: "Node.js", icon: SiNodedotjs, color: "#339933" },
	{ name: "Express.js", icon: SiExpress, color: "#E6EDF3" },
	{ name: "Prisma", icon: SiPrisma, color: "#5A67D8" },
	{ name: "PostgreSQL", icon: SiPostgresql, color: "#4169E1" },
	{ name: "MySQL", icon: SiMysql, color: "#4479A1" },
	{ name: "MongoDB", icon: SiMongodb, color: "#13AA52" },
	{ name: "Supabase", icon: SiSupabase, color: "#3ECF8E" },
	{ name: "TensorFlow Lite", icon: SiTensorflow, color: "#FF6F00" },
	{ name: "n8n", icon: SiN8N, color: "#EA4B71" },
	{ name: "Docker", icon: SiDocker, color: "#2496ED" },
	{ name: "XAMPP", icon: SiXampp, color: "#FB7A24" },
	{ name: "Figma", icon: SiFigma, color: "#F24E1E" },
	{ name: "Prettier", icon: SiPrettier, color: "#F7B93E" },
	{ name: "Git", icon: SiGit, color: "#F05032" },
	{ name: "GitHub", icon: SiGithub, color: "#E6EDF3" },
	{ name: "Postman", icon: SiPostman, color: "#FF6C37" },
	{ name: "Power BI", icon: TbChartBar, color: "#F2C811" },
	{ name: "VS Code", icon: VscCode, color: "#007ACC" },
	{ name: "Cursor", icon: TbCursorText, color: "#A0A0A0" },
	{ name: "IntelliJ IDEA", icon: SiIntellijidea, color: "#FE315D" },
	{ name: "PyCharm", icon: SiPycharm, color: "#21D789" },
	{ name: "NetBeans", icon: SiApachenetbeanside, color: "#1B6AC6" },
	{ name: "Xcode", icon: SiXcode, color: "#147EFB" },
];

// Split logos into 3 rows
// Derived from the list length rather than fixed bounds: the previous
// slice(22, 33) silently dropped anything added past the 33rd logo.
const ROW_COUNT = 3;
const PER_ROW = Math.ceil(techLogos.length / ROW_COUNT);

const rows = Array.from({ length: ROW_COUNT }, (_, row) =>
	techLogos.slice(row * PER_ROW, (row + 1) * PER_ROW)
);

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
							// Brand colour rides in as a custom property so the hover
							// state stays pure CSS — an inline style cannot express :hover.
							style={{ "--brand": tech.color }}
							className="group/logo flex items-center justify-center w-10 h-10 rounded-xl
								bg-gray-100/80 dark:bg-gray-800/60
								border border-gray-200/40 dark:border-gray-700/40
								hover:scale-110 hover:shadow-lg hover:shadow-current/10
								hover:border-gray-300 dark:hover:border-gray-500
								cursor-default transition-all duration-200"
						>
							<Icon
								className="w-5 h-5 text-gray-700 dark:text-gray-200
									group-hover/logo:text-[var(--brand)]
									transition-colors duration-200"
							/>
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
