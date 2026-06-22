import { json } from '@sveltejs/kit'

const IDMC_API_URL =
  'https://helix-tools-api.idmcdb.org/external-api/idus/last-180-days/?client_id=40P0X497LIQIWOUV&iso3=PSE&country_name=Palestine&format=json'

export interface DisplacementEvent {
  id: number
  country: string
  iso3: string
  latitude: number
  longitude: number
  figure: number
  displacement_date: string
  displacement_start_date: string
  displacement_end_date: string
  year: number
  event_name: string
  locations_name: string
  standard_popup_text: string
  standard_info_text: string
  source_url: string
  sources: string
  displacement_type: string
}

export async function GET() {
  try {
    const response = await fetch(IDMC_API_URL)

    if (!response.ok) {
      throw new Error(`IDMC API responded with status ${response.status}`)
    }

    const raw = await response.json()

    // IDMC may return a paginated object or a plain array
    const allRecords: DisplacementEvent[] = Array.isArray(raw)
      ? raw
      : (raw.results ?? [])

    // Filter strictly to Palestine — the API doesn't always honour the iso3 query param
    const validRecords = allRecords.filter(
      (r) =>
        r.iso3 === 'PSE' &&
        r.latitude != null &&
        r.longitude != null &&
        r.figure > 0 &&
        r.displacement_date
    )

    const gazaEvents = validRecords.filter((r) =>
      r.locations_name.toLowerCase().includes('gaza')
    )
    const westBankEvents = validRecords.filter(
      (r) => !r.locations_name.toLowerCase().includes('gaza')
    )

    const totalDisplaced = validRecords.reduce((sum, r) => sum + r.figure, 0)
    const gazaDisplaced = gazaEvents.reduce((sum, r) => sum + r.figure, 0)
    const westBankDisplaced = westBankEvents.reduce(
      (sum, r) => sum + r.figure,
      0
    )

    const dates = validRecords
      .map((r) => new Date(r.displacement_date))
      .filter((d) => !isNaN(d.getTime()))

    const dateRange =
      dates.length > 0
        ? {
            start: new Date(Math.min(...dates.map((d) => d.getTime())))
              .toISOString()
              .split('T')[0],
            end: new Date(Math.max(...dates.map((d) => d.getTime())))
              .toISOString()
              .split('T')[0],
          }
        : null

    const lats = validRecords.map((r) => r.latitude)
    const lngs = validRecords.map((r) => r.longitude)
    const bounds =
      validRecords.length > 0
        ? {
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lngs),
            west: Math.min(...lngs),
          }
        : null

    return json({
      success: true,
      data: validRecords,
      summary: {
        total_events: validRecords.length,
        total_displaced: totalDisplaced,
        gaza_displaced: gazaDisplaced,
        west_bank_displaced: westBankDisplaced,
        gaza_events_count: gazaEvents.length,
        west_bank_events_count: westBankEvents.length,
        date_range: dateRange,
        largest_displacement:
          validRecords.length > 0
            ? Math.max(...validRecords.map((r) => r.figure))
            : 0,
      },
      bounds,
      sources: [...new Set(validRecords.map((r) => r.sources))],
    })
  } catch (error) {
    console.error('Error fetching IDMC displacement events:', error)
    return json(
      {
        success: false,
        error: 'Failed to load displacement events from IDMC',
      },
      { status: 500 }
    )
  }
}
