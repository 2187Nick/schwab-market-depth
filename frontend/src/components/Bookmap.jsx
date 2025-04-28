// frontend/src/components/Bookmap.jsx
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createChart } from 'lightweight-charts';
import { HeatMapSeries } from '../heatmap/render';
import { LockIcon } from './LockIcon';

/** ±10% helper with minimum value of 0.05 and never below 0 */
const pctBand = p => ({ minValue: Math.max(0, Math.min(p - 0.05, p * 0.9)), maxValue: Math.max(p + 0.05, p * 1.1) });    

export default function Bookmap({
  apiBaseUrl,
  symbol: propSymbol,
  minimal = false,
}) {
  const { symbol: routeSym = '' } = useParams();
  const symbol = propSymbol || routeSym;
  const navigate = useNavigate();

  const chartEl = useRef(null);
  const chart    = useRef(null);
  const series   = useRef({});
  const history  = useRef([]);
  const lastPrice = useRef(null);
  const initialDone = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshRate, setRefreshRate] = useState(1000);
  const [latest, setLatest] = useState({
    last_price: null,
    last_size: null,
    underlying_price: null,
  });

  // Lock modes:
  // 0 = Auto mode (±10% band around last price, y-axis locked)
  // 1 = Manual mode (user can freely scale y-axis)
  const [lockMode, setLockMode] = useState(0);

  const applyUnlocked = () => {
    series.current.heatmap.applyOptions({
      autoscaleInfoProvider: undefined,
    });
  };

  /* Handle lock mode changes */
  useEffect(() => {
    if (!chart.current) return;
    
    // Configure user interaction based on mode
    chart.current.applyOptions({
      handleScale: {
        axisPressedMouseMove: { time: true, price: lockMode === 1 },
        mouseWheel:            lockMode === 1,
        pinch:                 lockMode === 1,
        axisDoubleClickReset:  lockMode === 1,
        shiftPressedMouseMove: true,
      },
    });

    // Set price range behavior based on mode
    if (lockMode === 0 && lastPrice.current != null) {
      // Auto mode: Lock to ±10% band
      const band = pctBand(lastPrice.current);
      series.current.heatmap.applyOptions({
        autoscaleInfoProvider: () => ({ priceRange: band }),
      });
    } else if (lockMode === 1) {
      // Manual mode: Remove price range constraints
      series.current.heatmap.applyOptions({
        autoscaleInfoProvider: undefined,
      });
    }
  }, [lockMode]);

  const fetchHist = useCallback(async enc => {
    if (!chart.current) return;
    try {
      const r = await fetch(`${apiBaseUrl}/historical_full/${enc}`);
      if (!r.ok) return;
      const d = await r.json();
      
      // Process historical data ensuring ascending timestamps
      let lastTime = 0;
      history.current = (d.snapshots || [])
        .filter(s => s.levels?.length)
        .map(s => {
          // Ensure each timestamp is at least 1 second after the previous
          let time = Math.floor(s.timestamp / 1000);
          if (time <= lastTime) {
            time = lastTime + 1;
          }
          lastTime = time;
          
          return {
            time,
            cells: s.levels.map(l => ({
              low: +l.price,
              high: +l.price + 0.01,
              amount: l.quantity * (l.side === 'BID' ? 1 : -1),
            })),
            lastPrice: s.last_price,  // Move these to the top level
            lastSize: s.last_size     // to match the renderer's expectations
          };
        });
      
      // Sort to ensure ascending order
      history.current.sort((a, b) => a.time - b.time);
      series.current.heatmap.setData(history.current);
      chart.current.timeScale().scrollToRealTime();
    } catch (e) {
      console.error(e);
    }
  }, [apiBaseUrl]);

  const fetchDepth = useCallback(async enc => {
    if (!chart.current || !series.current.heatmap) return;
    try {
      const r = await fetch(`${apiBaseUrl}/depth/${enc}?_=${Date.now()}`);
      if (!r.ok) return;
      const d = await r.json();
      if (!d?.levels) return;

      // Get current timestamp and ensure it's newer than last entry
      const currentTime = Math.floor(d.timestamp / 1000);
      const lastTime = history.current.at(-1)?.time || 0;
      
      // Skip update if the timestamp is older than our latest data
      if (currentTime < lastTime) {
        return;
      }
      
      // Use a timestamp that's definitely newer than our last entry
      const ts = Math.max(currentTime, lastTime + 1);

      // push latest price info
      setLatest(prev => ({
        last_price:      d.last_price ?? prev.last_price,
        last_size:       d.last_size  ?? prev.last_size,
        underlying_price:d.underlying_price ?? prev.underlying_price,
      }));
      lastPrice.current = d.last_price ?? lastPrice.current;

      // Process new levels
      const cells = d.levels
        .filter(l => l.quantity > 0)
        .map(l => ({
          low: l.price,
          high: l.price + 0.01,
          amount: l.quantity * (l.side === 'BID' ? 1 : -1),
        }));
      
      // Only add new data point if we have cells or last trade data
      if (cells.length > 0 || d.last_size) {
        // Remove any future timestamps (shouldn't happen, but just in case)
        history.current = history.current.filter(h => h.time <= ts);
        // Prepare data point with trade information
        const dataPoint = { 
          time: ts, 
          cells,
          // Only include trade data if we have both price and size
          ...(d.last_price != null && d.last_size != null ? {
            lastPrice: d.last_price,
            lastSize: d.last_size
          } : {})
        };
        history.current.push(dataPoint);
      }
      
      // Sort to ensure ascending order
      history.current.sort((a, b) => a.time - b.time);
      series.current.heatmap.setData(history.current);

      // —— INITIAL ZOOM ONCE —— 
      if (!initialDone.current && lastPrice.current != null) {
        const band = pctBand(lastPrice.current);
        
        // Apply the initial zoom using the pctBand auto mode
        series.current.heatmap.applyOptions({
          autoscaleInfoProvider: () => ({ priceRange: band }),
        });
        
        initialDone.current = true;
      }

      // Calculate the time range to show (only during initial period)
      if (history.current.length > 0) {
        const firstDataTime = history.current[0]?.time || ts;
        const totalTimeRange = ts - firstDataTime;
        
        // Only adjust the visible range if we haven't reached 3 minutes yet
        if (totalTimeRange < 180) {
          chart.current.timeScale().setVisibleRange({ 
            from: ts - totalTimeRange, 
            to: ts 
          });
        }
      }

      // —— EVERY‐TICK OVERRIDE IF LOCKED (mode 0) —— 
      if (lockMode === 0 && lastPrice.current != null) {
        const band = pctBand(lastPrice.current);
        series.current.heatmap.applyOptions({
          autoscaleInfoProvider: () => ({ priceRange: band }),
        });
      }

      chart.current.timeScale().scrollToRealTime();
      setLoading(false);
    } catch (e) {
      console.error(e);
      setError(e.message);
      setLoading(false);
    }
  }, [apiBaseUrl, lockMode]);

  /* chart init */
  useEffect(() => {
    if (!chartEl.current || chart.current) return;
    chart.current = createChart(chartEl.current, {
      width: chartEl.current.clientWidth,
      height: 600,
      layout: { background: { color: '#000' }, textColor: '#DDD', fontSize: 12 },
      grid: { vertLines: { visible: true, color: '#333' }, horzLines: { visible: true, color: '#333' } },
      rightPriceScale: { borderColor: '#444', autoScale: true, scaleMargins: { top: 0.2, bottom: 0.2 } },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 20,
        barSpacing: 3,
        shiftVisibleRangeOnNewBar: true,
        tickMarkFormatter: t => new Date(t * 1000).toLocaleTimeString(),
      },
      crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
      handleScale: { 
        axisPressedMouseMove: { time: true, price: false }, // Start with price axis locked
        mouseWheel: false,  // Disable mouse wheel for price scale
        pinch: false,       // Disable pinch for price scale
        axisDoubleClickReset: false,  // Disable double click reset for price scale
        shiftPressedMouseMove: true 
      },
    });
    const hm = new HeatMapSeries();
    series.current.heatmap = chart.current.addCustomSeries(hm, {
      priceScaleId: 'right',
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      timeFormat: 'timestamp',
      cellBorderWidth: 1,
      cellBorderColor: '#333',
      lastValueVisible: false,
      priceLineVisible: false,
      cellShader: a => `rgba(${a>0?'76,175,80':'244,67,54'},${Math.min(Math.abs(a)/100,1)})`,
      autoscaleInfoProvider: undefined,
    });
    const resize = () => chart.current.applyOptions({ width: chartEl.current.clientWidth });
    const ro = new ResizeObserver(resize);
    ro.observe(chartEl.current);
    window.addEventListener('resize', resize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', resize);
      chart.current.remove();
      chart.current = null;
      series.current = {};
      history.current = [];
    };
  }, []);

  /* symbol change & polling */
  useEffect(() => {
    if (!chart.current || !symbol) return;
    const m = symbol.replace(/%20/g,' ').match(/([A-Z]+)(\d{6}[CP]\d+)/);
    const fmt = m ? `${m[1].padEnd(6,' ')}${m[2]}` : symbol;
    const enc = encodeURIComponent(fmt);

    setLoading(true);
    history.current = [];
    lastPrice.current = null;
    initialDone.current = false;

    if (series.current.heatmap) {
      series.current.heatmap.setData([]);
      chart.current.priceScale('right').applyOptions({ autoScale: true });
    }

    fetchHist(enc).then(() => fetchDepth(enc));
    if (autoRefresh) {
      const id = setInterval(() => fetchDepth(enc), refreshRate);
      return () => clearInterval(id);
    }
  }, [symbol, autoRefresh, refreshRate, fetchHist, fetchDepth]);

  /* UI for the 2-state toggle */
  const lockTitle = [ 
    'Auto (±10% band)',
    'Manual mode',
  ][lockMode];

  const Mini = () => (
    <div className="mb-2 text-xs flex items-center space-x-6 pl-8">
      <span className="font-mono text-blue-400 break-all">
        {symbol.replace(/(\w+)\s+(\d{6})([CP])0*(\d+)000/,'$1 $2$3$4')}
      </span>
      {latest.last_price  != null && <> <span>Last:</span><span className="font-mono">{latest.last_price.toFixed(2)}</span></>}
      {latest.last_size   != null && <> <span>Size:</span><span className="font-mono">{latest.last_size}</span></>}
      {latest.underlying_price!=null && <> <span>Und:</span><span className="font-mono">{latest.underlying_price.toFixed(2)}</span></>}
    </div>
  );

  return (
    <div className="bg-black text-white px-0 py-2">
      {error && (
        <div className="p-4 bg-red-800 rounded mb-4">
          <p className="font-bold">Error:</p>
          <p className="mt-1">{error}</p>
          <button onClick={() => { setError(null); setLoading(true); fetchDepth(symbol); }}
                  className="mt-4 bg-yellow-500 hover:bg-yellow-600 px-3 py-1 rounded text-black text-sm">
            Retry
          </button>
        </div>
      )}
      {minimal ? <Mini/> : null}
      <div ref={chartEl}
           className="bg-black border border-gray-700 rounded relative w-full"
           style={{ height: 600 }}>
        {(loading || (!chart.current && !error)) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75 text-sm text-gray-300 z-20">
            {chart.current ? `Loading market depth for ${symbol}…` : 'Initializing chart…'}
          </div>
        )}
        <div className="absolute bottom-2 right-2 z-10">
          <button
            onClick={() => setLockMode(mode => mode === 0 ? 1 : 0)}
            className="w-10 h-7 flex items-center justify-center transition-transform focus:outline-none"
            title={lockTitle}
          >
            <LockIcon locked={lockMode === 1} />
          </button>
        </div>
      </div>
    </div>
  );
}
