// Projected path segments use CSS pixels, so the target stays usable as the view zooms.
export function closestWireSegment(points, x, y, radius) {
  let best = null;
  let bestDistance = radius * radius;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length2 = dx * dx + dy * dy;
    const t = length2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length2)) : 0;
    const nearX = a.x + t * dx;
    const nearY = a.y + t * dy;
    const distance2 = (x - nearX) ** 2 + (y - nearY) ** 2;
    if (distance2 >= bestDistance) continue;
    bestDistance = distance2;
    best = { index: index - 1, t, x: nearX, y: nearY, distance2 };
  }
  return best;
}

export function compareWireHits(a, b) {
  return a.distance2 - b.distance2 || (a.depth ?? 0) - (b.depth ?? 0) || (a.id < b.id ? -1 : Number(a.id > b.id));
}

export function distinctPickTargets(targets) {
  const seen = new Set();
  return targets.filter(({kind, id}) => {
    if (!id) return false;
    const key = kind + ':' + id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
