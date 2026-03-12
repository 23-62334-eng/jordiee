import { motion, useScroll, useTransform } from "framer-motion";
import { FiBookOpen } from "react-icons/fi";
import { useState, useRef } from "react";
import TiltCard from "./components/TiltCard";
import portfolio1 from "./assets/proj/1stPortfolio/portfolio1.png";
import portfolio2 from "./assets/proj/1stPortfolio/portfolio2.png";
import portfolio3 from "./assets/proj/1stPortfolio/portfolio3.png";
import portfolio4 from "./assets/proj/1stPortfolio/portfolio4.png";
import thrift1 from "./assets/proj/thriftStore/img1.png";
import thrift2 from "./assets/proj/thriftStore/img2.png";
import thrift3 from "./assets/proj/thriftStore/img3.png";
import thrift4 from "./assets/proj/thriftStore/img4.png";
import thrift5 from "./assets/proj/thriftStore/img5.png";
import time1 from "./assets/proj/timeSched/TSS1.jpeg";
import time2 from "./assets/proj/timeSched/TSS2.jpeg";
import time3 from "./assets/proj/timeSched/TSS3.jpeg";
import cafe1 from "./assets/proj/batCafe/batCafe1.png";
import cafe2 from "./assets/proj/batCafe/batCafe2.png";
import cafe3 from "./assets/proj/batCafe/batCafe3.png";
import cafe4 from "./assets/proj/batCafe/batCafe4.png";
import cafe5 from "./assets/proj/batCafe/batCafe5.png";
import cafe6 from "./assets/proj/batCafe/batCafe6.png";
import cafe7 from "./assets/proj/batCafe/batCafe7.png";
import cafe8 from "./assets/proj/batCafe/batCafe8.png";
import cafe9 from "./assets/proj/batCafe/batCafe9.png";
import cafe10 from "./assets/proj/batCafe/batCafe10.png";
import rental1 from "./assets/proj/vehiRental/vRental1.png";
import rental2 from "./assets/proj/vehiRental/vRental2.png";
import rental3 from "./assets/proj/vehiRental/vRental3.png";
import rental4 from "./assets/proj/vehiRental/vRental4.png";
import rental5 from "./assets/proj/vehiRental/vRental5.png";
import rental6 from "./assets/proj/vehiRental/vRental6.png";
import rental7 from "./assets/proj/vehiRental/vRental7.png";
import rental8 from "./assets/proj/vehiRental/vRental8.png";
import rental9 from "./assets/proj/vehiRental/vrental9.png";
import rental10 from "./assets/proj/vehiRental/vRental10.png";

/* ─── Image Carousel ─────────────────────────────────────── */
const ImageCarousel = ({ images, title, dateBadge }) => {
	const [currentIndex, setCurrentIndex] = useState(0);
	const stackSize = Math.min(images.length, 4);

	const handleClick = () => {
		setCurrentIndex((prev) => (prev + 1) % images.length);
	};

	return (
		<div className="relative w-full">
			{dateBadge && (
				<div className="absolute -top-3 left-3 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-white text-[10px] font-semibold z-30">
					{dateBadge}
				</div>
			)}
			<div
				className="relative cursor-pointer group"
				style={{ paddingBottom: "68%" }}
				onClick={handleClick}
			>
				{Array.from({ length: stackSize }, (_, stackIdx) => {
					const depth = stackSize - 1 - stackIdx;
					const imgIndex = (currentIndex + depth) % images.length;
					const isFront = depth === 0;
					const rotations = [0, -3.5, 4, -2];
					const xOffsets = [0, -8, 12, -4];
					const yOffsets = [0, -6, -10, -14];

					return (
						<motion.div
							key={`stack-${stackIdx}`}
							initial={false}
							animate={{
								rotate: rotations[depth] || 0,
								x: xOffsets[depth] || 0,
								y: yOffsets[depth] || 0,
								scale: 1 - depth * 0.03,
								opacity: 1 - depth * 0.15,
							}}
							transition={{ type: "spring", stiffness: 300, damping: 25 }}
							className="absolute inset-0"
							style={{ zIndex: stackIdx }}
						>
							<TiltCard
								className="w-full h-full rounded-xl overflow-hidden shadow-md border border-gray-200 dark:border-gray-700/50"
								borderRadius="rounded-xl"
								tiltDegree={isFront ? 8 : 3}
								scale={isFront ? 1.02 : 1}
								glareOpacity={isFront ? 0.15 : 0.04}
							>
								<div className="relative w-full h-full">
									<motion.img
										key={imgIndex}
										initial={{ opacity: 0.7 }}
										animate={{ opacity: 1 }}
										transition={{ duration: 0.35 }}
										src={images[imgIndex]}
										alt={`${title} - ${imgIndex + 1}`}
										loading="lazy"
										className={`w-full h-full object-cover ${isFront ? "group-hover:scale-105 transition-transform duration-700 ease-out" : ""}`}
									/>
									{isFront && (
										<>
											<div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
											<div className="absolute bottom-2 right-2 px-2.5 py-0.5 rounded-full bg-black/35 backdrop-blur-md text-white text-[10px] font-medium">
												{(currentIndex % images.length) + 1} / {images.length}
											</div>
											<div className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-full bg-black/35 backdrop-blur-md text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
												Click to browse
											</div>
										</>
									)}
									<div className="absolute inset-0 rounded-xl ring-1 ring-white/20 pointer-events-none" />
								</div>
							</TiltCard>
						</motion.div>
					);
				})}
			</div>
		</div>
	);
};

/* ─── Skill Badge ─────────────────────────────────────────── */
function SkillBadge({ skill }) {
	const [hovered, setHovered] = useState(false);
	return (
		<span
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			style={{
				transition: "transform 0.22s ease, box-shadow 0.3s ease",
				transform: hovered
					? "scale(1.06) translateY(-2px)"
					: "scale(1) translateY(0)",
				boxShadow: hovered ? "0 0 18px 4px rgba(99,102,241,0.28)" : "none",
			}}
			className="px-4 py-1.5 rounded-full text-sm font-medium cursor-default
				bg-gray-100 dark:bg-gray-800
				border border-gray-200 dark:border-gray-700
				text-gray-700 dark:text-gray-300"
		>
			{skill}
		</span>
	);
}

/* ─── Project Card ────────────────────────────────────────── */
function ProjectCard({
	id,
	title,
	description,
	tags,
	images,
	date,
	slideFrom,
}) {
	return (
		<motion.div
			id={id}
			initial={{
				opacity: 0,
				x: slideFrom === "left" ? -45 : 45,
				filter: "blur(4px)",
			}}
			whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
			viewport={{ once: true, amount: 0.12 }}
			transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
			className="rounded-2xl overflow-hidden
				bg-white dark:bg-gray-900/60
				border border-gray-200 dark:border-gray-700/60
				shadow-sm hover:shadow-xl
				hover:-translate-y-1.5
				transition-all duration-300 group"
		>
			<div className="relative p-3 pb-0">
				<ImageCarousel images={images} title={title} />
				{date && (
					<span className="absolute top-5 left-5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-white text-[10px] font-semibold tracking-wide z-20">
						{date}
					</span>
				)}
			</div>
			<div className="p-4 pt-3">
				<h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
					{title}
				</h4>
				<p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
					{description}
				</p>
				<div className="flex flex-wrap gap-1.5">
					{tags.map((tag) => (
						<span
							key={tag}
							className="px-2.5 py-0.5 rounded-full text-[10px] font-medium
								bg-gray-100 dark:bg-gray-800
								border border-gray-200 dark:border-gray-700
								text-gray-600 dark:text-gray-400"
						>
							{tag}
						</span>
					))}
				</div>
			</div>
		</motion.div>
	);
}

/* ─── Main Component ──────────────────────────────────────── */
function Projects() {
	const timelineRef = useRef(null);

	const { scrollYProgress } = useScroll({
		target: timelineRef,
		offset: ["start center", "end center"],
	});
	const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

	const stagger = {
		hidden: {},
		visible: { transition: { staggerChildren: 0.07 } },
	};
	const fadeUp = {
		hidden: { opacity: 0, y: 16 },
		visible: {
			opacity: 1,
			y: 0,
			transition: { duration: 0.55, ease: "easeOut" },
		},
	};

	const projects = [
		{
			id: "project-time-scheduling",
			title: "Time Scheduling System",
			date: "2nd Yr · 1st Sem 2024",
			description:
				"A scheduling management system built with Java (OOP) and MySQL to efficiently manage schedules and streamline time-based operations.",
			tags: ["Java", "MySQL", "OOP"],
			images: [time1, time2, time3],
			slideFrom: "left",
		},
		{
			id: "project-thrift-shop",
			title: "Online Thrift Shop",
			date: "2nd Yr · 2nd Sem 2025",
			description:
				"A web-based e-commerce platform with HTML, Tailwind CSS, and MySQL, featuring product browsing and inventory management.",
			tags: ["HTML", "CSS", "Tailwind CSS", "MySQL"],
			images: [thrift1, thrift2, thrift3, thrift4, thrift5],
			slideFrom: "right",
		},
		{
			title: "Portfolio Website",
			date: "Vacation 2025",
			description:
				"A fully responsive personal portfolio built with HTML, CSS, and Tailwind CSS showcasing projects through a clean interface.",
			tags: ["HTML", "CSS", "Tailwind CSS"],
			images: [portfolio1, portfolio2, portfolio3, portfolio4],
			slideFrom: "left",
		},
		{
			id: "project-bat-cafe",
			title: "Malvar Bat Cave Café",
			date: "3rd Yr · 1st Sem 2025",
			description:
				"A café management system with PHP and XAMPP featuring CRUD operations, an integrated chatbot, and dark mode.",
			tags: ["PHP", "XAMPP", "MySQL", "CRUD"],
			images: [
				cafe1,
				cafe2,
				cafe3,
				cafe4,
				cafe5,
				cafe6,
				cafe7,
				cafe8,
				cafe9,
				cafe10,
			],
			slideFrom: "right",
		},
		{
			id: "project-vehicle-rental",
			title: "Vehicle Rental System",
			date: "3rd Yr · 1st Sem 2025",
			description:
				"A PHP-based vehicle rental system with CRUD operations and XML data handling, enhanced with a chatbot for booking guidance.",
			tags: ["PHP", "CRUD", "XML"],
			images: [
				rental1,
				rental2,
				rental3,
				rental4,
				rental5,
				rental6,
				rental7,
				rental8,
				rental9,
				rental10,
			],
			slideFrom: "left",
		},
	];

	const timelineItems = [
		{
			date: "2nd Year · 1st Semester 2024",
			title: "Time Scheduling System",
			desc: "Built a scheduling management system using Java OOP and MySQL.",
			side: "left",
		},
		{
			date: "2nd Year · 2nd Semester 2025",
			title: "Online Thrift Shop",
			desc: "Developed a web-based e-commerce platform with HTML, Tailwind CSS, and MySQL.",
			side: "right",
		},
		{
			date: "Vacation 2025",
			title: "Portfolio Website",
			desc: "Created a personal portfolio site with HTML, CSS, and Tailwind CSS.",
			side: "left",
		},
		{
			date: "3rd Year · 1st Semester 2025",
			title: "Malvar Bat Cave Café",
			desc: "Built a café management system with PHP and XAMPP featuring CRUD operations, an integrated chatbot, and dark mode.",
			side: "right",
		},
		{
			date: "3rd Year · 1st Semester 2025",
			title: "Vehicle Rental System",
			desc: "Developed a PHP-based vehicle rental system with CRUD operations and XML data handling, enhanced with a chatbot for booking guidance.",
			side: "left",
		},
	];

	return (
		<section id="education" className="min-h-screen relative z-0">
			<div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-16">
				<motion.div
					initial={{ opacity: 0, y: 60 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.05 }}
					transition={{ duration: 0.8, ease: "easeOut" }}
					className="relative max-w-5xl w-full rounded-3xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-2xl
						border border-white/50 dark:border-gray-700/50
						shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)]
						overflow-hidden"
				>
					<div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-white/40 dark:from-gray-700/40 via-transparent to-white/10 dark:to-gray-800/10" />

					{/* ── Section 1: Education ── */}
					<motion.div
						variants={stagger}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
						className="px-7 py-7 sm:px-9 sm:py-8 border-b border-gray-200/40 dark:border-gray-700/40"
					>
						<motion.div
							variants={fadeUp}
							className="flex items-center gap-2 mb-6"
						>
							<span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-white" />
							<h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide uppercase">
								Education
							</h2>
						</motion.div>

						<div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
							{/* Degree info */}
							<motion.div variants={fadeUp} className="flex-1">
								<div className="flex items-start gap-4">
									<div className="w-10 h-10 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center shrink-0 mt-0.5">
										<FiBookOpen className="w-5 h-5 text-white dark:text-gray-900" />
									</div>
									<div>
										<h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug">
											Bachelor of Science in Information Technology
										</h3>
										<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
											Batangas State University · 2023 – Present
										</p>
										<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mt-3 max-w-lg">
											Currently studying software development, database systems,
											and modern web technologies — building real-world
											full-stack applications across multiple academic projects.
										</p>
									</div>
								</div>
							</motion.div>

							{/* Focus Areas */}
							<motion.div variants={fadeUp} className="lg:w-60 shrink-0">
								<p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
									Focus Areas
								</p>
								<ul className="space-y-2">
									{[
										"Software Development",
										"Database Management",
										"Web Application Development",
										"System Analysis & Design",
									].map((area) => (
										<li
											key={area}
											className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
										>
											<span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 shrink-0" />
											{area}
										</li>
									))}
								</ul>
							</motion.div>
						</div>
					</motion.div>

					{/* ── Section 2: Key Skills ── */}
					<motion.div
						variants={stagger}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
						className="px-7 py-6 sm:px-9 sm:py-7 border-b border-gray-200/40 dark:border-gray-700/40"
					>
						<motion.div
							variants={fadeUp}
							className="flex items-center gap-2 mb-4"
						>
							<span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-white" />
							<h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide">
								Key Skills Learned
							</h3>
						</motion.div>
						<motion.div variants={fadeUp} className="flex flex-wrap gap-2">
							{[
								"Object-Oriented Programming",
								"Database Design",
								"Full Stack Development",
								"System Analysis",
								"UI/UX Implementation",
							].map((skill) => (
								<SkillBadge key={skill} skill={skill} />
							))}
						</motion.div>
					</motion.div>

					{/* ── Section 3: Academic Projects ── */}
					<div className="px-7 py-6 sm:px-9 sm:py-7 border-b border-gray-200/40 dark:border-gray-700/40">
						<motion.div
							initial={{ opacity: 0, y: 14 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5 }}
							className="flex items-center gap-2 mb-6"
						>
							<span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-white" />
							<h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide">
								Academic Projects
							</h3>
						</motion.div>

						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
							{projects.map((proj) => (
								<ProjectCard key={proj.title} {...proj} />
							))}
						</div>
					</div>

					{/* ── Section 4: Learning Timeline ── */}
					<div className="px-7 py-6 sm:px-9 sm:py-7" ref={timelineRef}>
						<motion.div
							initial={{ opacity: 0, y: 14 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5 }}
							className="flex items-center gap-2 mb-8"
						>
							<span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-white" />
							<h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide">
								Learning Timeline
							</h3>
						</motion.div>

						<div className="relative">
							{/* Base vertical line */}
							<div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-gray-200 dark:bg-gray-700" />
							{/* Animated progress fill */}
							<motion.div
								style={{ scaleY, originY: 0 }}
								className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-gray-500 dark:bg-gray-400"
							/>

							<div className="space-y-10 pb-2">
								{timelineItems.map((item, i) => (
									<motion.div
										key={i}
										initial={{
											opacity: 0,
											x: item.side === "left" ? -28 : 28,
										}}
										whileInView={{ opacity: 1, x: 0 }}
										viewport={{ once: true, amount: 0.3 }}
										transition={{ duration: 0.55, ease: "easeOut" }}
										className={`relative flex items-start gap-4 ${item.side === "right" ? "flex-row-reverse" : ""}`}
									>
										{/* Dot */}
										<div className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-gray-400 dark:bg-gray-500 border-2 border-white dark:border-gray-800 z-10 mt-1.5" />

										{/* Content */}
										<div
											className={`w-[calc(50%-18px)] ${item.side === "right" ? "text-right" : ""}`}
										>
											<span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
												{item.date}
											</span>
											<h4 className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5 mb-1">
												{item.title}
											</h4>
											<p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
												{item.desc}
											</p>
										</div>

										{/* Spacer */}
										<div className="w-[calc(50%-18px)]" />
									</motion.div>
								))}
							</div>
						</div>
					</div>
				</motion.div>
			</div>
		</section>
	);
}

export default Projects;
