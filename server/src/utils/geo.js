/**
 * Calculates the Haversine distance between two coordinates in kilometers.
 * @param {Array} coord1 - [longitude, latitude]
 * @param {Array} coord2 - [longitude, latitude]
 * @returns {number} Distance in km
 */
export const calculateDistanceKm = (coord1, coord2) => {
    if (!coord1 || !coord2 || coord1.length < 2 || coord2.length < 2) return Infinity;

    const toRad = (value) => (value * Math.PI) / 180;
    
    const lon1 = coord1[0];
    const lat1 = coord1[1];
    const lon2 = coord2[0];
    const lat2 = coord2[1];

    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};
