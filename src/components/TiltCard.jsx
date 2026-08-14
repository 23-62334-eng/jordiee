import { motion } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import { useDarkMode } from "../context/DarkModeContext";

function TiltCard({
	children,
	className = "",
	variants,
	style = {},
	borderRadius = "rounded-2xl",
	borderRadiusStyle,
	tiltDegree = 12,
	scale = 1.04,
	glareOpacity = 0.25,
	// Lets a card be rendered as a real control (e.g. as="button") and pass
	// through onClick/aria-*; without this the extra props were dropped
	// silently and the card looked interactive but did nothing.
	as = "div",
	...rest
}) {
	const Tag = motion[as] ?? motion.div;
	const cardRef = useRef(null);
	const glareRef = useRef(null);
	const rafRef = useRef(null);
	const [isHovered, setIsHovered] = useState(false);
	const { isDark } = useDarkMode();

	const handleMouseMove = useCallback(
		(e) => {
			if (!cardRef.current) return;
			if (rafRef.current) cancelAnimationFrame(rafRef.current);

			rafRef.current = requestAnimationFrame(() => {
				const rect = cardRef.current.getBoundingClientRect();
				const x = e.clientX - rect.left;
				const y = e.clientY - rect.top;
				const centerX = rect.width / 2;
				const centerY = rect.height / 2;

				const rotateX = ((y - centerY) / centerY) * -tiltDegree;
				const rotateY = ((x - centerX) / centerX) * tiltDegree;

				cardRef.current.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`;

				if (glareRef.current) {
					const glareX = (x / rect.width) * 100;
					const glareY = (y / rect.height) * 100;
					glareRef.current.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,${glareOpacity}) 0%, rgba(255,255,255,${glareOpacity * 0.4}) 30%, transparent 70%)`;
				}
			});
		},
		[tiltDegree, scale, glareOpacity],
	);

	const handleMouseEnter = useCallback(() => {
		setIsHovered(true);
		if (cardRef.current) {
			cardRef.current.style.transition = "transform 0.15s ease-out";
		}
	}, []);

	const handleMouseLeave = useCallback(() => {
		setIsHovered(false);
		if (rafRef.current) cancelAnimationFrame(rafRef.current);
		if (cardRef.current) {
			cardRef.current.style.transition = "transform 0.5s ease-out";
			cardRef.current.style.transform =
				"perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
		}
		if (glareRef.current) {
			glareRef.current.style.background = "transparent";
		}
	}, []);

	useEffect(() => {
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, []);

	return (
		<Tag
			variants={variants}
			ref={cardRef}
			{...rest}
			onMouseMove={handleMouseMove}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			// The radius has to reach the root too, or the hover box-shadow is
			// drawn around a square box regardless of the card's actual shape.
			className={`${borderRadiusStyle ? "" : borderRadius} ${className}`}
			style={{
				...(borderRadiusStyle ? { borderRadius: borderRadiusStyle } : {}),
				transformStyle: "preserve-3d",
				// Only promote to its own compositor layer while the tilt is
				// actually running. Leaving it on parks a GPU layer per card for
				// the life of the page, which is what made scrolling past the
				// project grid stutter.
				willChange: isHovered ? "transform" : "auto",
				transition: "box-shadow 0.4s ease-out",
				boxShadow: isHovered
					? isDark
						? "0 25px 70px -10px rgba(200,200,210,0.35), 0 10px 30px -8px rgba(200,200,210,0.25), 0 0 20px rgba(200,200,210,0.12)"
						: "0 25px 70px -10px rgba(0,0,0,0.5), 0 10px 30px -8px rgba(0,0,0,0.35), 0 0 20px rgba(0,0,0,0.1)"
					: "0 0 0 0 transparent",
				...style,
			}}
		>
			{children}
			{/* Glare overlay */}
			<div
				ref={glareRef}
				className={`absolute inset-0 ${borderRadiusStyle ? "" : borderRadius} pointer-events-none z-20 overflow-hidden transition-opacity duration-300 ${isHovered ? "opacity-100" : "opacity-0"}`}
				style={
					borderRadiusStyle ? { borderRadius: borderRadiusStyle } : undefined
				}
			/>
			{/* Edge light effect */}
			<div
				className={`absolute inset-0 ${borderRadiusStyle ? "" : borderRadius} pointer-events-none z-10 overflow-hidden transition-opacity duration-300 ${isHovered ? "opacity-100" : "opacity-0"}`}
				style={{
					...(borderRadiusStyle ? { borderRadius: borderRadiusStyle } : {}),
					boxShadow:
						"inset 0 0 30px rgba(255,255,255,0.08), 0 15px 40px -10px rgba(0,0,0,0.3)",
				}}
			/>
		</Tag>
	);
}

export default TiltCard;
