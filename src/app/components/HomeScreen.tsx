import { Sun, Moon } from 'lucide-react';

interface HomeScreenProps {
  onQuickPlay: () => void;
  onPlayOnline: () => void;
  onSameDevice: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function HomeScreen({ onQuickPlay, onPlayOnline, onSameDevice, isDark, onToggleTheme }: HomeScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8 relative">
      <button
        onClick={onToggleTheme}
        className="absolute top-6 right-6 p-3 rounded-full hover:bg-[var(--scribble)] transition-colors"
        aria-label="Toggle theme"
      >
        {isDark ? <Sun size={28} color="var(--ink)" /> : <Moon size={28} color="var(--ink)" />}
      </button>

      <div className="flex flex-col items-center gap-8 w-full max-w-md">
        <h1
          className="text-5xl text-center mb-4"
          style={{
            color: 'var(--ink)',
          }}
        >
          Dots & Boxes
        </h1>

        <div className="flex flex-col gap-4 w-full">
          <button
            onClick={onQuickPlay}
            className="w-full py-5 px-6 border-2 rounded-xl transition-all hover:translate-y-[-2px] active:translate-y-[1px]"
            style={{
              borderColor: 'var(--ink)',
              backgroundColor: 'var(--paper)',
              color: 'var(--ink)',
              borderStyle: 'solid',
              borderWidth: '3px',
              boxShadow: '4px 4px 0px var(--ink)',
            }}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl">Quick Play</span>
              <span className="text-sm opacity-60">(Online Matchmaking)</span>
            </div>
          </button>

          <button
            onClick={onPlayOnline}
            className="w-full py-5 px-6 border-2 rounded-xl transition-all hover:translate-y-[-2px] active:translate-y-[1px]"
            style={{
              borderColor: 'var(--ink)',
              backgroundColor: 'transparent',
              color: 'var(--ink)',
              borderStyle: 'solid',
              borderWidth: '2.5px',
            }}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl">Play with a Friend</span>
              <span className="text-sm opacity-60">(Online)</span>
            </div>
          </button>

          <button
            onClick={onSameDevice}
            className="w-full py-5 px-6 border-2 rounded-xl transition-all hover:translate-y-[-2px] active:translate-y-[1px]"
            style={{
              borderColor: 'var(--ink)',
              backgroundColor: 'transparent',
              color: 'var(--ink)',
              borderStyle: 'solid',
              borderWidth: '2.5px',
            }}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl">Play with a Friend</span>
              <span className="text-sm opacity-60">(Same Device)</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
