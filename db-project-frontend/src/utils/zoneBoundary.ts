type Position = [number, number];
type LinearRing = Position[];

type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: LinearRing[];
};

type GeoJsonMultiPolygon = {
  type: "MultiPolygon";
  coordinates: LinearRing[][];
};

export type ZoneBoundary = GeoJsonPolygon | GeoJsonMultiPolygon | null | undefined;

const EPSILON = 1e-10;

const isPointOnSegment = (
  longitude: number,
  latitude: number,
  start: Position,
  end: Position
) => {
  const [startLng, startLat] = start;
  const [endLng, endLat] = end;
  const cross =
    (latitude - startLat) * (endLng - startLng) -
    (longitude - startLng) * (endLat - startLat);

  if (Math.abs(cross) > EPSILON) return false;

  const dot =
    (longitude - startLng) * (endLng - startLng) +
    (latitude - startLat) * (endLat - startLat);
  if (dot < -EPSILON) return false;

  const squaredLength =
    (endLng - startLng) * (endLng - startLng) +
    (endLat - startLat) * (endLat - startLat);

  return dot <= squaredLength + EPSILON;
};

const isPointInRing = (longitude: number, latitude: number, ring: LinearRing) => {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const current = ring[i];
    const previous = ring[j];

    if (isPointOnSegment(longitude, latitude, previous, current)) {
      return true;
    }

    const [currentLng, currentLat] = current;
    const [previousLng, previousLat] = previous;
    const intersects =
      currentLat > latitude !== previousLat > latitude &&
      longitude <
        ((previousLng - currentLng) * (latitude - currentLat)) /
          (previousLat - currentLat) +
          currentLng;

    if (intersects) inside = !inside;
  }

  return inside;
};

const isPointInPolygon = (
  longitude: number,
  latitude: number,
  polygon: LinearRing[]
) => {
  if (!polygon.length || !isPointInRing(longitude, latitude, polygon[0])) {
    return false;
  }

  return !polygon.slice(1).some((hole) => isPointInRing(longitude, latitude, hole));
};

export const isLocationInsideZoneBoundary = (
  boundary: ZoneBoundary,
  latitude: number,
  longitude: number
) => {
  if (!boundary) return false;

  if (boundary.type === "Polygon") {
    return isPointInPolygon(longitude, latitude, boundary.coordinates);
  }

  if (boundary.type === "MultiPolygon") {
    return boundary.coordinates.some((polygon) =>
      isPointInPolygon(longitude, latitude, polygon)
    );
  }

  return false;
};
