import { useState, useEffect } from "react";

function NavBar() {
	const [active, setActive] = useState("home");

	useEffect(() => {
		const sections = document.querySelectorAll("section");

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						setActive(entry.target.id);
					}
				});
			},
			{ threshold: 0.6 }
		);

		sections.forEach((section) => observer.observe(section));

		return () => observer.disconnect();
	}, []);

	const navItems = [
		{
			id: "home",
			label: "Home",
			icon: (
				<svg
					className="w-6 sm:w-8 md:w-10 h-6 sm:h-8 md:h-10"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<g id="SVGRepo_bgCarrier" stroke-width="0"></g>
					<g
						id="SVGRepo_tracerCarrier"
						stroke-linecap="round"
						stroke-linejoin="round"
					></g>
					<g id="SVGRepo_iconCarrier">
						<path
							d="M9 20H7C5.89543 20 5 19.1046 5 18V10.9199C5 10.336 5.25513 9.78132 5.69842 9.40136L10.6984 5.11564C11.4474 4.47366 12.5526 4.47366 13.3016 5.11564L18.3016 9.40136C18.7449 9.78132 19 10.336 19 10.9199V18C19 19.1046 18.1046 20 17 20H15M9 20V14C9 13.4477 9.44772 13 10 13H14C14.5523 13 15 13.4477 15 14V20M9 20H15"
							stroke="currentColor"
							stroke-linecap="round"
							stroke-linejoin="round"
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
					className="w-6 sm:w-8 md:w-10 h-6 sm:h-8 md:h-10"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<g id="SVGRepo_bgCarrier" stroke-width="0"></g>
					<g
						id="SVGRepo_tracerCarrier"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke="#CCCCCC"
						stroke-width="0.144"
					></g>
					<g id="SVGRepo_iconCarrier">
						{" "}
						<path
							d="M5 20V19C5 16.2386 7.23858 14 10 14H14C16.7614 14 19 16.2386 19 19V20M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z"
							stroke="currentColor"
							stroke-width="0.9600000000000002"
							stroke-linecap="round"
							stroke-linejoin="round"
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
					className="w-6 sm:w-8 md:w-10 h-6 sm:h-8 md:h-10"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
					fill="#000000"
				>
					<g id="SVGRepo_bgCarrier" stroke-width="0"></g>
					<g
						id="SVGRepo_tracerCarrier"
						stroke-linecap="round"
						stroke-linejoin="round"
					></g>
					<g id="SVGRepo_iconCarrier">
						<path
							d="M17.673 5.606a3326.02 3326.02 0 0 1-5.671-2.674L.138 8.524l2.03.98L2 9.531V20h1v-9.626l.72-.124.28.135v5.288c0 .914 5.206 3.533 6.249 4.049a3.89 3.89 0 0 0 3.48-.026C20 16.486 20 15.895 20 15.673v-5.288l3.854-1.857s-3.8-1.801-6.181-2.922zM19 15.504a51.526 51.526 0 0 1-5.726 3.302 2.884 2.884 0 0 1-2.582.02A40.184 40.184 0 0 1 5 15.521v-4.655l7 3.373 7-3.373zm-7-2.373L5.416 9.958l6.469-1.115-.17-.987-7.85 1.354-1.403-.676 9.537-4.495c.825.393 8.523 4.014 9.542 4.494z"
							fill="currentColor"
						></path>
						<path fill="none" d="M0 0h24v24H0z"></path>
					</g>
				</svg>
			),
		},
		{
			id: "work",
			label: "Work",
			icon: (
				<svg
					className="w-6 sm:w-7 md:w-9 h-6 sm:h-7 md:h-9"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<g id="SVGRepo_bgCarrier" stroke-width="0"></g>
					<g
						id="SVGRepo_tracerCarrier"
						stroke-linecap="round"
						stroke-linejoin="round"
					></g>
					<g id="SVGRepo_iconCarrier">
						{" "}
						<path
							d="M2 9C2 7.89543 2.89543 7 4 7H20C21.1046 7 22 7.89543 22 9V20C22 21.1046 21.1046 22 20 22H4C2.89543 22 2 21.1046 2 20V9Z"
							stroke="currentColor"
							stroke-width="0.9600000000000002"
							stroke-linecap="round"
							stroke-linejoin="round"
						></path>{" "}
						<path
							d="M16 7V4C16 2.89543 15.1046 2 14 2H10C8.89543 2 8 2.89543 8 4V7"
							stroke="currentColor"
							stroke-width="0.9600000000000002"
							stroke-linecap="round"
							stroke-linejoin="round"
						></path>{" "}
						<path
							d="M22 12H2"
							stroke="currentColor"
							stroke-width="0.9600000000000002"
							stroke-linecap="round"
							stroke-linejoin="round"
						></path>{" "}
						<path
							d="M7 12V14"
							stroke="currentColor"
							stroke-width="0.9600000000000002"
							stroke-linecap="round"
							stroke-linejoin="round"
						></path>{" "}
						<path
							d="M17 12V14"
							stroke="currentColor"
							stroke-width="0.9600000000000002"
							stroke-linecap="round"
							stroke-linejoin="round"
						></path>{" "}
					</g>
				</svg>
			),
		},
		{
			id: "menu",
			label: "Menu",
			icon: (
				<svg
					className="w-6 sm:w-7 md:w-9 h-6 sm:h-7 md:h-9"
					viewBox="0 0 192 192"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					stroke="#000000"
					stroke-width="0.0019200000000000003"
				>
					<g id="SVGRepo_bgCarrier" stroke-width="0"></g>
					<g
						id="SVGRepo_tracerCarrier"
						stroke-linecap="round"
						stroke-linejoin="round"
					></g>
					<g id="SVGRepo_iconCarrier">
						<path
							fill="currentColor"
							d="m80 38 4.243-4.243A6 6 0 0 0 80 32v6Zm16 16-4.243 4.243A6 6 0 0 0 96 60v-6Zm58 94H38v12h116v-12ZM28 138V54H16v84h12Zm10-94h42V32H38v12Zm37.757-1.757 16 16 8.486-8.486-16-16-8.486 8.486ZM164 70v68h12V70h-12ZM96 60h58V48H96v12Zm-58 88c-5.523 0-10-4.477-10-10H16c0 12.15 9.85 22 22 22v-12Zm116 12c12.15 0 22-9.85 22-22h-12c0 5.523-4.477 10-10 10v12Zm22-90c0-12.15-9.85-22-22-22v12c5.523 0 10 4.477 10 10h12ZM28 54c0-5.523 4.477-10 10-10V32c-12.15 0-22 9.85-22 22h12Z"
						></path>
					</g>
				</svg>
			),
		},
	];

	return (
		<nav className="fixed bottom-0 left-0 right-0 flex items-center justify-center pb-6 sm:pb-8 md:pb-12 pointer-events-none">
			<style>{`
				.glass-nav {
					background: #ffffff1a;
					backdrop-filter: blur(10px);
					-webkit-backdrop-filter: blur(10px);
					border: 1px solid #ffffffff;
					box-shadow: 0 8px 32px 0 #1f2687199, inset 0 1px 1px #ffffff80;
				}
				.glass-button-active {
					background: #4b5563; /* gray-600 */
					border: 1px solid #ffffff4d;
					backdrop-filter: blur(10px);
					-webkit-backdrop-filter: blur(10px);
					box-shadow: 
						0 8px 16px #0f172a33,
						inset 0 1px 1px #ffffff4d;
					transition: all 0.3s ease;
				}
				.glass-button-active:hover {
					transform: scale(1.15);
					box-shadow: 0 12px 20px #0f172a4d;
				}

				.glass-button-inactive {
					background: transparent;
					border: 2px solid #ffffffff;
					backdrop-filter: none;
					-webkit-backdrop-filter: none;
					box-shadow: none;
					color: #4b5563;
					transition: all 0.3s ease;
				}
				.glass-button-inactive:hover {
					background: #ffffff40;
					box-shadow: 0 4px 12px #0f172a19, inset 0 1px 1px #ffffff4d;
					transform: scale(1.15);
					color: #4b5563;
				}
			`}</style>
			<div className="flex items-center gap-3 sm:gap-4 md:gap-6 glass-nav rounded-full px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 pointer-events-auto">
				{navItems.map((item) => (
					<button
						key={item.id}
						onClick={() => {
							setActive(item.id);
							document.getElementById(item.id)?.scrollIntoView({
								behavior: "smooth",
								block: "start",
							});
						}}
						aria-label={item.label}
						className={`flex items-center justify-center w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 rounded-full transition-all duration-300 ${
							active === item.id
								? "glass-button-active text-white"
								: "glass-button-inactive"
						}`}
					>
						{item.icon}
					</button>
				))}
			</div>
		</nav>
	);
}

export default NavBar;
