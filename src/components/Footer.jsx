import { motion } from "framer-motion";
import {
	FaGithub,
	FaLinkedin,
	FaFacebook,
	FaEnvelope,
	FaMapMarkerAlt,
	FaInstagram,
} from "react-icons/fa";

function Footer() {
	const currentYear = new Date().getFullYear();

	return (
		<footer className="relative bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 border-t border-gray-200 dark:border-gray-700">
			<div className="max-w-6xl mx-auto px-6 py-12">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
					{/* About Section */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, ease: "easeOut" }}
					>
						<h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
							Mark Jordan Javier
						</h3>
						<p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
							Full Stack Web Developer passionate about creating modern,
							functional web applications.
						</p>
					</motion.div>

					{/* Connect Section */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
					>
						<h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
							Social Links
						</h3>
						<div className="flex gap-4">
							<a
								href="https://www.facebook.com/markjordan.javier"
								target="_blank"
								rel="noopener noreferrer"
								className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-300 transform hover:scale-110"
							>
								<FaFacebook size={24} />
							</a>
							<a
								href="https://www.instagram.com/jordieeeee_"
								target="_blank"
								rel="noopener noreferrer"
								className="text-gray-600 dark:text-gray-400 hover:text-pink-500 dark:hover:text-pink-400 transition-colors duration-300 transform hover:scale-110"
							>
								<FaInstagram size={24} />
							</a>
							<a
								href="https://github.com/Jordieeeee"
								target="_blank"
								rel="noopener noreferrer"
								className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-300 transform hover:scale-110"
							>
								<FaGithub size={24} />
							</a>
							<a
								href="https://www.linkedin.com/in/mark-jordan-javier-29b72935a/"
								target="_blank"
								rel="noopener noreferrer"
								className="text-gray-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-300 transform hover:scale-110"
							>
								<FaLinkedin size={24} />
							</a>
						</div>
					</motion.div>

					{/* Get in Touch */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
					>
						<h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
							Get in Touch
						</h3>
						<div className="space-y-3">
							<div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
								<FaEnvelope className="text-gray-500 dark:text-gray-400" />
								<a
									href="mailto:javiermarkjordan@email.com"
									className="hover:text-gray-900 dark:hover:text-white transition-colors duration-300 hover:underline"
								>
									javiermarkjordan@email.com
								</a>
							</div>
							<div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
								<FaMapMarkerAlt className="text-gray-500 dark:text-gray-400" />
								<span>Batangas, Philippines</span>
							</div>
						</div>
					</motion.div>
				</div>

				{/* Divider */}
				<div className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent mb-6" />

				{/* Bottom Section */}
				<motion.div
					initial={{ opacity: 0 }}
					whileInView={{ opacity: 1 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
					className="flex flex-col md:flex-row items-center justify-between gap-4"
				>
					<p className="text-gray-600 dark:text-gray-400 text-sm text-center md:text-left">
						© {currentYear} Mark Jordan Javier. All rights reserved.
					</p>
				</motion.div>
			</div>
		</footer>
	);
}

export default Footer;
