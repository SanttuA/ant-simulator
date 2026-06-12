import './styles.css';
import { Game } from './game/Game';

const canvas = document.getElementById('world-canvas');

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing world canvas.');
}

const game = new Game(canvas);
game.start();

window.addEventListener('beforeunload', () => {
  game.stop();
});
