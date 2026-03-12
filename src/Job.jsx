import { motion } from "framer-motion";
import {
	FiCode,
	FiDatabase,
	FiMonitor,
	FiGitBranch,
	FiClipboard,
	FiCheck,
	FiMail,
} from "react-icons/fi";

/* ─── Animation Variants ─────────────────────────────────── */
const fadeUp = {
	hidden: { opacity: 0, y: 20 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.55, ease: "easeOut" },
	},
};

const stagger = {
	hidden: {},
	visible: { transition: { staggerChildren: 0.07 } },
};

const slideUp = {
	hidden: { opacity: 0, y: 30 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
	},
};

/* ─── Skill Card ─────────────────────────────────────────── */
function SkillCard({ icon: Icon, title }) {
	return (
		<motion.div
			variants={slideUp}
			whileHover={{ y: -4, boxShadow: "0 12px 32px -8px rgba(0,0,0,0.18)" }}
			transition={{ type: "spring", stiffness: 300, damping: 20 }}
			className="flex items-center gap-3 px-4 py-3.5 rounded-2xl
				bg-white/60 dark:bg-gray-900/60
				border border-white/60 dark:border-gray-700/60
				backdrop-blur-sm shadow-sm cursor-default"
		>
			<div className="w-9 h-9 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center shrink-0">
				<Icon className="w-4 h-4 text-white dark:text-gray-900" />
			</div>
			<span className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug">
				{title}
			</span>
		</motion.div>
	);
}

/* ─── Main Component ─────────────────────────────────────── */
function Job() {
	const skills = [
		{ icon: FiCode, title: "Full Stack Development" },
		{ icon: FiDatabase, title: "Database Design & CRUD Operations" },
		{ icon: FiMonitor, title: "Responsive UI/UX Development" },
		{ icon: FiGitBranch, title: "Version Control & Git Workflows" },
		{ icon: FiClipboard, title: "Capstone Project Planning" },
	];

	const goals = [
		"Collaborative team environment with mentorship",
		"Challenging projects that improve technical skills",
		"Exposure to industry best practices",
		"Opportunity to contribute to real-world systems",
		"Continuous learning and professional growth",
	];

	const highlightTags = [
		"3rd Year IT Student",
		"Full Stack Development",
		"Capstone Project",
		"Clean Code",
	];

	const divider = (
		<div className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent my-8" />
	);

	return (
		<section id="work" className="min-h-screen">
			<div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-16">
				<motion.div
					initial={{ opacity: 0, y: 60 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.05 }}
					transition={{ duration: 0.8, ease: "easeOut" }}
					className="relative max-w-5xl w-full rounded-3xl
						bg-white/70 dark:bg-gray-800/70 backdrop-blur-2xl
						border border-white/50 dark:border-gray-700/50
						shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]
						overflow-hidden"
				>
					<div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-white/40 dark:from-gray-700/40 via-transparent to-white/10 dark:to-gray-800/10" />

					<div className="px-7 py-8 sm:px-10 sm:py-10">
						{/* ── Section 1: Experience ── */}
						<motion.div
							variants={stagger}
							initial="hidden"
							whileInView="visible"
							viewport={{ once: true }}
						>
							<motion.div
								variants={fadeUp}
								className="flex items-center gap-2 mb-6"
							>
								<span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-white" />
								<h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide uppercase">
									Experience
								</h2>
							</motion.div>

							<motion.p
								variants={fadeUp}
								className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4 max-w-2xl"
							>
								I am a{" "}
								<span className="font-semibold text-gray-900 dark:text-white">
									3rd Year BS Information Technology
								</span>{" "}
								student currently developing full-stack applications through
								academic and capstone projects.
							</motion.p>
							<motion.p
								variants={fadeUp}
								className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-5 max-w-2xl"
							>
								I focus on writing clean code, building scalable systems, and
								applying modern development practices such as version control,
								modular architecture, and responsive design.
							</motion.p>

							<motion.div
								variants={fadeUp}
								className="flex items-center gap-2 mb-4"
							>
								<span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
									Current Focus:
								</span>
								<span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
									Capstone Project Development
								</span>
							</motion.div>

							<motion.div variants={stagger} className="flex flex-wrap gap-2">
								{highlightTags.map((tag) => (
									<motion.span
										key={tag}
										variants={fadeUp}
										className="px-3 py-1 rounded-full text-xs font-medium
											bg-gray-900 dark:bg-white
											text-white dark:text-gray-900"
									>
										{tag}
									</motion.span>
								))}
							</motion.div>
						</motion.div>

						{divider}

						{/* ── Section 2: Skills Applied ── */}
						<motion.div
							variants={stagger}
							initial="hidden"
							whileInView="visible"
							viewport={{ once: true }}
						>
							<motion.div
								variants={fadeUp}
								className="flex items-center gap-2 mb-6"
							>
								<span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-white" />
								<h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide uppercase">
									Skills Applied
								</h2>
							</motion.div>

							<motion.div
								variants={stagger}
								className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
							>
								{skills.map((skill) => (
									<SkillCard
										key={skill.title}
										icon={skill.icon}
										title={skill.title}
									/>
								))}
							</motion.div>
						</motion.div>

						{divider}

						{/* ── Section 3: Career Goals ── */}
						<motion.div
							variants={stagger}
							initial="hidden"
							whileInView="visible"
							viewport={{ once: true }}
						>
							<motion.div
								variants={fadeUp}
								className="flex items-center gap-2 mb-6"
							>
								<span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-white" />
								<h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide uppercase">
									Career Goals
								</h2>
							</motion.div>

							<motion.div variants={stagger} className="space-y-3">
								{goals.map((goal) => (
									<motion.div
										key={goal}
										variants={fadeUp}
										className="flex items-start gap-3"
									>
										<div className="w-5 h-5 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center shrink-0 mt-0.5">
											<FiCheck className="w-3 h-3 text-white dark:text-gray-900" />
										</div>
										<span className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
											{goal}
										</span>
									</motion.div>
								))}
							</motion.div>
						</motion.div>

						{divider}

						{/* ── Section 4: Internship Availability ── */}
						<motion.div
							initial={{ opacity: 0, y: 24 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true, amount: 0.2 }}
							transition={{ duration: 0.7, ease: "easeOut" }}
						>
							<div className="flex items-center gap-2 mb-6">
								<span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-white" />
								<h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide uppercase">
									Currently Seeking
								</h2>
							</div>

							<div
								className="rounded-2xl p-6
									bg-gray-900 dark:bg-white/10
									border border-gray-700 dark:border-white/10
									backdrop-blur-sm"
							>
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
									<div className="flex-1">
										<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-semibold mb-4">
											<span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
											Available for Internship / OJT
										</div>
										<p className="text-sm text-gray-300 leading-relaxed max-w-lg">
											I am currently seeking an{" "}
											<span className="font-semibold text-white">
												Internship or OJT
											</span>{" "}
											opportunity where I can apply my development skills,
											contribute to real projects, and grow as a software
											developer.
										</p>
									</div>
									<motion.a
										href="mailto:javiermarkjordan@gmail.com"
										whileHover={{ scale: 1.04 }}
										whileTap={{ scale: 0.97 }}
										className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
											bg-white text-gray-900
											text-sm font-semibold shadow-sm shrink-0
											hover:bg-gray-100 transition-colors duration-200"
									>
										<FiMail className="w-4 h-4" />
										Contact Me
									</motion.a>
								</div>
							</div>
						</motion.div>
					</div>
				</motion.div>
			</div>
		</section>
	);
}

export default Job;
