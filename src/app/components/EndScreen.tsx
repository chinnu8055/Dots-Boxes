import { Trophy } from 'lucide-react';

interface EndScreenProps {
  winner: number;
  scores: [number, number];
  names: [string, string];
  onPlayAgain: () => void;
  onBackToHome: () => void;
  isHost: boolean;
  mode: string;
}

export function EndScreen({ winner, scores, names, onPlayAgain, onBackToHome, isHost, mode }: EndScreenProps) {
  const myPlayerNum = isHost ? 1 : 2;
  const isMe = mode !== 'local' && winner === myPlayerNum;
  
  const winnerName = winner === 0 
    ? "It's a Tie!" 
    : isMe 
      ? "You Win!" 
      : `${names[winner - 1]} Wins!`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8">
      <div className="flex flex-col items-center gap-8 w-full max-w-md">
        <Trophy size={72} color="var(--ink)" strokeWidth={2} />

        <h1 className="text-4xl text-center" style={{ color: 'var(--ink)' }}>
          {winnerName}
        </h1>

        <div className="flex gap-4 w-full">
          <div
            className="flex-1 p-5 rounded-xl border-3 text-center relative overflow-hidden"
            style={{
              borderColor: winner === 1 ? 'var(--player1)' : 'var(--ink-light)',
              backgroundColor: 'var(--paper)',
              borderWidth: winner === 1 ? '4px' : '2px',
              borderStyle: 'solid',
              boxShadow: winner === 1 ? '0 8px 24px rgba(0, 0, 0, 0.12)' : 'none',
              transform: winner === 1 ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.3s ease-out',
            }}
          >
            {winner === 1 && (
              <div 
                className="absolute inset-0 pointer-events-none" 
                style={{ backgroundColor: 'var(--player1)', opacity: 0.12 }} 
              />
            )}
            <div className="relative z-10">
              <div className="flex justify-center mb-3">
                <div
                  className="w-5 h-5 rounded-full"
                  style={{ backgroundColor: 'var(--player1)' }}
                />
              </div>
              <div className="text-4xl mb-2 font-bold" style={{ color: 'var(--ink)' }}>
                {scores[0]}
              </div>
              <div className="text-base" style={{ color: 'var(--ink)', fontWeight: winner === 1 ? 600 : 400 }}>
                {names[0]} {mode !== 'local' && isHost && <span className="text-xs opacity-50 block">(You)</span>}
              </div>
            </div>
          </div>

          <div
            className="flex-1 p-5 rounded-xl border-3 text-center relative overflow-hidden"
            style={{
              borderColor: winner === 2 ? 'var(--player2)' : 'var(--ink-light)',
              backgroundColor: 'var(--paper)',
              borderWidth: winner === 2 ? '4px' : '2px',
              borderStyle: 'solid',
              boxShadow: winner === 2 ? '0 8px 24px rgba(0, 0, 0, 0.12)' : 'none',
              transform: winner === 2 ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.3s ease-out',
            }}
          >
            {winner === 2 && (
              <div 
                className="absolute inset-0 pointer-events-none" 
                style={{ backgroundColor: 'var(--player2)', opacity: 0.12 }} 
              />
            )}
            <div className="relative z-10">
              <div className="flex justify-center mb-3">
                <div
                  className="w-5 h-5 rounded-full"
                  style={{ backgroundColor: 'var(--player2)' }}
                />
              </div>
              <div className="text-4xl mb-2 font-bold" style={{ color: 'var(--ink)' }}>
                {scores[1]}
              </div>
              <div className="text-base" style={{ color: 'var(--ink)', fontWeight: winner === 2 ? 600 : 400 }}>
                {names[1]} {mode !== 'local' && !isHost && <span className="text-xs opacity-50 block">(You)</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 w-full mt-6">
          <button
            onClick={onPlayAgain}
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
            <span className="text-2xl">Play Again</span>
          </button>

          <button
            onClick={onBackToHome}
            className="w-full py-4 px-6 border-2 rounded-xl transition-all hover:translate-y-[-2px] active:translate-y-[1px]"
            style={{
              borderColor: 'var(--ink)',
              backgroundColor: 'transparent',
              color: 'var(--ink)',
              borderStyle: 'solid',
              borderWidth: '2.5px',
            }}
          >
            <span className="text-xl">Back to Home</span>
          </button>
        </div>
      </div>
    </div>
  );
}
