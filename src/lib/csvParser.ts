import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface GeographicData {
	latitude: number;
	longitude: number;
	location: string;
	area: string;
}

export interface CasualtyRecord extends GeographicData {
	date: string;
	killed: number;
	injured: number;
	children_killed: number;
	women_killed: number;
	source: string;
}

export interface InfrastructureRecord extends GeographicData {
	date: string;
	hospitals_damaged: number;
	schools_damaged: number;
	homes_destroyed: number;
	type: string;
}

export interface DisplacementRecord extends GeographicData {
	date: string;
	people_displaced: number;
	displacement_centers: number;
	capacity: number;
}

/**
 * Validates geographic coordinates
 */
function validateCoordinates(lat: number, lng: number): boolean {
	// Gaza Strip bounds approximately: 31.2-31.6°N, 34.2-34.5°E
	return lat >= 31.0 && lat <= 32.0 && lng >= 34.0 && lng <= 35.0;
}

/**
 * Generic CSV parser with coordinate validation
 */
function parseCSVWithCoordinates<T>(
	csvContent: string,
	numericColumns: string[],
	coordinateColumns: string[] = ['latitude', 'longitude']
): T[] {
	const records = parse(csvContent, {
		columns: true,
		skip_empty_lines: true,
		cast: (value, context) => {
			const column = context.column as string;
			
			// Convert numeric columns to numbers
			if (numericColumns.includes(column) || coordinateColumns.includes(column)) {
				const num = parseFloat(value);
				if (isNaN(num)) {
					throw new Error(`Invalid numeric value "${value}" in column "${column}"`);
				}
				return num;
			}
			
			return value.trim();
		}
	});

	// Validate coordinates for each record
	return records.map((record: any) => {
		if (coordinateColumns.every(col => col in record)) {
			const lat = record[coordinateColumns[0]];
			const lng = record[coordinateColumns[1]];
			
			if (!validateCoordinates(lat, lng)) {
				console.warn(`Invalid coordinates for ${record.location}: ${lat}, ${lng}`);
			}
		}
		
		return record as T;
	});
}

/**
 * Load and parse casualties CSV data
 */
export async function loadCasualtiesData(): Promise<CasualtyRecord[]> {
	try {
		const csvPath = join(process.cwd(), 'data', 'casualties.csv');
		const csvContent = readFileSync(csvPath, 'utf-8');
		
		const numericColumns = [
			'killed', 'injured', 'children_killed', 'women_killed',
			'latitude', 'longitude'
		];
		
		return parseCSVWithCoordinates<CasualtyRecord>(csvContent, numericColumns);
	} catch (error) {
		console.error('Error loading casualties data:', error);
		throw new Error('Failed to load casualties data');
	}
}

/**
 * Load and parse infrastructure CSV data
 */
export async function loadInfrastructureData(): Promise<InfrastructureRecord[]> {
	try {
		const csvPath = join(process.cwd(), 'data', 'infrastructure.csv');
		const csvContent = readFileSync(csvPath, 'utf-8');
		
		const numericColumns = [
			'hospitals_damaged', 'schools_damaged', 'homes_destroyed',
			'latitude', 'longitude'
		];
		
		return parseCSVWithCoordinates<InfrastructureRecord>(csvContent, numericColumns);
	} catch (error) {
		console.error('Error loading infrastructure data:', error);
		throw new Error('Failed to load infrastructure data');
	}
}

/**
 * Load and parse displacement CSV data
 */
export async function loadDisplacementData(): Promise<DisplacementRecord[]> {
	try {
		const csvPath = join(process.cwd(), 'data', 'displacement.csv');
		const csvContent = readFileSync(csvPath, 'utf-8');
		
		const numericColumns = [
			'people_displaced', 'displacement_centers', 'capacity',
			'latitude', 'longitude'
		];
		
		return parseCSVWithCoordinates<DisplacementRecord>(csvContent, numericColumns);
	} catch (error) {
		console.error('Error loading displacement data:', error);
		throw new Error('Failed to load displacement data');
	}
}

/**
 * Get unique locations with their coordinates
 */
export function getUniqueLocations(records: GeographicData[]): GeographicData[] {
	const locationMap = new Map<string, GeographicData>();
	
	records.forEach(record => {
		const key = `${record.location}-${record.area}`;
		if (!locationMap.has(key)) {
			locationMap.set(key, {
				latitude: record.latitude,
				longitude: record.longitude,
				location: record.location,
				area: record.area
			});
		}
	});
	
	return Array.from(locationMap.values());
}

/**
 * Calculate geographic bounds for all data points
 */
export function calculateBounds(records: GeographicData[]): {
	north: number;
	south: number;
	east: number;
	west: number;
} {
	if (records.length === 0) {
		// Default Gaza Strip bounds
		return {
			north: 31.6,
			south: 31.2,
			east: 34.5,
			west: 34.2
		};
	}
	
	const lats = records.map(r => r.latitude);
	const lngs = records.map(r => r.longitude);
	
	return {
		north: Math.max(...lats),
		south: Math.min(...lats),
		east: Math.max(...lngs),
		west: Math.min(...lngs)
	};
}
