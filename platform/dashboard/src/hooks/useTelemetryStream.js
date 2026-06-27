import { useState, useEffect, useRef } from 'react';
import API from '../config/api';

export default function useTelemetryStream() {
  const [streamData, setStreamData] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimeout = useRef(null);

  useEffect(() => {
    let isCurrent = true;

    const connect = () => {
      // Determine WebSocket URL based on HTTP API base URL
      let wsUrl = '';
      if (API.BASE_URL) {
        wsUrl = API.BASE_URL.replace(/^http/, 'ws') + '/ws/telemetry';
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;
      }
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected to', wsUrl);
      };

      ws.onmessage = (event) => {
        if (!isCurrent) return;
        try {
          const newPacket = JSON.parse(event.data);
          setStreamData(prev => {
            // Append new packet, keeping max 10000 items
            const updated = [...prev, newPacket];
            if (updated.length > 10000) {
              return updated.slice(updated.length - 10000);
            }
            return updated;
          });
        } catch (e) {
          console.error("Error parsing WebSocket message", e);
        }
      };

      ws.onclose = () => {
        if (isCurrent) {
          console.log('WebSocket disconnected, reconnecting in 5s...');
          reconnectTimeout.current = setTimeout(connect, 5000);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close(); // trigger onclose to reconnect
      };
    };

    connect();

    return () => {
      isCurrent = false;
      clearTimeout(reconnectTimeout.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Provide a function to initialize the state with historical data
  const initStreamData = (historicalData) => {
    if (historicalData && Array.isArray(historicalData)) {
      setStreamData(historicalData);
    }
  };

  return { streamData, initStreamData };
}
