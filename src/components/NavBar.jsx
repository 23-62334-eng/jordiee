import { useState, useEffect, useRef } from "react";
import {
	motion,
	AnimatePresence,
	useMotionValue,
	useSpring,
	useTransform,
} from "framer-motion";

// Dock icon component with magnification effect
function DockIcon({
	mouseX,
	item,
	index,
	isActive,
	onClick,
	onMouseEnter,
	onMouseLeave,
}) {
	const ref = useRef(null);

	const distance = useTransform(mouseX, (val) => {
		const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
		return val - bounds.x - bounds.width / 2;
	});

	// Responsive sizing: no animation on mobile, magnification on desktop
	const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
	const baseSize = isMobile ? 46 : 50;
	const magnifiedSize = isMobile ? 46 : 70; // Keep same size on mobile (no animation)

	const widthSync = useTransform(
		distance,
		[-150, 0, 150],
		[baseSize, magnifiedSize, baseSize]
	);
	const width = useSpring(widthSync, {
		mass: 0.1,
		stiffness: 150,
		damping: 12,
	});

	const height = width;

	return (
		<motion.button
			ref={ref}
			style={{ width, height }}
			onClick={onClick}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			aria-label={item.label}
			className={`
				relative
				flex items-center justify-center
				rounded-full
				${isActive ? "nav-button-active" : "nav-button"}
			`}
		>
			<div className="nav-tooltip">{item.label}</div>
			<div className="nav-icon">{item.icon}</div>
		</motion.button>
	);
}

function NavBar() {
	const [active, setActive] = useState("home");
	const [hoveredIndex, setHoveredIndex] = useState(null);
	const mouseX = useMotionValue(Infinity);

	// Track active section
	useEffect(() => {
		const sections = Array.from(document.querySelectorAll("section[id]"));

		if (sections.length === 0) return;

		const handleScroll = () => {
			const scrollPosition = window.scrollY + window.innerHeight / 2;
			let currentSection = sections[0].id;
			for (let section of sections) {
				const rect = section.getBoundingClientRect();
				const sectionTop = window.scrollY + rect.top;
				if (scrollPosition >= sectionTop) {
					currentSection = section.id;
				}
			}
			setActive(currentSection);
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		handleScroll(); // set on mount

		return () => {
			window.removeEventListener("scroll", handleScroll);
		};
	}, []);

	const navItems = [
		{
			id: "home",
			label: "Home",
			icon: (
				<svg
					className="w-7 sm:w-7 md:w-8 h-7 sm:h-7 md:h-8"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
					<g
						id="SVGRepo_tracerCarrier"
						strokeLinecap="round"
						strokeLinejoin="round"
					></g>
					<g id="SVGRepo_iconCarrier">
						<path
							d="M9 20H7C5.89543 20 5 19.1046 5 18V10.9199C5 10.336 5.25513 9.78132 5.69842 9.40136L10.6984 5.11564C11.4474 4.47366 12.5526 4.47366 13.3016 5.11564L18.3016 9.40136C18.7449 9.78132 19 10.336 19 10.9199V18C19 19.1046 18.1046 20 17 20H15M9 20V14C9 13.4477 9.44772 13 10 13H14C14.5523 13 15 13.4477 15 14V20M9 20H15"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						></path>
					</g>
				</svg>
			),
		},
		{
			id: "profile",
			label: "Profile",
			icon: (
				<svg
					className="w-7 sm:w-7 md:w-8 h-7 sm:h-7 md:h-8"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
					<g
						id="SVGRepo_tracerCarrier"
						strokeLinecap="round"
						strokeLinejoin="round"
						stroke="#CCCCCC"
						strokeWidth="0.144"
					></g>
					<g id="SVGRepo_iconCarrier">
						{" "}
						<path
							d="M5 20V19C5 16.2386 7.23858 14 10 14H14C16.7614 14 19 16.2386 19 19V20M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						></path>{" "}
					</g>
				</svg>
			),
		},
		{
			id: "education",
			label: "Education",
			icon: (
				<svg
					className="w-7 sm:w-7 md:w-8 h-7 sm:h-7 md:h-8"
					viewBox="0 0 128 128"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M25.6 59.7v27.7s18.6 10.7 37.5 10.7c19.5 0 39.3-10.7 39.3-10.7V59.7L64 76.8 25.6 59.7zm91.7 25.6v-6.4h-2.1V53.3l-6.4 4.3v21.3h-2.1v6.4h2.1l-4.3 21.3h14.9l-4.3-21.3h2.2zm-10.6-32L72.6 49s-6 1.9-8.5 2.1c-4.3.4-6.3-.7-6.4-4.3-.1-3.6.9-5.7 6.4-6.4 5.5-.7 8.5 4.3 8.5 4.3l40.5 6.4 14.9-6.4-64-23.4L0 44.8l64 27.7 42.7-19.2z"
						fill="currentColor"
					/>
				</svg>
			),
		},
		{
			id: "work",
			label: "Work",
			icon: (
				<svg
					className="w-7 sm:w-7 md:w-8 h-7 sm:h-7 md:h-8"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
					<g
						id="SVGRepo_tracerCarrier"
						strokeLinecap="round"
						strokeLinejoin="round"
					></g>
					<g id="SVGRepo_iconCarrier">
						{" "}
						<path
							d="M2 9C2 7.89543 2.89543 7 4 7H20C21.1046 7 22 7.89543 22 9V20C22 21.1046 21.1046 22 20 22H4C2.89543 22 2 21.1046 2 20V9Z"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						></path>{" "}
						<path
							d="M16 7V4C16 2.89543 15.1046 2 14 2H10C8.89543 2 8 2.89543 8 4V7"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						></path>{" "}
						<path
							d="M22 12H2"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						></path>{" "}
						<path
							d="M7 12V14"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						></path>{" "}
						<path
							d="M17 12V14"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						></path>{" "}
					</g>
				</svg>
			),
		},
		{
			id: "certificate",
			label: "Certificate",
			icon: (
				<svg
					className="w-7 sm:w-7 md:w-8 h-7 sm:h-7 md:h-8"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
					<g
						id="SVGRepo_tracerCarrier"
						strokeLinecap="round"
						strokeLinejoin="round"
					></g>
					<g id="SVGRepo_iconCarrier">
						<path
							d="M13 7L11.8845 4.76892C11.5634 4.1268 11.4029 3.80573 11.1634 3.57116C10.9516 3.36373 10.6963 3.20597 10.4161 3.10931C10.0992 3 9.74021 3 9.02229 3H5.2C4.0799 3 3.51984 3 3.09202 3.21799C2.71569 3.40973 2.40973 3.71569 2.21799 4.09202C2 4.51984 2 5.0799 2 6.2V7M2 7H17.2C18.8802 7 19.7202 7 20.362 7.32698C20.9265 7.6146 21.3854 8.07354 21.673 8.63803C22 9.27976 22 10.1198 22 11.8V16.2C22 17.8802 22 18.7202 21.673 19.362C21.3854 19.9265 20.9265 20.3854 20.362 20.673C19.7202 21 18.8802 21 17.2 21H6.8C5.11984 21 4.27976 21 3.63803 20.673C3.07354 20.3854 2.6146 19.9265 2.32698 19.362C2 18.7202 2 17.8802 2 16.2V7Z"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</g>
				</svg>
			),
		},
	];

	return (
		<motion.nav
			initial={{ y: 100, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			transition={{ duration: 0.6, ease: "easeInOut" }}
			onMouseMove={(e) => mouseX.set(e.pageX)}
			onMouseLeave={() => mouseX.set(Infinity)}
			className="
				fixed
				left-0
				right-0
				bottom-[calc(env(safe-area-inset-bottom)+1rem)]
				z-50
				flex
				justify-center
				pointer-events-none
			"
		>
			<style>{`
				/* Floating idle animation */
				@keyframes float {
					0%, 100% {
						transform: translateY(0px);
					}
					50% {
						transform: translateY(-2px);
					}
				}

				/* Tooltip fade in animation */
				@keyframes tooltipFadeIn {
					from {
						opacity: 0;
						transform: translateY(4px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}

				/* iOS 26 glassmorphism container - Enhanced */
				.glass-nav {
					background: rgba(255, 255, 255, 0.08);
					backdrop-filter: blur(80px) saturate(180%);
					-webkit-backdrop-filter: blur(80px) saturate(180%);
					box-shadow: 
						0 8px 32px rgba(0, 0, 0, 0.1),
						0 2px 8px rgba(0, 0, 0, 0.05),
						inset 0 1px 0 rgba(255, 255, 255, 0.3),
						inset 0 -1px 0 rgba(0, 0, 0, 0.05);
					animation: float 5s ease-in-out infinite;
				}

				/* Dark mode glassmorphism */
				.dark .glass-nav {
					background: rgba(31, 41, 55, 0.6);
					backdrop-filter: blur(80px) saturate(180%);
					-webkit-backdrop-filter: blur(80px) saturate(180%);
					box-shadow: 
						0 8px 32px rgba(0, 0, 0, 0.4),
						0 2px 8px rgba(0, 0, 0, 0.2),
						inset 0 1px 0 rgba(255, 255, 255, 0.1),
						inset 0 -1px 0 rgba(0, 0, 0, 0.3);
				}

				/* Tooltip label */
				.nav-tooltip {
					position: absolute;
					bottom: calc(100% + 12px);
					left: 50%;
					transform: translateX(-50%);
					background: rgba(20, 20, 20, 0.95);
					backdrop-filter: blur(20px);
					-webkit-backdrop-filter: blur(20px);
					color: white;
					padding: 6px 14px;
					border-radius: 12px;
					font-size: 13px;
					font-weight: 500;
					white-space: nowrap;
					pointer-events: none;
					opacity: 0;
					transition: opacity 1.2s ease;
					box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
					z-index: 100;
				}

				.dark .nav-tooltip {
					background: rgba(55, 65, 81, 0.95);
					backdrop-filter: blur(20px);
					-webkit-backdrop-filter: blur(20px);
					box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
				}

				.nav-button:hover .nav-tooltip,
				.nav-button-active:hover .nav-tooltip {
					opacity: 1;
					animation: tooltipFadeIn 1s ease forwards;
				}

				/* Active button state - iOS style */
				.nav-button-active {
					background: linear-gradient(135deg, #4b5563 0%, #52606d 100%);
					border: none;
					box-shadow: 
						0 4px 16px rgba(0, 0, 0, 0.18),
						0 2px 8px rgba(0, 0, 0, 0.12),
						inset 0 1px 2px rgba(255, 255, 255, 0.15);
					transform: scale(1.1);
					color: white;
					transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
				}

				.dark .nav-button-active {
					background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
					box-shadow: 
						0 4px 16px rgba(59, 130, 246, 0.3),
						0 2px 8px rgba(59, 130, 246, 0.2),
						inset 0 1px 2px rgba(255, 255, 255, 0.2);
					color: white;
				}

				/* Inactive button state */
				.nav-button {
					background: white;
					border: none;
					box-shadow: 
						0 2px 8px rgba(0, 0, 0, 0.08),
						0 1px 4px rgba(0, 0, 0, 0.06);
					color: #374151;
					transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
				}

				.dark .nav-button {
					background: rgba(55, 65, 81, 0.8);
					backdrop-filter: blur(8px);
					-webkit-backdrop-filter: blur(8px);
					box-shadow: 
						0 2px 8px rgba(0, 0, 0, 0.3),
						0 1px 4px rgba(0, 0, 0, 0.2),
						inset 0 1px 0 rgba(255, 255, 255, 0.1);
					color: #e5e7eb;
				}

				/* Hover effect with spring animation - iOS refined */
				.nav-button:hover {
					background: white;
					border: none;
					box-shadow: 
						0 6px 20px rgba(0, 0, 0, 0.12),
						0 3px 10px rgba(0, 0, 0, 0.08);
					transform: scale(1.15);
					color: #374151;
				}

				.dark .nav-button:hover {
					background: rgba(75, 85, 99, 0.9);
					backdrop-filter: blur(8px);
					-webkit-backdrop-filter: blur(8px);
					box-shadow: 
						0 6px 20px rgba(0, 0, 0, 0.4),
						0 3px 10px rgba(0, 0, 0, 0.3),
						inset 0 1px 0 rgba(255, 255, 255, 0.15);
					color: #f3f4f6;
				}

				.nav-button-active:hover {
					background: linear-gradient(135deg, #3f4551 0%, #475563 100%);
					border: none;
					transform: scale(1.18);
					box-shadow: 
						0 8px 24px rgba(0, 0, 0, 0.2),
						0 4px 12px rgba(0, 0, 0, 0.15);
					color: white;
				}

				.dark .nav-button-active:hover {
					background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
					box-shadow: 
						0 8px 24px rgba(59, 130, 246, 0.4),
						0 4px 12px rgba(59, 130, 246, 0.3),
						inset 0 1px 2px rgba(255, 255, 255, 0.25);
				}

				/* Neighboring icons scale effect */
				.nav-button.neighbor-scaled {
					transform: scale(0.92);
					opacity: 0.7;
					transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
				}

				.nav-button-active.neighbor-scaled {
					transform: scale(1.02);
					opacity: 0.85;
				}

				/* Click active state enhancement */
				.nav-button:active,
				.nav-button-active:active {
					transform: scale(1.05);
					transition-duration: 0.1s;
				}

				/* Smooth icon transitions */
				.nav-icon {
					transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
				}

				.nav-button:hover .nav-icon {
					transform: scale(1.25);
				}

				/* Performance optimizations */
				.glass-nav,
				.nav-button,
				.nav-button-active {
					will-change: transform;
					transform-origin: center;
				}

				/* Responsive adjustments */
				@media (hover: hover) {
					.nav-button:hover,
					.nav-button-active:hover {
						cursor: pointer;
					}
				}

				@media (hover: none) {
					.nav-button:hover,
					.nav-button-active:hover {
						transform: scale(1);
					}
				}
			`}</style>
			<div
				className="
					flex items-center
					gap-2 sm:gap-4 md:gap-5
					glass-nav
					rounded-full
					px-2 py-1.5
					sm:px-4 sm:py-2.5
					pointer-events-auto
					border border-gray-200 dark:border-gray-700
					overflow-visible
					isolate
				"
				style={{ contain: "layout" }}
			>
				{navItems.map((item, index) => {
					const isActive = active === item.id;

					return (
						<DockIcon
							key={item.id}
							mouseX={mouseX}
							item={item}
							index={index}
							isActive={isActive}
							onClick={() => {
								setActive(item.id);
								const element = document.getElementById(item.id);
								if (element) {
									// Update hash to trigger animation
									window.history.pushState(null, "", `#${item.id}`);

									// Get the element's position relative to the document
									const elementPosition =
										element.getBoundingClientRect().top + window.scrollY;
									// Scroll to the element
									window.scrollTo({
										top: elementPosition,
										behavior: "smooth",
									});

									// Trigger a custom event for animation reset
									window.dispatchEvent(new Event("hashchange"));
								}
							}}
							onMouseEnter={() => setHoveredIndex(index)}
							onMouseLeave={() => setHoveredIndex(null)}
						/>
					);
				})}
			</div>
		</motion.nav>
	);
}

export default NavBar;
