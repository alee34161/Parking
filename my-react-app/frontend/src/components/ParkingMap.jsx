import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './ParkingMap.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const getOccupancyColor = (occupancyRate) => {
  if (occupancyRate <= 50) return '#22c55e';
  if (occupancyRate <= 70) return '#eab308';
  if (occupancyRate <= 90) return '#f97316';
  return '#dc2626';
};

const BADGE_OFFSETS = {
  right:      [50,  0],
  left:       [-50, 0],
  'top-right': [14, -40],
  'top-left':  [-80, -40],
};

const normalizeBadgeOffsetKey = (rawValue) => {
  if (rawValue == null) return null;
  const normalized = String(rawValue)
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');

  if (BADGE_OFFSETS[normalized]) return normalized;
  if (normalized === 'topright') return 'top-right';
  if (normalized === 'topleft') return 'top-left';
  return null;
};

const ParkingMap = ({ parkingLots, selectedLot, selectedLevel, onLotClick, onLevelClick, filteredLotIds }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const levelMarkersRef = useRef({});
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-117.885, 33.882],
      zoom: 15,
      pitch: 0
    });

    map.current.on('load', () => {
      setMapLoaded(true);
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current || !mapLoaded || !parkingLots.length) return;

    if (map.current.getLayer('parking-lots-fill')) map.current.removeLayer('parking-lots-fill');
    if (map.current.getLayer('parking-lots-outline')) map.current.removeLayer('parking-lots-outline');
    if (map.current.getSource('parking-lots')) map.current.removeSource('parking-lots');

    const geojsonData = {
      type: 'FeatureCollection',
      features: parkingLots
        .filter(lot => lot.polygon_coordinates && lot.polygon_coordinates.length > 0)
        .map(lot => {
          const occupancyRate = lot.available_spots !== null
            ? ((lot.total_spots - lot.available_spots) / lot.total_spots) * 100
            : 0;
          const isFiltered = filteredLotIds && !filteredLotIds.includes(lot.id);

          return {
            type: 'Feature',
            properties: {
              id: lot.id,
              name: lot.name,
              totalSpots: lot.total_spots,
              availableSpots: lot.available_spots || 0,
              occupancyRate,
              status: lot.status || 'Open',
              isFiltered,
              isStructure: lot.is_structure === 1 || lot.is_structure === true
            },
            geometry: {
              type: 'Polygon',
              coordinates: [lot.polygon_coordinates.map(coord => [coord.lng, coord.lat])]
            }
          };
        })
    };

    map.current.addSource('parking-lots', { type: 'geojson', data: geojsonData });

    map.current.addLayer({
      id: 'parking-lots-fill',
      type: 'fill',
      source: 'parking-lots',
      paint: {
        'fill-color': [
          'case',
          ['get', 'isFiltered'], '#d1d5db',
          ['==', ['get', 'status'], 'Closed'], '#dc2626',
          ['interpolate', ['linear'], ['get', 'occupancyRate'],
            0, '#22c55e', 50, '#eab308', 80, '#f97316', 100, '#dc2626']
        ],
        'fill-opacity': ['case', ['get', 'isFiltered'], 0.4, 0.75]
      }
    });

    map.current.addLayer({
      id: 'parking-lots-outline',
      type: 'line',
      source: 'parking-lots',
      paint: {
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], '#2563eb',
          ['get', 'isFiltered'], '#999999',
          '#ffffff'
        ],
        'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 4, 2.5]
      }
    });

    map.current.on('click', 'parking-lots-fill', (e) => {
      const feature = e.features[0];
      if (!feature.properties.isFiltered && onLotClick) {
        onLotClick(feature.properties.id);
      }
    });

    map.current.on('mouseenter', 'parking-lots-fill', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });
    map.current.on('mouseleave', 'parking-lots-fill', () => {
      map.current.getCanvas().style.cursor = '';
    });

    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });

    map.current.on('mousemove', 'parking-lots-fill', (e) => {
      const props = e.features[0].properties;
      popup.setLngLat(e.lngLat).setHTML(`
        <div class="parking-popup">
          <strong>${props.name}</strong><br/>
          <span>${props.availableSpots} / ${props.totalSpots} available</span><br/>
          <span>${props.occupancyRate.toFixed(1)}% occupied</span><br/>
          <span class="status">${props.status}</span>
        </div>
      `).addTo(map.current);
    });

    map.current.on('mouseleave', 'parking-lots-fill', () => popup.remove());

  }, [parkingLots, mapLoaded, onLotClick, filteredLotIds]);

  // level badges for structures
  useEffect(() => {
    if (!map.current || !mapLoaded || !parkingLots.length) return;

    Object.values(levelMarkersRef.current).forEach(marker => marker.remove());
    levelMarkersRef.current = {};

    const structures = parkingLots.filter(
      lot =>
        (lot.is_structure === 1 || lot.is_structure === true) &&
        lot.latitude &&
        lot.longitude &&
        lot.levels &&
        lot.levels.length > 0
    );

    const mapCenterLng = map.current.getCenter().lng;

    structures.forEach(lot => {
      const isFiltered = filteredLotIds && !filteredLotIds.includes(lot.id);
      const explicitOffset = normalizeBadgeOffsetKey(
        lot.badge_offset ??
        lot.badgeOffset ??
        lot.badgeAlignment ??
        lot.alignment ??
        lot.direction ??
        lot.position
      );
      const defaultOffset = lot.longitude != null && lot.longitude > mapCenterLng ? 'left' : 'right';
      const offsetKey = explicitOffset || defaultOffset;
      const [offsetX, offsetY] = BADGE_OFFSETS[offsetKey] || BADGE_OFFSETS.right;

      const levelsBottomUp = [...lot.levels].sort((a, b) => b.level_number - a.level_number);

      const badgeContainer = document.createElement('div');
      badgeContainer.className = 'level-badge-stack';

      levelsBottomUp.forEach(level => {
        const occupancy = level.available_spots != null && level.total_spots > 0
          ? ((level.total_spots - level.available_spots) / level.total_spots) * 100
          : 0;
        const color = isFiltered ? '#9ca3af' : getOccupancyColor(occupancy);
        const isSelected = selectedLevel && selectedLevel.id === level.id;

        const badge = document.createElement('div');
        badge.className = `level-badge${isSelected ? ' level-badge--selected' : ''}`;
        badge.style.backgroundColor = color;
        badge.style.borderColor = isSelected ? '#2563eb' : 'rgba(255,255,255,0.7)';

        badge.innerHTML = `
          <span class="level-badge-floor">${level.level_number}</span>
          <span class="level-badge-spots">${level.available_spots ?? '?'}</span>
        `;

        if (!isFiltered) {
          badge.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onLevelClick) onLevelClick(lot.id, level.id);
          });
          badge.style.cursor = 'pointer';
        }

        badgeContainer.appendChild(badge);
      });

      const marker = new mapboxgl.Marker({
        element: badgeContainer,
        anchor: 'center',
        offset: [offsetX, offsetY]
      })
        .setLngLat([lot.longitude, lot.latitude])
        .addTo(map.current);

      levelMarkersRef.current[lot.id] = marker;
    });

  }, [parkingLots, mapLoaded, filteredLotIds, selectedLevel, onLevelClick]);

  useEffect(() => {
    if (!map.current || !mapLoaded || !parkingLots.length) return;

    parkingLots.forEach(lot => {
      map.current.setFeatureState({ source: 'parking-lots', id: lot.id }, { selected: false });
    });

    if (selectedLot) {
      map.current.setFeatureState({ source: 'parking-lots', id: selectedLot }, { selected: true });

      const lot = parkingLots.find(l => l.id === selectedLot);
      if (lot && lot.latitude && lot.longitude) {
        map.current.flyTo({ center: [lot.longitude, lot.latitude], zoom: 17, duration: 1000 });
      }
    }
  }, [selectedLot, mapLoaded, parkingLots]);

  return (
    <div className="map-container-wrapper">
      <div ref={mapContainer} className="map-container" />
      <div className="map-legend">
        <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#22c55e' }}></span><span>Available</span></div>
        <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#eab308' }}></span><span>Moderate</span></div>
        <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#f97316' }}></span><span>Limited</span></div>
        <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#dc2626' }}></span><span>Full/Closed</span></div>
        <div className="legend-item"><span className="legend-color" style={{ backgroundColor: '#cccccc' }}></span><span>Filtered</span></div>
      </div>
    </div>
  );
};

export default ParkingMap;
