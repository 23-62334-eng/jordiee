import {
	FaGithub,
	FaLinkedin,
	FaFacebook,
	FaEnvelope,
	FaMapMarkerAlt,
	FaCertificate,
} from "react-icons/fa";
import { useState, useEffect } from "react";

function Home() {
	const fullText = "Full Stack Web Developer";
	const [displayedText, setDisplayedText] = useState("");

	useEffect(() => {
		let index = 0;
		const interval = setInterval(() => {
			if (index < fullText.length) {
				setDisplayedText(fullText.slice(0, index + 1));
				index++;
			} else {
				clearInterval(interval);
			}
		}, 80);

		return () => clearInterval(interval);
	}, []);

	return (
		<section id="home" className="min-h-screen">
			<div className="min-h-screen flex items-center justify-center  px-4 sm:px-6">
				<style>{`
				.typing-cursor {
					animation: blink 0.7s infinite;
				}
				@keyframes blink {
					0%, 49% {
						opacity: 1;
					}
					50%, 100% {
						opacity: 0;
					}
				}
			`}</style>
				<div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
					{/* TOP IMAGE FOR MOBILE */}
					<div className="md:hidden flex justify-center order-first -mt-24 sm:-mt-20 mb-8 sm:mb-12">
						<div className="relative rounded-full overflow-hidden w-64 h-64 sm:w-72 sm:h-72 border-4 border-gray-300 shadow-2xl hover:shadow-3xl transition-shadow duration-500 group">
							<img
								src="/src/assets/me/jordie.jpg"
								alt="Profile"
								className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
							/>

							{/* Overlay Shine Effect */}
							<div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

							{/* Subtle Inner Glow */}
							<div className="absolute inset-0 rounded-full shadow-inner shadow-blue-500/20"></div>
						</div>
					</div>

					{/* LEFT CONTENT */}
					<div>
						<div className="flex items-center gap-3 mb-4 flex-wrap">
							{/* Name */}
							<span className="px-4 py-1 text-xl sm:text-2xl font-bold rounded-full bg-gray-300 text-gray-700">
								Mark Jordan Javier
							</span>

							{/* Certified Badge with polish */}
							<div
								className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 hover:scale-110 transition transform relative"
								title="Certified Developer"
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

								{/* Optional Glow Pulse */}
								<span className="absolute inset-0 rounded-full bg-blue-300 opacity-30 animate-ping"></span>
							</div>
						</div>

						<div className="flex items-center gap-2 text-gray-600 mb-3 text-base sm:text-lg">
							<FaMapMarkerAlt className="text-gray-500" />
							<span>Batangas, Philippines</span>
						</div>

						<h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
							{displayedText}
							<span className="typing-cursor">|</span>
						</h1>
						<p className="mt-5 text-gray-600 max-w-lg text-base sm:text-lg">
							A BS Information Technology student from Batangas State University
							- TNEU.
						</p>

						{/* Resume Download Button */}
						<div className="fade-up-element mt-6 sm:mt-8">
							<a
								href="/src/RESUME.pdf"
								download
								className="
                            group relative inline-block
                            font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-full
                            text-gray-600 text-sm sm:text-base
                            bg-gradient-to-br from-gray-100 to-gray-200
                            shadow-lg overflow-hidden
                            transition-all duration-300 ease-out
                            hover:-translate-y-1 hover:shadow-xl
                            active:scale-95 
                        "
							>
								{/* Glow overlay */}
								<span
									className="
                            absolute inset-0 rounded-full 
                            bg-gradient-to-tr from-gray-400/30 to-transparent 
                            opacity-0 group-hover:opacity-100 
                            transition duration-500
                        "
								></span>

								{/* Button Content */}
								<span className="relative flex items-center gap-1 sm:gap-2">
									<span className="text-base sm:text-lg">📄</span>
									<span>Download Resume</span>
								</span>
							</a>
						</div>

						{/* SOCIAL ICONS */}
						<div className="mt-6 flex items-center gap-5 text-2xl sm:text-3xl">
							<a
								href="https://www.facebook.com/markjordan.javier"
								target="_blank"
								className="hover:text-blue-600 text-gray-700 transition duration-300 transform hover:scale-110"
							>
								<FaFacebook />
							</a>

							<a
								href="https://github.com/Jordieeeee"
								target="_blank"
								className="hover:text-gray-900 text-gray-700 transition duration-300 transform hover:scale-110"
							>
								<FaGithub />
							</a>

							<a
								href="https://www.linkedin.com/in/mark-jordan-javier-29b72935a/"
								target="_blank"
								className="hover:text-blue-500 text-gray-700 transition duration-300 transform hover:scale-110"
							>
								<FaLinkedin />
							</a>

							<a
								href="mailto:javiermarkjordan@email.com"
								className="hover:text-red-500 text-gray-700 transition duration-300 transform hover:scale-110"
							>
								<FaEnvelope />
							</a>
						</div>
					</div>

					{/* RIGHT IMAGE FOR DESKTOP */}
					<div className="hidden md:flex justify-center">
						<div className="relative rounded-full overflow-hidden w-80 h-80 border-4 border-gray-300 shadow-2xl hover:shadow-3xl transition-shadow duration-500 group">
							<img
								src="/src/assets/me/jordie.jpg"
								alt="Profile"
								className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
							/>

							{/* Overlay Shine Effect */}
							<div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

							{/* Subtle Inner Glow */}
							<div className="absolute inset-0 rounded-full shadow-inner shadow-blue-500/20"></div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

export default Home;
