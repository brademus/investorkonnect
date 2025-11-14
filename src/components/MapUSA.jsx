import React from "react";

/**
 * Interactive US Map Component
 * 
 * Displays clickable US states
 * Simplified SVG paths for major investment markets
 */

const US_STATES = [
  {
    code: 'CA',
    name: 'California',
    path: 'M100,200 L80,180 L70,190 L75,210 L90,220 Z',
    tooltip: 'California - Major markets: LA, SF, San Diego'
  },
  {
    code: 'TX',
    name: 'Texas',
    path: 'M350,300 L340,280 L360,270 L380,290 L370,310 Z',
    tooltip: 'Texas - Major markets: Houston, Dallas, Austin'
  },
  {
    code: 'FL',
    name: 'Florida',
    path: 'M550,320 L540,310 L545,330 L560,340 L555,325 Z',
    tooltip: 'Florida - Major markets: Miami, Orlando, Tampa'
  },
  {
    code: 'NY',
    name: 'New York',
    path: 'M600,150 L590,140 L595,160 L610,165 L605,150 Z',
    tooltip: 'New York - Major markets: NYC, Buffalo, Rochester'
  },
  {
    code: 'AZ',
    name: 'Arizona',
    path: 'M180,280 L170,270 L175,290 L190,295 L185,280 Z',
    tooltip: 'Arizona - Major markets: Phoenix, Tucson'
  },
  {
    code: 'GA',
    name: 'Georgia',
    path: 'M520,280 L510,270 L515,290 L530,295 L525,280 Z',
    tooltip: 'Georgia - Major markets: Atlanta, Augusta, Savannah'
  },
  {
    code: 'NC',
    name: 'North Carolina',
    path: 'M560,240 L550,230 L555,250 L570,255 L565,240 Z',
    tooltip: 'North Carolina - Major markets: Charlotte, Raleigh'
  },
  {
    code: 'WA',
    name: 'Washington',
    path: 'M120,80 L110,70 L115,90 L130,95 L125,80 Z',
    tooltip: 'Washington - Major markets: Seattle, Spokane'
  },
  {
    code: 'CO',
    name: 'Colorado',
    path: 'M240,200 L230,190 L235,210 L250,215 L245,200 Z',
    tooltip: 'Colorado - Major markets: Denver, Colorado Springs'
  },
  {
    code: 'IL',
    name: 'Illinois',
    path: 'M420,180 L410,170 L415,190 L430,195 L425,180 Z',
    tooltip: 'Illinois - Major markets: Chicago, Aurora'
  }
];

export default function MapUSA({ onStateClick }) {
  const [hoveredState, setHoveredState] = React.useState(null);

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      {/* Map Title */}
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-slate-900 mb-2">
          Where do you want to invest?
        </h3>
        <p className="text-slate-600">
          Click on a state to get started
        </p>
      </div>

      {/* SVG Map */}
      <svg
        viewBox="0 0 700 450"
        className="w-full h-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Map Background */}
        <rect width="700" height="450" fill="#f8fafc" />
        
        {/* States */}
        {US_STATES.map((state) => (
          <g key={state.code}>
            <path
              d={state.path}
              fill={hoveredState === state.code ? '#3b82f6' : '#e2e8f0'}
              stroke="#475569"
              strokeWidth="2"
              className="transition-all duration-200 cursor-pointer"
              onMouseEnter={() => setHoveredState(state.code)}
              onMouseLeave={() => setHoveredState(null)}
              onClick={() => onStateClick(state.code, state.name)}
            />
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredState && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
          {US_STATES.find(s => s.code === hoveredState)?.tooltip}
        </div>
      )}

      {/* State Grid Fallback */}
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {US_STATES.map((state) => (
          <button
            key={state.code}
            onClick={() => onStateClick(state.code, state.name)}
            className="px-4 py-3 bg-white border-2 border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors font-medium text-slate-900"
          >
            {state.name}
          </button>
        ))}
      </div>

      <p className="text-center text-sm text-slate-500 mt-6">
        Don't see your state? <a href="#contact" className="text-blue-600 hover:text-blue-700 underline">Contact us</a> to add it
      </p>
    </div>
  );
}