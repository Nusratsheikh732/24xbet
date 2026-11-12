import type { Game } from '@/types';

interface GameCardProps {
  game: Game;
  onClick: (game: Game) => void;
}

export default function GameCard({ game, onClick }: GameCardProps) {
  return (
    <div
      onClick={() => onClick(game)}
      className="relative group cursor-pointer active:scale-95 transition-transform"
    >
      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-dark-card2 border border-dark-border group-hover:border-neon-green/30 transition-colors">
        <img
          src={game.image}
          alt={game.name}
          loading="lazy"
          className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/40 to-transparent" />

        {/* Play overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-neon-green/90 flex items-center justify-center neon-green-glow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-dark-bg">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Game name */}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-xs font-bold text-white truncate">{game.name}</p>
        </div>
      </div>
    </div>
  );
}
