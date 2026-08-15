/**
 * Render the segmented prose from profile.json.
 *
 * Some paragraphs in the source interleave <span> emphasis mid-sentence, so
 * profile.json stores them as verbatim segments rather than one flat string —
 * that keeps every fragment traceable to the component it came from, and
 * preserves the emphasis instead of flattening it away.
 */
export default function RichText({ segments, emphasisClassName = "font-semibold text-gray-900 dark:text-white" }) {
	return segments.map((seg, i) =>
		seg.emphasis ? (
			<span key={i} className={emphasisClassName}>
				{seg.text}
			</span>
		) : (
			<span key={i}>{seg.text}</span>
		),
	);
}
