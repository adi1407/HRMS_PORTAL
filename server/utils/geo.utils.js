const EARTH_RADIUS_METERS = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

const haversineDistance = (empLat, empLon, officeLat, officeLon) => {
  const dLat = toRad(officeLat - empLat);
  const dLon = toRad(officeLon - empLon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(empLat)) * Math.cos(toRad(officeLat)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
};

const isWithinGeoFence = (empLat, empLon, branch) => {
  const distance = haversineDistance(empLat, empLon, branch.latitude, branch.longitude);
  return {
    allowed: distance <= branch.radiusMeters,
    distance: Math.round(distance),
    radiusMeters: branch.radiusMeters,
    distanceFromEdge: Math.round(distance - branch.radiusMeters),
  };
};

module.exports = { haversineDistance, isWithinGeoFence };
