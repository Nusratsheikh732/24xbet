import { useState } from 'react';
import { teamLogos } from '@/data/teamLogos';

interface ClubLogoProps {
  teamName: string;
  size?: number;
}

const clubColors: Record<string, { bg: string; fg: string; abbr: string }> = {
  Marseille: { bg: '#2FAEE0', fg: '#FFFFFF', abbr: 'OM' },
};

function Fallback({ teamName, size }: { teamName: string; size: number }) {
  const info = clubColors[teamName] || { bg: '#1e3a5f', fg: '#fff', abbr: teamName.slice(0, 2).toUpperCase() };
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="24" fill={info.bg} />
      <text
        x="24" y="30"
        textAnchor="middle"
        fontSize="14"
        fontWeight="900"
        fill={info.fg}
        fontFamily="Arial, sans-serif"
      >
        {info.abbr}
      </text>
    </svg>
  );
}

export default function ClubLogo({ teamName, size = 40 }: ClubLogoProps) {
  const logoUrl = teamLogos[teamName];
  const [errored, setErrored] = useState(false);

  if (!logoUrl || errored) {
    return (
      <div
        className="rounded-full overflow-hidden shrink-0 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Fallback teamName={teamName} size={size} />
      </div>
    );
  }

  return (
    <div
      className="rounded-full overflow-hidden bg-white/95 flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <img
        src={logoUrl}
        alt={teamName}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={() => setErrored(true)}
      />
    </div>
  );
}
