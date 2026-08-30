
const ORIGIN = { lat: 7.0000, lng: 79.8000 };

const BASE_CELL_M = 250;          
const M_PER_DEG_LAT = 111320;     


function mToDegLat(m) {
  return m / M_PER_DEG_LAT;
}


function mToDegLng(m, atLat) {
  return m / (M_PER_DEG_LAT * Math.cos(atLat * Math.PI / 180));
}


function latLngToCell(lat, lng, cellM = BASE_CELL_M) {
  const dLat = mToDegLat(cellM);
  const dLng = mToDegLng(cellM, ORIGIN.lat);

  const col = Math.floor((lng - ORIGIN.lng) / dLng);   
  const row = Math.floor((ORIGIN.lat - lat) / dLat);   

  return `${cellM}-${col}-${row}`;
}


function parentCell(cellId, targetM) {
  const [m, col, row] = cellId.split('-').map(Number);
  const factor = targetM / m;                          
  return `${targetM}-${Math.floor(col / factor)}-${Math.floor(row / factor)}`;
}


function cellBounds(cellId) {
  const [m, col, row] = cellId.split('-').map(Number);
  const dLat = mToDegLat(m);
  const dLng = mToDegLng(m, ORIGIN.lat);

  const north = ORIGIN.lat - row * dLat;
  const west  = ORIGIN.lng + col * dLng;

  return { north, south: north - dLat, west, east: west + dLng };
}


function cellLabel(cellId) {
  const [, col, row] = cellId.split('-').map(Number);
  return String.fromCharCode(65 + (col % 26)) + (row + 1);
}

module.exports = { latLngToCell, parentCell, cellBounds, cellLabel, ORIGIN, BASE_CELL_M };