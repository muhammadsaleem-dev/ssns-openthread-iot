/**
 * Shared utility functions for the dashboard.
 */

/**
 * Format an ISO timestamp to a short locale string.
 * Returns "—" for null/undefined.
 */
export function formatTimestamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const absolute = d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const now = new Date();
  const diffInSeconds = Math.floor((now - d) / 1000);
  
  let relative = '';
  if (diffInSeconds < 5) {
    relative = 'Just now';
  } else if (diffInSeconds < 60) {
    relative = `${diffInSeconds}s ago`;
  } else if (diffInSeconds < 3600) {
    relative = `${Math.floor(diffInSeconds / 60)}m ago`;
  } else if (diffInSeconds < 86400) {
    relative = `${Math.floor(diffInSeconds / 3600)}h ago`;
  } else {
    relative = `${Math.floor(diffInSeconds / 86400)}d ago`;
  }

  return `${absolute} (${relative})`;
}

/**
 * Format a timestamp to time-only for chart axes.
 */
export function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Compute the arithmetic mean of an array of numbers.
 * Returns 0 for empty arrays.
 */
export function average(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

/**
 * Computes a standard Air Quality Index (AQI) based on PM2.5 and PM10.
 * Returns the higher AQI value between the two pollutants.
 */
export function computeAqi(pm25, pm10) {
  const calcSubIndex = (conc, breakpoints) => {
    for (let i = 0; i < breakpoints.length; i++) {
      const bp = breakpoints[i];
      if (conc >= bp.cLow && conc <= bp.cHigh) {
        return Math.round(
          ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (conc - bp.cLow) + bp.iLow
        );
      }
    }
    // If it exceeds the chart, extrapolate from the last tier
    const last = breakpoints[breakpoints.length - 1];
    return Math.round(
      ((last.iHigh - last.iLow) / (last.cHigh - last.cLow)) * (conc - last.cLow) + last.iLow
    );
  };

  const pm25Bps = [
    { cLow: 0.0, cHigh: 12.0, iLow: 0, iHigh: 50 },
    { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
    { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
    { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
    { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
    { cLow: 250.5, cHigh: 500.4, iLow: 301, iHigh: 500 },
  ];

  const pm10Bps = [
    { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
    { cLow: 55, cHigh: 154, iLow: 51, iHigh: 100 },
    { cLow: 155, cHigh: 254, iLow: 101, iHigh: 150 },
    { cLow: 255, cHigh: 354, iLow: 151, iHigh: 200 },
    { cLow: 355, cHigh: 424, iLow: 201, iHigh: 300 },
    { cLow: 425, cHigh: 604, iLow: 301, iHigh: 500 },
  ];

  const aqi25 = pm25 !== undefined && pm25 !== null ? calcSubIndex(pm25, pm25Bps) : 0;
  const aqi10 = pm10 !== undefined && pm10 !== null ? calcSubIndex(pm10, pm10Bps) : 0;

  return Math.max(aqi25, aqi10);
}
