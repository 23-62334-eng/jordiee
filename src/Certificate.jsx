import { motion, AnimatePresence } from "framer-motion";
import {
	FiExternalLink,
	FiX,
	FiDownload,
	FiCheckCircle,
	FiAward,
	FiUsers,
	FiStar,
} from "react-icons/fi";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import TiltCard from "./components/TiltCard";

import cert1 from "./assets/cert/cert1.jpg";
import cert2 from "./assets/cert/cert2.jpg";
import cert3 from "./assets/cert/cert3.jpg";
import cert4 from "./assets/cert/cert4.jpg";
import certMicroPBI from "./assets/cert/MicroPBI.jpg";
import certClaudeInAction from "./assets/cert/ClaudeInAction.jpg";
import certClaude101 from "./assets/cert/Claude101.jpg";

/* ─── Data ───────────────────────────────────────────────── */
const certificates = [
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

const categoryColors = {
	Professional:
		"bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200/50 dark:border-blue-700/50",
	Conference:
		"bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200/50 dark:border-purple-700/50",
	Event:
		"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-700/50",
};

/* ─── Org Logo ───────────────────────────────────────────── */
function OrgLogo({ org, size = "sm" }) {
	const base =
		size === "sm"
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
			<TiltCard
				className="group flex flex-col rounded-2xl overflow-hidden
				bg-white dark:bg-gray-900
				border border-gray-200 dark:border-gray-700/60
				shadow-sm dark:shadow-none h-full"
				borderRadius="rounded-2xl"
				tiltDegree={8}
				scale={1.03}
				glareOpacity={0.2}
			>
				{/* Image */}
				<div className="relative h-44 overflow-hidden bg-gray-100 dark:bg-gray-800">
					<img
						src={cert.img}
						alt={cert.title}
						loading="lazy"
						className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
					/>
				</div>

				{/* Body */}
				<div className="flex flex-col gap-2 p-4 flex-1">
					{/* Category + Verified */}
					<div className="flex items-center gap-1.5 flex-wrap">
						<span
							className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${categoryColors[cert.category]}`}
						>
							{cert.category}
						</span>
						{cert.verified && (
							<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200/60 dark:border-green-700/40">
								<FiCheckCircle className="w-2.5 h-2.5" />
								Verified
							</span>
						)}
					</div>

					{/* Title */}
					<h3 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
						{cert.title}
					</h3>

					{/* Org row */}
					<div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100 dark:border-gray-800">
						<OrgLogo org={cert.org} size="sm" />
						<p className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1 min-w-0">
							{cert.org}
						</p>
						<span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 font-medium">
							{cert.year}
						</span>
					</div>

					{/* View button (always visible) */}
					<button
						onClick={() => onView(cert)}
						className="mt-1 w-full inline-flex items-center justify-center gap-1.5
						px-3 py-2 rounded-xl text-xs font-semibold
						bg-gray-900 dark:bg-white
						text-white dark:text-gray-900
						hover:bg-gray-700 dark:hover:bg-gray-100
						transition-colors duration-200"
					>
						<FiExternalLink className="w-3.5 h-3.5" />
						View Certificate
					</button>
				</div>
			</TiltCard>
		</motion.div>
	);
}

/* ─── Certificate Modal ──────────────────────────────────── */
function CertificateModal({ cert, onClose }) {
	useEffect(() => {
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "";
		};
	}, []);

	return createPortal(
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.2 }}
			className="fixed inset-0 z-[100] flex items-center justify-center p-4
				bg-black/60 backdrop-blur-md"
			onClick={onClose}
		>
			<motion.div
				initial={{ scale: 0.88, opacity: 0, y: 20 }}
				animate={{ scale: 1, opacity: 1, y: 0 }}
				exit={{ scale: 0.88, opacity: 0, y: 20 }}
				transition={{ type: "spring", damping: 28, stiffness: 320 }}
				className="relative bg-white dark:bg-gray-900 rounded-3xl
					shadow-2xl max-w-3xl w-full
					border border-gray-200 dark:border-gray-700/60
					overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Top accent bar */}
				<div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

				{/* Close */}
				<button
					onClick={onClose}
					className="absolute top-4 right-4 z-10 p-2.5 rounded-full
						bg-gray-100 dark:bg-gray-800
						hover:bg-gray-200 dark:hover:bg-gray-700
						border border-gray-200 dark:border-gray-700
						transition-colors duration-150"
				>
					<FiX size={18} className="text-gray-700 dark:text-gray-300" />
				</button>

				{/* Image */}
				<div
					className="w-full bg-gray-50 dark:bg-gray-800"
					style={{ maxHeight: "55vh" }}
				>
					<img
						src={cert.img}
						alt={cert.title}
						className="w-full h-full object-contain p-4"
						style={{ maxHeight: "55vh" }}
					/>
				</div>

				{/* Info */}
				<div className="p-6 border-t border-gray-100 dark:border-gray-800">
					<div className="flex items-start justify-between gap-4">
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 mb-2 flex-wrap">
								<span
									className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${categoryColors[cert.category]}`}
								>
									{cert.category}
								</span>
								{cert.verified && (
									<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200/60 dark:border-green-700/40">
										<FiCheckCircle className="w-3 h-3" />
										Verified
									</span>
								)}
							</div>
							<h2 className="text-lg font-bold text-gray-900 dark:text-white leading-snug mb-3">
								{cert.title}
							</h2>
							<div className="flex items-center gap-2">
								<OrgLogo org={cert.org} size="lg" />
								<p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
									{cert.org}
								</p>
								<span className="text-gray-300 dark:text-gray-600">
									&middot;
								</span>
								<p className="text-sm text-gray-500 dark:text-gray-400">
									{cert.year}
								</p>
							</div>
						</div>
						<a
							href={cert.img}
							download
							className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl
								bg-gray-900 dark:bg-white
								text-white dark:text-gray-900 text-sm font-semibold
								hover:bg-gray-700 dark:hover:bg-gray-100
								transition-colors duration-200"
						>
							<FiDownload className="w-4 h-4" />
							Download
						</a>
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

	const counts = certificates.reduce((acc, c) => {
		acc[c.category] = (acc[c.category] || 0) + 1;
		return acc;
	}, {});

	const stats = [
		{
			icon: FiAward,
			label: "Professional Certifications",
			value: counts.Professional || 0,
		},
		{
			icon: FiUsers,
			label: "Conferences Attended",
			value: counts.Conference || 0,
		},
		{ icon: FiStar, label: "Tech Events", value: counts.Event || 0 },
	];

	const stagger = {
		hidden: {},
		visible: { transition: { staggerChildren: 0.08 } },
	};

	return (
		<section id="certificate" className="min-h-screen relative z-0">
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

						{/* ── Stats Row ── */}
						<motion.div
							variants={stagger}
							initial="hidden"
							whileInView="visible"
							viewport={{ once: true }}
							className="grid grid-cols-3 gap-3 mb-8"
						>
							{stats.map(({ icon: Icon, label, value }) => (
								<motion.div
									key={label}
									variants={{
										hidden: { opacity: 0, y: 12 },
										visible: {
											opacity: 1,
											y: 0,
											transition: { duration: 0.45, ease: "easeOut" },
										},
									}}
									className="flex flex-col items-center justify-center gap-1 py-4 px-3 rounded-2xl
										bg-white/60 dark:bg-gray-900/60
										border border-white/60 dark:border-gray-700/60
										backdrop-blur-sm text-center"
								>
									<Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
									<span className="text-2xl font-bold text-gray-900 dark:text-white leading-none">
										{value}
									</span>
									<span className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug">
										{label}
									</span>
								</motion.div>
							))}
						</motion.div>

						{/* ── Divider ── */}
						<div className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent mb-8" />

						{/* ── Certification Grid ── */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
