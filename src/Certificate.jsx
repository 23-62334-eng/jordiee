import { motion, AnimatePresence } from "framer-motion";
import {
	FiX,
	FiCheckCircle,
} from "react-icons/fi";
import { useState, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import TiltCard from "./components/TiltCard";

import cert1 from "./assets/cert/cert1.webp";
import cert2 from "./assets/cert/cert2.webp";
import cert3 from "./assets/cert/cert3.webp";
import cert4 from "./assets/cert/cert4.webp";
import certMicroPBI from "./assets/cert/MicroPBI.webp";
import certClaudeInAction from "./assets/cert/ClaudeInAction.webp";
import certClaude101 from "./assets/cert/Claude_101.webp";
import certClaudeAgent from "./assets/cert/Claude_Agent.webp";
import certAWSCLOUD101 from "./assets/cert/Cloud101.webp";
import certAWSCLI from "./assets/cert/AWS_CLI.webp";


/* ─── Data ───────────────────────────────────────────────── */
const certificates = [
	{
		title: "AWS CLI",
		org: "AWS",
		year: "2026",
		img: certAWSCLI,
		category: "Professional",
		verified: true,
	},
	{
		title: "CLOUD 101",
		org: "AWS",
		year: "2026",
		img: certAWSCLOUD101,
		category: "Badge",
		verified: true,
	},
	{
		title: "Claude Agent",
		org: "Anthropic",
		year: "2026",
		img: certClaudeAgent,
		category: "Professional",
		verified: true,
	},
	{
		title: "Claude 101",
		org: "Anthropic",
		year: "2026",
		img: certClaude101,
		category: "Professional",
		verified: true,
	},
	{
		title: "Claude in Action",
		org: "Anthropic",
		year: "2026",
		img: certClaudeInAction,
		category: "Professional",
		verified: true,
	},
	{
		title: "Microsoft Power BI Data Analyst",
		org: "Microsoft",
		year: "2025",
		img: certMicroPBI,
		category: "Professional",
		verified: true,
	},
	{
		title: "Databiz Conference 2024",
		org: "Batangas Information Technology Society",
		year: "2024",
		img: cert1,
		category: "Conference",
		verified: true,
	},
	{
		title: "BIT Conference (BITCON) 2025",
		org: "Batangas Information Technology Society",
		year: "2025",
		img: cert2,
		category: "Conference",
		verified: true,
	},
	{
		title: "Databiz Conference 2025",
		org: "Batangas Information Technology Society",
		year: "2025",
		img: cert3,
		category: "Conference",
		verified: true,
	},
	{
		title: "TechTalks S3",
		org: "CICS Student Council",
		year: "2025",
		img: cert4,
		category: "Event",
		verified: false,
	},
];

// One neutral badge for every category. The three used to be blue / purple /
// emerald, which were the last colours left in this section.
const CATEGORY_BADGE =
	"bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700";

/* ─── Org Logo ───────────────────────────────────────────── */
function OrgLogo({ org, size = "sm" }) {
	const base =
		size === "xs"
			? "w-4 h-4 rounded text-[7px] font-bold"
			: size === "sm"
				? "w-6 h-6 rounded-md text-[9px] font-bold"
				: "w-10 h-10 rounded-lg text-xs font-bold";
	const map = {
		Anthropic:
			"bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300",
		Microsoft:
			"bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300",
		"Batangas Information Technology Society":
			"bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300",
		"CICS Student Council":
			"bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300",
	};
	const initials = {
		Anthropic: "AI",
		Microsoft: "MS",
		"Batangas Information Technology Society": "BI",
		"CICS Student Council": "CC",
	};
	const c = map[org];
	if (!c) return null;
	return (
		<span className={`${base} ${c} flex items-center justify-center shrink-0`}>
			{initials[org]}
		</span>
	);
}

/* ─── Certification Card ─────────────────────────────────── */
function CertificationCard({ cert, onView }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 24 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, amount: 0.1 }}
			transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
		>
			{/* The whole card is the trigger. A real <button> rather than an
			    onClick on the wrapper, so it is reachable by keyboard, announced
			    as a control, and activates on Enter/Space for free. */}
			<TiltCard
				as="button"
				type="button"
				onClick={() => onView(cert)}
				aria-label={`View certificate: ${cert.title}`}
				className="group flex flex-col rounded-xl overflow-hidden text-left w-full
				bg-white dark:bg-gray-900
				border border-gray-200 dark:border-gray-700/60
				shadow-sm dark:shadow-none h-full cursor-pointer
				focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:ring-offset-2"
				borderRadius="rounded-xl"
				tiltDegree={6}
				scale={1.03}
				glareOpacity={0.2}
			>
				{/* Image */}
				<div className="relative h-24 overflow-hidden bg-gray-100 dark:bg-gray-800">
					<img
						src={cert.img}
						alt={cert.title}
						loading="lazy"
						decoding="async"
						className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
					/>
					{/* At four across there is no room for a "Verified" pill beside the
					    category, so the tick moves onto the image as an icon. */}
					{cert.verified && (
						<span
							className="absolute top-1.5 right-1.5 p-1 rounded-full
								bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm
								text-green-600 dark:text-green-400"
							title="Verified"
						>
							<FiCheckCircle className="w-3 h-3" aria-hidden="true" />
							<span className="sr-only">Verified</span>
						</span>
					)}
				</div>

				{/* Body */}
				<div className="flex flex-col gap-1.5 p-2.5 flex-1">
					{/* Category */}
					<span
						className={`self-start px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${CATEGORY_BADGE}`}
					>
						{cert.category}
					</span>

					{/* Title — clamped, since a few of these run long and would
					    otherwise set the height of the whole row. */}
					<h3 className="text-xs font-bold text-gray-900 dark:text-white leading-snug line-clamp-2">
						{cert.title}
					</h3>

					{/* Org row */}
					<div className="flex items-center gap-1.5 mt-auto pt-1.5 border-t border-gray-100 dark:border-gray-800">
						<OrgLogo org={cert.org} size="xs" />
						<p className="text-[10px] text-gray-500 dark:text-gray-400 truncate flex-1 min-w-0">
							{cert.org}
						</p>
						<span className="text-[9px] text-gray-400 dark:text-gray-500 shrink-0 font-medium">
							{cert.year}
						</span>
					</div>
				</div>
			</TiltCard>
		</motion.div>
	);
}

/* ─── Certificate Modal ──────────────────────────────────── */
function CertificateModal({ cert, onClose }) {
	const titleId = useId();
	const dialogRef = useRef(null);

	useEffect(() => {
		document.body.style.overflow = "hidden";

		// Escape is the expected way out of a dialog; previously the only exit
		// was clicking the backdrop, which is mouse-only.
		const onKey = (event) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);

		// Move focus into the dialog so screen readers announce it and the
		// keyboard is not left behind on the card underneath.
		dialogRef.current?.focus();

		return () => {
			document.body.style.overflow = "";
			document.removeEventListener("keydown", onKey);
		};
	}, [onClose]);

	return createPortal(
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.2 }}
			className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6
				bg-black/70 backdrop-blur-sm"
			onClick={onClose}
		>
			<motion.div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				tabIndex={-1}
				initial={{ scale: 0.97, opacity: 0, y: 12 }}
				animate={{ scale: 1, opacity: 1, y: 0 }}
				exit={{ scale: 0.97, opacity: 0, y: 12 }}
				transition={{ type: "spring", damping: 30, stiffness: 340 }}
				className="relative w-full max-w-3xl overflow-hidden rounded-2xl outline-none
					bg-white dark:bg-gray-900
					border border-gray-200 dark:border-gray-700/60
					shadow-2xl"
				onClick={(event) => event.stopPropagation()}
			>
				{/* Ghost close button — present, not shouting. */}
				<button
					onClick={onClose}
					aria-label="Close"
					className="absolute top-3 right-3 z-10 p-2 rounded-full
						text-gray-400 hover:text-gray-900 dark:hover:text-white
						hover:bg-gray-100 dark:hover:bg-gray-800
						focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))]
						transition-colors duration-150"
				>
					<FiX size={18} />
				</button>

				{/* The certificate is the point of the dialog, so it gets the room. */}
				<div className="flex items-center justify-center bg-gray-50 dark:bg-gray-800/40 p-4 sm:p-6">
					<img
						src={cert.img}
						alt={cert.title}
						className="max-h-[68vh] w-auto max-w-full object-contain rounded-lg"
					/>
				</div>

				{/* One quiet meta line, one title, one attribution line. */}
				<div className="px-5 py-4 sm:px-6 sm:py-5 border-t border-gray-100 dark:border-gray-800">
					<p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
						{cert.category}
						{cert.verified && (
							<>
								<span aria-hidden="true">·</span>
								<span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300">
									<FiCheckCircle className="w-3 h-3" />
									Verified
								</span>
							</>
						)}
					</p>

					<h2
						id={titleId}
						className="mt-1.5 text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-snug"
					>
						{cert.title}
					</h2>

					<div className="mt-3 flex items-center gap-2 text-sm">
						<OrgLogo org={cert.org} size="sm" />
						<span className="font-medium text-gray-700 dark:text-gray-200">
							{cert.org}
						</span>
						<span className="text-gray-300 dark:text-gray-600">·</span>
						<span className="text-gray-500 dark:text-gray-400">{cert.year}</span>
					</div>
				</div>
			</motion.div>
		</motion.div>,
		document.body,
	);
}

/* ─── Main Component ─────────────────────────────────────── */
function Certificate() {
	const [expandedCert, setExpandedCert] = useState(null);

	// No min-h-screen on the section: the compact four-across grid is ~550px,
	// so forcing a full viewport left ~350px of dead air that read as a gap
	// between this section and Experience above it.
	return (
		<section id="certificate" className="relative z-0">
			<div className="flex items-center justify-center px-4 sm:px-6 py-12">
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

					<div className="px-7 py-8 sm:px-9 sm:py-9">
						{/* ── Section Header ── */}
						<motion.div
							initial={{ opacity: 0, y: 16 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.55, ease: "easeOut" }}
							className="mb-6"
						>
							<div className="flex items-center gap-2 mb-1">
								<span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-white" />
								<h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide uppercase">
									Certifications
								</h2>
							</div>
							<p className="text-xs text-gray-500 dark:text-gray-400 ml-3.5 leading-relaxed max-w-xl">
								Professional certifications, conferences, and technical events
								that contributed to my development journey.
							</p>
						</motion.div>

						{/* ── Certification Grid ── */}
						<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
							{certificates.map((cert, i) => (
								<CertificationCard
									key={i}
									cert={cert}
									onView={setExpandedCert}
								/>
							))}
						</div>
					</div>
				</motion.div>
			</div>

			{/* Modal */}
			<AnimatePresence>
				{expandedCert && (
					<CertificateModal
						cert={expandedCert}
						onClose={() => setExpandedCert(null)}
					/>
				)}
			</AnimatePresence>
		</section>
	);
}

export default Certificate;
