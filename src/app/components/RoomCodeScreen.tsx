import { useState, useEffect } from 'react';
import { ArrowLeft, Copy, Share2 } from 'lucide-react';

interface RoomCodeScreenProps {
  onBack: () => void;
  onCreateRoom: (code: string) => void;
  onJoinRoom: (code: string) => void;
  activeRoomCode?: string | null;
}

export function RoomCodeScreen({ onBack, onCreateRoom, onJoinRoom, activeRoomCode }: RoomCodeScreenProps) {
  const [mode, setMode] = useState<'select' | 'create' | 'join'>(activeRoomCode ? 'create' : 'select');
  const [roomCode, setRoomCode] = useState(activeRoomCode || '');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeRoomCode) {
      setRoomCode(activeRoomCode);
      setMode('create');
    } else if (activeRoomCode === null && mode === 'create') {
      // If activeRoomCode becomes null while we are in create mode, 
      // it means the hosting was cancelled or reset.
      setMode('select');
      setRoomCode('');
    }
  }, [activeRoomCode, mode]);

  const generateRoomCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    // We don't set mode or roomCode here anymore; 
    // we wait for App to pass it back via activeRoomCode prop
    onCreateRoom(code);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Dots & Boxes',
          text: `Join my game! Room code: ${roomCode}`,
        });
      } catch (err) {
        console.error('Failed to share:', err);
      }
    } else {
      handleCopyCode();
    }
  };

  const handleJoinRoom = () => {
    if (joinCode.length === 6) {
      onJoinRoom(joinCode);
    }
  };

  if (mode === 'create') {
    return (
      <div className="min-h-screen flex flex-col px-6 py-8">
        <button
          onClick={onBack}
          className="self-start mb-6 p-3 rounded-full hover:bg-[var(--scribble)] transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={28} color="var(--ink)" />
        </button>

        <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-md mx-auto w-full">
          <div className="text-center">
            <h2 className="text-3xl mb-2" style={{ color: 'var(--ink)' }}>
              Room Created
            </h2>
            <p className="text-lg opacity-60" style={{ color: 'var(--ink)' }}>
              Share this code with your friend
            </p>
          </div>

          <div className="flex flex-col items-center gap-6 p-8 bg-[var(--paper)] rounded-2xl border-3 border-[var(--ink)] shadow-[4px_4px_0px_var(--ink)]">
            <div className="flex items-center gap-4">
              <span 
                className="text-5xl tracking-widest font-bold" 
                style={{ 
                  color: 'var(--ink)',
                  fontFamily: '"Gloria Hallelujah", cursive'
                }}
              >
                {roomCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-2 hover:bg-[var(--scribble)] rounded-lg transition-colors border-2 border-transparent hover:border-[var(--ink)]"
              >
                <Copy size={24} color="var(--ink)" />
              </button>
            </div>
            <div className="text-center">
              <p className="text-lg opacity-80 mb-2" style={{ color: 'var(--ink)' }}>
                {copied ? 'Copied to clipboard!' : 'Share this code with a friend'}
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm opacity-60" style={{ color: 'var(--ink)' }}>Waiting for someone to join</span>
                <div className="flex gap-1">
                  <div className="w-1 h-1 rounded-full bg-[var(--ink)] animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1 h-1 rounded-full bg-[var(--ink)] animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1 h-1 rounded-full bg-[var(--ink)] animate-bounce"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="min-h-screen flex flex-col px-6 py-8">
        <button
          onClick={() => setMode('select')}
          className="self-start mb-6 p-3 rounded-full hover:bg-[var(--scribble)] transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={28} color="var(--ink)" />
        </button>

        <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-md mx-auto w-full">
          <div className="text-center">
            <h2 className="text-3xl mb-2" style={{ color: 'var(--ink)' }}>
              Join Room
            </h2>
            <p className="text-lg opacity-60" style={{ color: 'var(--ink)' }}>
              Enter the 6-digit room code
            </p>
          </div>

          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full py-5 px-8 border-3 rounded-xl text-center text-5xl tracking-widest font-bold"
            style={{
              borderColor: 'var(--ink)',
              backgroundColor: 'var(--paper)',
              color: 'var(--ink)',
              borderStyle: 'solid',
              borderWidth: '3px',
              outline: 'none',
              fontFamily: '"Gloria Hallelujah", cursive',
              boxShadow: '4px 4px 0px var(--ink)',
            }}
            maxLength={6}
            autoFocus
          />

          <button
            onClick={handleJoinRoom}
            disabled={joinCode.length !== 6}
            className="w-full py-4 px-6 border-2 rounded-xl transition-all hover:translate-y-[-2px] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: 'var(--ink)',
              backgroundColor: 'var(--paper)',
              color: 'var(--ink)',
              borderStyle: 'solid',
              borderWidth: '2.5px',
              boxShadow: joinCode.length === 6 ? '3px 3px 0px var(--ink)' : 'none',
            }}
          >
            <span className="text-xl">Join Game</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-6 py-8">
      <button
        onClick={onBack}
        className="self-start mb-6 p-3 rounded-full hover:bg-[var(--scribble)] transition-colors"
        aria-label="Back"
      >
        <ArrowLeft size={28} color="var(--ink)" />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 max-w-md mx-auto w-full">
        <h2 className="text-3xl mb-4 text-center" style={{ color: 'var(--ink)' }}>
          Online Play
        </h2>

        <button
          onClick={generateRoomCode}
          className="w-full py-5 px-6 border-2 rounded-xl transition-all hover:translate-y-[-2px]"
          style={{
            borderColor: 'var(--ink)',
            backgroundColor: 'var(--paper)',
            color: 'var(--ink)',
            borderStyle: 'solid',
            borderWidth: '3px',
            boxShadow: '4px 4px 0px var(--ink)',
          }}
        >
          <span className="text-2xl">Create Room</span>
        </button>

        <button
          onClick={() => setMode('join')}
          className="w-full py-5 px-6 border-2 rounded-xl transition-all hover:translate-y-[-2px]"
          style={{
            borderColor: 'var(--ink)',
            backgroundColor: 'transparent',
            color: 'var(--ink)',
            borderStyle: 'solid',
            borderWidth: '2.5px',
          }}
        >
          <span className="text-2xl">Join Room</span>
        </button>
      </div>
    </div>
  );
}
