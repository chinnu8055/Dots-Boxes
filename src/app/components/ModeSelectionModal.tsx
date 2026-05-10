import { useState } from 'react';
import { X, Zap, Clock, Coffee, Infinity as InfinityIcon, Grid } from 'lucide-react';

interface ModeSelectionModalProps {
  onClose: () => void;
  onSelectMode: (seconds: number, gridSize: number) => void;
}

export function ModeSelectionModal({ onClose, onSelectMode }: ModeSelectionModalProps) {
  const [gridSize, setGridSize] = useState(5);
  const modes = [
    { label: 'Rapid', seconds: 10, icon: Zap, color: '#FF6B9D' },
    { label: 'Quick Match', seconds: 30, icon: Clock, color: '#5B9BD5' },
    { label: 'Relaxed', seconds: 60, icon: Coffee, color: '#7BC96F' },
    { label: 'Classroom Mode', seconds: Number.POSITIVE_INFINITY, icon: InfinityIcon, color: '#9B87D4' },
  ];

  const gridSizes = [
    { label: 'Small', size: 5 },
    { label: 'Medium', size: 7 },
    { label: 'Large', size: 9 },
  ];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-6 z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md p-6 rounded-xl relative"
        style={{
          backgroundColor: 'var(--paper)',
          border: '3px solid var(--ink)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-[var(--scribble)] transition-colors"
          aria-label="Close"
        >
          <X size={24} color="var(--ink)" />
        </button>

        <h2 className="text-2xl mb-4" style={{ color: 'var(--ink)' }}>
          Grid Size
        </h2>

        <div className="flex gap-2 mb-8">
          {gridSizes.map((gs) => (
            <button
              key={gs.size}
              onClick={() => setGridSize(gs.size)}
              className="flex-1 py-3 px-2 border-2 rounded-xl transition-all"
              style={{
                borderColor: gridSize === gs.size ? 'var(--ink)' : 'var(--ink-light)',
                backgroundColor: gridSize === gs.size ? 'var(--scribble)' : 'transparent',
                color: 'var(--ink)',
                borderWidth: gridSize === gs.size ? '3px' : '2px',
                opacity: gridSize === gs.size ? 1 : 0.6,
              }}
            >
              <div className="text-sm opacity-70 mb-1">{gs.label}</div>
              <div className="text-xl font-bold">{gs.size}x{gs.size}</div>
            </button>
          ))}
        </div>

        <h2 className="text-2xl mb-4" style={{ color: 'var(--ink)' }}>
          Turn Time
        </h2>

        <div className="flex flex-col gap-3">
          {modes.map((mode) => (
            <button
              key={mode.label}
              onClick={() => {
                onSelectMode(mode.seconds, gridSize);
              }}
              className="w-full py-4 px-5 border-2 rounded-xl transition-all hover:translate-y-[-2px] active:translate-y-[1px] flex items-center gap-3"
              style={{
                borderColor: 'var(--ink)',
                backgroundColor: 'transparent',
                color: 'var(--ink)',
                borderStyle: 'solid',
                borderWidth: '2.5px',
              }}
            >
              <mode.icon size={24} color={mode.color} strokeWidth={2.5} />
              <span className="text-xl flex-1 text-left">{mode.label}</span>
              <span className="text-lg" style={{ color: 'var(--ink-light)' }}>
                {mode.seconds === Number.POSITIVE_INFINITY ? '∞' : `${mode.seconds}s`}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
