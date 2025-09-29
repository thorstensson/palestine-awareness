import { json } from '@sveltejs/kit';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface DisplacementEvent {
	id: string;
	country: string;
	iso3: string;
	latitude: number;
	longitude: number;
	figure: number;
	displacement_date: string;
	displacement_start_date: string;
	displacement_end_date: string;
	year: number;
	event_name: string;
	locations_name: string;
	description: string;
	source_url: string;
	combined_type: string;
	sources: string;
}

export async function GET() {
	try {
		const csvPath = join(process.cwd(), 'data', 'event_data_pse.csv');
		const csvContent = readFileSync(csvPath, 'utf-8');
		
		// Split lines and use first line as headers, skip metadata line
		const lines = csvContent.split('\n');
		const headers = lines[0]; // First line has column names
		const dataLines = lines.slice(2); // Skip metadata line, start from actual data
		const cleanedCSV = [headers, ...dataLines].join('\n');
		
		const records = parse(cleanedCSV, {
			columns: true,
			skip_empty_lines: true,
			cast: (value, context) => {
				const column = context.column as string;
				
				// Convert numeric columns
				if (['latitude', 'longitude', 'figure', 'year'].includes(column)) {
					const num = parseFloat(value);
					return isNaN(num) ? 0 : num;
				}
				
				return value;
			}
		}) as DisplacementEvent[];

		// Filter out invalid records and focus on Gaza/Palestine
		const validRecords = records.filter(record => 
			record.latitude && 
			record.longitude && 
			record.figure > 0 &&
			record.displacement_date &&
			record.country === 'Palestine'
		);

		// Separate Gaza Strip from West Bank events
		const gazaEvents = validRecords.filter(record => 
			record.locations_name.toLowerCase().includes('gaza')
		);

		const westBankEvents = validRecords.filter(record => 
			!record.locations_name.toLowerCase().includes('gaza')
		);

		// Calculate summary statistics
		const totalDisplaced = validRecords.reduce((sum, record) => sum + record.figure, 0);
		const gazaDisplaced = gazaEvents.reduce((sum, record) => sum + record.figure, 0);
		const westBankDisplaced = westBankEvents.reduce((sum, record) => sum + record.figure, 0);

		// Get date range
		const dates = validRecords.map(r => new Date(r.displacement_date)).filter(d => !isNaN(d.getTime()));
		const dateRange = dates.length > 0 ? {
			start: new Date(Math.min(...dates.map(d => d.getTime()))).toISOString().split('T')[0],
			end: new Date(Math.max(...dates.map(d => d.getTime()))).toISOString().split('T')[0]
		} : null;

		// Calculate geographic bounds
		const lats = validRecords.map(r => r.latitude);
		const lngs = validRecords.map(r => r.longitude);
		const bounds = {
			north: Math.max(...lats),
			south: Math.min(...lats),
			east: Math.max(...lngs),
			west: Math.min(...lngs)
		};

		return json({
			success: true,
			data: validRecords,
			gaza_events: gazaEvents,
			west_bank_events: westBankEvents,
			summary: {
				total_events: validRecords.length,
				total_displaced: totalDisplaced,
				gaza_displaced: gazaDisplaced,
				west_bank_displaced: westBankDisplaced,
				gaza_events_count: gazaEvents.length,
				west_bank_events_count: westBankEvents.length,
				date_range: dateRange,
				largest_displacement: Math.max(...validRecords.map(r => r.figure)),
				most_recent_event: validRecords.sort((a, b) => 
					new Date(b.displacement_date).getTime() - new Date(a.displacement_date).getTime()
				)[0]
			},
			bounds,
			sources: [...new Set(validRecords.map(r => r.sources))],
			event_types: [...new Set(validRecords.map(r => r.combined_type))]
		});

	} catch (error) {
		console.error('Error reading displacement events:', error);
		return json({
			success: false,
			error: 'Failed to load displacement events data'
		}, { status: 500 });
	}
}
