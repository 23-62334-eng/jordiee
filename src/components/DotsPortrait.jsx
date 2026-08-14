import portraitDots from "../assets/me/portrait-dots.svg";

// The halftone is applied as a CSS mask rather than an <img>, so the element's
// own background becomes the ink — one asset, no second colour variant.
//
// The ink stays dark in both themes on purpose. A halftone encodes tone as dot
// *density*, so lightening the ink for dark mode does not recolour the image,
// it inverts it: dense areas become bright and the face reads as an X-ray
// negative. Instead the artwork keeps its paper, which is the page itself in
// light mode and a soft card in dark mode.
const maskStyle = {
	maskImage: `url(${portraitDots})`,
	WebkitMaskImage: `url(${portraitDots})`,
	// "cover" so the artwork fills a non-square box; "contain" would
	// letterbox it inside the oval with dead white space.
	maskSize: "cover",
	WebkitMaskSize: "cover",
	maskRepeat: "no-repeat",
	WebkitMaskRepeat: "no-repeat",
	maskPosition: "center",
	WebkitMaskPosition: "center",
};

function DotsPortrait({ className = "" }) {
	return (
		<div
			// Paper stays white in both themes: the ink is black, so a black
			// paper would invert the halftone. overflow-hidden is what actually
			// crops the dots to the circle — border-radius alone would leave
			// the masked corners showing.
			className={`relative overflow-hidden rounded-full bg-white ${className}`}
		>
			<div
				role="img"
				aria-label="Halftone dot portrait of Mark Jordan Javier"
				className="w-full h-full select-none pointer-events-none bg-gray-900"
				style={maskStyle}
			/>
		</div>
	);
}

export default DotsPortrait;
