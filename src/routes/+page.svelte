<script lang="ts">
  import { onMount } from 'svelte'
  import mapboxgl from 'mapbox-gl'
  import 'mapbox-gl/dist/mapbox-gl.css'

  let mapContainer: HTMLDivElement
  let map: any
  let eventsData: any[] = []
  let summary: any = {}
  let loading = true

  // Mapbox token!
  import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public'
  mapboxgl.accessToken =
    PUBLIC_MAPBOX_TOKEN ||
    'pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbGV4YW1wbGUifQ.example'

  onMount(async () => {
    // Fetch displacement events data
    try {
      const response = await fetch('/api/events')
      const data = await response.json()

      if (data.success) {
        eventsData = data.data
        summary = data.summary
        loading = false
        initializeMap()
      }
    } catch (error) {
      console.error('Failed to load events data:', error)
      loading = false
    }
  })

  function initializeMap() {
    map = new mapboxgl.Map({
      container: mapContainer,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [34.4668, 31.5017], // Gaza center
      zoom: 8,
      pitch: 0,
      bearing: 0,
    })

    map.on('load', () => {
      addDisplacementMarkers()
    })

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl())
  }

  function addDisplacementMarkers() {
    // Create GeoJSON from events data
    const geojsonData = {
      type: 'FeatureCollection',
      features: eventsData.map((event) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [event.longitude, event.latitude],
        },
        properties: {
          id: event.id,
          figure: event.figure,
          date: event.displacement_date,
          location: event.locations_name,
          description: event.description,
          source_url: event.source_url,
          sources: event.sources,
        },
      })),
    }

    // Add data source
    map.addSource('displacement-events', {
      type: 'geojson',
      data: geojsonData,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    })

    // Add cluster circles
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'displacement-events',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#ff6b6b',
          10,
          '#ff5252',
          30,
          '#d32f2f',
        ],
        'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 30, 40],
        'circle-opacity': 0.8,
        'circle-stroke-width': 0,
      },
    })

    // Add cluster count labels
    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'displacement-events',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12,
      },
      paint: {
        'text-color': '#ffffff',
      },
    })

    // Add individual points
    map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'displacement-events',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'interpolate',
          ['linear'],
          ['get', 'figure'],
          0,
          '#ffeb3b',
          1000,
          '#ff9800',
          10000,
          '#f44336',
          50000,
          '#b71c1c',
        ],
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'figure'],
          0,
          8,
          1000,
          12,
          10000,
          18,
          50000,
          25,
          100000,
          35,
        ],
        'circle-opacity': 0.8,
        'circle-stroke-width': 0,
      },
    })

    // Add click handlers for popups
    map.on('click', 'unclustered-point', (e: any) => {
      const coordinates = e.features[0].geometry.coordinates.slice()
      const props = e.features[0].properties

      const popup = new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(
          `
					<div class="popup-content">
						<h3>${props.location}</h3>
						<p><strong>${props.figure.toLocaleString()}</strong> people displaced</p>
						<p><strong>Date:</strong> ${new Date(props.date).toLocaleDateString()}</p>
						<p class="description">${props.description}</p>
						<p><strong>Source:</strong> ${props.sources}</p>
						${props.source_url ? `<a href="${props.source_url}" target="_blank" class="source-link">View Report</a>` : ''}
					</div>
				`
        )
        .addTo(map)
    })

    // Change cursor on hover
    map.on('mouseenter', 'unclustered-point', () => {
      map.getCanvas().style.cursor = 'pointer'
    })

    map.on('mouseleave', 'unclustered-point', () => {
      map.getCanvas().style.cursor = ''
    })

    // Handle cluster clicks
    map.on('click', 'clusters', (e: any) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['clusters'],
      })
      const clusterId = features[0].properties.cluster_id
      map
        .getSource('displacement-events')
        .getClusterExpansionZoom(clusterId, (err: any, zoom: any) => {
          if (!err) {
            map.easeTo({
              center: features[0].geometry.coordinates,
              zoom: zoom,
            })
          }
        })
    })
  }

  function formatNumber(num: number) {
    return num.toLocaleString()
  }
</script>

<svelte:head>
  <title>Free Palestine &#x2022; Thorstensson</title>
  <meta
    name="description"
    content="Interactive map showing displacement events in Palestine during 2025"
  />
</svelte:head>

<div class="app">
  <!-- Header -->
  <header class="header">
    <div class="header__content">
      <h1 class="header__title">West Bank Displacement Tracker 2025</h1>
      {#if !loading && summary}
        <div class="header__stats">
          <div class="stat">
            <span class="stat__number"
              >{formatNumber(summary.total_displaced)}</span
            >
            <span class="stat__label">Total Displaced</span>
          </div>
          <div class="stat">
            <span class="stat__number">{summary.total_events}</span>
            <span class="stat__label">Events Recorded</span>
          </div>
          <div class="stat">
            <span class="stat__number"
              >{formatNumber(summary.gaza_displaced)}</span
            >
            <span class="stat__label">Gaza Strip</span>
          </div>
          <div class="stat">
            <span class="stat__number"
              >{formatNumber(summary.west_bank_displaced)}</span
            >
            <span class="stat__label">West Bank</span>
          </div>
        </div>
      {/if}
    </div>
  </header>

  <!-- Map Container -->
  <main class="map-container">
    {#if loading}
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>Loading data...</p>
      </div>
    {/if}
    <div bind:this={mapContainer} class="map"></div>
  </main>

  <!-- Legend -->
  <div class="legend">
    <h3 class="legend__title">Displacement Scale</h3>
    <div class="legend__items">
      <div class="legend__item">
        <div class="legend__circle legend__circle--small"></div>
        <span>1 - 1,000 people</span>
      </div>
      <div class="legend__item">
        <div class="legend__circle legend__circle--medium"></div>
        <span>1,000 - 10,000 people</span>
      </div>
      <div class="legend__item">
        <div class="legend__circle legend__circle--large"></div>
        <span>10,000+ people</span>
      </div>
    </div>
    <p class="legend__source">Data: UN OCHA; Zoom & Click info</p>
  </div>
</div>

<style lang="scss">
  @use '../styles/_variables.scss' as *;
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: $sans-ui;
    background: $primary;
    color: $primary;
  }

  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .header {
    background: $primary;
    padding: 1rem 2rem;

    z-index: 1000;
  }

  .header__content {
    max-width: 1200px;
    margin: 0 auto;
  }

  .header__title {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    font-weight: 300;
    color: $secondary;
  }

  .header__stats {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 120px;
  }

  .stat__number {
    font-size: 1.5rem;
    color: $accent2;
  }

  .stat__label {
    font-size: 0.9rem;
    color: #e3f2fd;
    margin-top: 0.25rem;
  }

  .map-container {
    flex: 1;
    position: relative;
  }

  .map {
    width: 100%;
    height: 100%;
  }

  .loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    z-index: 1000;
    background: $accent3;
    padding: 2rem;
    border-radius: 8px;
    color: $accent2;
    font-family: $sans-text;
    font-weight: 300;
    font-size: 1rem;
  }

  .loading-spinner {
    width: 60px;
    height: 60px;
    border: 4px solid #333;
    border-top: 4px solid $accent1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .legend {
    position: absolute;
    bottom: 20px;
    left: 20px;
    background: $accent3;
    padding: 1rem;
    border-radius: 8px;
    backdrop-filter: blur(10px);
    z-index: 1000;
    min-width: 200px;
  }

  .legend__title {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: #ffffff;
    font-weight: 500;
  }

  .legend__items {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    color: $accent2;
  }

  .legend__item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .legend__circle {
    border-radius: 50%;
    flex-shrink: 0;
    width: 25px;
    height: 25px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .legend__circle::before {
    content: '';
    border-radius: 50%;
    position: absolute;
  }

  .legend__circle--small::before {
    width: 12px;
    height: 12px;
    background: #ffeb3b;
  }

  .legend__circle--medium::before {
    width: 18px;
    height: 18px;
    background: #ff9800;
  }

  .legend__circle--large::before {
    width: 25px;
    height: 25px;
    background: #f44336;
  }

  .legend__source {
    font-size: 0.8rem;
    color: #bbb;
    margin: 0.5rem 0 0 0;
    border-top: 1px solid #333;
    padding-top: 0.5rem;
  }

  :global(.mapboxgl-popup-content) {
    background: $accent3;
    border-radius: 8px;
  }

  :global(.popup-content) {
    color: $secondary;
    font-family: $sans-ui;
    font-weight: 300;
    max-width: 300px;
    background: $accent3;
    border-radius: 8px;
  }

  :global(.mapboxgl-ctrl-logo) {
    display: none !important;
  }

  :global(.popup-content h3) {
    margin: 0 0 0.5rem 0;
    color: $accent2;
  }

  :global(.popup-content .description) {
    font-size: 0.9rem;
    line-height: 1.4;
    margin: 0.5rem 0;
  }

  :global(.popup-content .source-link) {
    display: inline-block;
    margin-top: 0.5rem;
    color: $accent2;
    text-decoration: none;
    font-weight: bold;
  }

  :global(.popup-content .source-link:hover) {
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    .header {
      padding: 1rem;
    }

    .header h1 {
      font-size: 1.5rem;
    }

    .stats {
      gap: 1rem;
    }

    .stat {
      min-width: 100px;
    }

    .legend {
      bottom: 10px;
      left: 10px;
      right: 10px;
      min-width: auto;
    }
  }
</style>
