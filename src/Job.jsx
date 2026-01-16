import { motion } from "framer-motion";
import { FiBriefcase } from "react-icons/fi";

function Job() {
	const container = {
		hidden: {},
		visible: {
			transition: {
				staggerChildren: 0.08,
			},
		},
	};

	const item = {
		hidden: { opacity: 0, y: 12 },
		visible: {
			opacity: 1,
			y: 0,
			transition: { duration: 0.6, ease: "easeOut" },
		},
	};

	const badge = {
		hidden: { opacity: 0, scale: 0.9 },
		visible: {
			opacity: 1,
			scale: 1,
			transition: { duration: 0.3 },
		},
	};

	const bulletItem = {
		hidden: { opacity: 0, x: -12 },
		visible: {
			opacity: 1,
			x: 0,
			transition: { duration: 0.5, ease: "easeOut" },
		},
	};

	return (
		<section id="work" className="min-h-screen">
			<div className="min-h-screen flex items-center justify-center px-6 py-20">
				{/* Glass Card */}
				<motion.div
					initial={{ opacity: 0, y: 60 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.1 }}
					transition={{ duration: 0.8, ease: "easeOut" }}
					className="relative max-w-5xl w-full p-10 rounded-3xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-2xl
				border border-white/50 dark:border-gray-700/50
				shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]"
				>
					<div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-white/40 dark:from-gray-700/40 via-transparent to-white/10 dark:to-gray-800/10" />

					{/* Header */}
					<motion.div
						variants={container}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
					>
						<motion.div
							variants={item}
							className="flex items-center gap-3 mb-5"
						>
							<FiBriefcase className="text-4xl md:text-5xl text-gray-900 dark:text-white" />
							<motion.h2
								initial={{ opacity: 0, y: 20, letterSpacing: "0.2em" }}
								whileInView={{ opacity: 1, y: 0, letterSpacing: "0em" }}
								transition={{ duration: 0.8, ease: "easeOut" }}
								className="text-4xl md:text-4xl font-semibold tracking-tight text-gray-900 dark:text-white"
							>
								Experience & Career
							</motion.h2>
						</motion.div>

						{/* Divider */}
						<motion.div
							variants={item}
							className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent my-8"
						/>

						{/* Professional Readiness */}
						<div className="space-y-6 mb-10">
							<div className="flex items-center gap-3">
								<span className="w-2 h-2 rounded-full bg-gray-900 dark:bg-white" />
								<motion.h3
									variants={item}
									className="text-xl font-semibold text-gray-900 dark:text-white tracking-wide"
								>
									Professional Readiness
								</motion.h3>
							</div>

							<motion.p
								variants={item}
								className="text-gray-600 dark:text-gray-300 text-base leading-7"
							>
								I am currently a{" "}
								<span className="font-semibold text-gray-900 dark:text-white">
									3rd Year college student
								</span>{" "}
								developing production-style applications through hands-on
								projects. I am currently working on{" "}
								<span className="font-semibold text-gray-900 dark:text-white">
									Capstone 1
								</span>
								, where I focus on writing clean code, building scalable
								systems, and following real-world development workflows.
							</motion.p>

							<motion.p
								variants={item}
								className="text-gray-600 dark:text-gray-300 text-base leading-7"
							>
								I am actively seeking an{" "}
								<span className="font-semibold text-gray-900 dark:text-white">
									Internship or OJT
								</span>{" "}
								where I can contribute to real projects, collaborate with a
								team, and continue growing as a developer.
							</motion.p>
						</div>

						{/* Project & Skill Experience */}
						<div className="space-y-6 mb-10">
							<div className="flex items-center gap-3">
								<span className="w-2 h-2 rounded-full bg-gray-900 dark:bg-white" />
								<motion.h3
									variants={item}
									className="text-xl font-semibold text-gray-900 dark:text-white tracking-wide"
								>
									Project & Skill Experience
								</motion.h3>
							</div>

							<motion.ul
								variants={container}
								initial="hidden"
								whileInView="visible"
								viewport={{ once: true }}
								className="space-y-2"
							>
								{[
									"Full-stack system development (frontend & backend)",
									"Database design, CRUD operations, and data validation",
									"Responsive UI/UX with modern design principles",
									"Version control and collaborative workflows",
									"Capstone-level planning, documentation, and presentation",
								].map((item, i) => (
									<motion.li
										key={i}
										variants={bulletItem}
										className="text-gray-600 dark:text-gray-300 text-base leading-7 flex items-start gap-3"
									>
										<span className="text-gray-900 dark:text-white font-semibold mt-0.5">
											•
										</span>
										<span>{item}</span>
									</motion.li>
								))}
							</motion.ul>
						</div>

						{/* What I'm Seeking */}
						<div className="space-y-6">
							<div className="flex items-center gap-3">
								<span className="w-2 h-2 rounded-full bg-gray-900 dark:bg-white" />
								<motion.h3
									variants={item}
									className="text-xl font-semibold text-gray-900 dark:text-white tracking-wide"
								>
									What I'm Seeking
								</motion.h3>
							</div>

							<motion.ul
								variants={container}
								initial="hidden"
								whileInView="visible"
								viewport={{ once: true }}
								className="space-y-2"
							>
								{[
									"A collaborative team environment with mentorship opportunities",
									"Challenging projects that push my technical and creative skills",
									"Exposure to industry best practices and professional workflows",
									"Opportunity to make meaningful contributions to real-world applications",
									"Growth in both technical expertise and professional development",
								].map((item, i) => (
									<motion.li
										key={i}
										variants={bulletItem}
										className="text-gray-600 dark:text-gray-300 text-base leading-7 flex items-start gap-3"
									>
										<span className="text-gray-900 dark:text-white font-semibold mt-0.5">
											•
										</span>
										<span>{item}</span>
									</motion.li>
								))}
							</motion.ul>
						</div>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}

export default Job;
