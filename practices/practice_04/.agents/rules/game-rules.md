# Game Rules & Mechanics

## Core Parameters
- **Score is Health**: The score value directly represents health points (HP).
- **Starting Value**: 100 HP.
- **Berries**: Each berry eaten gives exactly +10 points/HP.
- **Scale Formula**:
  $$S = \sqrt{\frac{\max(10, \text{score})}{100}}$$
- **Damage**:
  Head touches body/head -> $D = 25 + 10 \cdot (S - 1)$.
  Attacker absorbs +40% of damage dealt.
  Bite cooldown: 350ms.
- **Death Drop**: When HP <= 0, lizard dies and spawns a cluster of berries.
- **Bots**: Always maintain at least 14 active bots.
