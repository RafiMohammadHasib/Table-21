import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, RotateCcw, Check, X, Settings, User, Play, ChevronLeft, Volume2, VolumeX, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from './lib/utils';
import {
  initAudio,
  playSelectSound,
  playConfirmSound,
  playWinSound,
  playLoseSound,
  playTossSound,
  setMuted,
  getMuted,
} from './lib/audio';

type Phase = 'HOME' | 'SETUP' | 'PLAYING' | 'GAME_OVER' | 'PROFILE' | 'SETTINGS';
type Difficulty = 'EASY' | 'BALANCED' | 'DEFENSIVE' | 'AGGRESSIVE' | 'HARD';
type Player = 'USER' | 'AI' | 'PLAYER_1' | 'PLAYER_2';
type GameMode = 'PvE' | 'PvP';

export default function App() {
  const [phase, setPhase] = useState<Phase>('HOME');
  const [difficulty, setDifficulty] = useState<Difficulty>('BALANCED');
  const [gameMode, setGameMode] = useState<GameMode>('PvE');
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Game State
  const [turn, setTurn] = useState<Player>('USER');
  const [currentNumber, setCurrentNumber] = useState<number>(0);
  const [pendingSelection, setPendingSelection] = useState<number>(0);
  const [winner, setWinner] = useState<Player | null>(null);
  
  // Toss State
  const [showToss, setShowToss] = useState(false);
  const [tossResult, setTossResult] = useState<'HEADS' | 'TAILS' | null>(null);
  const [tossWinner, setTossWinner] = useState<Player | null>(null);

  // Score Tracking State
  const [pveScores, setPveScores] = useState({ user: 0, ai: 0 });
  const [pvpScores, setPvpScores] = useState({ player1: 0, player2: 0 });

  // Modal State
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Player Names
  const [playerNames, setPlayerNames] = useState({
    USER: 'You',
    AI: 'Computer',
    PLAYER_1: 'Player 1',
    PLAYER_2: 'Player 2'
  });

  // Restart game flow
  const startGameFlow = () => {
    initAudio();
    setCurrentNumber(0);
    setPendingSelection(0);
    setWinner(null);
    setShowToss(true);
    setTossResult(null);
    setTossWinner(null);
  };

  const handleTossChoice = (choice: 'HEADS' | 'TAILS') => {
    playTossSound();
    // Random outcome
    const isHeads = Math.random() > 0.5;
    const result = isHeads ? 'HEADS' : 'TAILS';
    setTossResult(result);
    
    // On HARD, we might want to rig the toss slightly or just play optimal after.
    // Let's keep toss fair, but AI makes optimal choice if it wins.
    const userWon = choice === result;
    if (gameMode === 'PvE') {
      setTossWinner(userWon ? 'USER' : 'AI');
    } else {
      setTossWinner(userWon ? 'PLAYER_1' : 'PLAYER_2');
    }
  };

  const handleTossDecision = (whoGoesFirst: Player) => {
    playConfirmSound();
    setTurn(whoGoesFirst);
    setShowToss(false);
    setPhase('PLAYING');
  };

  // If AI wins toss, it decides who goes first
  useEffect(() => {
    if (showToss && tossWinner === 'AI' && gameMode === 'PvE') {
      const timer = setTimeout(() => {
        // Winning strategy is to go SECOND. 
        // So on HARD, AI will ALWAYS choose USER to go first.
        // On EASY/MEDIUM, AI might pick randomly.
        let aiChooses: Player = 'USER'; // Default to user going first (AI wants to go second to win)
        if (difficulty === 'EASY' && Math.random() > 0.5) {
          aiChooses = 'AI';
        }
        handleTossDecision(aiChooses);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [showToss, tossWinner, difficulty, gameMode]);

  // AI Turn Logic
  useEffect(() => {
    if (phase === 'PLAYING' && turn === 'AI' && !winner && gameMode === 'PvE') {
      const timer = setTimeout(() => {
        makeAIMove();
      }, 1500); // AI thinking delay
      return () => clearTimeout(timer);
    }
  }, [phase, turn, currentNumber, winner, gameMode]);

  const makeAIMove = () => {
    // Target winning positions: 4, 8, 12, 16, 20
    const targetNumbers = [4, 8, 12, 16, 20];
    let chosenAddedAmount = 1; // Default fallback

    const nextTarget = targetNumbers.find(t => t > currentNumber && t <= currentNumber + 3);

    if (difficulty === 'EASY') {
      // EASY: Random 1-3
      chosenAddedAmount = Math.floor(Math.random() * 3) + 1;
    } else if (difficulty === 'BALANCED') {
      // BALANCED: 50% chance to play optimally
      if (Math.random() > 0.5 && nextTarget) {
        chosenAddedAmount = nextTarget - currentNumber;
      } else {
        chosenAddedAmount = Math.floor(Math.random() * 3) + 1;
      }
    } else {
      // HARD, DEFENSIVE, AGGRESSIVE: Always play optimal if target is in reach
      if (nextTarget) {
        chosenAddedAmount = nextTarget - currentNumber;
      } else {
        // If no target in reach, we are in a losing position. Strategy differs:
        if (difficulty === 'DEFENSIVE') {
          chosenAddedAmount = 1; // Drag the game out
        } else if (difficulty === 'AGGRESSIVE') {
          chosenAddedAmount = 3; // Rush the game
        } else {
          // HARD: Be unpredictable
          chosenAddedAmount = Math.floor(Math.random() * 3) + 1;
        }
      }
    }

    // Ensure we don't accidentally pick more numbers than exist up to 21
    if (currentNumber + chosenAddedAmount > 21) {
      chosenAddedAmount = 21 - currentNumber;
    }

    playConfirmSound();
    commitMove(currentNumber + chosenAddedAmount, 'AI');
  };

  const commitMove = (newNumber: number, player: Player) => {
    setCurrentNumber(newNumber);
    setPendingSelection(newNumber);

    if (newNumber >= 21) {
      // Person who said 21 loses.
      let winningPlayer: Player = 'AI';
      if (gameMode === 'PvE') {
        winningPlayer = player === 'USER' ? 'AI' : 'USER';
        setPveScores(prev => ({
          user: prev.user + (winningPlayer === 'USER' ? 1 : 0),
          ai: prev.ai + (winningPlayer === 'AI' ? 1 : 0)
        }));
      } else {
        winningPlayer = player === 'PLAYER_1' ? 'PLAYER_2' : 'PLAYER_1';
        setPvpScores(prev => ({
          player1: prev.player1 + (winningPlayer === 'PLAYER_1' ? 1 : 0),
          player2: prev.player2 + (winningPlayer === 'PLAYER_2' ? 1 : 0)
        }));
      }
      
      setWinner(winningPlayer);
      setPhase('GAME_OVER');
      if (winningPlayer === 'USER' || winningPlayer === 'PLAYER_1' || winningPlayer === 'PLAYER_2') {
        playWinSound();
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00E5FF', '#FFFFFF', '#AAAAAA']
        });
      } else {
        playLoseSound();
      }
    } else {
      // Switch turn
      if (gameMode === 'PvE') {
        setTurn(player === 'USER' ? 'AI' : 'USER');
      } else {
        setTurn(player === 'PLAYER_1' ? 'PLAYER_2' : 'PLAYER_1');
      }
    }
  };

  // User Actions
  const handleBoxClick = (num: number) => {
    if (phase !== 'PLAYING') return;
    if (gameMode === 'PvE' && turn !== 'USER') return;
    
    // Must be greater than current number, and within 3 of current number
    if (num > currentNumber && num <= currentNumber + 3 && num <= 21) {
      playSelectSound();
      setPendingSelection(num);
    }
  };

  const handleConfirmUserMove = () => {
    if (pendingSelection <= currentNumber) return;
    if (gameMode === 'PvE' && turn !== 'USER') return;
    
    playConfirmSound();
    commitMove(pendingSelection, turn);
  };

  const handleUndoSelection = () => {
    if (gameMode === 'PvE' && turn !== 'USER') return;
    
    setPendingSelection(currentNumber);
  };

  const handleRematch = () => {
    setPhase('SETUP');
    startGameFlow();
  };

  const toggleSound = () => {
    const newMuteState = !soundEnabled;
    setSoundEnabled(newMuteState);
    setMuted(!newMuteState);
    if (newMuteState) {
        initAudio(); // Initialize audio context on first interaction if enabling sound
        playSelectSound();
    }
  };


  return (
    <div className="h-[100dvh] sm:min-h-[100dvh] sm:h-auto flex flex-col items-center justify-center sm:p-4 bg-bg-base text-text-light font-sans selection:bg-accent/30 relative w-full overflow-hidden">
      <div className="w-full h-[100dvh] sm:h-auto max-w-md bg-bg-panel sm:shadow-[16px_16px_0_var(--color-border-subtle)] rounded-none overflow-hidden sm:border-2 border-border-subtle relative pb-12 z-10 flex flex-col">
        
        {/* Header */}
        <header className="py-6 px-8 text-center bg-[#111] border-b-2 border-border-subtle flex items-center justify-between relative">
          {phase === 'HOME' ? (
            <div className="w-8 opacity-0"></div>
          ) : (
            <button 
              onClick={() => setPhase('HOME')}
              className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-accent transition-colors"
              aria-label="Back to Home"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 border-2 border-accent flex items-center justify-center font-bold text-accent text-sm font-mono">21</div>
            <h1 className="text-xl font-bold tracking-[0.2em] uppercase text-text-light">Table 21</h1>
          </div>
          <button 
            onClick={() => setShowRulesModal(true)} 
            className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-accent transition-colors"
            aria-label="View Game Rules"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </header>

        <main className="px-4 sm:px-6 py-4 sm:py-8 flex flex-col flex-1 relative overflow-y-auto">
          <AnimatePresence mode="wait">
            
            {/* HOME PHASE */}
            {phase === 'HOME' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center flex-1 space-y-6"
              >
                <div className="w-full flex flex-col gap-4 mt-8">
                  <button
                    onClick={() => setPhase('SETUP')}
                    className="w-full group h-16 border-2 border-accent hover:bg-accent hover:-translate-y-1 shadow-[4px_4px_0_var(--color-accent)] transition-all flex items-center justify-center gap-3 bg-bg-black"
                  >
                    <Play className="w-5 h-5 text-accent group-hover:text-black transition-colors fill-accent group-hover:fill-black" />
                    <span className="text-xl font-bold group-hover:text-black text-accent uppercase tracking-[0.2em] transition-colors">Play Match</span>
                  </button>

                  <button
                    onClick={() => setPhase('PROFILE')}
                    className="w-full group h-16 border-2 border-border-subtle hover:border-text-light hover:-translate-y-1 transition-all flex items-center justify-center gap-3 bg-bg-panel"
                  >
                    <User className="w-5 h-5 text-text-dim group-hover:text-text-light transition-colors" />
                    <span className="text-md font-bold group-hover:text-text-light text-text-dim uppercase tracking-[0.2em] transition-colors">Player Profile</span>
                  </button>

                  <button
                    onClick={() => setPhase('SETTINGS')}
                    className="w-full group h-16 border-2 border-border-subtle hover:border-text-light hover:-translate-y-1 transition-all flex items-center justify-center gap-3 bg-bg-panel"
                  >
                    <Settings className="w-5 h-5 text-text-dim group-hover:text-text-light transition-colors" />
                    <span className="text-md font-bold group-hover:text-text-light text-text-dim uppercase tracking-[0.2em] transition-colors">Settings</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* SETTINGS PHASE */}
            {phase === 'SETTINGS' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center flex-1 space-y-6 w-full mt-4"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Settings className="w-6 h-6 text-accent" />
                  <h2 className="text-xl font-bold uppercase tracking-[0.2em] text-text-light">Settings</h2>
                </div>

                <div className="w-full flex flex-col gap-4">
                  <button
                    onClick={toggleSound}
                    className="w-full h-16 border-2 border-border-subtle p-4 flex items-center justify-between bg-bg-black hover:border-text-light transition-colors group"
                  >
                    <span className="text-sm font-bold uppercase tracking-widest text-text-light">Sound Effects</span>
                    <div className="text-accent">
                      {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6 text-text-dim" />}
                    </div>
                  </button>

                  <button
                    onClick={() => setShowRulesModal(true)}
                    className="w-full h-16 border-2 border-border-subtle p-4 flex items-center justify-between bg-bg-black hover:border-text-light transition-colors group"
                  >
                    <span className="text-sm font-bold uppercase tracking-widest text-text-light">How To Play</span>
                    <HelpCircle className="w-6 h-6 text-text-dim group-hover:text-accent transition-colors" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* PROFILE PHASE */}
            {phase === 'PROFILE' && (
              <motion.div 
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center flex-1 space-y-8 w-full mt-4"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Trophy className="w-6 h-6 text-accent" />
                  <h2 className="text-xl font-bold uppercase tracking-[0.2em] text-text-light">Player Stats</h2>
                </div>

                <div className="w-full flex gap-4 my-2">
                  <div className="flex-1 border-2 border-border-subtle p-3 text-center bg-bg-black overflow-hidden relative">
                    <p className="text-[8px] uppercase tracking-widest text-text-dim mb-2">1 Player Wins</p>
                    <div className="flex justify-center items-center gap-2 font-mono text-sm font-bold">
                      <div className="flex flex-col items-center w-[40%]">
                        <span className="text-[8px] text-text-muted uppercase mb-1 truncate w-full">{playerNames.USER || 'You'}</span>
                        <span className="text-accent">{pveScores.user}</span>
                      </div>
                      <span className="text-border-subtle">-</span>
                      <div className="flex flex-col items-center w-[40%]">
                        <span className="text-[8px] text-text-muted uppercase mb-1 truncate w-full">{playerNames.AI || 'AI'}</span>
                        <span className="text-text-mid">{pveScores.ai}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 border-2 border-border-subtle p-3 text-center bg-bg-black overflow-hidden relative">
                    <p className="text-[8px] uppercase tracking-widest text-text-dim mb-2">2 Player Wins</p>
                    <div className="flex justify-center items-center gap-2 font-mono text-sm font-bold">
                      <div className="flex flex-col items-center w-[40%]">
                        <span className="text-[8px] text-text-muted uppercase mb-1 truncate w-full">{playerNames.PLAYER_1 || 'P1'}</span>
                        <span className="text-accent">{pvpScores.player1}</span>
                      </div>
                      <span className="text-border-subtle">-</span>
                      <div className="flex flex-col items-center w-[40%]">
                        <span className="text-[8px] text-text-muted uppercase mb-1 truncate w-full">{playerNames.PLAYER_2 || 'P2'}</span>
                        <span className="text-text-mid">{pvpScores.player2}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full space-y-6 pt-6 border-t border-border-subtle">
                   <h3 className="text-[10px] text-center font-bold uppercase tracking-[0.2em] text-text-dim">Edit Display Names</h3>
                   <div className="flex flex-col gap-4">
                     <div className="w-full flex gap-4">
                        <div className="flex-1 space-y-2">
                          <label className="text-center block font-semibold text-text-dim text-[10px] uppercase tracking-widest">
                            Your Name
                          </label>
                          <input 
                            type="text"
                            maxLength={10}
                            className="w-full bg-bg-black border-2 border-border-subtle p-2 text-xs font-mono text-center text-text-light focus:border-accent outline-none focus:-translate-y-1 focus:shadow-[4px_4px_0_var(--color-accent)] transition-all uppercase placeholder-text-dim/50"
                            placeholder="YOU"
                            value={playerNames.USER}
                            onChange={(e) => setPlayerNames(prev => ({ ...prev, USER: e.target.value }))}
                          />
                        </div>
                        <div className="flex-1 space-y-2">
                          <label className="text-center block font-semibold text-text-dim text-[10px] uppercase tracking-widest">
                            Computer Name
                          </label>
                          <input 
                            type="text"
                            maxLength={10}
                            className="w-full bg-bg-black border-2 border-border-subtle p-2 text-xs font-mono text-center text-text-light focus:border-accent outline-none focus:-translate-y-1 focus:shadow-[4px_4px_0_var(--color-accent)] transition-all uppercase placeholder-text-dim/50"
                            placeholder="COMPUTER"
                            value={playerNames.AI}
                            onChange={(e) => setPlayerNames(prev => ({ ...prev, AI: e.target.value }))}
                          />
                        </div>
                     </div>
                     <div className="w-full flex gap-4">
                        <div className="flex-1 space-y-2">
                          <label className="text-center block font-semibold text-text-dim text-[10px] uppercase tracking-widest">
                            Player 1 Name
                          </label>
                          <input 
                            type="text"
                            maxLength={10}
                            className="w-full bg-bg-black border-2 border-border-subtle p-2 text-xs font-mono text-center text-text-light focus:border-accent outline-none focus:-translate-y-1 focus:shadow-[4px_4px_0_var(--color-accent)] transition-all uppercase placeholder-text-dim/50"
                            placeholder="PLAYER 1"
                            value={playerNames.PLAYER_1}
                            onChange={(e) => setPlayerNames(prev => ({ ...prev, PLAYER_1: e.target.value }))}
                          />
                        </div>
                        <div className="flex-1 space-y-2">
                          <label className="text-center block font-semibold text-text-dim text-[10px] uppercase tracking-widest">
                            Player 2 Name
                          </label>
                          <input 
                            type="text"
                            maxLength={10}
                            className="w-full bg-bg-black border-2 border-border-subtle p-2 text-xs font-mono text-center text-text-light focus:border-accent outline-none focus:-translate-y-1 focus:shadow-[4px_4px_0_var(--color-accent)] transition-all uppercase placeholder-text-dim/50"
                            placeholder="PLAYER 2"
                            value={playerNames.PLAYER_2}
                            onChange={(e) => setPlayerNames(prev => ({ ...prev, PLAYER_2: e.target.value }))}
                          />
                        </div>
                     </div>
                   </div>
                </div>
              </motion.div>
            )}

            {/* SETUP PHASE */}
            {phase === 'SETUP' && !showToss && (
              <motion.div 
                key="setup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center justify-center flex-1 space-y-8 w-full mt-4"
              >
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold tracking-[0.2em] uppercase text-text-light">Match Setup</h2>
                </div>

                <div className="w-full space-y-3 pt-2">
                  <p className="text-center font-semibold text-text-dim text-[10px] uppercase tracking-widest">Game Mode</p>
                  <div className="flex gap-2 justify-center">
                    {(['PvE', 'PvP'] as GameMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setGameMode(m)}
                        className={cn(
                          "px-4 py-2 text-xs font-bold transition-all duration-300 uppercase tracking-widest border",
                          gameMode === m 
                            ? "border-accent bg-accent text-black shadow-[4px_4px_0_var(--color-accent)]" 
                            : "border-border-subtle bg-bg-hover text-text-dim hover:border-accent hover:text-accent hover:-translate-y-1 hover:translate-x-1 transition-transform"
                        )}
                      >
                        {m === 'PvE' ? '1 Player' : '2 Players'}
                      </button>
                    ))}
                  </div>
                </div>

                {gameMode === 'PvE' && (
                  <div className="w-full space-y-3 pt-4">
                    <p className="text-center font-semibold text-text-dim text-[10px] uppercase tracking-widest">Difficulty</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {(['EASY', 'BALANCED', 'DEFENSIVE', 'AGGRESSIVE', 'HARD'] as Difficulty[]).map((d) => (
                        <button
                          key={d}
                          onClick={() => setDifficulty(d)}
                          className={cn(
                            "px-4 py-2 text-xs font-bold transition-all duration-300 uppercase tracking-widest border",
                            difficulty === d 
                              ? "border-accent bg-accent text-black shadow-[4px_4px_0_var(--color-accent)]" 
                              : "border-border-subtle bg-bg-hover text-text-dim hover:border-accent hover:text-accent hover:-translate-y-1 hover:translate-x-1 transition-transform"
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={startGameFlow}
                  className="mt-8 w-full group h-16 border-2 border-border-subtle hover:border-accent hover:-translate-y-1 hover:shadow-[4px_4px_0_var(--color-accent)] transition-all flex items-center justify-center bg-bg-hover"
                >
                  <span className="text-xl font-bold group-hover:text-accent uppercase tracking-[0.2em] transition-colors text-text-light">Start Toss</span>
                </button>
              </motion.div>
            )}

            {/* TOSS PHASE */}
            {phase === 'SETUP' && showToss && (
               <motion.div 
               key="toss"
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 1.1 }}
               className="flex flex-col items-center justify-center flex-1 space-y-8"
             >
                <h2 className="text-[10px] uppercase tracking-[0.3em] text-text-dim text-center">Coin Toss</h2>
                
                {!tossResult ? (
                  <div className="space-y-6 w-full text-center">
                    <p className="text-text-mid text-xs font-mono uppercase tracking-widest">Choose Heads or Tails</p>
                    <div className="flex justify-center gap-6">
                      <button onClick={() => handleTossChoice('HEADS')} className="w-24 h-24 border-2 border-border-subtle bg-bg-hover hover:border-accent text-text-light hover:text-accent font-bold tracking-[0.2em] flex items-center justify-center transition-all uppercase hover:-translate-y-1 hover:shadow-[4px_4px_0_var(--color-accent)]">HEADS</button>
                      <button onClick={() => handleTossChoice('TAILS')} className="w-24 h-24 border-2 border-border-subtle bg-bg-hover hover:border-accent text-text-light hover:text-accent font-bold tracking-[0.2em] flex items-center justify-center transition-all uppercase hover:-translate-y-1 hover:shadow-[4px_4px_0_var(--color-accent)]">TAILS</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 w-full text-center">
                    <motion.div 
                      initial={{ rotateY: 0 }}
                      animate={{ rotateY: 1080 }} // multiple flips
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="w-24 h-24 mx-auto rounded-none border-2 border-accent flex items-center justify-center text-accent font-bold tracking-[0.2em] bg-bg-black"
                    >
                      {tossResult === 'HEADS' ? 'H' : 'T'}
                    </motion.div>
                    
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.5 }}
                      className="space-y-6"
                    >
                      <h3 className="text-xl font-bold uppercase tracking-[0.1em] text-accent">
                        {gameMode === 'PvE'
                          ? (tossWinner === 'USER' ? `${playerNames.USER || 'You'} won the toss` : `${playerNames.AI || 'Computer'} won the toss`)
                          : (tossWinner === 'PLAYER_1' ? `${playerNames.PLAYER_1 || 'Player 1'} won the toss` : `${playerNames.PLAYER_2 || 'Player 2'} won the toss`)}
                      </h3>
                      
                      {tossWinner === 'USER' || tossWinner === 'PLAYER_1' || tossWinner === 'PLAYER_2' ? (
                        <div className="space-y-4">
                          <p className="text-text-dim text-xs uppercase tracking-widest text-[10px]">Who should play first?</p>
                          <div className="flex gap-4 justify-center">
                            {gameMode === 'PvE' ? (
                              <>
                                <button onClick={() => handleTossDecision('USER')} className="px-6 py-3 border-2 border-accent bg-accent text-black uppercase text-xs font-bold shadow-[4px_4px_0_var(--color-accent)] hover:-translate-y-1 transition-transform truncate max-w-[120px]">{playerNames.USER || 'You'}</button>
                                <button onClick={() => handleTossDecision('AI')} className="px-6 py-3 border-2 border-border-subtle bg-bg-hover text-text-dim uppercase text-xs hover:border-accent hover:text-accent hover:-translate-y-1 transition-transform truncate max-w-[120px]">{playerNames.AI || 'Computer'}</button>
                              </>
                            ) : tossWinner === 'PLAYER_1' ? (
                              <>
                                <button onClick={() => handleTossDecision('PLAYER_1')} className="px-6 py-3 border-2 border-accent bg-accent text-black uppercase text-xs font-bold shadow-[4px_4px_0_var(--color-accent)] hover:-translate-y-1 transition-transform truncate max-w-[120px]">{playerNames.PLAYER_1 || 'Player 1'}</button>
                                <button onClick={() => handleTossDecision('PLAYER_2')} className="px-6 py-3 border-2 border-border-subtle bg-bg-hover text-text-dim uppercase text-xs hover:border-accent hover:text-accent hover:-translate-y-1 transition-transform truncate max-w-[120px]">{playerNames.PLAYER_2 || 'Player 2'}</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => handleTossDecision('PLAYER_2')} className="px-6 py-3 border-2 border-accent bg-accent text-black uppercase text-xs font-bold shadow-[4px_4px_0_var(--color-accent)] hover:-translate-y-1 transition-transform truncate max-w-[120px]">{playerNames.PLAYER_2 || 'Player 2'}</button>
                                <button onClick={() => handleTossDecision('PLAYER_1')} className="px-6 py-3 border-2 border-border-subtle bg-bg-hover text-text-dim uppercase text-xs hover:border-accent hover:text-accent hover:-translate-y-1 transition-transform truncate max-w-[120px]">{playerNames.PLAYER_1 || 'Player 1'}</button>
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-text-mid font-mono text-sm animate-pulse uppercase tracking-widest">
                          {playerNames.AI || 'Computer'} is deciding...
                        </p>
                      )}
                    </motion.div>
                  </div>
                )}
             </motion.div>
            )}

            {/* PLAYING PHASE */}
            {phase === 'PLAYING' && (
              <motion.div 
                key="playing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col flex-1"
              >
                {/* Turn Indicator */}
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-border-subtle">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest text-text-dim">Mode</span>
                    <span className="text-xs text-accent uppercase font-bold">{gameMode === 'PvE' ? difficulty : 'VS Friend'}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-widest text-text-dim mb-1">Turn Order</span>
                    <div className="flex items-center gap-3 w-32 justify-end">
                      <motion.div 
                        animate={{ opacity: [1, 0.4, 1] }} 
                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                        className={cn("w-3 h-3 rounded-none border border-black shrink-0", turn === 'USER' || turn === 'PLAYER_1' ? "bg-white" : "bg-accent")}
                      />
                      <span className="text-xs font-bold uppercase tracking-wider text-text-light truncate text-right">
                        {gameMode === 'PvE' 
                          ? (turn === 'USER' ? (playerNames.USER || 'You') : (playerNames.AI || 'Computer'))
                          : (turn === 'PLAYER_1' ? (playerNames.PLAYER_1 || 'Player 1') : (playerNames.PLAYER_2 || 'Player 2'))
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-7 gap-2 flex-1 content-center px-0">
                  {Array.from({ length: 21 }, (_, i) => i + 1).map(num => {
                    const isPlayed = num <= currentNumber;
                    const isPending = num > currentNumber && num <= pendingSelection;
                    const isValidChoice = num > currentNumber && num <= currentNumber + 3;
                    const canPlay = gameMode === 'PvE' ? turn === 'USER' : true;

                    return (
                      <motion.button
                        key={num}
                        disabled={!canPlay || num <= currentNumber || num > currentNumber + 3}
                        onClick={() => handleBoxClick(num)}
                        animate={
                          isPending 
                            ? { scale: [1.05, 1.1, 1.05], boxShadow: ["4px 4px 0 var(--color-accent)"] }
                            : { scale: 1, boxShadow: "0px 0px 0 transparent" }
                        }
                        transition={{
                          duration: 1.5,
                          repeat: isPending ? Infinity : 0,
                          ease: "easeInOut"
                        }}
                        className={cn(
                          "w-full aspect-square flex items-center justify-center text-sm font-mono font-bold transition-all duration-200 border-2",
                          isPlayed 
                            ? num === 21 
                                ? "border-red-900 bg-red-900/20 text-red-500 opacity-40 hover:scale-100 cursor-default" 
                                : "border-accent bg-accent text-black hover:scale-100 cursor-default"
                            : isPending
                              ? "border-accent bg-bg-black text-accent z-10 block"
                              : isValidChoice
                                ? "border-border-subtle bg-bg-hover text-text-mid hover:border-accent hover:text-accent hover:-translate-y-1 hover:shadow-[2px_2px_0_var(--color-accent)] cursor-pointer block"
                                : "border-border-subtle bg-[#111] opacity-40 text-text-dim cursor-not-allowed",
                          num === 21 && !isPlayed && !isPending && "border-red-900/40 text-red-600 bg-bg-black", 
                        )}
                      >
                        {num}
                      </motion.button>
                    )
                  })}
                </div>

                {/* Controls */}
                <div className="mt-8 flex gap-4">
                  <button
                    disabled={(gameMode === 'PvE' && turn !== 'USER') || pendingSelection <= currentNumber}
                    onClick={handleUndoSelection}
                    className="w-16 h-16 flex items-center justify-center border-2 border-border-subtle bg-bg-hover text-text-dim disabled:opacity-30 hover:border-text-light hover:text-text-light hover:-translate-y-1 transition-all"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                  <button
                    disabled={(gameMode === 'PvE' && turn !== 'USER') || pendingSelection <= currentNumber}
                    onClick={handleConfirmUserMove}
                    className="flex-1 h-16 border-2 border-accent bg-bg-black hover:bg-accent hover:text-black hover:-translate-y-1 shadow-[4px_4px_0_var(--color-accent)] group transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:border-border-subtle disabled:hover:bg-bg-black disabled:hover:text-text-light disabled:shadow-none disabled:transform-none"
                  >
                     <span className="text-sm font-bold uppercase tracking-[0.2em] group-disabled:text-text-dim text-accent group-hover:text-black transition-colors">Serve Selection</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* GAME OVER PHASE */}
            {phase === 'GAME_OVER' && (
              <motion.div 
                key="gameover"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center flex-1 space-y-8"
              >
                <div className="text-center space-y-4 px-4 overflow-hidden">
                  <h2 className={cn("font-bold text-4xl uppercase tracking-[0.2em] break-words", (winner === 'USER' || winner === 'PLAYER_1' || winner === 'PLAYER_2') ? 'text-accent' : 'text-text-light')}>
                    {winner && (playerNames[winner] || winner)} Wins
                  </h2>
                  <p className="font-mono text-sm uppercase tracking-widest text-text-mid">
                    {winner && (playerNames[winner] || 'Winner')} is served at Table 21.
                  </p>
                </div>

                <div className="flex flex-col gap-3 mt-8 w-full">
                  <button
                    onClick={handleRematch}
                    className="w-full group h-14 border-2 border-accent hover:bg-accent hover:-translate-y-1 shadow-[4px_4px_0_var(--color-accent)] transition-all flex items-center justify-center bg-bg-black"
                  >
                    <span className="text-sm font-bold uppercase tracking-[0.2em] text-accent group-hover:text-black transition-colors">Quick Rematch</span>
                  </button>

                  <button
                    onClick={() => setPhase('HOME')}
                    className="w-full group h-14 border-2 border-border-subtle hover:border-accent hover:-translate-y-1 transition-all flex items-center justify-center bg-bg-hover"
                  >
                    <span className="text-xs font-bold uppercase tracking-[0.2em] group-hover:text-accent transition-colors text-text-light">Main Menu</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <AnimatePresence>
          {showRulesModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-bg-base/90 backdrop-blur-sm flex flex-col p-6"
            >
              <div className="flex-1 bg-bg-panel border-2 border-border-subtle shadow-[8px_8px_0_var(--color-border-subtle)] p-6 flex flex-col relative">
                <button 
                  onClick={() => setShowRulesModal(false)}
                  className="absolute top-4 right-4 text-text-dim hover:text-accent transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold uppercase tracking-[0.2em] text-text-light mb-6">Game Rules</h2>
                
                <div className="space-y-6 overflow-y-auto text-sm font-mono text-text-mid flex-1 pr-2">
                  <div className="space-y-2">
                    <h3 className="text-accent uppercase tracking-widest text-xs font-bold">Goal</h3>
                    <p>Force your opponent to select the number <strong className="text-red-500">21</strong>.</p>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-accent uppercase tracking-widest text-xs font-bold">Number Selection</h3>
                    <p>On your turn, you must select 1, 2, or 3 consecutive numbers, continuing from the last selected number.</p>
                    <ul className="list-disc list-inside mt-2 space-y-2 ml-2 text-[10px] sm:text-xs">
                      <li>If the last number was 4, you can select up to 5, 6, or 7.</li>
                      <li>You must select at least 1 number.</li>
                      <li>You cannot skip numbers.</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-accent uppercase tracking-widest text-xs font-bold">Winning & Losing</h3>
                    <p>The player who is forced to select <strong className="text-red-500">21</strong> loses the game.</p>
                    <p className="mt-2 text-[10px] md:text-xs italic text-text-dim font-sans">Hint: There is a mathematical strategy to guarantee a win if you go second!</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowRulesModal(false)}
                  className="mt-6 w-full h-12 border-2 border-accent bg-bg-black hover:bg-accent hover:text-black transition-all flex items-center justify-center font-bold uppercase tracking-[0.2em] text-accent text-xs hover:-translate-y-1 shadow-[4px_4px_0_var(--color-accent)]"
                >
                  Got It
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="absolute bottom-0 left-0 w-full h-12 border-t border-border-subtle px-8 flex items-center justify-between text-[10px] tracking-[0.2em] text-text-muted bg-bg-panel uppercase">
          <span>Game Version 1.0.2</span>
          <span>Bistro Series</span>
        </footer>
      </div>
    </div>
  );
}

