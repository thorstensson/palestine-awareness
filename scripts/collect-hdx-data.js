/**
 * UN OCHA HDX Data Collection Script for Gaza
 * Fetches humanitarian data and converts to our CSV format
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Gaza coordinates mapping
const GAZA_COORDINATES = {
  'Gaza': { lat: 31.5017, lng: 34.4668, area: 'North Gaza' },
  'Gaza City': { lat: 31.5017, lng: 34.4668, area: 'North Gaza' },
  'Khan Younis': { lat: 31.3469, lng: 34.3044, area: 'South Gaza' },
  'Rafah': { lat: 31.2948, lng: 34.2492, area: 'South Gaza' },
  'Deir al-Balah': { lat: 31.4181, lng: 34.3517, area: 'Central Gaza' },
  'Jabalia': { lat: 31.5314, lng: 34.4831, area: 'North Gaza' },
  'Gaza Strip': { lat: 31.4181, lng: 34.3668, area: 'Gaza Strip' }
};

/**
 * Get coordinates for a location
 */
function getCoordinates(location) {
  // Try exact match first
  if (GAZA_COORDINATES[location]) {
    return GAZA_COORDINATES[location];
  }
  
  // Try partial match
  for (const [key, coords] of Object.entries(GAZA_COORDINATES)) {
    if (location.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(location.toLowerCase())) {
      return coords;
    }
  }
  
  // Default to Gaza Strip center
  return GAZA_COORDINATES['Gaza Strip'];
}

/**
 * Fetch HDX datasets for Palestine/Gaza
 */
async function fetchHDXDatasets() {
  try {
    console.log('🔍 Searching for Gaza datasets on HDX...');
    
    const response = await fetch(
      'https://data.humdata.org/api/3/action/package_search?q=gaza OR palestine&rows=20'
    );
    
    if (!response.ok) {
      throw new Error(`HDX API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error('HDX API returned unsuccessful response');
    }
    
    console.log(`📊 Found ${data.result.count} datasets`);
    
    // Filter for relevant datasets
    const relevantDatasets = data.result.results.filter(dataset => {
      const title = dataset.title.toLowerCase();
      const notes = (dataset.notes || '').toLowerCase();
      
      return (
        title.includes('gaza') || 
        title.includes('palestine') ||
        title.includes('casualt') ||
        title.includes('displacement') ||
        notes.includes('gaza')
      );
    });
    
    console.log(`✅ Found ${relevantDatasets.length} relevant datasets`);
    
    return relevantDatasets;
    
  } catch (error) {
    console.error('❌ Error fetching HDX datasets:', error.message);
    return [];
  }
}

/**
 * Download and process a CSV resource
 */
async function processCSVResource(resource, datasetTitle) {
  try {
    console.log(`📥 Downloading: ${resource.name}`);
    
    const response = await fetch(resource.url);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }
    
    const csvContent = await response.text();
    
    // Save raw data
    const rawFileName = `hdx-raw-${Date.now()}-${resource.name.replace(/[^a-z0-9]/gi, '_')}.csv`;
    const rawPath = path.join(__dirname, '..', 'data', 'raw', rawFileName);
    
    // Ensure raw directory exists
    const rawDir = path.dirname(rawPath);
    if (!fs.existsSync(rawDir)) {
      fs.mkdirSync(rawDir, { recursive: true });
    }
    
    fs.writeFileSync(rawPath, csvContent);
    console.log(`💾 Saved raw data: ${rawFileName}`);
    
    // Try to parse and convert to our format
    const lines = csvContent.split('\n');
    if (lines.length < 2) return null;
    
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    console.log(`📋 Headers found: ${headers.join(', ')}`);
    
    // Check if this looks like casualty data
    if (headers.some(h => h.includes('killed') || h.includes('death') || h.includes('casualt'))) {
      return convertToCasualtyFormat(csvContent, datasetTitle);
    }
    
    // Check if this looks like displacement data
    if (headers.some(h => h.includes('displac') || h.includes('refugee') || h.includes('idp'))) {
      return convertToDisplacementFormat(csvContent, datasetTitle);
    }
    
    return null;
    
  } catch (error) {
    console.error(`❌ Error processing ${resource.name}:`, error.message);
    return null;
  }
}

/**
 * Convert data to our casualty CSV format
 */
function convertToCasualtyFormat(csvContent, source) {
  const lines = csvContent.split('\n');
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  
  const convertedData = [];
  convertedData.push('date,killed,injured,children_killed,women_killed,latitude,longitude,location,area,source');
  
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(cell => cell.trim());
    if (row.length < headers.length) continue;
    
    const rowData = {};
    headers.forEach((header, index) => {
      rowData[header] = row[index];
    });
    
    // Try to extract relevant fields
    const date = extractDate(rowData);
    const killed = extractNumber(rowData, ['killed', 'death', 'fatal']);
    const injured = extractNumber(rowData, ['injured', 'wound']);
    const location = extractLocation(rowData);
    const coords = getCoordinates(location);
    
    if (date && (killed > 0 || injured > 0)) {
      convertedData.push([
        date,
        killed || 0,
        injured || 0,
        0, // children_killed - would need specific data
        0, // women_killed - would need specific data
        coords.lat,
        coords.lng,
        location,
        coords.area,
        source
      ].join(','));
    }
  }
  
  return convertedData.length > 1 ? convertedData.join('\n') : null;
}

/**
 * Extract date from row data
 */
function extractDate(rowData) {
  const dateFields = ['date', 'event_date', 'data_date', 'timestamp'];
  
  for (const field of dateFields) {
    if (rowData[field]) {
      const date = new Date(rowData[field]);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  return new Date().toISOString().split('T')[0]; // Default to today
}

/**
 * Extract number from row data
 */
function extractNumber(rowData, keywords) {
  for (const [key, value] of Object.entries(rowData)) {
    if (keywords.some(keyword => key.includes(keyword))) {
      const num = parseInt(value);
      if (!isNaN(num)) return num;
    }
  }
  return 0;
}

/**
 * Extract location from row data
 */
function extractLocation(rowData) {
  const locationFields = ['location', 'admin1', 'admin2', 'region', 'area', 'place'];
  
  for (const field of locationFields) {
    if (rowData[field] && rowData[field].toLowerCase().includes('gaza')) {
      return rowData[field];
    }
  }
  
  return 'Gaza Strip';
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting HDX data collection for Gaza...');
  
  try {
    const datasets = await fetchHDXDatasets();
    
    if (datasets.length === 0) {
      console.log('❌ No datasets found');
      return;
    }
    
    console.log('\n📋 Available datasets:');
    datasets.forEach((dataset, index) => {
      console.log(`${index + 1}. ${dataset.title}`);
      console.log(`   Resources: ${dataset.num_resources}`);
      console.log(`   Updated: ${dataset.metadata_modified.split('T')[0]}`);
      console.log('');
    });
    
    // Process CSV resources from datasets
    for (const dataset of datasets.slice(0, 5)) { // Limit to first 5 datasets
      console.log(`\n🔄 Processing dataset: ${dataset.title}`);
      
      for (const resource of dataset.resources) {
        if (resource.format && resource.format.toLowerCase() === 'csv') {
          const convertedData = await processCSVResource(resource, dataset.title);
          
          if (convertedData) {
            const fileName = `hdx-converted-${Date.now()}.csv`;
            const filePath = path.join(__dirname, '..', 'data', fileName);
            fs.writeFileSync(filePath, convertedData);
            console.log(`✅ Converted data saved: ${fileName}`);
          }
        }
      }
    }
    
    console.log('\n🎉 Data collection completed!');
    console.log('📁 Check the data/ folder for new files');
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
  }
}

// Run the script
main();
