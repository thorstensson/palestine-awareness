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
      style: 'mapbox://styles/mapbox/light-v11',
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
          popup_text: event.standard_popup_text,
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
          '#4a7c7b',
          10,
          '#1f4e4d',
          30,
          '#0a2625',
        ],
        'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 30, 40],
        'circle-opacity': 0.85,
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
          '#84a6a5',
          1000,
          '#4a7c7b',
          10000,
          '#1f4e4d',
          50000,
          '#0a2625',
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

      const locationHeader = props.location
        ? `<p class="popup-location">${props.location}</p>`
        : ''

      const popup = new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(
          `
          <div class="popup-content">
            ${locationHeader}
            <div class="popup-body">${props.popup_text}</div>
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
    content="Interactive map showing displacement events in Palestine over the last 180 days"
  />
  <meta property="og:title" content="Free Palestine — Displacement Map" />
  <meta
    property="og:description"
    content="Interactive map showing displacement events in Palestine over the last 180 days"
  />
  <meta property="og:image" content="/og-image.png" />
  <meta
    property="og:url"
    content="https://palestine-awareness.thomasthorstensson.com"
  />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <link
    rel="canonical"
    href="https://palestine-awareness.thomasthorstensson.com"
  />
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Palestine Displacement Map",
      "description": "Interactive map showing displacement events in Palestine from the IDMC API",
      "applicationCategory": "DataVisualization",
      "browserRequirements": "Requires JavaScript",
      "url": "https://palestine-awareness.thomasthorstensson.com"
    }
  </script>
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
  />
</svelte:head>

<div class="app">
  <!-- Header -->
  <header class="header">
    <div class="header__content">
      <div class="header__left">
        <h1 class="header__title">Palestine: Displacement — Last 180 Days</h1>
        {#if !loading && summary}
          <div class="header__stats">
            <div class="stat">
              <span class="stat__number"
                >{formatNumber(summary.total_displaced)}</span
              >
              <span class="stat__label">Displaced</span>
            </div>
            <div class="stat">
              <span class="stat__number">{summary.total_events}</span>
              <span class="stat__label">Events</span>
            </div>
            <div class="stat">
              <span class="stat__number"
                >{formatNumber(summary.gaza_displaced)}</span
              >
              <span class="stat__label">Gaza</span>
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
      {#if !loading}
        <a
          href="https://www.thomasthorstensson.com"
          target="_blank"
          rel="noopener noreferrer"
          class="header__credit"
        >
          <img
            src="/palestine-2.svg"
            alt="by Thomas"
            title="by Thomas"
            class="header__flag"
          />
        </a>
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
  {#if !loading}
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
      <p class="legend__source">
        Data: <a
          href="https://helix-tools-api.idmcdb.org/external-api/#/operations-tag-IDU"
          target="_blank"
          rel="noopener noreferrer"
          class="legend__link">IDMC API</a
        > — last 180 days
      </p>
    </div>
  {/if}
</div>

<style lang="scss">
  @use '../styles/global.scss' as *;

  :global(html) {
    overscroll-behavior: none;
    -webkit-overflow-scrolling: touch;
    height: 100%;
    overflow: hidden;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    font-family: $sans-text;
    font-weight: 400;
    background: $primary;
    color: $primary;
    overscroll-behavior: none;
    -webkit-overflow-scrolling: touch;
    height: 100%;
    overflow: hidden;
    position: fixed;
    width: 100%;
  }

  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overscroll-behavior: none;
    touch-action: pan-x pan-y;
    -webkit-overflow-scrolling: touch;
  }

  .header {
    background: $primary;
    padding: 1rem 2rem;
    z-index: 1002;
    position: relative;
  }

  .header__content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .header__left {
    display: flex;
    flex-direction: column;
  }

  .header__title {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    font-weight: 400;
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
    align-items: flex-start;
  }

  .stat__number {
    font-size: 1.5rem;
    color: $accent2;
  }

  .map-container {
    flex: 1;
    position: relative;
    overscroll-behavior: none;
  }

  .map {
    width: 100%;
    height: 100%;
    overscroll-behavior: none;
    touch-action: pan-x pan-y;
  }

  .loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
    z-index: 1003;
    background: $accent3;
    padding: 2.5rem 2rem;
    border-radius: 0.5rem;
    color: $secondary;
    font-family: $sans-text;
  }

  .loading p {
    font-size: clamped(10px, 13px, 380px, 1920px);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin: 0;
  }

  .loading-spinner {
    width: 3.75rem;
    height: 3.75rem;
    border: 0.25rem solid rgba($secondary, 0.15);
    border-top: 0.25rem solid $accent2;
    border-radius: 50%;
    animation: spin 1s linear infinite;
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
    bottom: 0.625rem;
    left: 1rem;
    background: $primary;
    padding: 1rem;
    border-radius: 0.5rem;
    backdrop-filter: blur(10px);
    z-index: 1002;
    min-width: auto;
  }

  .legend__title {
    margin: 0 0 0.5rem 0;
    font-size: clamped(10px, 13px, 380px, 1920px);
    color: $secondary;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.12em;
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
    font-size: clamped(8px, 10px, 380px, 1920px);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .legend__circle {
    border-radius: 50%;
    flex-shrink: 0;
    width: 1.5625rem;
    height: 1.5625rem;
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
    width: 0.75rem;
    height: 0.75rem;
    background: #84a6a5;
  }

  .legend__circle--medium::before {
    width: 1.125rem;
    height: 1.125rem;
    background: #4a7c7b;
  }

  .legend__circle--large::before {
    width: 1.5625rem;
    height: 1.5625rem;
    background: #1f4e4d;
  }

  .legend__source {
    font-size: clamped(7px, 9px, 380px, 1920px);
    color: $accent1;
    margin: 0.5rem 0 0 0;
    border-top: 1px solid #333;
    padding-top: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }

  .legend__link {
    color: $accent2;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  :global(.header__stats > *) {
    min-width: unset !important;
  }

  :global(.mapboxgl-popup-content) {
    background: $primary;
    border-radius: 0.5rem;
    z-index: 1001 !important;
  }

  :global(.mapboxgl-popup) {
    z-index: 1001 !important;
  }

  :global(.popup-content) {
    color: $secondary;
    font-family: $sans-text;
    max-width: 18.75rem;
    background: $primary;
    border-radius: 0.5rem;
  }

  :global(.mapboxgl-ctrl-logo) {
    display: none !important;
  }

  :global(.popup-location) {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    color: $accent2;
    border-bottom: 1px solid #333;
    padding-bottom: 0.5rem;
  }

  :global(.popup-body) {
    font-size: clamped(11px, 13px, 380px, 1920px);
    line-height: 1.5;
    color: $secondary;
  }

  :global(.popup-body b) {
    font-size: clamped(13px, 15px, 380px, 1920px);
    color: $accent2;
    font-family: $sans-text;
    font-weight: 400;
  }

  :global(.popup-content .source-link) {
    display: inline-block;
    margin-top: 0.5rem;
    color: $accent2;
    text-decoration: none;
  }

  .header {
    padding: 1rem;

    h1 {
      font-size: clamped(10px, 13px, 380px, 1920px);
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    &__stats {
      gap: 1rem;

      @media (min-width: 768px) {
        gap: 2rem;
      }

      .stat {
        min-width: unset;
        &__number {
          font-size: clamped(11px, 14px, 380px, 1920px);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        &__label {
          font-size: clamped(8px, 10px, 380px, 1920px);
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: $accent2;
          margin-top: 0.25rem;
        }
      }
    }
  }

  .header__credit {
    margin: 0 0 0 auto;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    line-height: 0;
  }

  .header__flag {
    width: 2.25rem;
    height: auto;
    display: block;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 0.65;
    }
  }

  :global(.popup-content .source-link:hover) {
    text-decoration: underline;
  }
</style>
