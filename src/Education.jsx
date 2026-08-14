import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FiBookOpen, FiX, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { useState, useEffect, useCallback, useId, useRef } from "react";
import { createPortal } from "react-dom";

import portfolio1 from "./assets/proj/1stPortfolio/portfolio1.webp";
import portfolio2 from "./assets/proj/1stPortfolio/portfolio2.webp";
import portfolio3 from "./assets/proj/1stPortfolio/portfolio3.webp";
import portfolio4 from "./assets/proj/1stPortfolio/portfolio4.webp";
import thrift1 from "./assets/proj/thriftStore/img1.webp";
import thrift2 from "./assets/proj/thriftStore/img2.webp";
import thrift3 from "./assets/proj/thriftStore/img3.webp";
import thrift4 from "./assets/proj/thriftStore/img4.webp";
import thrift5 from "./assets/proj/thriftStore/img5.webp";
import time1 from "./assets/proj/timeSched/TSS1.webp";
import time2 from "./assets/proj/timeSched/TSS2.webp";
import time3 from "./assets/proj/timeSched/TSS3.webp";
import cafe1 from "./assets/proj/batCafe/batCafe1.webp";
import cafe2 from "./assets/proj/batCafe/batCafe2.webp";
import cafe3 from "./assets/proj/batCafe/batCafe3.webp";
import cafe4 from "./assets/proj/batCafe/batCafe4.webp";
import cafe5 from "./assets/proj/batCafe/batCafe5.webp";
import cafe6 from "./assets/proj/batCafe/batCafe6.webp";
import cafe7 from "./assets/proj/batCafe/batCafe7.webp";
import cafe8 from "./assets/proj/batCafe/batCafe8.webp";
import cafe9 from "./assets/proj/batCafe/batCafe9.webp";
import cafe10 from "./assets/proj/batCafe/batCafe10.webp";
import rental1 from "./assets/proj/vehiRental/vRental1.webp";
import rental2 from "./assets/proj/vehiRental/vRental2.webp";
import rental3 from "./assets/proj/vehiRental/vRental3.webp";
import rental4 from "./assets/proj/vehiRental/vRental4.webp";
import rental5 from "./assets/proj/vehiRental/vRental5.webp";
import rental6 from "./assets/proj/vehiRental/vRental6.webp";
import rental7 from "./assets/proj/vehiRental/vRental7.webp";
import rental8 from "./assets/proj/vehiRental/vRental8.webp";
import rental9 from "./assets/proj/vehiRental/vRental9.webp";
import rental10 from "./assets/proj/vehiRental/vRental10.webp";

/* One easing and one duration for the whole section. The old version mixed
   spring stacks, blur filters and four different slide directions; a single
   curve is what makes a page read as considered rather than decorated. */
const EASE = [0.23, 1, 0.32, 1];

/* Depth slots for the lightbox deck: where a card sits, how big it is, and how
   far out of focus, by its distance from the front. Cards animate between these
   on navigate, blur included — a one-off 380ms tween on at most four layers,
   not a continuous one, which is what makes filter animation affordable here.

   Offsets are percentages of the card's own width, not pixels, so the deck
   keeps its proportions on a phone instead of sliding out of the panel. */
const SLOTS = [
	{ x: "0%", scale: 1, opacity: 1, blur: 0 },
	{ x: "12%", scale: 0.93, opacity: 0.7, blur: 3 },
	{ x: "21%", scale: 0.87, opacity: 0.4, blur: 6 },
	{ x: "28%", scale: 0.82, opacity: 0.2, blur: 9 },
];

// Off-deck positions. Advancing throws the front card past the left edge;
// stepping back sends the rearmost card further into the stack. `blur` is
// translated to `filter` here — it is not a motion prop on its own.
const OUT_FRONT = { x: "-42%", scale: 0.92, opacity: 0, filter: "blur(0px)" };
const atSlot = (s) => ({
	x: s.x,
	scale: s.scale,
	opacity: s.opacity,
	filter: `blur(${s.blur}px)`,
});
const rear = (depth) => {
	const s = SLOTS[depth - 1];
	return {
		x: s.x,
		scale: s.scale,
		opacity: 0,
		filter: `blur(${s.blur}px)`,
	};
};

/* ─── Data ───────────────────────────────────────────────────
   One chronological list, newest first. This used to be three arrays —
   professionalWork, projects and timelineItems — where the timeline restated
   all eight entries the cards had already described. */
const work = [
	{
		id: "project-capstone",
		year: "2026",
		term: "4th Year",
		kind: "Capstone",
		status: "In development",
		title: "Integrated Payroll & Mobile Commercial System",
		org: "Tanauan City Water District",
		description:
			"Payroll processing plus a mobile commercial layer for a live municipal water utility — built end to end from schema and API through to UI and deployment.",
		tags: ["Payroll", "Mobile", "Full Stack"],
	},
	{
		id: "project-twd-monitoring",
		year: "2026",
		term: "4th Year",
		kind: "Client work",
		title: "TWD Project Monitoring System",
		description:
			"Replaces manual office-to-office, file-based progress reporting with a single web system for tracking project status across departments.",
		tags: ["Web System", "Reporting"],
	},
	{
		id: "project-school-evaluation",
		year: "2026",
		term: "4th Year",
		kind: "School project",
		title: "School Evaluation System",
		description:
			"A structured evaluation workflow with role-based access and reporting, replacing paper-based evaluation forms.",
		tags: ["Role-Based Access", "Reporting"],
	},
	{
		id: "project-vehicle-rental",
		year: "2025",
		term: "3rd Yr · Sem 1",
		kind: "School project",
		title: "Vehicle Rental System",
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
	},
	{
		id: "project-bat-cafe",
		year: "2025",
		term: "3rd Yr · Sem 1",
		kind: "School project",
		title: "Malvar Bat Cave Café",
		description:
			"A café management system with PHP and XAMPP featuring CRUD operations, an integrated chatbot, and dark mode.",
		tags: ["PHP", "XAMPP", "MySQL"],
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
	},
	{
		id: "project-portfolio",
		year: "2025",
		term: "Vacation",
		kind: "Personal",
		title: "Portfolio Website",
		description:
			"A fully responsive personal portfolio built with HTML, CSS, and Tailwind CSS showcasing projects through a clean interface.",
		tags: ["HTML", "CSS", "Tailwind"],
		images: [portfolio1, portfolio2, portfolio3, portfolio4],
	},
	{
		id: "project-thrift-shop",
		year: "2025",
		term: "2nd Yr · Sem 2",
		kind: "School project",
		title: "Online Thrift Shop",
		description:
			"A web-based e-commerce platform with HTML, Tailwind CSS, and MySQL, featuring product browsing and inventory management.",
		tags: ["HTML", "Tailwind", "MySQL"],
		images: [thrift1, thrift2, thrift3, thrift4, thrift5],
	},
	{
		id: "project-time-scheduling",
		year: "2024",
		term: "2nd Yr · Sem 1",
		kind: "School project",
		title: "Time Scheduling System",
		description:
			"A scheduling management system built with Java (OOP) and MySQL to efficiently manage schedules and streamline time-based operations.",
		tags: ["Java", "MySQL", "OOP"],
		images: [time1, time2, time3],
	},
];

const focusAreas = [
	"Software Development",
	"Database Management",
	"Web Application Development",
	"System Analysis & Design",
];

const skills = [
	"Object-Oriented Programming",
	"Database Design",
	"Full Stack Development",
	"System Analysis",
	"UI/UX Implementation",
];

/* ─── Lightbox ───────────────────────────────────────────────
   The thumbnail shows one calm frame; the rest of the shots live here rather
   than in a rotating stack that kept every image decoded on the page. */
function Lightbox({ item, onClose }) {
	const titleId = useId();
	const dialogRef = useRef(null);
	const reduced = useReducedMotion();
	// `page` counts monotonically instead of wrapping, and each card is keyed by
	// its page rather than by which image it shows. A project with four or fewer
	// shots renders every one of them at once, so keying by image meant the key
	// set was identical before and after a step — AnimatePresence saw nothing
	// enter or leave, and the front card crawled backwards into the deck instead
	// of flying off. Monotonic keys guarantee exactly one enter and one exit for
	// every project, whether it has three screenshots or ten.
	//
	// Direction rides along so the deck knows which way to move; without it,
	// prev would animate like next in reverse.
	const [{ page, dir }, setSlide] = useState({ page: 0, dir: 1 });
	const total = item.images.length;
	const wrap = (n) => ((n % total) + total) % total;
	const index = wrap(page);

	const next = useCallback(
		() => setSlide(({ page: p }) => ({ page: p + 1, dir: 1 })),
		[],
	);
	const prev = useCallback(
		() => setSlide(({ page: p }) => ({ page: p - 1, dir: -1 })),
		[],
	);
	// Dots jump by the shortest signed distance so the deck travels the way the
	// dot sits relative to the current one.
	const goTo = useCallback(
		(target) =>
			setSlide(({ page: p }) => {
				const delta = target - ((p % total) + total) % total;
				return { page: p + delta, dir: delta >= 0 ? 1 : -1 };
			}),
		[total],
	);

	// On a phone the deck has to give way to the screenshot: a four-card stack
	// left the actual image about 200px wide, which defeats the point of
	// opening it. One card behind, and the front card gets the room.
	const [compact, setCompact] = useState(
		() =>
			typeof window !== "undefined" &&
			window.matchMedia("(max-width: 639px)").matches,
	);
	useEffect(() => {
		const mq = window.matchMedia("(max-width: 639px)");
		const onChange = (e) => setCompact(e.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);
	const depth = Math.min(total, compact ? 2 : SLOTS.length);

	useEffect(() => {
		document.body.style.overflow = "hidden";
		const onKey = (e) => {
			if (e.key === "Escape") onClose();
			if (e.key === "ArrowRight") next();
			if (e.key === "ArrowLeft") prev();
		};
		document.addEventListener("keydown", onKey);
		dialogRef.current?.focus();
		return () => {
			document.body.style.overflow = "";
			document.removeEventListener("keydown", onKey);
		};
	}, [onClose, next, prev]);

	return createPortal(
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.18, ease: EASE }}
			className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/40 dark:bg-black/80"
			onClick={onClose}
		>
			<motion.div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				tabIndex={-1}
				// Never scale from 0 — it reads as appearing out of nowhere.
				initial={{ opacity: 0, scale: 0.97 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.97 }}
				transition={{ duration: 0.22, ease: EASE }}
				className="relative w-full max-w-5xl outline-none
					rounded-3xl border border-black/10 dark:border-white/10
					bg-white/80 dark:bg-neutral-900/75 backdrop-blur-2xl
					px-4 py-5 sm:px-6 sm:py-6"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-start justify-between gap-4 mb-4">
					<div className="min-w-0">
						<h2
							id={titleId}
							className="text-sm font-semibold text-gray-900 dark:text-white truncate"
						>
							{item.title}
						</h2>
						<p className="text-xs text-gray-500 dark:text-white/50 mt-0.5 tabular-nums">
							{index + 1} of {total}
						</p>
					</div>
					<button
						onClick={onClose}
						aria-label="Close"
						className="shrink-0 w-9 h-9 grid place-items-center rounded-full
							border border-black/10 dark:border-white/15
							bg-black/[0.03] dark:bg-white/5 backdrop-blur-md
							text-gray-500 hover:text-gray-900 hover:bg-black/[0.07]
							dark:text-white/70 dark:hover:text-white dark:hover:bg-white/10
							active:scale-95
							transition-[color,background-color,transform] duration-150
							focus-visible:outline-none focus-visible:ring-2
							focus-visible:ring-gray-900 dark:focus-visible:ring-white/60"
					>
						<FiX size={16} />
					</button>
				</div>

				{/* Depth stack: the current shot sits sharp and forward, the next few
				    recede to the right, scaled down and blurred, so the set reads as
				    a physical deck rather than a single flat frame.

				    Each card is keyed by its image, not by its position, so on
				    navigate the card behind physically travels forward — growing,
				    unblurring and sliding left into the front slot — instead of
				    every slot cross-fading in place. */}
				<div className="relative flex items-center justify-center">
					<div
						className="relative w-[80%] sm:w-[62%] aspect-[16/10]"
						style={{ perspective: 1200 }}
					>
						<AnimatePresence initial={false} custom={dir}>
							{Array.from({ length: depth }, (_, d) => {
								const position = page + d;
								const imgIndex = wrap(position);
								const slot = SLOTS[d];
								const isFront = d === 0;
								return (
									<motion.div
										key={position}
										custom={dir}
										// enter/exit are named variants, not inline objects, so
										// AnimatePresence's `custom` reaches a card that is already
										// unmounting. With inline props the leaving card keeps the
										// direction from its last render and exits the wrong way.
										variants={{
											// Reduced motion keeps the deck's layout but drops the
											// travel: cards fade in place instead of sliding.
											enter: (direction) =>
												reduced
													? { ...atSlot(slot), opacity: 0 }
													: direction === 1
														? rear(depth)
														: OUT_FRONT,
											exit: (direction) =>
												reduced
													? { ...atSlot(slot), opacity: 0 }
													: direction === 1
														? OUT_FRONT
														: rear(depth),
										}}
										initial="enter"
										animate={atSlot(slot)}
										exit="exit"
										transition={{ duration: reduced ? 0.15 : 0.38, ease: EASE }}
										className="absolute inset-0 rounded-2xl overflow-hidden
											border border-black/10 dark:border-white/10
											bg-gray-100 dark:bg-black/40 shadow-2xl"
										// Front card paints on top, and keeps that z while it
										// exits so it slides out over the deck, not under it.
										style={{ zIndex: SLOTS.length - d }}
									>
										<img
											src={item.images[imgIndex]}
											alt={
												isFront
													? `${item.title} — screenshot ${imgIndex + 1}`
													: ""
											}
											aria-hidden={!isFront}
											draggable={false}
											className="w-full h-full object-cover"
										/>
									</motion.div>
								);
							})}
						</AnimatePresence>
					</div>

					{total > 1 && (
						<>
							<button
								onClick={prev}
								aria-label="Previous screenshot"
								className="absolute left-0 sm:left-2 z-20 w-11 h-11 grid place-items-center rounded-full
									border border-black/10 dark:border-white/15
									bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-none
									text-gray-600 hover:text-gray-900 hover:bg-white
									dark:text-white/80 dark:hover:text-white dark:hover:bg-white/10
									active:scale-95
									transition-[color,background-color,transform] duration-150
									focus-visible:outline-none focus-visible:ring-2
									focus-visible:ring-gray-900 dark:focus-visible:ring-white/60"
							>
								<FiChevronLeft size={20} />
							</button>
							<button
								onClick={next}
								aria-label="Next screenshot"
								className="absolute right-0 sm:right-2 z-20 w-11 h-11 grid place-items-center rounded-full
									border border-black/10 dark:border-white/15
									bg-white/70 dark:bg-white/5 backdrop-blur-md shadow-sm dark:shadow-none
									text-gray-600 hover:text-gray-900 hover:bg-white
									dark:text-white/80 dark:hover:text-white dark:hover:bg-white/10
									active:scale-95
									transition-[color,background-color,transform] duration-150
									focus-visible:outline-none focus-visible:ring-2
									focus-visible:ring-gray-900 dark:focus-visible:ring-white/60"
							>
								<FiChevronRight size={20} />
							</button>
						</>
					)}
				</div>

				{/* Dots: the active one stretches into a pill rather than just
				    brightening, so position is readable at a glance. */}
				{total > 1 && (
					<div className="flex items-center justify-center gap-1.5 mt-6">
						{item.images.map((_, i) => (
							<button
								key={i}
								onClick={() => goTo(i)}
								aria-label={`Go to screenshot ${i + 1}`}
								aria-current={i === index}
								className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ease-out
									focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white/60
									${
										i === index
											? "w-6 bg-gray-900 dark:bg-white"
											: "w-1.5 bg-gray-900/25 dark:bg-white/30 hover:bg-gray-900/40 dark:hover:bg-white/50"
									}`}
							/>
						))}
					</div>
				)}
			</motion.div>
		</motion.div>,
		document.body,
	);
}

/* ─── Work Row ───────────────────────────────────────────────
   Year rail, then the entry, then one screenshot. A row, not a card: the old
   grid gave three different card treatments to what is really one list. */
function WorkRow({ item, onOpen, reduced }) {
	const hasImages = item.images?.length > 0;

	return (
		<motion.li
			id={item.id}
			variants={{
				hidden: { opacity: 0, y: reduced ? 0 : 12 },
				visible: {
					opacity: 1,
					y: 0,
					transition: { duration: 0.42, ease: EASE },
				},
			}}
			className="group scroll-mt-24"
		>
			<div
				className="grid gap-x-6 gap-y-2 py-6 sm:grid-cols-[5.5rem_1fr]
					border-t border-gray-200/70 dark:border-gray-700/50"
			>
				{/* Year rail */}
				<div className="sm:pt-0.5">
					<span className="text-xs font-semibold tabular-nums text-gray-900 dark:text-white">
						{item.year}
					</span>
					<span className="block text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
						{item.term}
					</span>
				</div>

				{/* Entry */}
				<div className="flex flex-col-reverse sm:flex-row gap-4 sm:gap-6">
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1.5">
							<span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
								{item.kind}
							</span>
							{item.status && (
								<span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
									<span className="w-1 h-1 rounded-full bg-gray-900 dark:bg-white" />
									{item.status}
								</span>
							)}
						</div>

						<h4 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
							{item.title}
						</h4>
						{item.org && (
							<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
								{item.org}
							</p>
						)}

						<p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-2 max-w-prose">
							{item.description}
						</p>

						<div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
							{item.tags.map((tag) => (
								<span
									key={tag}
									className="text-[10px] font-medium text-gray-400 dark:text-gray-500"
								>
									{tag}
								</span>
							))}
						</div>
					</div>

					{/* One screenshot. Opens the rest rather than rotating in place. */}
					{hasImages && (
						<button
							type="button"
							onClick={() => onOpen(item)}
							aria-label={`View ${item.images.length} screenshots of ${item.title}`}
							className="relative shrink-0 w-full sm:w-44 aspect-[16/10] overflow-hidden rounded-lg
								border border-gray-200 dark:border-gray-700/60 bg-gray-100 dark:bg-gray-800
								cursor-pointer active:scale-[0.98]
								transition-transform duration-150
								focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
						>
							<img
								src={item.images[0]}
								alt=""
								loading="lazy"
								decoding="async"
								width={1200}
								height={750}
								className="w-full h-full object-cover
									transition-[opacity] duration-200
									group-hover:opacity-90"
							/>
							{item.images.length > 1 && (
								<span
									className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded
										bg-black/55 text-white text-[9px] font-medium tabular-nums"
								>
									{item.images.length}
								</span>
							)}
						</button>
					)}
				</div>
			</div>
		</motion.li>
	);
}

/* ─── Main Component ─────────────────────────────────────── */
function Education() {
	const [active, setActive] = useState(null);
	const reduced = useReducedMotion();

	const list = {
		hidden: {},
		visible: { transition: { staggerChildren: 0.05 } },
	};
	const fadeUp = {
		hidden: { opacity: 0, y: reduced ? 0 : 12 },
		visible: {
			opacity: 1,
			y: 0,
			transition: { duration: 0.42, ease: EASE },
		},
	};

	return (
		<section id="education" className="relative z-0">
			<div className="flex items-center justify-center px-4 sm:px-6 py-16">
				<motion.div
					variants={fadeUp}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, amount: 0.05 }}
					className="relative max-w-5xl w-full rounded-3xl
						bg-white/70 dark:bg-gray-800/70 backdrop-blur-2xl
						border border-white/50 dark:border-gray-700/50
						shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)]
						overflow-hidden"
				>
					{/* ── Education ── */}
					<motion.div
						variants={list}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true, amount: 0.15 }}
						className="px-7 py-8 sm:px-10 sm:py-10"
					>
						<motion.div variants={fadeUp} className="flex items-center gap-2 mb-7">
							<span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-white" />
							<h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide uppercase">
								Education
							</h2>
						</motion.div>

						<motion.div variants={fadeUp} className="flex items-start gap-4">
							<div className="w-10 h-10 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center shrink-0 mt-0.5">
								<FiBookOpen className="w-5 h-5 text-white dark:text-gray-900" />
							</div>
							<div className="min-w-0">
								<h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug">
									Bachelor of Science in Information Technology
								</h3>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
									Batangas State University · 2023 – Present
								</p>
								<p className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-600 dark:text-gray-300">
									<span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-white" />
									4th Year · Capstone in development
								</p>
								<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mt-3 max-w-prose">
									Now in my fourth year, currently developing our capstone
									project alongside coursework in software development, database
									systems, and modern web technologies — building real-world
									full-stack applications across multiple academic projects.
								</p>
							</div>
						</motion.div>

						{/* Focus areas and skills, side by side rather than stacked as
						    two more full-width blocks. */}
						<motion.div
							variants={fadeUp}
							className="grid gap-8 sm:grid-cols-2 mt-8 pt-8 border-t border-gray-200/70 dark:border-gray-700/50"
						>
							<div>
								<p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
									Focus Areas
								</p>
								<ul className="space-y-1.5">
									{focusAreas.map((area) => (
										<li
											key={area}
											className="text-sm text-gray-700 dark:text-gray-300"
										>
											{area}
										</li>
									))}
								</ul>
							</div>
							<div>
								<p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
									Key Skills
								</p>
								<ul className="space-y-1.5">
									{skills.map((skill) => (
										<li
											key={skill}
											className="text-sm text-gray-700 dark:text-gray-300"
										>
											{skill}
										</li>
									))}
								</ul>
							</div>
						</motion.div>
					</motion.div>

					{/* ── Work ── */}
					<div className="px-7 pb-9 sm:px-10 sm:pb-11 border-t border-gray-200/40 dark:border-gray-700/40 pt-8">
						<motion.div
							variants={fadeUp}
							initial="hidden"
							whileInView="visible"
							viewport={{ once: true }}
							className="flex items-baseline justify-between gap-4 mb-2"
						>
							<div className="flex items-center gap-2">
								<span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-white" />
								<h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide uppercase">
									Work
								</h3>
							</div>
							<span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 tabular-nums">
								{work.length} projects · 2024 – 2026
							</span>
						</motion.div>

						<motion.ul
							variants={list}
							initial="hidden"
							whileInView="visible"
							viewport={{ once: true, amount: 0.02 }}
						>
							{work.map((item) => (
								<WorkRow
									key={item.id}
									item={item}
									onOpen={setActive}
									reduced={reduced}
								/>
							))}
						</motion.ul>
					</div>
				</motion.div>
			</div>

			<AnimatePresence>
				{active && <Lightbox item={active} onClose={() => setActive(null)} />}
			</AnimatePresence>
		</section>
	);
}

export default Education;
