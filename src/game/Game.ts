import { TILE_SIZE } from './World';
import { Renderer } from './Renderer';
import { Simulation } from './Simulation';

interface UiRefs {
  pauseButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  speedSelect: HTMLSelectElement;
  spawnAntButton: HTMLButtonElement;
  spawnFoodButton: HTMLButtonElement;
  debugToggle: HTMLInputElement;
  antCount: HTMLElement;
  storedFood: HTMLElement;
  hiveSize: HTMLElement;
  knownFood: HTMLElement;
  runtime: HTMLElement;
  selectedAntId: HTMLElement;
  selectedAntGoal: HTMLElement;
  selectedAntAction: HTMLElement;
  selectedAntCarrying: HTMLElement;
  selectedAntEnergy: HTMLElement;
  selectedAntPlan: HTMLElement;
}

export class Game {
  readonly simulation = new Simulation();
  private readonly renderer: Renderer;
  private readonly ui: UiRefs;
  private lastTimestamp = 0;
  private lastUiUpdateTimestamp = 0;
  private accumulator = 0;
  private animationFrame = 0;
  private readonly fixedStep = 1 / 30;
  private readonly uiUpdateInterval = 200;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.ui = readUiRefs();
    this.bindControls();
  }

  start(): void {
    this.animationFrame = requestAnimationFrame((timestamp) => this.loop(timestamp));
  }

  stop(): void {
    cancelAnimationFrame(this.animationFrame);
  }

  private loop(timestamp: number): void {
    const delta =
      this.lastTimestamp === 0 ? 0 : Math.min(0.1, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;
    this.accumulator += delta * this.simulation.speed;

    while (this.accumulator >= this.fixedStep) {
      this.simulation.update(this.fixedStep);
      this.accumulator -= this.fixedStep;
    }

    this.renderer.render(this.simulation, this.ui.debugToggle.checked);
    if (
      this.lastUiUpdateTimestamp === 0 ||
      timestamp - this.lastUiUpdateTimestamp >= this.uiUpdateInterval
    ) {
      this.updateUi();
      this.lastUiUpdateTimestamp = timestamp;
    }
    this.animationFrame = requestAnimationFrame((nextTimestamp) => this.loop(nextTimestamp));
  }

  private bindControls(): void {
    this.ui.pauseButton.addEventListener('click', () => {
      this.simulation.paused = !this.simulation.paused;
      this.updateUi();
    });

    this.ui.resetButton.addEventListener('click', () => {
      this.simulation.reset();
      this.updateUi();
    });

    this.ui.speedSelect.addEventListener('change', () => {
      this.simulation.speed = Number(this.ui.speedSelect.value);
      this.updateUi();
    });

    this.ui.spawnAntButton.addEventListener('click', () => {
      const ant = this.simulation.spawnAnt();
      this.simulation.selectedAntId = ant.id;
      this.updateUi();
    });

    this.ui.spawnFoodButton.addEventListener('click', () => {
      this.simulation.spawnFood();
      this.updateUi();
    });

    this.canvas.addEventListener('click', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = Math.floor(((event.clientX - rect.left) * scaleX) / TILE_SIZE);
      const y = Math.floor(((event.clientY - rect.top) * scaleY) / TILE_SIZE);
      this.simulation.selectAntAt({ x, y });
      this.updateUi();
    });
  }

  private updateUi(): void {
    const stats = this.simulation.getStats();
    const selected = this.simulation.selectedAnt;

    this.ui.pauseButton.textContent = stats.paused ? 'Resume' : 'Pause';
    this.ui.antCount.textContent = String(stats.antCount);
    this.ui.storedFood.textContent = String(stats.storedFood);
    this.ui.hiveSize.textContent = String(stats.hiveSize);
    this.ui.knownFood.textContent = String(stats.knownFoodSources);
    this.ui.runtime.textContent = formatRuntime(stats.elapsedTime);

    this.ui.selectedAntId.textContent = selected?.id ?? 'none';
    this.ui.selectedAntGoal.textContent = selected?.currentGoal?.name ?? 'none';
    this.ui.selectedAntAction.textContent = selected?.currentAction?.name ?? 'none';
    this.ui.selectedAntCarrying.textContent = selected?.carrying ?? 'none';
    this.ui.selectedAntEnergy.textContent = selected ? String(Math.round(selected.energy)) : '0';
    this.ui.selectedAntPlan.textContent = selected
      ? [selected.currentAction?.name, ...selected.currentPlan.map((action) => action.name)]
          .filter(Boolean)
          .join(' -> ') || 'none'
      : 'none';
  }
}

function readUiRefs(): UiRefs {
  return {
    pauseButton: requiredElement('pause-button', HTMLButtonElement),
    resetButton: requiredElement('reset-button', HTMLButtonElement),
    speedSelect: requiredElement('speed-select', HTMLSelectElement),
    spawnAntButton: requiredElement('spawn-ant-button', HTMLButtonElement),
    spawnFoodButton: requiredElement('spawn-food-button', HTMLButtonElement),
    debugToggle: requiredElement('debug-toggle', HTMLInputElement),
    antCount: requiredElement('ant-count', HTMLElement),
    storedFood: requiredElement('stored-food', HTMLElement),
    hiveSize: requiredElement('hive-size', HTMLElement),
    knownFood: requiredElement('known-food', HTMLElement),
    runtime: requiredElement('runtime', HTMLElement),
    selectedAntId: requiredElement('selected-ant-id', HTMLElement),
    selectedAntGoal: requiredElement('selected-ant-goal', HTMLElement),
    selectedAntAction: requiredElement('selected-ant-action', HTMLElement),
    selectedAntCarrying: requiredElement('selected-ant-carrying', HTMLElement),
    selectedAntEnergy: requiredElement('selected-ant-energy', HTMLElement),
    selectedAntPlan: requiredElement('selected-ant-plan', HTMLElement),
  };
}

function requiredElement<T extends typeof HTMLElement>(
  id: string,
  constructor: T,
): InstanceType<T> {
  const element = document.getElementById(id);
  if (!(element instanceof constructor)) {
    throw new Error(`Missing required element: #${id}`);
  }

  return element as InstanceType<T>;
}

function formatRuntime(elapsedTime: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedTime));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}:${padTime(minutes)}:${padTime(seconds)}`;
  }

  return `${padTime(minutes)}:${padTime(seconds)}`;
}

function padTime(value: number): string {
  return String(value).padStart(2, '0');
}
