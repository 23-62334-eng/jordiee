import { motion, AnimatePresence } from "framer-motion";
import { FiExternalLink, FiX, FiAward } from "react-icons/fi";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import TiltCard from "./components/TiltCard";

import cert1 from "./assets/cert/cert1.jpg";
import cert2 from "./assets/cert/cert2.jpg";
import cert3 from "./assets/cert/cert3.jpg";
import cert4 from "./assets/cert/cert4.jpg";
import certMicroPBI from "./assets/cert/MicroPBI.jpg";

const certificates = [
	{
		title: "Microsoft Power BI Data Analyst",
		org: "Microsoft",
		year: "2025",
		img: certMicroPBI,
		category: "Professional",
	},
	{
		title: "Databiz Conference 2024",
		org: "Batangas Information Technology Society",
		year: "2024",
		img: cert1,
		category: "Conference",
	},
	{
		title: "BIT Conference (BITCON) 2025",
		org: "Batangas Information Technology Society",
		year: "2025",
		img: cert2,
		category: "Conference",
	},
	{
		title: "Databiz Conference 2025",
		org: "Batangas Information Technology Society",
		year: "2025",
		img: cert3,
		category: "Conference",
	},
	{
		title: "TechTalks S3",
		org: "CICS Student Council",
		year: "2025",
		img: cert4,
		category: "Event",
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

function Certificate() {
	const [expandedCert, setExpandedCert] = useState(null);

	// Lock body scroll when modal is open
	useEffect(() => {
		if (expandedCert) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [expandedCert]);

	const container = {
		hidden: {},
		visible: {
			transition: {
				staggerChildren: 0.1,
			},
		},
	};

	const certItem = {
		hidden: { opacity: 0, y: 20 },
		visible: {
			opacity: 1,
			y: 0,
			transition: { duration: 0.5, ease: "easeOut" },
		},
	};

	return (
		<section id="certificate" className="min-h-screen relative z-0">
			<div className="min-h-screen flex items-center justify-center px-6 py-20">
				{/* Glass Card */}
				<motion.div
					initial={{ opacity: 0, y: 60 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.1 }}
					transition={{ duration: 0.8, ease: "easeOut" }}
					className="relative max-w-6xl w-full p-10 rounded-3xl bg-white/70 dark:bg-gray-800 backdrop-blur-2xl
					border border-white/50 dark:border-gray-700
					shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]"
				>
					<div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-white/40 dark:from-gray-700/40 via-transparent to-white/10 dark:to-gray-800/10" />

					{/* Header */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
						viewport={{ once: true, amount: 0.1 }}
						transition={{ duration: 0.6, ease: "easeOut" }}
						className="flex items-center gap-3 mb-10"
					>
						<FiAward className="text-4xl md:text-5xl text-gray-900 dark:text-white" />
						<motion.h2
							initial={{ opacity: 0, y: 20, letterSpacing: "0.2em" }}
							whileInView={{ opacity: 1, y: 0, letterSpacing: "0em" }}
							transition={{ duration: 0.8, ease: "easeOut" }}
							className="text-4xl md:text-4xl font-semibold tracking-tight text-gray-900 dark:text-white"
						>
							Certifications
						</motion.h2>
					</motion.div>

					{/* Overview Card */}
					<motion.div
						initial={{ opacity: 0, y: 30 }}
						whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
						viewport={{ once: true, amount: 0.1 }}
						transition={{ duration: 0.5, ease: "easeOut" }}
						className="mb-8"
					>
						<div
							className="relative rounded-2xl p-8 md:p-10
							bg-white/60 dark:bg-gray-700 backdrop-blur-xl
							border border-white/40 dark:border-gray-600
							shadow-lg dark:shadow-gray-900/30"
						>
							<div
								className="absolute inset-0 rounded-2xl
								bg-gradient-to-br from-white/40 dark:from-gray-600/40 via-transparent to-white/10 dark:to-gray-700/10
								-z-10"
							/>

							<p className="text-gray-700 dark:text-gray-300 leading-relaxed max-w-3xl">
								Professional certifications and recognized participation in
								technology, data science, AI, and professional development
								conferences and events.
							</p>

							{/* Stats Row */}
							<div className="flex flex-wrap gap-4 mt-5">
								{Object.entries(
									certificates.reduce((acc, cert) => {
										acc[cert.category] = (acc[cert.category] || 0) + 1;
										return acc;
									}, {}),
								).map(([cat, count]) => (
									<span
										key={cat}
										className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${categoryColors[cat]}`}
									>
										<span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
										{count} {cat}
									</span>
								))}
							</div>
						</div>
					</motion.div>

					{/* Divider */}
					<motion.div
						initial={{ opacity: 0, scaleX: 0 }}
						whileInView={{ opacity: 1, scaleX: 1 }}
						viewport={{ once: true, amount: 0.1 }}
						transition={{ duration: 0.6, ease: "easeOut" }}
						className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent mb-10"
					/>

					{/* CERT GRID */}
					<motion.div
						variants={container}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true }}
						className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
					>
						{certificates.map((cert, i) => (
							<TiltCard
								key={i}
								variants={certItem}
								className="group relative rounded-2xl overflow-hidden cursor-pointer bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-lg hover:shadow-2xl dark:shadow-gray-900/50 dark:hover:shadow-gray-900/70 transition-shadow duration-300"
							>
								{/* Image Container */}
								<div className="relative h-48 overflow-hidden bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
									<img
										src={cert.img}
										alt={cert.title}
										loading="lazy"
										className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
									/>

									{/* Shine overlay on hover */}
									<div
										className="absolute inset-0 opacity-0 group-hover:opacity-100
										transition duration-500
										bg-gradient-to-tr from-transparent via-white/15 dark:via-white/5 to-transparent
										pointer-events-none"
									/>

									{/* Overlay Button */}
									<div className="absolute inset-0 bg-gradient-to-br from-gray-900/70 via-gray-800/60 to-gray-900/70 dark:from-black/80 dark:via-gray-900/70 dark:to-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
										<button
											onClick={() => setExpandedCert(cert)}
											className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-full font-semibold shadow-lg dark:shadow-gray-900/50 hover:scale-105 active:scale-95 transition-all duration-200 text-sm"
										>
											View{" "}
											<FiExternalLink className="w-4 h-4 dark:text-white" />
										</button>
									</div>
								</div>

								{/* Info Section */}
								<div className="p-5 bg-gradient-to-br from-white/95 to-gray-50/95 dark:from-gray-800/95 dark:to-gray-900/95 border-t border-gray-200/50 dark:border-gray-700/50">
									{/* Category Badge */}
									<span
										className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2.5 ${categoryColors[cert.category]}`}
									>
										{cert.category}
									</span>
									<h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug group-hover:text-gray-800 dark:group-hover:text-gray-100 transition-colors duration-300">
										{cert.title}
									</h3>
									<div className="flex items-center gap-2 mt-2">
										<p className="text-gray-500 dark:text-gray-400 text-xs font-medium">
											{cert.org}
										</p>
										<span className="text-gray-300 dark:text-gray-600">
											&middot;
										</span>
										<p className="text-gray-400 dark:text-gray-500 text-xs">
											{cert.year}
										</p>
									</div>
								</div>
							</TiltCard>
						))}
					</motion.div>
				</motion.div>
			</div>

			{/* Modal */}
			{createPortal(
				<AnimatePresence>
					{expandedCert && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
							className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md"
							onClick={() => setExpandedCert(null)}
						>
							<motion.div
								initial={{ scale: 0.85, opacity: 0 }}
								animate={{ scale: 1, opacity: 1 }}
								exit={{ scale: 0.85, opacity: 0 }}
								transition={{ type: "spring", damping: 25, stiffness: 300 }}
								className="relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-3xl shadow-2xl dark:shadow-gray-900/70 max-w-4xl w-full border border-gray-200/50 dark:border-gray-700/50 overflow-hidden"
								onClick={(e) => e.stopPropagation()}
							>
								{/* Gradient Overlay */}
								<div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 dark:from-blue-600 dark:via-purple-600 dark:to-pink-600" />
								{/* Close Button */}
								<button
									onClick={() => setExpandedCert(null)}
									className="absolute top-6 right-6 z-10 p-3 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full shadow-lg hover:shadow-xl dark:shadow-gray-900/50 transition-all duration-300 border border-gray-200 dark:border-gray-700 hover:scale-110 active:scale-90"
								>
									<FiX size={20} className="text-gray-700 dark:text-gray-200" />
								</button>

								{/* Full Image */}
								<div className="relative w-full h-[600px] overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
									<img
										src={expandedCert.img}
										alt={expandedCert.title}
										className="w-full h-full object-contain p-4"
									/>
									<div className="absolute inset-0 shadow-inner pointer-events-none" />
								</div>

								{/* Info */}
								<div className="p-8 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-t border-gray-200/50 dark:border-gray-700/50">
									<span
										className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 ${categoryColors[expandedCert.category]}`}
									>
										{expandedCert.category}
									</span>
									<div className="flex items-center gap-3 mb-2">
										<FiAward
											className="text-gray-700 dark:text-gray-200"
											size={28}
										/>
										<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
											{expandedCert.title}
										</h2>
									</div>
									<div className="flex items-center gap-2 mt-3">
										<p className="text-gray-600 dark:text-gray-300 font-medium">
											{expandedCert.org}
										</p>
										<span className="text-gray-300 dark:text-gray-600">
											&middot;
										</span>
										<p className="text-gray-500 dark:text-gray-400">
											{expandedCert.year}
										</p>
									</div>
								</div>
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>,
				document.body,
			)}
		</section>
	);
}

export default Certificate;
