import { GameClient } from './GameClient.js';
import { CanvasRenderer } from './renderer/CanvasRenderer.js';

// DOM Elements
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;

const hud = document.getElementById('hud') as HTMLElement;
const playerNameDisplay = document.getElementById('player-name-display') as HTMLElement;
const healthBarFill = document.getElementById('health-bar-fill') as HTMLElement;
const scoreText = document.getElementById('score-text') as HTMLElement;
const berriesEatenText = document.getElementById('berries-eaten-text') as HTMLElement;
const bitesDealtText = document.getElementById('bites-dealt-text') as HTMLElement;
const leaderboardList = document.getElementById('leaderboard-list') as HTMLOListElement;

const startModal = document.getElementById('start-modal') as HTMLElement;
const nicknameInput = document.getElementById('nickname-input') as HTMLInputElement;
const skinSelector = document.getElementById('skin-selector') as HTMLElement;
const playBtn = document.getElementById('play-btn') as HTMLButtonElement;

const gameoverModal = document.getElementById('gameover-modal') as HTMLElement;
const finalScoreVal = document.getElementById('final-score-val') as HTMLElement;
const finalBerriesVal = document.getElementById('final-berries-val') as HTMLElement;
const respawnBtn = document.getElementById('respawn-btn') as HTMLButtonElement;

// Init Client & Renderer
const client = new GameClient();
const renderer = new CanvasRenderer(canvas, minimapCanvas);

// Selected Skin
let selectedColor = '#2ECC71';
let selectedSecondary = '#27AE60';

skinSelector.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('.skin-option') as HTMLElement;
  if (!target) return;

  document.querySelectorAll('.skin-option').forEach((el) => el.classList.remove('selected'));
  target.classList.add('selected');

  selectedColor = target.getAttribute('data-color') || '#2ECC71';
  selectedSecondary = target.getAttribute('data-secondary') || '#27AE60';
});

// Play Action
playBtn.addEventListener('click', () => {
  const name = nicknameInput.value.trim() || 'Геккон';
  client.join(name, selectedColor, selectedSecondary);
  playerNameDisplay.textContent = name;

  startModal.classList.add('hidden');
  hud.classList.remove('hidden');
});

// Respawn Action
respawnBtn.addEventListener('click', () => {
  const name = nicknameInput.value.trim() || 'Геккон';
  client.respawn(name);

  gameoverModal.classList.add('hidden');
  hud.classList.remove('hidden');
});

// Death Handler
client.onDeath = (killer, finalScore) => {
  hud.classList.add('hidden');
  gameoverModal.classList.remove('hidden');

  finalScoreVal.textContent = finalScore.toString();
  finalBerriesVal.textContent = client.berriesEatenCount.toString();
};

// Input Tracking
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let isBoosting = false;

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

window.addEventListener('mousedown', (e) => {
  if (e.button === 0 && client.isPlaying) {
    isBoosting = true;
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    isBoosting = false;
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && client.isPlaying) {
    isBoosting = true;
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    isBoosting = false;
  }
});

// Touch controls for mobile
window.addEventListener('touchmove', (e) => {
  if (e.touches.length > 0) {
    mouseX = e.touches[0].clientX;
    mouseY = e.touches[0].clientY;
  }
}, { passive: true });

// Input Send Interval (40 times/sec)
setInterval(() => {
  if (!client.isPlaying || !client.currentSnapshot) return;

  const selfLizard = client.currentSnapshot.lizards.find((l) => l.id === client.selfId);
  let targetAngle = 0;

  if (selfLizard) {
    // Convert screen mouse pos to world pos
    const worldPos = renderer.screenToWorld(mouseX, mouseY);
    targetAngle = Math.atan2(worldPos.y - selfLizard.y, worldPos.x - selfLizard.x);
  } else {
    // Relative to screen center
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    targetAngle = Math.atan2(mouseY - cy, mouseX - cx);
  }

  client.sendInput(targetAngle, isBoosting);
}, 25);

// Main Render Loop
let lastTime = performance.now();

function animate(now: number) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  client.particles.update(dt);

  if (client.currentSnapshot) {
    renderer.render(client.currentSnapshot, client.selfId, client.particles, dt, now);

    // Update HUD
    const selfLizard = client.currentSnapshot.lizards.find((l) => l.id === client.selfId);
    if (selfLizard) {
      scoreText.textContent = selfLizard.score.toString();
      berriesEatenText.textContent = client.berriesEatenCount.toString();
      bitesDealtText.textContent = client.bitesDealtCount.toString();

      // Health bar relative to maximum comfortable scale
      const hpPercent = Math.min(100, Math.max(5, (selfLizard.score / 250) * 100));
      healthBarFill.style.width = `${hpPercent}%`;

      if (selfLizard.score < 40) {
        healthBarFill.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
      } else if (selfLizard.score < 80) {
        healthBarFill.style.background = 'linear-gradient(90deg, #f1c40f, #e67e22)';
      } else {
        healthBarFill.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
      }
    }

    // Update Leaderboard
    updateLeaderboard(client.currentSnapshot.leaderboard, client.selfId);
  }

  requestAnimationFrame(animate);
}

function updateLeaderboard(entries: any[], selfId: string) {
  leaderboardList.innerHTML = '';
  entries.forEach((entry, idx) => {
    const li = document.createElement('li');
    if (entry.id === selfId) {
      li.classList.add('self-row');
    }
    li.innerHTML = `<span>${idx + 1}. ${entry.name}</span> <span>${entry.score}</span>`;
    leaderboardList.appendChild(li);
  });
}

requestAnimationFrame(animate);
