// frontend/src/components/Dashboard.jsx
import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import Bookmap from './Bookmap';
import { format, parse } from 'date-fns';
import { LockIcon } from './LockIcon';

/** tiny hamburger icon */
const HamburgerIcon = () => (
  <span className="relative block w-3 h-3">
    <span className="absolute inset-x-0 top-0 h-[2px] bg-current" />
    <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-current" />
    <span className="absolute inset-x-0 bottom-0 h-[2px] bg-current" />
  </span>
);

const ChartForm = memo(function ChartForm({
  idx,
  actionLabel,
  collapsible,
  formData,
  todayISO,
  onFieldChange,
  onSubmit,
  onCollapse
}) {
  const dateRef = useRef(null);
  return (
    <div className="flex-1 flex flex-col justify-center items-center space-y-3 w-full text-xs relative px-4 pt-4 pb-4">
      {collapsible && (
        <button
          type="button"
          tabIndex={-1}
          onClick={onCollapse}
          className="absolute -top-1 -left-1 w-5 h-5 flex items-center justify-center text-white hover:opacity-80"
        >
          <HamburgerIcon />
        </button>
      )}
      <input
        type="text"
        placeholder="Enter Symbol (e.g. SPY)"
        value={formData.symbol || ''}
        onChange={e => onFieldChange(idx, 'symbol', e.target.value.toUpperCase())}
        className="w-full glass py-3 px-2 rounded-md focus:outline-none"
      />
      <div className="w-full">
        <input
          type="date"
          ref={dateRef}
          value={formData.expirationDate || todayISO}
          onChange={e => onFieldChange(idx, 'expirationDate', e.target.value)}
          onClick={() => dateRef.current?.showPicker()}
          className="w-full glass py-3 px-2 rounded-md focus:outline-none cursor-pointer"
        />
      </div>
      <div className="flex w-full space-x-2">
        <button
          type="button"
          onClick={() => onFieldChange(idx, 'optionType', 'C')}
          className={`flex-1 py-1 rounded-md focus:outline-none ${
            formData.optionType !== 'P' ? 'bg-blue-400 hover:bg-blue-500 text-white' : 'bg-slate-600 hover:bg-slate-500 text-white'
          }`}
        >
          Call
        </button>
        <button
          type="button"
          onClick={() => onFieldChange(idx, 'optionType', 'P')}
          className={`flex-1 py-1 rounded-md focus:outline-none ${
            formData.optionType === 'P' ? 'bg-blue-400 hover:bg-blue-500 text-white' : 'bg-slate-600 hover:bg-slate-500 text-white'
          }`}
        >
          Put
        </button>
      </div>
      <input
        type="number"
        placeholder="Enter Strike (e.g. 550)"
        value={formData.strike || ''}
        onChange={e => onFieldChange(idx, 'strike', e.target.value)}
        className="w-full glass py-3 px-2 rounded-md focus:outline-none"
      />
      <button
        onClick={() => onSubmit(idx)}
        className="w-full py-3 text-xs text-white bg-blue-400 hover:bg-blue-500 rounded-md transition-colors duration-150"
      >
        {actionLabel}
      </button>
    </div>
  );
});

export default function Dashboard({ apiBaseUrl }) {
  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const [formDataMap, setFormDataMap] = useState({});
  const [gridColumns, setGridColumns] = useState(1);
  const [gridRows, setGridRows] = useState(1);
  const [grid, setGrid] = useState([]);
  const [menuCollapsed, setMenuCollapsed] = useState({});
  const [autoRefresh] = useState(true);
  const [chartLocks, setChartLocks] = useState({});
  const [formExpanded, setFormExpanded] = useState({ 0: true });
  const toggleLock = useCallback((idx) => {
    setChartLocks(prev => {
      const newLocks = { ...prev, [idx]: !prev[idx] };
      setGrid(prevGrid => {
        const next = [...prevGrid];
        if (next[idx]) {
          next[idx] = { ...next[idx], isLocked: newLocks[idx] };
        }
        return next;
      });
      return newLocks;
    });
  }, []);

  useEffect(() => {
    const total = gridRows * gridColumns;
    const newGrid = prev =>
      prev.length === total
        ? prev
        : [...prev.slice(0, total), ...Array(total - prev.length).fill(null)];
    
    setGrid(prev => {
      const result = newGrid(prev);
      const newIndices = Array.from({length: total}, (_, i) => i).filter(i => i >= prev.length);
      if (newIndices.length > 0) {
        setFormExpanded(prev => ({
          ...prev,
          ...Object.fromEntries(newIndices.map(i => [i, true]))
        }));
      }
      return result;
    });
  }, [gridRows, gridColumns]);

  const handleFormChange = useCallback((idx, field, value) => {
    setFormDataMap(prev => ({
      ...prev,
      [idx]: { ...(prev[idx] || {}), [field]: value }
    }));
  }, []);

  const buildSymbolCode = fd => {
    const expDate = parse(fd.expirationDate || todayISO, 'yyyy-MM-dd', new Date());
    const expYYMMDD = format(expDate, 'yyMMdd');
    const paddedStrike = ((parseFloat(fd.strike) || 0) * 1000)
      .toString()
      .padStart(8, '0');
    return `${(fd.symbol || '').padEnd(6, ' ')}${expYYMMDD}${fd.optionType || 'C'}${paddedStrike}`;
  };

  const buildDisplaySymbol = fd => {
    const expDate = parse(fd.expirationDate || todayISO, 'yyyy-MM-dd', new Date());
    const expYYMMDD = format(expDate, 'yyMMdd');
    return `${(fd.symbol || '').toUpperCase()}${expYYMMDD}${fd.optionType || 'C'}${parseFloat(fd.strike) || ''}`;
  };

  const handleCreateChart = idx => {
    const fd = formDataMap[idx] || {};
    const apiSymbol = buildSymbolCode(fd);
    const displaySymbol = buildDisplaySymbol(fd);
    setGrid(prev => {
      const next = [...prev];
      next[idx] = { 
        id: Date.now(), 
        apiSymbol, 
        displaySymbol, 
        autoRefresh,
        isLocked: chartLocks[idx] || false
      };
      return next;
    });
    setFormExpanded(prev => ({ ...prev, [idx]: false }));
    setMenuCollapsed(prev => ({ ...prev, [idx]: false }));
  };

  const handleClearCell = idx => {
    setGrid(prevGrid => {
      const next = [...prevGrid];
      next[idx] = null;
      const filled = next.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
      if (filled.length === 0) {
        setGridRows(1);
        setGridColumns(1);
        return [null];
      }
      const maxIdx = Math.max(...filled);
      const newRows = Math.floor(maxIdx / gridColumns) + 1;
      const newCols = filled.reduce((m, i) => Math.max(m, i % gridColumns), 0) + 1;
      setGridRows(newRows);
      setGridColumns(newCols);
      const trimmed = [];
      for (let r = 0; r < newRows; r++) {
        for (let c = 0; c < newCols; c++) {
          trimmed.push(next[r * gridColumns + c] ?? null);
        }
      }
      return trimmed;
    });
    setFormExpanded(prev => ({ ...prev, [idx]: false }));
    setMenuCollapsed(prev => ({ ...prev, [idx]: false }));
    setFormDataMap(prev => {
      const { [idx]: _, ...rest } = prev;
      return rest;
    });
  };

  const RedXButton = ({ onClick }) => (
    <button
      type="button"
      tabIndex={-1}
      onClick={onClick}
      className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-red-600 text-black hover:bg-red-500 leading-none text-lg font-medium"
    >
      ×
    </button>
  );

  const PlusBtn = ({ onClick, className }) => (
    <button
      type="button"
      tabIndex={-1}
      onClick={onClick}
      className={`bg-slate-700 hover:bg-slate-600 rounded-sm w-5 h-5 flex items-center justify-center text-white text-xs shadow-md ${className}`}
    >
      +
    </button>
  );

  const MenuButton = ({ idx }) => (
    <div className="absolute top-1 left-1">
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setMenuCollapsed(prev => ({ ...prev, [idx]: !prev[idx] }))}
        className="w-5 h-5 flex items-center justify-center text-white hover:opacity-80"
      >
        <HamburgerIcon />
      </button>
    </div>
  );

  return (
    <div className="relative overflow-visible">
      <main className="m-0 p-0">
        <div className="grid gap-1 overflow-visible mx-auto"
          style={{
            gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${gridRows}, auto)`
          }}
        >
          {grid.map((cell, idx) => {
            const col = idx % gridColumns;
            const row = Math.floor(idx / gridColumns);
            const isLastCol = col === gridColumns - 1;
            const isLastRow = row === gridRows - 1;

            return (
              <div
                key={idx}
                className="relative flex flex-col overflow-visible border-4 border-blue-400/70 rounded-md p-0"
                style={{ minWidth: 0 }}
              >
                {isLastCol && (
                  <PlusBtn
                    onClick={() => setGridColumns(c => c + 1)}
                    className="absolute right-[-1.125rem] top-1/2 -translate-y-1/2"
                  />
                )}
                {isLastRow && (
                  <PlusBtn
                    onClick={() => setGridRows(r => r + 1)}
                    className="absolute bottom-[-1.125rem] left-1/2 -translate-x-1/2"
                  />
                )}

                {cell && <RedXButton onClick={() => handleClearCell(idx)} />}
                {cell && <MenuButton idx={idx} />}

                {cell ? (
                  <>
                    {menuCollapsed[idx] && (
                      <div className="glass px-4 py-2 mb-1 space-y-2 text-xs">
                        <ChartForm
                          idx={idx}
                          actionLabel="Update Chart"
                          collapsible
                          formData={formDataMap[idx] || { optionType: 'C' }}
                          todayISO={todayISO}
                          onFieldChange={handleFormChange}
                          onSubmit={handleCreateChart}
                          onCollapse={() =>
                            setMenuCollapsed(prev => ({ ...prev, [idx]: false }))
                          }
                        />
                      </div>
                    )}                    
                    <div className="pl-0">
                      <Bookmap
                        apiBaseUrl={apiBaseUrl}
                        symbol={cell.apiSymbol}
                        displaySymbol={cell.displaySymbol}
                        autoRefresh={cell.autoRefresh}
                        isLocked={cell.isLocked}
                        onToggleLock={() => toggleLock(idx)}
                        minimal
                      />
                    </div>
                  </>
                ) : (
                  <ChartForm
                    idx={idx}
                    actionLabel="Create Chart"
                    collapsible={false}
                    formData={formDataMap[idx] || {optionType: 'C' }}
                    todayISO={todayISO}
                    onFieldChange={handleFormChange}
                    onSubmit={handleCreateChart}
                  />
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
