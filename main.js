let map;
let userMarker;
let notified = new Set();
let facilitiesData = [];
let routingControl = null;
let facilityMarkers = [];

// Dummy crowded areas (blinking)
const crowdData = [
  { name: "Crowded Area - Mahakaleshwar Temple", coords: [23.182, 75.784] },
  { name: "Crowded Area - Ram Ghat (Shipra)", coords: [23.176, 75.789] }
];

// Initialize map
async function initMap() {
  map = L.map('map').setView([23.182, 75.784], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Load facilities
  try {
    const resp = await fetch("facilities.json");
    facilitiesData = await resp.json();

    facilitiesData.forEach(f => {
      const [lngF, latF] = f.location.coordinates;
      const marker = L.marker([latF, lngF]).addTo(map)
        .bindPopup(`<b>${f.name}</b><br/>${f.type}`);
      facilityMarkers.push(marker);
    });
  } catch (e) {
    console.error("Failed to load facilities.json", e);
  }


// Add dummy crowd points (blinking)
crowdData.forEach(c => {
  const divIcon = L.divIcon({ 
    className: "blinking-crowd",
    iconSize: [40, 40],       // match CSS size
    iconAnchor: [20, 20]      // center point
  });
  L.marker(c.coords, { icon: divIcon })
    .addTo(map)
    .bindTooltip(c.name, { permanent: false });
});



  // Track user location
  if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition(onLocation, console.error, { enableHighAccuracy: true });
  } else {
    console.warn("Geolocation not available");
  }

  await initServiceWorker();
}

function onLocation(pos) {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  if (!userMarker) {
    userMarker = L.marker([lat, lng], { icon: blueIcon() })
      .addTo(map)
      .bindPopup("You are here")
      .openPopup();
  } else {
    userMarker.setLatLng([lat, lng]);
  }

  // Notifications for nearby facilities
  facilitiesData.forEach(f => {
    const [lngF, latF] = f.location.coordinates;
    const dist = distanceMeters(lat, lng, latF, lngF);

    if (dist < 150 && !notified.has(f._id)) {
      showNotification(`${f.name} (${f.type}) is nearby`);
      notified.add(f._id);
    }
  });

  // Auto rerouting
  if (routingControl) {
    const waypoints = routingControl.getWaypoints();
    if (waypoints.length > 1) {
      routingControl.setWaypoints([
        L.latLng(lat, lng),
        waypoints[waypoints.length - 1].latLng
      ]);
    }
  }
}

// find nearest facility of selected category

function findNearest() {
  if (!userMarker) {
    alert("Waiting for your location...");
    return;
  }

  const category = document.getElementById("category").value;

  if (!category) {
    alert("Please select a category.");
    return;
  }

  const userLatLng = userMarker.getLatLng();
  let nearest = null;
  let nearestDist = Infinity;

  facilitiesData.forEach(f => {
    if (f.type === category) {
      const [lngF, latF] = f.location.coordinates;
      const dist = distanceMeters(userLatLng.lat, userLatLng.lng, latF, lngF);

      if (dist < nearestDist) {
        nearest = f;
        nearestDist = dist;
      }
    }
  });

  if (!nearest) {
    alert(`No ${category} found.`);
    return;
  }

  const [lngF, latF] = nearest.location.coordinates;

  // Remove previous route
  if (routingControl) {
    map.removeControl(routingControl);
  }

  // Draw new route with instructions
  routingControl = L.Routing.control({
    waypoints: [
      userLatLng,
      L.latLng(latF, lngF)
    ],
    routeWhileDragging: false,
    showAlternatives: false,
    addWaypoints: false,
    createMarker: () => null // hide start/end markers
  }).addTo(map);

  map.fitBounds([userLatLng, [latF, lngF]]);
}


// Blue user icon
function blueIcon() {
  return new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
}

// Distance helper
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = v => v * Math.PI/180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Notifications
async function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.log("SW registered");

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log("Notifications allowed");
    }
  }
}

function showNotification(msg) {
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.getRegistration().then(reg => {
      reg.showNotification("Facility Nearby", { body: msg });
    });
  }
}

window.onload = initMap;
