---
name: lizard-arena
description: >-
  Specific architecture, game rules, formulas, and guidelines for the Lizard Arena
  (Agar.io-like 2D multiplayer game with lizards, berries, combat damage, and bots).
---

# Lizard Arena Game Design & Specifications

## 1. Core Game Rules & Formulas
- **Health / Score Equivalence**:
  - `score` acts directly as health points (`HP`).
  - Base starting score/HP: `100`.
  - Max/death condition: If `score <= 0`, the lizard dies and drops berries proportional to a fraction of its lost mass.
- **Berries & Growth**:
  - 1 Berry = `+10` points/HP.
  - Berries randomly spawn on the world map and maintain a minimum density.
- **Visual Scaling**:
  - Scale factor: $S = \sqrt{\text{score} / 100}$.
  - Head radius: $R_{\text{head}} = R_0 \cdot S$ (where base $R_0 \approx 18\text{px}$).
  - Body length & segment count increase with score ($L = L_0 + \text{segments} \cdot S$).
  - Camera zoom scales inversely: $\text{zoom} = \max(0.35, 1.0 / (0.8 + 0.2 \cdot S))$.
  - Speed scales slightly downwards with size for balance: $\text{speed} = v_0 / S^{0.25}$.

## 2. Lizard Anatomy & Kinematics
- **Head**: Contains eyes, nose, animated tongue that flicks occasionally.
- **Body & Spine**: Chain of $N$ linked segments with constraint distance.
- **Limbs**: 4 legs attached to specific spine segments, animated with alternating walking gait matching movement speed.
- **Tail**: Tapering segments trailing behind.

## 3. Combat & Damage Mechanics
- If a lizard's head hits another lizard's body/tail:
  - Deals damage: e.g. base bite damage $D = 15 + 5 \cdot S$.
  - Damaged lizard loses HP ($-\text{damage}$).
  - Attacker gains a portion of the stolen mass or berries scatter at the bite point.
  - Floating damage numbers & hit particles trigger on bite.
  - Cooldown per target to prevent instant multi-frame death.
- If two lizard heads collide:
  - Both take damage or larger lizard deals more damage to smaller one.

## 4. Architecture (Multiplayer + Bots)
- **Authoritative Server / Game State**:
  - Fast spatial partitioning (Spatial Hash Grid) for $O(1)$ berry pickup and lizard proximity checks.
  - Tickrate: 30-60 ticks/s.
  - Synchronizes world state: lizard heads, spine angles, scores, berries, damage events.
- **AI Bots**:
  - State machine: `FORAGE` (seek nearest berry), `ATTACK` (seek smaller/equal lizard), `FLEE` (turn away from much larger/attacking lizard), `WANDER`.
  - Bots spawn automatically when player count is below desired room capacity.
- **Client**:
  - HTML5 Canvas 2D + Vite.
  - Smooth interpolation of state, responsive mouse/touch steering, sound effects (Web Audio API synthesizers), particle effects.
