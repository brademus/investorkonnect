/**
 * Location Data for US States
 * 
 * Provides county and city data for autocomplete in location picker
 */

// Embedded location data - expand as needed
const LOCATIONS = {
  'AL': {
    counties: ['Jefferson', 'Mobile', 'Madison', 'Montgomery', 'Tuscaloosa'],
    cities: ['Birmingham', 'Montgomery', 'Mobile', 'Huntsville', 'Tuscaloosa']
  },
  'AZ': {
    counties: ['Maricopa', 'Pima', 'Pinal', 'Yavapai', 'Coconino'],
    cities: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale']
  },
  'CA': {
    counties: ['Los Angeles', 'San Diego', 'Orange', 'Riverside', 'San Bernardino', 'Santa Clara', 'Alameda'],
    cities: ['Los Angeles', 'San Diego', 'San Jose', 'San Francisco', 'Fresno', 'Sacramento', 'Oakland']
  },
  'CO': {
    counties: ['Denver', 'El Paso', 'Jefferson', 'Arapahoe', 'Adams', 'Boulder'],
    cities: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood', 'Boulder']
  },
  'FL': {
    counties: ['Miami-Dade', 'Broward', 'Palm Beach', 'Orange', 'Hillsborough', 'Pinellas'],
    cities: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale', 'St. Petersburg']
  },
  'GA': {
    counties: ['Fulton', 'Gwinnett', 'Cobb', 'DeKalb', 'Clayton', 'Forsyth'],
    cities: ['Atlanta', 'Augusta', 'Columbus', 'Macon', 'Savannah', 'Athens']
  },
  'IL': {
    counties: ['Cook', 'DuPage', 'Lake', 'Will', 'Kane', 'McHenry'],
    cities: ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford', 'Elgin']
  },
  'MA': {
    counties: ['Middlesex', 'Worcester', 'Suffolk', 'Essex', 'Norfolk'],
    cities: ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell']
  },
  'NC': {
    counties: ['Mecklenburg', 'Wake', 'Guilford', 'Forsyth', 'Durham', 'Cumberland'],
    cities: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville']
  },
  'NV': {
    counties: ['Clark', 'Washoe', 'Carson City'],
    cities: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas']
  },
  'NY': {
    counties: ['Kings', 'Queens', 'New York', 'Suffolk', 'Bronx', 'Nassau'],
    cities: ['New York', 'Buffalo', 'Rochester', 'Syracuse', 'Albany', 'Yonkers']
  },
  'OH': {
    counties: ['Cuyahoga', 'Franklin', 'Hamilton', 'Summit', 'Montgomery', 'Lucas'],
    cities: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton']
  },
  'PA': {
    counties: ['Philadelphia', 'Allegheny', 'Montgomery', 'Bucks', 'Delaware', 'Chester'],
    cities: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading', 'Scranton']
  },
  'TN': {
    counties: ['Shelby', 'Davidson', 'Knox', 'Hamilton', 'Rutherford', 'Williamson'],
    cities: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville', 'Murfreesboro']
  },
  'TX': {
    counties: ['Harris', 'Dallas', 'Tarrant', 'Bexar', 'Travis', 'Collin'],
    cities: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth', 'El Paso']
  },
  'UT': {
    counties: ['Salt Lake', 'Utah', 'Davis', 'Weber', 'Washington'],
    cities: ['Salt Lake City', 'Provo', 'West Valley City', 'West Jordan', 'Orem']
  },
  'WA': {
    counties: ['King', 'Pierce', 'Snohomish', 'Spokane', 'Clark', 'Thurston'],
    cities: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Kent']
  },
  'WI': {
    counties: ['Milwaukee', 'Dane', 'Waukesha', 'Brown', 'Racine', 'Outagamie'],
    cities: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine', 'Appleton']
  }
};

/**
 * Load location data for a state
 * @param {string} stateCode - Two-letter state code (e.g., 'CA', 'TX')
 * @returns {Promise<{counties: string[], cities: string[]}>}
 */
export const loadLocationsForState = async (stateCode) => {
  // Simulate async loading (can be replaced with API call)
  return new Promise((resolve) => {
    setTimeout(() => {
      const locations = LOCATIONS[stateCode] || { counties: [], cities: [] };
      resolve(locations);
    }, 100);
  });
};

/**
 * Get all available states with location data
 * @returns {string[]} Array of state codes
 */
export const getAvailableStates = () => {
  return Object.keys(LOCATIONS);
};