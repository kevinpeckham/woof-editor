/**
 * Adjust an anchored popover's `{x, y}` so its full bounding rect stays
 * within the viewport. Handles all four edges:
 *
 *   - Right overflow → shifts left so the right edge sits inside.
 *   - Left overflow → clamps to a small gutter from the left edge.
 *   - Bottom overflow → flips above the anchor if there's room, else
 *     clamps to a gutter from the top.
 *   - Top overflow → clamps to the gutter.
 *
 * Designed for click-anchored menus where the click point is the
 * intended top-left corner. The popover is assumed to grow down-right
 * from that point; bottom overflow triggers a "flip up" attempt
 * (anchor.y - size.height) before clamping, which preserves the
 * intended anchor direction when possible.
 *
 * Both `anchor` and `size` are in viewport (client) pixel space.
 *
 * @example
 *   const adjusted = fitPopoverToViewport(
 *     { x: e.clientX, y: e.clientY },
 *     { width: rect.width, height: rect.height },
 *   );
 *   menuPosition = adjusted;
 */
export function fitPopoverToViewport(
	anchor: { x: number; y: number },
	size: { width: number; height: number },
	options: {
		/** Margin from the viewport edge. Default 8. */
		gutter?: number;
		/** Override the viewport size (e.g. for testing). */
		viewport?: { width: number; height: number };
	} = {},
): { x: number; y: number } {
	const gutter = options.gutter ?? 8;
	const vw = options.viewport?.width ?? (typeof window !== "undefined" ? window.innerWidth : 1920);
	const vh =
		options.viewport?.height ?? (typeof window !== "undefined" ? window.innerHeight : 1080);

	let x = anchor.x;
	let y = anchor.y;

	// Right overflow → shift left to fit.
	if (x + size.width + gutter > vw) {
		x = vw - size.width - gutter;
	}
	// Left clamp.
	if (x < gutter) x = gutter;

	// Bottom overflow → try flipping above the anchor first, else clamp.
	if (y + size.height + gutter > vh) {
		const flipped = anchor.y - size.height - gutter;
		if (flipped >= gutter) {
			y = flipped;
		} else {
			y = vh - size.height - gutter;
		}
	}
	// Top clamp.
	if (y < gutter) y = gutter;

	return { x, y };
}
