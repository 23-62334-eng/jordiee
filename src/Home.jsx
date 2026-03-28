import {
	FaGithub,
	FaLinkedin,
	FaFacebook,
	FaEnvelope,
	FaMapMarkerAlt,
	FaCertificate,
	FaReact,
	FaPhp,
	FaJava,
	FaPython,
	FaDocker,
	FaFigma,
} from "react-icons/fa";
import { SiTailwindcss, SiMysql, SiJavascript, SiN8N } from "react-icons/si";
import { motion } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import resumePdf from "./assets/resume/RESUME.pdf";
import cvPDF from "./assets/cv/markjordanjavier_cv.pdf";
import me from "./assets/me/jordie.jpg";
import AsciiPortrait from "./components/AsciiPortrait";
import TiltCard from "./components/TiltCard";

// Project thumbnail images
import projTimeSched from "./assets/proj/timeSched/TSS1.jpeg";
import projThrift from "./assets/proj/thriftStore/img1.png";
import projBatCafe from "./assets/proj/batCafe/batCafe1.png";
import projVehiRental from "./assets/proj/vehiRental/vRental1.png";

// Orbiting tech stack icons around the portrait
const orbitIcons = [
	{ icon: FaReact, label: "React", color: "#61DAFB", angle: 0 },
	{ icon: SiJavascript, label: "JavaScript", color: "#F7DF1E", angle: 40 },
	{ icon: SiTailwindcss, label: "Tailwind", color: "#06B6D4", angle: 80 },
	{ icon: FaPhp, label: "PHP", color: "#777BB4", angle: 120 },
	{ icon: SiMysql, label: "MySQL", color: "#4479A1", angle: 160 },
	{ icon: FaPython, label: "Python", color: "#3776AB", angle: 200 },
	{ icon: FaJava, label: "Java", color: "#ED8B00", angle: 240 },
	{ icon: SiN8N, label: "n8n", color: "#EA4B71", angle: 280 },
	{ icon: FaFigma, label: "Figma", color: "#F24E1E", angle: 320 },
];

// JS-driven orbiting icons with front/back depth (z-index swap)
function OrbitingIcons({ icons, radiusX, radiusY, duration, tileClass }) {
	const iconsRef = useRef([]);
	const startRef = useRef(null);

	const animate = useCallback(
		(now) => {
			if (!startRef.current) startRef.current = now;
			const elapsed = now - startRef.current;
			const speed = (2 * Math.PI) / (duration * 1000);

			icons.forEach((item, i) => {
				const el = iconsRef.current[i];
				if (!el) return;

				const baseAngle = (item.angle * Math.PI) / 180;
				const currentAngle = baseAngle + elapsed * speed;

				const x = Math.cos(currentAngle) * radiusX;
				const y = Math.sin(currentAngle) * radiusY;

				// sin > 0 (bottom half) = front of portrait, sin < 0 (top half) = behind
				const sinVal = Math.sin(currentAngle);
				const isFront = sinVal > 0;

				// Depth cues: back icons shrink + fade for 3D illusion
				const depthFactor = (sinVal + 1) / 2; // 0 = full back, 1 = full front
				const scale = 0.65 + 0.35 * depthFactor;
				const opacity = 0.35 + 0.65 * depthFactor;

				el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})`;
				el.style.opacity = opacity;
				el.style.zIndex = isFront ? "30" : "1";
			});

			requestAnimationFrame(animate);
		},
		[icons, radiusX, radiusY, duration],
	);

	useEffect(() => {
		const id = requestAnimationFrame(animate);
		return () => cancelAnimationFrame(id);
	}, [animate]);

	return (
		<>
			{icons.map((item, i) => (
				<div
					key={item.label}
					ref={(el) => (iconsRef.current[i] = el)}
					className="absolute pointer-events-auto"
					style={{
						left: "50%",
						top: "50%",
						willChange: "transform, opacity",
					}}
					title={item.label}
				>
					<div className={tileClass}>
						<item.icon style={{ color: item.color }} />
					</div>
				</div>
			))}
		</>
	);
}

// Hook to get responsive screen tier
function useScreenTier() {
	const [tier, setTier] = useState("sm");
	useEffect(() => {
		const update = () => {
			const w = window.innerWidth;
			if (w >= 1280) setTier("xl");
			else if (w >= 1024) setTier("lg");
			else if (w >= 768) setTier("md");
			else if (w >= 640) setTier("sm");
			else setTier("xs");
		};
		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);
	return tier;
}

function Home() {
	const titles = ["Full Stack Web Developer", "Aspiring Software Engineer"];
	const [displayedText, setDisplayedText] = useState("");
	const screenTier = useScreenTier();

	useEffect(() => {
		let titleIndex = 0;
		let charIndex = 0;
		let isDeleting = false;
		let timeout;

		const tick = () => {
			const current = titles[titleIndex];

			if (!isDeleting) {
				charIndex++;
				setDisplayedText(current.slice(0, charIndex));

				if (charIndex === current.length) {
					// Finished typing — pause then start deleting
					timeout = setTimeout(() => {
						isDeleting = true;
						tick();
					}, 1000);
					return;
				}
				timeout = setTimeout(tick, 85);
			} else {
				charIndex--;
				setDisplayedText(current.slice(0, charIndex));

				if (charIndex === 0) {
					// Finished deleting — move to next title
					isDeleting = false;
					titleIndex = (titleIndex + 1) % titles.length;
					timeout = setTimeout(tick, 300);
					return;
				}
				timeout = setTimeout(tick, 40);
			}
		};

		tick();
		return () => clearTimeout(timeout);
	}, []);

	// Floating animation for side panels
	const floatPanel = {
		animate: {
			y: [0, -8, 0],
			transition: {
				duration: 4,
				repeat: Infinity,
				ease: "easeInOut",
			},
		},
	};

	const floatPanelRight = {
		animate: {
			y: [0, -8, 0],
			transition: {
				duration: 4,
				repeat: Infinity,
				ease: "easeInOut",
				delay: 1.5,
			},
		},
	};

	return (
		<section
			id="home"
			className="
				min-h-[100svh]
				flex
				items-center
				justify-center
				pb-32
			"
		>
			<div className="min-h-screen flex items-center justify-center px-3 sm:px-4 md:px-6">
				<style>{`
				.typing-cursor {
					animation: blink 1s ease-in-out infinite;
				}
				@keyframes blink {
					0%, 40% { opacity: 1; }
					50%, 90% { opacity: 0; }
					100% { opacity: 1; }
				}
			`}</style>

				{/* ===== MOBILE / TABLET LAYOUT ===== */}
				<div className="lg:hidden max-w-lg w-full flex flex-col items-center gap-20 sm:gap-12">
					{/* Portrait with floating icons */}
					<div className="relative mt-4 sm:mt-4">
						<div className="relative z-10">
							<TiltCard
								className="relative overflow-hidden"
								borderRadiusStyle="50%"
								style={{ borderRadius: "50%" }}
								tiltDegree={8}
								scale={1.05}
								glareOpacity={0.15}
							>
								<AsciiPortrait className="w-48 h-72 sm:w-64 sm:h-96 md:w-72 md:h-[28rem]" />
							</TiltCard>
						</div>

						{/* Orbiting tech icons - mobile/tablet (behind & in front) */}
						<OrbitingIcons
							icons={orbitIcons}
							radiusX={
								screenTier === "xs" ? 100 : screenTier === "sm" ? 120 : 150
							}
							radiusY={
								screenTier === "xs" ? 160 : screenTier === "sm" ? 185 : 220
							}
							duration={22}
							tileClass={`${screenTier === "xs" ? "w-10 h-10 text-lg" : "w-12 h-12 sm:w-14 sm:h-14 text-xl sm:text-2xl"} rounded-xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-white/50 dark:border-gray-600/50 shadow-lg flex items-center justify-center cursor-default`}
						/>
					</div>

					{/* Info card below portrait - glassmorphic, left-aligned */}
					<motion.div
						initial={{ opacity: 0, y: 30 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.3 }}
						className="w-full"
					>
						<TiltCard
							className="p-5 sm:p-6 md:p-8 rounded-2xl bg-white/70 dark:bg-gray-800/60 backdrop-blur-xl border border-white/40 dark:border-gray-700/40"
							borderRadius="rounded-2xl"
							tiltDegree={4}
							scale={1.01}
							glareOpacity={0.1}
						>
							<div className="flex flex-col gap-3 sm:gap-4">
								{/* Name badge + verified */}
								<div className="flex items-center gap-3 flex-wrap">
									<motion.span
										className="px-4 py-1.5 text-base sm:text-lg font-bold rounded-full bg-gray-200/80 dark:bg-gray-700/80 text-gray-700 dark:text-gray-200 cursor-default"
										whileHover={{ scale: 1.05, y: -2 }}
										transition={{ type: "spring", stiffness: 300, damping: 20 }}
									>
										Mark Jordan Javier
									</motion.span>
									<motion.div
										className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 relative cursor-pointer"
										title="Certified Developer"
										whileHover={{ scale: 1.2, rotate: 10 }}
										transition={{ type: "spring", stiffness: 400, damping: 15 }}
									>
										<svg
											fill="#009dff"
											viewBox="-960 -960 3840 3840"
											xmlns="http://www.w3.org/2000/svg"
											className="w-10 h-10"
										>
											<path
												d="M960 15 693.227 257.027 333.44 243.053 284.693 599.96 0 820.547l192 304.64-76.267 352 342.934 109.973 167.893 318.613L960 1769.56l333.44 136.213 167.893-318.613 342.934-109.973-76.267-352 192-304.64-284.693-220.587-48.747-356.907-359.893 13.974L960 15Zm352.747 616.427 147.84 153.813-600 577.28-402.774-402.773L608.64 808.92l254.933 254.827 449.174-432.32Z"
												fillRule="evenodd"
											/>
										</svg>
										<span className="absolute inset-0 rounded-full bg-blue-300 dark:bg-blue-500 opacity-30 dark:opacity-20 animate-ping"></span>
									</motion.div>
								</div>

								{/* Location */}
								<div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm sm:text-base">
									<FaMapMarkerAlt />
									<span>Batangas, Philippines</span>
								</div>

								{/* Title */}
								<h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight tracking-tight">
									{displayedText}
									<span className="typing-cursor">|</span>
								</h1>

								{/* Bio */}
								<p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base leading-relaxed">
									A BS Information Technology student from Batangas State
									University - TNEU. Passionate about building modern web
									applications.
								</p>

								{/* Resume button */}
								<div>
									<motion.a
										href={cvPDF}
										download="markjordanjavier-CV.pdf"
										className="group relative inline-flex items-center gap-2 font-semibold py-2 sm:py-2.5 px-5 sm:px-6 rounded-full text-gray-600 dark:text-gray-200 text-sm sm:text-base bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 shadow-lg dark:shadow-gray-900/50 overflow-hidden"
										whileHover={{ y: -4, scale: 1.02 }}
										whileTap={{ scale: 0.98 }}
										transition={{ type: "spring", stiffness: 400, damping: 20 }}
									>
										<span className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-400/20 dark:from-blue-500/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out"></span>
										<span className="relative flex items-center gap-2">
											<span className="text-base sm:text-lg">📄</span>
											<span>Download CV</span>
										</span>
									</motion.a>
								</div>

								{/* Social icons */}
								<div className="flex items-center gap-4 sm:gap-5 text-2xl sm:text-3xl">
									<motion.a
										href="https://www.facebook.com/markjordan.javier"
										target="_blank"
										className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
										whileHover={{ scale: 1.2, y: -3 }}
										transition={{ type: "spring", stiffness: 400, damping: 15 }}
									>
										<FaFacebook />
									</motion.a>
									<motion.a
										href="https://github.com/Jordieeeee"
										target="_blank"
										className="text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
										whileHover={{ scale: 1.2, y: -3 }}
										transition={{ type: "spring", stiffness: 400, damping: 15 }}
									>
										<FaGithub />
									</motion.a>
									<motion.a
										href="https://www.linkedin.com/in/mark-jordan-javier-29b72935a/"
										target="_blank"
										className="text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-blue-400"
										whileHover={{ scale: 1.2, y: -3 }}
										transition={{ type: "spring", stiffness: 400, damping: 15 }}
									>
										<FaLinkedin />
									</motion.a>
									<motion.a
										href="mailto:javiermarkjordan@email.com"
										className="text-gray-700 dark:text-gray-200 hover:text-red-500 dark:hover:text-red-400"
										whileHover={{ scale: 1.2, y: -3 }}
										transition={{ type: "spring", stiffness: 400, damping: 15 }}
									>
										<FaEnvelope />
									</motion.a>
								</div>
							</div>
						</TiltCard>
					</motion.div>
				</div>

				{/* ===== DESKTOP - HERO LAYOUT ===== */}
				<div className="hidden lg:grid max-w-7xl w-full grid-cols-[1fr_auto_1fr] gap-10 xl:gap-20 2xl:gap-28 items-center min-h-[85vh]">
					{/* LEFT - Name + Title + Info */}
					<motion.div
						initial={{ opacity: 0, x: -50 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.7, ease: "easeOut" }}
					>
						<motion.div variants={floatPanel} animate="animate">
							<div className="flex items-center gap-3 mb-5 flex-wrap">
								<motion.span
									className="px-4 py-1.5 text-lg font-semibold rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md text-gray-700 dark:text-gray-200 border border-white/50 dark:border-gray-700/50 shadow-md cursor-default"
									whileHover={{ scale: 1.05, y: -2 }}
									transition={{ type: "spring", stiffness: 300, damping: 20 }}
								>
									Mark Jordan Javier
								</motion.span>
								<motion.div
									className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 relative cursor-pointer"
									title="Certified Developer"
									whileHover={{ scale: 1.2, rotate: 10 }}
									transition={{ type: "spring", stiffness: 400, damping: 15 }}
								>
									<svg
										fill="#009dff"
										viewBox="-960 -960 3840 3840"
										xmlns="http://www.w3.org/2000/svg"
										className="w-10 h-10"
									>
										<path
											d="M960 15 693.227 257.027 333.44 243.053 284.693 599.96 0 820.547l192 304.64-76.267 352 342.934 109.973 167.893 318.613L960 1769.56l333.44 136.213 167.893-318.613 342.934-109.973-76.267-352 192-304.64-284.693-220.587-48.747-356.907-359.893 13.974L960 15Zm352.747 616.427 147.84 153.813-600 577.28-402.774-402.773L608.64 808.92l254.933 254.827 449.174-432.32Z"
											fillRule="evenodd"
										/>
									</svg>
									<span className="absolute inset-0 rounded-full bg-blue-300 dark:bg-blue-500 opacity-30 dark:opacity-20 animate-ping"></span>
								</motion.div>
							</div>

							<div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-4 text-base">
								<FaMapMarkerAlt />
								<span>Batangas, Philippines</span>
							</div>

							<h1 className="text-3xl xl:text-5xl 2xl:text-6xl font-extrabold text-gray-900 dark:text-white leading-[0.95] tracking-tight">
								{displayedText}
								<span className="typing-cursor">|</span>
							</h1>

							{/* Info moved here - below title */}
							<p className="mt-5 text-gray-600 dark:text-gray-300 text-sm xl:text-base 2xl:text-lg leading-relaxed max-w-md">
								A BS Information Technology student from Batangas State
								University - TNEU. Passionate about building modern web
								applications.
							</p>
						</motion.div>
					</motion.div>

					{/* CENTER - Portrait with orbiting tech icons */}
					<motion.div
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
						className="relative flex justify-center"
					>
						{/* Glow effect behind portrait */}
						<div className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2 w-[500px] h-[120px] bg-blue-400/15 dark:bg-blue-500/10 rounded-full blur-[80px] z-0 pointer-events-none" />

						<div className="relative z-10">
							<TiltCard
								className="relative overflow-hidden"
								borderRadiusStyle="50%"
								style={{ borderRadius: "50%" }}
								tiltDegree={8}
								scale={1.05}
								glareOpacity={0.15}
							>
								<AsciiPortrait className="w-64 h-[28rem] xl:w-80 xl:h-[36rem] 2xl:w-96 2xl:h-[40rem]" />
							</TiltCard>
						</div>

						{/* Orbiting tech stack icons (behind & in front of portrait) */}
						<OrbitingIcons
							icons={orbitIcons}
							radiusX={
								screenTier === "lg" ? 170 : screenTier === "xl" ? 200 : 230
							}
							radiusY={screenTier === "lg" ? 100 : 120}
							duration={25}
							tileClass={`${screenTier === "lg" ? "w-12 h-12 text-2xl rounded-xl" : "w-14 h-14 xl:w-16 xl:h-16 text-2xl xl:text-3xl rounded-2xl"} bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-white/50 dark:border-gray-600/50 shadow-lg dark:shadow-gray-900/40 flex items-center justify-center cursor-default`}
						/>
					</motion.div>

					{/* RIGHT - Stacked layered project notification cards */}
					<motion.div
						initial={{ opacity: 0, x: 50 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.7, ease: "easeOut", delay: 0.4 }}
						className="relative flex flex-col items-start justify-start gap-5"
					>
						<div className="relative w-full" style={{ height: 240 }}>
							{[
								{
									title: "Time Scheduling System",
									desc: "A Java + MySQL OOP system for efficient schedule management and data operations.",
									img: projTimeSched,
									time: "2nd Year",
									scrollId: "project-time-scheduling",
								},
								{
									title: "Online Thrift Shop",
									desc: "Full-stack e-commerce platform for thrift items with user auth and cart system.",
									img: projThrift,
									time: "2nd Year",
									scrollId: "project-thrift-shop",
								},
								{
									title: "Vehicle Rental System",
									desc: "Rental management app with booking, availability tracking, and admin dashboard.",
									img: projVehiRental,
									time: "3rd Year",
									scrollId: "project-vehicle-rental",
								},
								{
									title: "Malvar Bat Cave Café",
									desc: "Business website with online ordering, menu management, and modern UI.",
									img: projBatCafe,
									time: "3rd Year",
									scrollId: "project-bat-cafe",
								},
							].map((project, i, arr) => {
								const total = arr.length;
								const depth = total - 1 - i;
								const yOffset = depth * 32;
								const xOffset = -(depth * 14);
								const scale = 1 - depth * 0.035;
								const blur = depth > 0 ? depth * 0.6 : 0;
								const cardOpacity = 1 - depth * 0.12;
								const rotations = [0, -2.5, 1.8, -1.2];
								const rotate = rotations[depth] || 0;

								return (
									<motion.div
										key={project.title}
										initial={{ opacity: 0, x: 60, y: yOffset + 30 }}
										animate={{ opacity: cardOpacity, x: xOffset, y: yOffset }}
										transition={{
											duration: 0.7,
											delay: 0.5 + i * 0.12,
											ease: "easeOut",
										}}
										className="absolute left-0 right-0"
										style={{
											zIndex: i,
											transformOrigin: "center top",
											scale,
											filter: blur > 0 ? `blur(${blur}px)` : "none",
											rotate: `${rotate}deg`,
										}}
									>
										<motion.div
											animate={{ y: [0, -3 - (total - 1 - depth), 0] }}
											transition={{
												duration: 4 + i * 0.6,
												repeat: Infinity,
												ease: "easeInOut",
												delay: i * 0.7,
											}}
										>
											<TiltCard
												className={`rounded-2xl border backdrop-blur-xl ${depth === 0 ? "bg-white/80 dark:bg-gray-900/80 shadow-[0_16px_48px_-10px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_48px_-10px_rgba(0,0,0,0.5)]" : "bg-white/60 dark:bg-gray-900/60 shadow-[0_8px_28px_-8px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_28px_-8px_rgba(0,0,0,0.4)]"} border-gray-200 dark:border-white/10 overflow-hidden`}
												borderRadius="rounded-2xl"
												tiltDegree={depth === 0 ? 10 : 6}
												scale={depth === 0 ? 1.04 : 1.02}
												glareOpacity={depth === 0 ? 0.15 : 0.06}
											>
												<div
													className="group flex items-start gap-4 p-4 xl:p-5 cursor-pointer relative"
													onClick={() => {
														const el = document.getElementById(
															project.scrollId,
														);
														if (el)
															el.scrollIntoView({
																behavior: "smooth",
																block: "center",
															});
													}}
												>
													{/* Shine overlay on hover */}
													<div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-tr from-transparent via-white/20 dark:via-white/8 to-transparent pointer-events-none" />

													{/* See Projects popup on hover */}
													<div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-10">
														<span className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-gray-900/70 dark:bg-white/20 backdrop-blur-md shadow-lg tracking-wide uppercase border border-gray-900/20 dark:border-white/20">
															See Projects
														</span>
													</div>

													{/* Project thumbnail */}
													<div className="shrink-0 w-11 h-11 xl:w-13 xl:h-13 rounded-xl overflow-hidden shadow-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-white/10 group-hover:opacity-30 transition-opacity duration-300 mt-0.5">
														<img
															src={project.img}
															alt={project.title}
															className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
														/>
													</div>

													{/* Content */}
													<div className="flex-1 min-w-0 group-hover:opacity-30 transition-opacity duration-300">
														<div className="flex items-start justify-between gap-2">
															<h4 className="text-sm xl:text-base font-bold text-gray-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors duration-300">
																{project.title}
															</h4>
															<span className="text-[10px] xl:text-xs text-gray-400 dark:text-gray-400 whitespace-nowrap mt-0.5 shrink-0">
																{project.time}
															</span>
														</div>
														<p className="text-xs xl:text-sm text-gray-500 dark:text-gray-300 mt-1.5 leading-relaxed line-clamp-2">
															{project.desc}
														</p>
													</div>
												</div>
											</TiltCard>
										</motion.div>
									</motion.div>
								);
							})}
						</div>

						{/* Resume + Socials below cards */}
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.6, delay: 1.1, ease: "easeOut" }}
							className="flex flex-col items-start gap-3"
							style={{ zIndex: 20 }}
						>
							<motion.a
								href={cvPDF}
								download="markjordanjavier-CV.pdf"
								className="group relative inline-flex items-center gap-2 font-semibold py-2 px-5 rounded-full text-gray-600 dark:text-gray-200 text-sm bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 shadow-lg dark:shadow-gray-900/50 overflow-hidden"
								whileHover={{ y: -4, scale: 1.02 }}
								whileTap={{ scale: 0.98 }}
								transition={{ type: "spring", stiffness: 400, damping: 20 }}
							>
								<span className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-400/20 dark:from-blue-500/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out"></span>
								<span className="relative flex items-center gap-2">
									<span className="text-lg">📄</span>
									<span>Download CV</span>
								</span>
							</motion.a>

							<div className="flex items-center gap-5 text-2xl xl:text-3xl pl-1">
								<motion.a
									href="https://www.facebook.com/markjordan.javier"
									target="_blank"
									className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
									whileHover={{ scale: 1.2, y: -3 }}
									transition={{ type: "spring", stiffness: 400, damping: 15 }}
								>
									<FaFacebook />
								</motion.a>
								<motion.a
									href="https://github.com/Jordieeeee"
									target="_blank"
									className="text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
									whileHover={{ scale: 1.2, y: -3 }}
									transition={{ type: "spring", stiffness: 400, damping: 15 }}
								>
									<FaGithub />
								</motion.a>
								<motion.a
									href="https://www.linkedin.com/in/mark-jordan-javier-29b72935a/"
									target="_blank"
									className="text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-blue-400"
									whileHover={{ scale: 1.2, y: -3 }}
									transition={{ type: "spring", stiffness: 400, damping: 15 }}
								>
									<FaLinkedin />
								</motion.a>
								<motion.a
									href="mailto:javiermarkjordan@email.com"
									className="text-gray-700 dark:text-gray-200 hover:text-red-500 dark:hover:text-red-400"
									whileHover={{ scale: 1.2, y: -3 }}
									transition={{ type: "spring", stiffness: 400, damping: 15 }}
								>
									<FaEnvelope />
								</motion.a>
							</div>
						</motion.div>
					</motion.div>
				</div>
			</div>
		</section>
	);
}

export default Home;
