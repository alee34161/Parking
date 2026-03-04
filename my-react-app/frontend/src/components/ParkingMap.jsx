import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './ParkingMap.css';

// Set your Mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const ParkingMap = ({ parkingLots, selectedLot, onLotClick, filteredLotIds }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (map.current) return; // Initialize map only once

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-117.885, 33.882], // CSUF coordinates
      zoom: 15,
      pitch: 0
    });

    map.current.on('load', () => {
      setMapLoaded(true);
      
      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    });

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update map layers when parking lots change
  useEffect(() => {
    if (!map.current || !mapLoaded || !parkingLots.length) return;

    // Remove existing layers and sources
    if (map.current.getLayer('parking-lots-fill')) {
      map.current.removeLayer('parking-lots-fill');
    }
    if (map.current.getLayer('parking-lots-outline')) {
      map.current.removeLayer('parking-lots-outline');
    }
    if (map.current.getSource('parking-lots')) {
      map.current.removeSource('parking-lots');
    }

    // Create GeoJSON from parking lots
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
              permitTypes: lot.permit_types || []
            },
            geometry: {
              type: 'Polygon',
              coordinates: [lot.polygon_coordinates.map(coord => [coord.lng, coord.lat])]
            }
          };
        })
    };

    // Add source
    map.current.addSource('parking-lots', {
      type: 'geojson',
      data: geojsonData
    });

    // Add fill layer with color coding
    map.current.addLayer({
      id: 'parking-lots-fill',
      type: 'fill',
      source: 'parking-lots',
      paint: {
        'fill-color': [
          'case',
          ['get', 'isFiltered'],
          '#d1d5db', // Grayed out for filtered lots
          [
            'case',
            ['==', ['get', 'status'], 'Closed'],
            '#dc2626', // Red for closed
            [
              'interpolate',
              ['linear'],
              ['get', 'occupancyRate'],
              0, '#22c55e',    // Green (0% occupied = lots available)
              50, '#eab308',   // Yellow (50% occupied)
              80, '#f97316',   // Orange (80% occupied)
              100, '#dc2626'   // Red (100% occupied = full)
            ]
          ]
        ],
        'fill-opacity': [
          'case',
          ['get', 'isFiltered'],
          0.4, // Lower opacity for filtered
          0.75  // Higher opacity for better visibility
        ]
      }
    });

    // Add outline layer
    map.current.addLayer({
      id: 'parking-lots-outline',
      type: 'line',
      source: 'parking-lots',
      paint: {
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          '#2563eb', // Blue for selected
          ['get', 'isFiltered'],
          '#999999', // Gray for filtered
          '#ffffff'  // White for normal
        ],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          4,  // Thicker for selected
          2.5 // Visible outline
        ]
      }
    });

    // Add click handler
    map.current.on('click', 'parking-lots-fill', (e) => {
      const feature = e.features[0];
      const lotId = feature.properties.id;
      
      if (!feature.properties.isFiltered && onLotClick) {
        onLotClick(lotId);
      }
    });

    // Change cursor on hover
    map.current.on('mouseenter', 'parking-lots-fill', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', 'parking-lots-fill', () => {
      map.current.getCanvas().style.cursor = '';
    });

    // Add popup on hover
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false
    });

    map.current.on('mousemove', 'parking-lots-fill', (e) => {
      const feature = e.features[0];
      const props = feature.properties;
      
      const occupancyRate = props.occupancyRate.toFixed(1);
      
      popup
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="parking-popup">
            <strong>${props.name}</strong><br/>
            <span>${props.availableSpots} / ${props.totalSpots} available</span><br/>
            <span>${occupancyRate}% occupied</span><br/>
            <span class="status">${props.status}</span>
          </div>
        `)
        .addTo(map.current);
    });

    map.current.on('mouseleave', 'parking-lots-fill', () => {
      popup.remove();
    });

  }, [parkingLots, mapLoaded, onLotClick, filteredLotIds]);

  // Highlight selected lot
  useEffect(() => {
    if (!map.current || !mapLoaded || !parkingLots.length) return;

    // Clear previous selection
    parkingLots.forEach(lot => {
      map.current.setFeatureState(
        { source: 'parking-lots', id: lot.id },
        { selected: false }
      );
    });

    // Set new selection
    if (selectedLot) {
      map.current.setFeatureState(
        { source: 'parking-lots', id: selectedLot },
        { selected: true }
      );

      // Optionally fly to selected lot
      const lot = parkingLots.find(l => l.id === selectedLot);
      if (lot && lot.latitude && lot.longitude) {
        map.current.flyTo({
          center: [lot.longitude, lot.latitude],
          zoom: 17,
          duration: 1000
        });
      }
    }
  }, [selectedLot, mapLoaded, parkingLots]);

  return (
    <div className="map-container-wrapper">
      <div ref={mapContainer} className="map-container" />
      
      {/* Legend */}
      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#22c55e' }}></span>
          <span>Available</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#eab308' }}></span>
          <span>Moderate</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#f97316' }}></span>
          <span>Limited</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#dc2626' }}></span>
          <span>Full/Closed</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#cccccc' }}></span>
          <span>Filtered</span>
        </div>
      </div>
    </div>
  );
};

export default ParkingMap;
