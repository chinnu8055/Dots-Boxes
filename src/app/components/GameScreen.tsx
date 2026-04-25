import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Pause, Pencil } from 'lucide-react';
import type { DataConnection } from 'peerjs';

interface GameScreenProps {
  gridSize: number;
  mode: 'quick' | 'online' | 'local';
  turnTime: number;
  onBack: () => void;
  onGameEnd: (winner: number, scores: [number, number], names: [string, string]) => void;
  connection?: DataConnection | null;
  isHost?: boolean;
}

type LineId = string;

const DOT_SIZE = 8;
const LINE_THICKNESS = 4;
const CELL_SIZE = 24;

export function GameScreen({ 
  gridSize, 
  mode, 
  turnTime, 
  onBack, 
  onGameEnd,
  connection,
  isHost = true 
}: GameScreenProps) {
  const [lines, setLines] = useState<Map<LineId, number>>(new Map());
  const [boxes, setBoxes] = useState<Map<string, number>>(new Map());
  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [isPaused, setIsPaused] = useState(false);
  const [newBoxes, setNewBoxes] = useState<Set<string>>(new Set());
  const [localTurnTime, setLocalTurnTime] = useState(turnTime);
  const [timeLeft, setTimeLeft] = useState(turnTime);
  const [player1Name, setPlayer1Name] = useState('Player 1');
  const [player2Name, setPlayer2Name] = useState('Player 2');
  const [editingPlayer, setEditingPlayer] = useState<1 | 2 | null>(null);

  const myPlayerNum = isHost ? 1 : 2;
  const isMyTurn = mode === 'local' || currentPlayer === myPlayerNum;

  useEffect(() => {
    setLocalTurnTime(turnTime);
    setTimeLeft(turnTime);
  }, [turnTime]);

  useEffect(() => {
    if (newBoxes.size > 0) {
      const timer = setTimeout(() => setNewBoxes(new Set()), 500);
      return () => clearTimeout(timer);
    }
  }, [newBoxes]);

  useEffect(() => {
    if (localTurnTime === Infinity || isPaused) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Both players can trigger turn switch if timer runs out to ensure sync
          // but we only switch if it's our turn OR if we are guest and host timed out
          const canISwitch = mode === 'local' || isMyTurn || (!isHost && prev <= 0);
          
          if (canISwitch) {
            setCurrentPlayer((p) => (p === 1 ? 2 : 1));
            return localTurnTime;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentPlayer, localTurnTime, isPaused, mode, isMyTurn, isHost]);

  // Sync network moves and handle initial handshake
  useEffect(() => {
    if (!connection) return;

    // We use a small flag to prevent redundant name sends during initial mount
    let hasSentInitialNames = false;

    const handleData = (data: any) => {
      console.log('GameScreen received data:', data);
      if (data.type === 'move') {
        applyMove(data.lineId, data.player);
      } else if (data.type === 'names') {
        if (data.p1) setPlayer1Name(data.p1);
        if (data.p2) setPlayer2Name(data.p2);
        if (data.turnTime !== undefined) {
          setLocalTurnTime(data.turnTime);
          setTimeLeft(data.turnTime);
        }
      } else if (data.type === 'handshake') {
        console.log('Handshake received from:', data.from);
        // If we receive any handshake, respond with names to ensure both sides are synced
        connection.send({
          type: 'names',
          p1: player1Name,
          p2: player2Name,
          turnTime: localTurnTime
        });
        hasSentInitialNames = true;
      } else if (data.type === 'heartbeat') {
        // Keep-alive message, no action needed
      }
    };

    connection.on('data', handleData);
    
    // Proactively send names when component mounts to ensure peer has them
    // This handles the case where the handshake might have arrived before listener was ready
    const initialSyncTimeout = setTimeout(() => {
      if (!hasSentInitialNames) {
        console.log('Sending proactive name sync...');
        connection.send({
          type: 'names',
          p1: player1Name,
          p2: player2Name,
          turnTime: localTurnTime
        });
      }
    }, 1000);

    return () => {
      connection.off('data', handleData);
      clearTimeout(initialSyncTimeout);
    };
  }, [connection, isHost, player1Name, player2Name, localTurnTime]);

  // Update names for peer when changed
  useEffect(() => {
    if (connection && isMyTurn && mode !== 'local') {
      connection.send({
        type: 'names',
        p1: player1Name,
        p2: player2Name,
        turnTime: localTurnTime
      });
    }
  }, [player1Name, player2Name, connection, localTurnTime, isMyTurn, mode]);

  const applyMove = useCallback((lineId: LineId, player: 1 | 2) => {
    setLines(prevLines => {
      if (prevLines.has(lineId)) return prevLines;
      
      const nextLines = new Map(prevLines);
      nextLines.set(lineId, player);
      
      // Calculate boxes based on the new lines
      setBoxes(prevBoxes => {
        const nextBoxes = new Map(prevBoxes);
        const justCompleted = new Set<string>();
        let boxesCompleted = 0;

        for (let row = 0; row < gridSize - 1; row++) {
          for (let col = 0; col < gridSize - 1; col++) {
            const boxId = `box-${row}-${col}`;
            if (nextBoxes.has(boxId)) continue;

            const top = `h-${row}-${col}`;
            const bottom = `h-${row + 1}-${col}`;
            const left = `v-${row}-${col}`;
            const right = `v-${row}-${col + 1}`;

            if (
              nextLines.has(top) &&
              nextLines.has(bottom) &&
              nextLines.has(left) &&
              nextLines.has(right)
            ) {
              nextBoxes.set(boxId, player);
              justCompleted.add(boxId);
              boxesCompleted++;
            }
          }
        }

        if (boxesCompleted > 0) {
          // Player gets another turn
          setScores(prevScores => {
            const nextScores: [number, number] = [...prevScores];
            nextScores[player - 1] += boxesCompleted;
            
            const totalBoxes = (gridSize - 1) * (gridSize - 1);
            if (nextBoxes.size === totalBoxes) {
              const winner = nextScores[0] > nextScores[1] ? 1 : nextScores[1] > nextScores[0] ? 2 : 0;
              setTimeout(() => onGameEnd(winner, nextScores, [player1Name, player2Name]), 800);
            }
            return nextScores;
          });
          setNewBoxes(justCompleted);
          setTimeLeft(localTurnTime); // Reset timer for same player
        } else {
          // Switch turns
          setCurrentPlayer(player === 1 ? 2 : 1);
          setTimeLeft(localTurnTime);
        }

        return nextBoxes;
      });

      return nextLines;
    });
  }, [gridSize, localTurnTime, onGameEnd, player1Name, player2Name]);

  const handleLineClick = (lineId: LineId) => {
    console.log('Line clicked:', lineId, 'isMyTurn:', isMyTurn, 'currentPlayer:', currentPlayer);
    if (lines.has(lineId) || isPaused || !isMyTurn) return;

    applyMove(lineId, currentPlayer);

    if (connection) {
      connection.send({
        type: 'move',
        lineId,
        player: currentPlayer
      });
    }
  };

  const handleNameEdit = (player: 1 | 2, newName: string) => {
    if (player === 1) {
      setPlayer1Name(newName || 'Player 1');
    } else {
      setPlayer2Name(newName || 'Player 2');
    }
    setEditingPlayer(null);
  };

  const renderGrid = () => {
    const elements = [];

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        elements.push(
          <div
            key={`dot-${row}-${col}`}
            className="rounded-full"
            style={{
              gridRow: row * 2 + 1,
              gridColumn: col * 2 + 1,
              width: `${DOT_SIZE}px`,
              height: `${DOT_SIZE}px`,
              backgroundColor: 'var(--dot)',
              placeSelf: 'center',
            }}
          />
        );

        if (col < gridSize - 1) {
          const lineId = `h-${row}-${col}`;
          const lineOwner = lines.get(lineId);
          const isDrawn = lineOwner !== undefined;
          const lineColor = isDrawn
            ? lineOwner === 1
              ? 'var(--player1)'
              : 'var(--player2)'
            : 'var(--line-faint)';

          elements.push(
            <button
              key={lineId}
              onClick={() => handleLineClick(lineId)}
              className="transition-all touch-manipulation flex items-center justify-center w-full h-full"
              style={{
                gridRow: row * 2 + 1,
                gridColumn: col * 2 + 2,
                backgroundColor: 'transparent',
                cursor: isDrawn ? 'default' : 'pointer',
                border: 'none',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div
                style={{
                  width: `calc(100% + ${CELL_SIZE - DOT_SIZE + 2}px)`,
                  height: `${LINE_THICKNESS}px`,
                  backgroundColor: lineColor,
                  borderRadius: `${LINE_THICKNESS / 2}px`,
                  transition: 'all 0.2s',
                  position: 'absolute',
                  left: `-${(CELL_SIZE - DOT_SIZE + 2) / 2}px`,
                }}
              />
            </button>
          );
        }

        if (row < gridSize - 1) {
          const lineId = `v-${row}-${col}`;
          const lineOwner = lines.get(lineId);
          const isDrawn = lineOwner !== undefined;
          const lineColor = isDrawn
            ? lineOwner === 1
              ? 'var(--player1)'
              : 'var(--player2)'
            : 'var(--line-faint)';

          elements.push(
            <button
              key={lineId}
              onClick={() => handleLineClick(lineId)}
              className="transition-all touch-manipulation flex items-center justify-center w-full h-full"
              style={{
                gridRow: row * 2 + 2,
                gridColumn: col * 2 + 1,
                backgroundColor: 'transparent',
                cursor: isDrawn ? 'default' : 'pointer',
                border: 'none',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div
                style={{
                  height: `calc(100% + ${CELL_SIZE - DOT_SIZE + 2}px)`,
                  width: `${LINE_THICKNESS}px`,
                  backgroundColor: lineColor,
                  borderRadius: `${LINE_THICKNESS / 2}px`,
                  transition: 'all 0.2s',
                  position: 'absolute',
                  top: `-${(CELL_SIZE - DOT_SIZE + 2) / 2}px`,
                }}
              />
            </button>
          );
        }

        if (row < gridSize - 1 && col < gridSize - 1) {
          const boxId = `box-${row}-${col}`;
          const owner = boxes.get(boxId);
          const isNew = newBoxes.has(boxId);

          let label = '';
          if (owner === 1) {
            label = player1Name === 'Player 1' ? '1' : player1Name.charAt(0).toUpperCase();
          } else if (owner === 2) {
            label = player2Name === 'Player 2' ? '2' : player2Name.charAt(0).toUpperCase();
          }

          elements.push(
            <div
              key={boxId}
              className="transition-all flex items-center justify-center"
              style={{
                gridRow: row * 2 + 2,
                gridColumn: col * 2 + 2,
                backgroundColor: owner
                  ? owner === 1
                    ? 'var(--player1)'
                    : 'var(--player2)'
                  : 'transparent',
                opacity: owner ? (isNew ? 0.5 : 0.35) : 0,
                borderRadius: '6px',
                transform: isNew ? 'scale(1.1)' : 'scale(1)',
                transition: 'all 0.3s ease-out',
              }}
            >
              {owner && (
                <span 
                  className="text-xl font-bold select-none pointer-events-none" 
                  style={{ color: 'var(--ink)', opacity: 0.8 }}
                >
                  {label}
                </span>
              )}
            </div>
          );
        }
      }
    }

    return elements;
  };

  const showPause = mode === 'quick' || mode === 'local';

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center justify-between px-4 py-4">
        <button
          onClick={onBack}
          className="p-3 rounded-full hover:bg-[var(--scribble)] transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={24} color="var(--ink)" />
        </button>

        {showPause && (
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-3 rounded-full hover:bg-[var(--scribble)] transition-colors"
            aria-label="Pause"
          >
            <Pause size={24} color="var(--ink)" />
          </button>
        )}
      </div>

      <div className="px-4 pb-4">
        <div className="flex gap-3">
          <div
            className="flex-1 p-4 rounded-xl border-2 transition-all relative overflow-hidden"
            style={{
              borderColor: currentPlayer === 1 ? 'var(--player1)' : 'var(--ink-light)',
              backgroundColor: 'var(--paper)',
              borderWidth: currentPlayer === 1 ? '3px' : '2px',
              boxShadow: currentPlayer === 1 ? '0 4px 12px rgba(0, 0, 0, 0.1)' : 'none',
            }}
          >
            {currentPlayer === 1 && (
              <div 
                className="absolute inset-0 pointer-events-none" 
                style={{ backgroundColor: 'var(--player1)', opacity: 0.12 }} 
              />
            )}
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: 'var(--player1)' }}
                />
                {editingPlayer === 1 && (mode === 'local' || isHost) ? (
                  <input
                    type="text"
                    value={player1Name}
                    onChange={(e) => setPlayer1Name(e.target.value)}
                    onBlur={() => handleNameEdit(1, player1Name)}
                    onKeyDown={(e) => e.key === 'Enter' && handleNameEdit(1, player1Name)}
                    className="text-base flex-1 bg-transparent border-b border-[var(--ink)] outline-none"
                    style={{ color: 'var(--ink)' }}
                    autoFocus
                  />
                ) : (
                  <span className="text-base flex-1" style={{ color: 'var(--ink)', fontWeight: currentPlayer === 1 ? 600 : 400 }}>
                    {player1Name} {mode !== 'local' && isHost && <span className="text-xs opacity-50 ml-1">(You)</span>}
                  </span>
                )}
                {(mode === 'local' || isHost) && (
                  <button
                    onClick={() => setEditingPlayer(editingPlayer === 1 ? null : 1)}
                    className="p-1 hover:bg-[var(--scribble)] rounded transition-colors"
                  >
                    <Pencil size={14} color="var(--ink)" />
                  </button>
                )}
              </div>
              <div className="text-3xl" style={{ color: 'var(--ink)', fontWeight: currentPlayer === 1 ? 700 : 400 }}>
                {scores[0]}
              </div>
              {currentPlayer === 1 && (
                <div className="text-base mt-1 animate-pulse" style={{ color: 'var(--ink)', fontWeight: 600 }}>
                  {isMyTurn ? 'Your Turn' : `${player1Name}'s Turn`}
                </div>
              )}
              {currentPlayer === 1 && turnTime !== Infinity && (
                <div className="text-sm mt-1" style={{ color: 'var(--ink-light)' }}>
                  {timeLeft}s
                </div>
              )}
            </div>
          </div>

          <div
            className="flex-1 p-4 rounded-xl border-2 transition-all relative overflow-hidden"
            style={{
              borderColor: currentPlayer === 2 ? 'var(--player2)' : 'var(--ink-light)',
              backgroundColor: 'var(--paper)',
              borderWidth: currentPlayer === 2 ? '3px' : '2px',
              boxShadow: currentPlayer === 2 ? '0 4px 12px rgba(0, 0, 0, 0.1)' : 'none',
            }}
          >
            {currentPlayer === 2 && (
              <div 
                className="absolute inset-0 pointer-events-none" 
                style={{ backgroundColor: 'var(--player2)', opacity: 0.12 }} 
              />
            )}
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: 'var(--player2)' }}
                />
                {editingPlayer === 2 && (mode === 'local' || !isHost) ? (
                  <input
                    type="text"
                    value={player2Name}
                    onChange={(e) => setPlayer2Name(e.target.value)}
                    onBlur={() => handleNameEdit(2, player2Name)}
                    onKeyDown={(e) => e.key === 'Enter' && handleNameEdit(2, player2Name)}
                    className="text-base flex-1 bg-transparent border-b border-[var(--ink)] outline-none"
                    style={{ color: 'var(--ink)' }}
                    autoFocus
                  />
                ) : (
                  <span className="text-base flex-1" style={{ color: 'var(--ink)', fontWeight: currentPlayer === 2 ? 600 : 400 }}>
                    {player2Name} {mode !== 'local' && !isHost && <span className="text-xs opacity-50 ml-1">(You)</span>}
                  </span>
                )}
                {(mode === 'local' || !isHost) && (
                  <button
                    onClick={() => setEditingPlayer(editingPlayer === 2 ? null : 2)}
                    className="p-1 hover:bg-[var(--scribble)] rounded transition-colors"
                  >
                    <Pencil size={14} color="var(--ink)" />
                  </button>
                )}
              </div>
              <div className="text-3xl" style={{ color: 'var(--ink)', fontWeight: currentPlayer === 2 ? 700 : 400 }}>
                {scores[1]}
              </div>
              {currentPlayer === 2 && (
                <div className="text-base mt-1 animate-pulse" style={{ color: 'var(--ink)', fontWeight: 600 }}>
                  {isMyTurn ? 'Your Turn' : `${player2Name}'s Turn`}
                </div>
              )}
              {currentPlayer === 2 && turnTime !== Infinity && (
                <div className="text-sm mt-1" style={{ color: 'var(--ink-light)' }}>
                  {timeLeft}s
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridSize - 1}, ${CELL_SIZE}px 1fr) ${CELL_SIZE}px`,
            gridTemplateRows: `repeat(${gridSize - 1}, ${CELL_SIZE}px 1fr) ${CELL_SIZE}px`,
            gap: '0',
            width: 'min(90vw, 400px)',
            height: 'min(90vw, 400px)',
            maxWidth: '400px',
            maxHeight: '400px',
          }}
        >
          {renderGrid()}
        </div>
      </div>

      {isPaused && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        >
          <div
            className="w-full max-w-sm mx-6 p-8 rounded-xl text-center"
            style={{
              backgroundColor: 'var(--paper)',
              border: '3px solid var(--ink)',
            }}
          >
            <h2 className="text-3xl mb-6" style={{ color: 'var(--ink)' }}>
              Game Paused
            </h2>
            <button
              onClick={() => setIsPaused(false)}
              className="w-full py-4 px-6 border-2 rounded-xl transition-all hover:translate-y-[-2px]"
              style={{
                borderColor: 'var(--ink)',
                backgroundColor: 'var(--paper)',
                color: 'var(--ink)',
                borderStyle: 'solid',
                borderWidth: '2.5px',
                boxShadow: '3px 3px 0px var(--ink)',
              }}
            >
              <span className="text-xl">Resume</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
