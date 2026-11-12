import gameMarkup from '../../public/index.html?raw';
import gameStyles from '@/style.css?raw';
import gameScript from '@/script.js?raw';

const gameDocument = gameMarkup
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>${gameStyles}</style>`)
  .replace('<script src="script.js"></script>', () => `<script>${gameScript}</script>`);

export default function WildBountyGame() {
  return (
    <iframe
      title="Wild Bounty Showdown"
      srcDoc={gameDocument}
      sandbox="allow-scripts allow-modals"
      className="w-full h-full border-0 block"
    />
  );
}
