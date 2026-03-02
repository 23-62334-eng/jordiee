import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import portrait from "../assets/me/portrait.png";
import { useDarkMode } from "../context/DarkModeContext";

function AsciiPortrait({ className = "" }) {
	const asciiRef = useRef(null);
	const [isLoading, setIsLoading] = useState(true);
	const { isDark } = useDarkMode();

	useEffect(() => {
		const ascii = asciiRef.current;
		if (!ascii) return;

		const img = new Image();
		img.src = portrait;

		const isDarkMode = isDark;

		img.onload = () => {
			setIsLoading(false);
			render();
		};

		// Extended grayscale ramp (smooth transitions)
		const chars =
			" .'`^\",:;Il!i~+_-?][}{1)(|\\/*tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

		function render() {
			const containerRect = ascii.getBoundingClientRect();
			const screenW = containerRect.width || 320;
			const screenH = containerRect.height || 480;

			const fontSize = 1.4;
			const lineHeight = fontSize * 0.85;

			ascii.style.fontSize = fontSize + "px";
			ascii.style.lineHeight = lineHeight + "px";
			ascii.style.letterSpacing = "0px";

			// Fill the full container
			const finalCols = Math.floor(screenW / (fontSize * 0.6));
			const finalRows = Math.floor(screenH / lineHeight);

			// Use the original image aspect ratio for cropping
			const imageRatio = img.width / img.height;
			const gridRatio = finalCols / finalRows;

			let cropWidth, cropHeight, cropX, cropY;
			if (imageRatio > gridRatio) {
				cropHeight = img.height;
				cropWidth = img.height * gridRatio;
				cropX = (img.width - cropWidth) / 2;
				cropY = 0;
			} else {
				cropWidth = img.width;
				cropHeight = img.width / gridRatio;
				cropX = 0;
				cropY = (img.height - cropHeight) / 2;
			}

			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");

			canvas.width = finalCols;
			canvas.height = finalRows;

			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = "high";
			ctx.drawImage(
				img,
				cropX,
				cropY,
				cropWidth,
				cropHeight,
				0,
				0,
				finalCols,
				finalRows,
			);

			const data = ctx.getImageData(0, 0, finalCols, finalRows).data;

			let result = "";

			// Oval masking: ellipse with full width and height
			const centerX = finalCols / 2;
			const centerY = finalRows / 2;
			const radiusX = finalCols / 2;
			const radiusY = finalRows / 2;

			for (let y = 0; y < finalRows; y++) {
				for (let x = 0; x < finalCols; x++) {
					// Check if point is inside the oval
					const dx = (x - centerX) / radiusX;
					const dy = (y - centerY) / radiusY;
					const inOval = dx * dx + dy * dy <= 1;

					if (inOval) {
						const i = (y * finalCols + x) * 4;

						let r = data[i];
						let g = data[i + 1];
						let b = data[i + 2];

						// Convert to grayscale
						let brightness = 0.299 * r + 0.587 * g + 0.114 * b;

						// Enhanced shadow lift
						brightness = brightness * 0.97 + 10;

						// Gamma correction for photorealistic tones
						brightness = 255 * Math.pow(brightness / 255, 0.8);

						// Strong contrast for fine detail
						brightness = (brightness - 128) * 1.4 + 128;

						brightness = Math.max(0, Math.min(255, brightness));

						const charIndex = Math.floor(
							(brightness / 255) * (chars.length - 1),
						);

						result += chars[charIndex];
					} else {
						result += " ";
					}
				}
				result += "\n";
			}

			ascii.textContent = result;
		}

		const handleResize = () => {
			if (!isLoading) render();
		};

		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
		};
	}, [isLoading, isDark]);

	return (
		<motion.div
			className={`relative overflow-hidden ${className}`}
			style={{
				borderRadius: "50%",
				background: isDark ? "transparent" : "#0a0a0a",
			}}
			whileHover={{
				scale: 1.05,
				boxShadow: isDark
					? "0 0 40px 8px rgba(212, 197, 185, 0.25), 0 0 80px 16px rgba(212, 197, 185, 0.1)"
					: "0 0 40px 10px rgba(0, 0, 0, 0.35), 0 0 80px 20px rgba(0, 0, 0, 0.15), 0 0 120px 30px rgba(59, 130, 246, 0.08)",
				filter: isDark ? "brightness(1.15)" : "brightness(1.25)",
			}}
			transition={{ duration: 0.4, ease: "easeOut" }}
		>
			{isLoading && (
				<div className="absolute inset-0 flex items-center justify-center text-gray-400">
					<div className="text-center">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-2"></div>
						<div className="text-sm">Loading...</div>
					</div>
				</div>
			)}

			<div
				ref={asciiRef}
				className="w-full h-full flex items-center justify-center"
				style={{
					fontFamily: '"Courier New", monospace',
					whiteSpace: "pre",
					color: isDark ? "#d4c5b9" : "#e0e0e0",
					textAlign: "center",
					filter: isDark
						? "contrast(150%) brightness(1.2)"
						: "contrast(150%) brightness(1.2)",
					textShadow: isDark
						? "0 0 0.3px rgba(0, 0, 0, 0.5)"
						: "0 0 0.3px rgba(255, 255, 255, 0.3)",
					fontWeight: "600",
					overflow: "hidden",
					background: "transparent",
				}}
			/>
		</motion.div>
	);
}

export default AsciiPortrait;
