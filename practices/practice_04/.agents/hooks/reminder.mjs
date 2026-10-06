#!/usr/bin/env node
import fs from 'fs';

try {
  const input = fs.readFileSync(0, 'utf-8');
  console.log(JSON.stringify({
    injectSteps: [
      {
        ephemeralMessage: "Правила Lizard Arena: Базовое HP = 100, 1 ягода = +10 HP, масштаб S = sqrt(score/100), авторитетная физика на сервере (60Hz), процедурный рендеринг без внешних тяжелых картинок/звуков."
      }
    ]
  }));
} catch (e) {
  console.log(JSON.stringify({ injectSteps: [] }));
}
