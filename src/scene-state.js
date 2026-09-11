// Distance is measured from the edge of the CTA, not its center.
// The outer 16px margin prevents the line flickering at the zone boundary.
export function proximityPose(point, rect, wasNear = false) {
  const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
  const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
  const distance = Math.hypot(dx, dy);
  const near = distance <= (wasNear ? 176 : 160);
  return { near, progress: near ? Math.max(.08, Math.round((1 - distance / 176) * 100) / 100) : 0 };
}

export function sceneState({ near = false, progress = 0, focused = false, hovered = false, leaving = false } = {}) {
  if (focused || hovered || leaving) return { mood: "ready", anticipation: 1 };
  if (near) return { mood: "hopeful", anticipation: Math.min(.8, progress * .8) };
  return { mood: "resigned", anticipation: 0 };
}
