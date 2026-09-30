let userLat = null;
let userLng = null;
let map, userMarker, routingControl, destinationMarker;

// Tile Layers
const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
});

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Tiles &copy; Esri'
});

const terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  maxZoom: 17,
  attribution: '© OpenTopoMap'
});

// Map Init - Default center set to Gopalganj, Bihar
map = L.map('map', {
  center: [26.4678, 84.4419], 
  zoom: 12,
  layers: [streetLayer]
});

// Switch Layers
document.querySelectorAll('input[name="map-layer"]').forEach((radio) => {
  radio.addEventListener('change', (e) => {
    map.removeLayer(streetLayer);
    map.removeLayer(satelliteLayer);
    map.removeLayer(terrainLayer);

    if (e.target.value === 'streets') map.addLayer(streetLayer);
    if (e.target.value === 'satellite') map.addLayer(satelliteLayer);
    if (e.target.value === 'terrain') map.addLayer(terrainLayer);
  });
});

// Check URL parameters on page load (Auto location prompt HAS BEEN REMOVED)
window.addEventListener('DOMContentLoaded', () => {
  checkURLParameters();
});

// Manual Location Request (Only when user clicks 'My Location' button)
function getUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLat = position.coords.latitude;
        userLng = position.coords.longitude;

        if (userMarker) map.removeLayer(userMarker);

        userMarker = L.marker([userLat, userLng]).addTo(map);
        userMarker.bindPopup('<b>Aapki Current Location</b>').openPopup();

        map.setView([userLat, userLng], 13);
      },
      (error) => {
        alert('Location access enable nahi ho paya.');
      },
      { enableHighAccuracy: true }
    );
  } else {
    alert('Aapke browser me Geolocation feature supported nahi hai.');
  }
}

// Global Search (Gaon / City / Location)
async function searchLocation(query) {
  if (!query) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=1`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
    } else {
      alert('Location nahi mili. Kripya naam fir se check karein.');
      return null;
    }
  } catch (err) {
    console.error('Search error:', err);
    alert('Search karne me error aayi.');
    return null;
  }
}

// Weather Details
async function fetchWeather(lat, lon) {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    const data = await res.json();
    if (data.current_weather) {
      document.getElementById('temp-val').innerText = `${data.current_weather.temperature} °C`;
      document.getElementById('weather-desc').innerText = `Wind: ${data.current_weather.windspeed} km/h`;
    }
  } catch (err) {
    document.getElementById('temp-val').innerText = '--';
    document.getElementById('weather-desc').innerText = 'Weather unavailable';
  }
}

function showInfoPanel(title, address, lat, lon) {
  document.getElementById('location-name').innerText = title;
  document.getElementById('location-address').innerText = address;
  document.getElementById('info-panel').classList.remove('hidden');
  fetchWeather(lat, lon);
}

// Search Button Action
document.getElementById('search-btn').addEventListener('click', async () => {
  const query = document.getElementById('destination-input').value;
  const result = await searchLocation(query);
  if (result) {
    if (destinationMarker) map.removeLayer(destinationMarker);
    destinationMarker = L.marker([result.lat, result.lon]).addTo(map);
    map.setView([result.lat, result.lon], 14);
    showInfoPanel(query, result.displayName, result.lat, result.lon);
  }
});

// Calculate Distance & Travel Time Route
document.getElementById('route-btn').addEventListener('click', async () => {
  const startQuery = document.getElementById('start-input').value;
  const destQuery = document.getElementById('destination-input').value;

  let startCoords = null;

  if (startQuery.trim() !== '') {
    const startRes = await searchLocation(startQuery);
    if (startRes) startCoords = [startRes.lat, startRes.lon];
    else return;
  } else if (userLat && userLng) {
    startCoords = [userLat, userLng];
  }

  if (!startCoords) {
    alert('Kripya Start Location enter karein ya My Location button press karein.');
    return;
  }

  const destRes = await searchLocation(destQuery);
  if (!destRes) return;

  if (routingControl) map.removeControl(routingControl);

  routingControl = L.Routing.control({
    waypoints: [
      L.latLng(startCoords[0], startCoords[1]),
      L.latLng(destRes.lat, destRes.lon)
    ],
    routeWhileDragging: true,
    showAlternatives: true,
    altLineOptions: { styles: [{ color: '#888', opacity: 0.6, weight: 5 }] }
  }).addTo(map);

  // Calculate & Display Distance and Time
  routingControl.on('routesfound', function(e) {
    const routes = e.routes;
    const summary = routes[0].summary;
    
    // Distance in km
    const distanceKm = (summary.totalDistance / 1000).toFixed(1) + ' km';
    
    // Time formatting
    const totalMinutes = Math.round(summary.totalTime / 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    let timeStr = '';
    if (hours > 0) timeStr += hours + ' Hours ';
    timeStr += mins + ' Mins';

    document.getElementById('route-distance').innerText = distanceKm;
    document.getElementById('route-time').innerText = timeStr;
    document.getElementById('route-summary').classList.remove('hidden');
  });

  showInfoPanel('Destination', destRes.displayName, destRes.lat, destRes.lon);
});

document.getElementById('my-location-btn').addEventListener('click', () => {
  getUserLocation();
});

// Share URL Function
document.getElementById('share-btn').addEventListener('click', () => {
  const center = map.getCenter();
  const zoom = map.getZoom();
  const shareURL = `${window.location.origin}${window.location.pathname}?lat=${center.lat.toFixed(5)}&lng=${center.lng.toFixed(5)}&zoom=${zoom}`;
  
  navigator.clipboard.writeText(shareURL).then(() => {
    alert('Map location ka link copy ho gaya hai:
' + shareURL);
  });
});

// Clear Route Panel & Markers
document.getElementById('clear-btn').addEventListener('click', () => {
  if (routingControl) map.removeControl(routingControl);
  if (destinationMarker) map.removeLayer(destinationMarker);
  document.getElementById('start-input').value = '';
  document.getElementById('destination-input').value = '';
  document.getElementById('info-panel').classList.add('hidden');
  document.getElementById('route-summary').classList.add('hidden');
});

document.getElementById('close-info').addEventListener('click', () => {
  document.getElementById('info-panel').classList.add('hidden');
});

function checkURLParameters() {
  const params = new URLSearchParams(window.location.search);
  const lat = parseFloat(params.get('lat'));
  const lng = parseFloat(params.get('lng'));
  const zoom = parseInt(params.get('zoom')) || 13;

  if (lat && lng) {
    map.setView([lat, lng], zoom);
    L.marker([lat, lng]).addTo(map).bindPopup('Shared Location').openPopup();
  }
}