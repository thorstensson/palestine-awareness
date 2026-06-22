<img width="600" height="600" alt="Image" src="https://github.com/user-attachments/assets/f0ef76c9-6d61-48ab-b68d-4ea66d01dead" />
<br />
<br />

# Palestine Awareness

A SvelteKit application for visualizing displacement events in Palestine. In the shadow of the atrocities taking place in Gaza, displacement is a daily reality for many Palestinians.

:pray: .T

**22 June 2026** &mdash; Updated to now pull data from the IDMC IDU API, which is updated by people in the field on a regular basis.

## View & Consider

https://palestine-awareness.thomasthorstensson.com/

## Features

- Interactive Mapbox GL map with clustered displacement markers
- Live data from the IDMC IDU API &mdash; updated regularly with the latest 180 days of events
- Popup details with event descriptions, figures, and source attribution
- Summary statistics (total displaced, Gaza vs West Bank breakdown)

## Tech Stack

- SvelteKit
- Mapbox GL JS
- IDMC Internal Displacement API

## Development

Install dependencies and start the development server:

```sh
npm install
npm run dev
```

## Data Source

Displacement event data is fetched live from the [IDMC IDU API](https://helix-tools-api.idmcdb.org/external-api/#/operations-tag-IDU).
