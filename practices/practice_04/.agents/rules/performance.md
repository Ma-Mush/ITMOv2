# Performance Guidelines

## Spatial Partitioning
- Collision queries for berries and lizards MUST use `SpatialGrid`.
- Never perform brute-force $O(N \cdot M)$ checks between all lizards and all berries.

## Audio & Graphics
- Procedural audio via Web Audio API oscillators. Do not load external media files.
- Procedural vector rendering on 2D Canvas. Do not load external sprite textures.

## Network
- Server physics at 60 Hz.
- Network broadcast at 30 Hz.
- Client interpolates positions for 60+ FPS visual smoothness.
