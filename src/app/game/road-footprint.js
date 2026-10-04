// Normalized top-down rectangles; y grows south, as it does on the map.
export const SURFACE_TILE_SIZE = 1.002;
export const ROAD_HALF_WIDTH = .29;
export function roadRectangles(mask) {
 const edge = .5 - ROAD_HALF_WIDTH, width = ROAD_HALF_WIDTH * 2;
 const rectangles = [[edge, edge, width, width]];
 if (mask & 1) rectangles.push([edge, 0, width, .5]);
 if (mask & 2) rectangles.push([.5, edge, .5, width]);
 if (mask & 4) rectangles.push([edge, .5, width, .5]);
 if (mask & 8) rectangles.push([0, edge, .5, width]);
 return rectangles;
}
export function roadContains(mask, x, z) {
 return roadRectangles(mask).some(([left, top, width, height]) =>
  x >= left && x <= left + width && z >= top && z <= top + height);
}
export function roadFragmentMask(mask) {
 const number = n => n.toFixed(8);
 const tests = roadRectangles(mask).map(([x, z, w, h]) =>
  `(p.x>=${number(x)}&&p.x<=${number(x+w)}&&p.y>=${number(1-z-h)}&&p.y<=${number(1-z)})`);
 return `bool onRoad(vec2 p){return ${tests.join('||')};}`;
}
