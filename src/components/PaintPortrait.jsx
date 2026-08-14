import portraitPaint from "../assets/me/me-paint.jpg";

// Rasterised from assets/me/me_paint.svg. The source vector is 5.7 MB across
// ~9,900 paths, for a portrait that renders at most 384px wide — 27x more
// bytes than the pixels can show, re-rasterised on every resize. This is the
// same artwork at 900x900 (well over 2x the display size), as JPEG: the
// painterly texture compresses cleanly and nothing here needs transparency.
//
// Plain <img> rather than the CSS mask the halftone used, since that paints a
// single flat colour through a stencil and would flatten every tone.
function PaintPortrait({ className = "" }) {
	return (
		// object-cover: the painting fills the oval edge to edge. The source is
		// square and the frame is a 4:5 oval, so the sides are cropped — which
		// is what brings the face up to fill the frame. bg-white only shows
		// while the image is still loading.
		<div
			className={`relative overflow-hidden rounded-full bg-white ${className}`}
		>
			<img
				src={portraitPaint}
				alt="Painted portrait of Mark Jordan Javier"
				width={900}
				height={900}
				draggable={false}
				className="w-full h-full object-cover select-none pointer-events-none"
			/>
		</div>
	);
}

export default PaintPortrait;
