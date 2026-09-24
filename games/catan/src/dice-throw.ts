/** The 8-bit skin's throw length: the same path, replayed at a fixed stepped pace. */
export const pixelThrowDuration = (strength: number) =>
  1100 + Math.max(0, Math.min(1, strength)) * 1300;

/** Small cosmetic simulation, independent of the rules and their randomness. */
export function diceThrow(strength: number, random: () => number) {
  const power = Math.max(0, Math.min(1, strength));
  let duration = 1600 + power * 2200;
  const steps = Math.ceil(duration / (1000 / 60));
  const dt = duration / 1000 / steps;
  const dice = [0, 1].map((i) => {
    let x = (i ? 0.22 : -0.22) + (random() - 0.5) * 0.12,
      y = 0.5 + random() * 0.12;
    const heading = -Math.PI / 2 + (random() - 0.5) * 1.8;
    const speed = (1.3 + power * 5) * (0.85 + random() * 0.3);
    let vx = Math.cos(heading) * speed,
      vy = Math.sin(heading) * speed;
    let height = 0.06,
      vertical = 0.8 + power * 0.6 + random() * 0.3;
    let spinX = 0,
      spinY = 0,
      yaw = random() * 40 - 20;
    const axisX = 150 + random() * 140,
      axisY = (random() - 0.5) * 260;
    const friction = 3.2 - power * 1.5;
    return {
      x,
      y,
      vx,
      vy,
      height,
      vertical,
      spinX,
      spinY,
      yaw,
      axisX,
      axisY,
      friction,
    };
  });
  const paths: {
    x: number;
    y: number;
    height: number;
    spinX: number;
    spinY: number;
    yaw: number;
    offset: number;
  }[][] = [[], []];
  for (let step = 0; step <= steps; step++) {
    dice.forEach((die, i) => {
      paths[i].push({ ...die, offset: step / steps });
      die.x += die.vx * dt;
      die.y += die.vy * dt;
      for (let edge = 0; edge < 6; edge++) {
        const angle = Math.PI / 6 + (edge * Math.PI) / 3;
        const nx = Math.cos(angle),
          ny = Math.sin(angle);
        const outside = die.x * nx + die.y * ny - 0.8;
        if (outside > 0) {
          die.x -= outside * nx;
          die.y -= outside * ny;
          const outgoing = die.vx * nx + die.vy * ny;
          if (outgoing > 0) {
            die.vx -= 1.65 * outgoing * nx;
            die.vy -= 1.65 * outgoing * ny;
          }
        }
      }
      die.vertical -= 5.5 * dt;
      die.height += die.vertical * dt;
      if (die.height <= 0) {
        die.height = 0;
        die.vertical = Math.abs(die.vertical) > 0.22 ? -die.vertical * 0.38 : 0;
      }
      const decay = Math.exp(-die.friction * dt);
      die.vx *= decay;
      die.vy *= decay;
      const momentum =
        Math.hypot(die.vx, die.vy) + Math.abs(die.vertical) * 0.3;
      die.spinX += die.axisX * momentum * dt;
      die.spinY += die.axisY * momentum * dt;
      die.yaw += (die.vx - die.vy) * 25 * dt;
    });
    const [a, b] = dice;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      distance = Math.hypot(dx, dy);
    if (distance < 0.25 && Math.abs(a.height - b.height) < 0.12) {
      const nx = distance ? dx / distance : 1,
        ny = distance ? dy / distance : 0;
      const overlap = (0.25 - distance) / 2;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;
      const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (closing > 0) {
        a.vx -= nx * closing * 0.8;
        a.vy -= ny * closing * 0.8;
        b.vx += nx * closing * 0.8;
        b.vy += ny * closing * 0.8;
      }
    }
  }
  // Stop the asymptotic low-energy tail as soon as both dice are on their
  // final face. The last tip takes 520 ms, regardless of charge strength.
  const settle = Math.max(
    ...paths.map((path) => {
      const last = path.at(-1)!;
      return path.findIndex(
        (p) =>
          p.offset >= 0.15 &&
          p.height < 0.025 &&
          Math.abs(last.spinX - p.spinX) < 65 &&
          Math.abs(last.spinY - p.spinY) < 65,
      );
    }),
  );
  const start = Math.max(1, settle);
  const end = Math.min(steps, start + Math.ceil(0.52 / dt));
  for (const path of paths) {
    const last = { ...path.at(-1)! };
    // Ease the residual slide and tilt to zero velocity, then hold still.
    // Match the incoming tangent rather than abruptly cutting off the simulation.

    const fields = ['x', 'y', 'height', 'spinX', 'spinY', 'yaw'] as const;
    const anchor = { ...path[start] };
    for (const field of fields) {
      const delta = last[field] - anchor[field];
      const incoming = (anchor[field] - path[start - 1][field]) * (end - start);
      // A monotone tangent prevents the last few degrees reversing into a wobble.
      const tangent =
        delta === 0
          ? 0
          : Math.sign(delta) *
            Math.min(
              Math.max(0, incoming * Math.sign(delta)),
              3 * Math.abs(delta),
            );
      for (let frame = start; frame < path.length; frame++) {
        const t = Math.min(1, (frame - start) / (end - start));
        path[frame][field] =
          t === 1
            ? last[field]
            : anchor[field] +
              delta * (3 * t * t - 2 * t * t * t) +
              tangent * (t * t * t - 2 * t * t + t);
      }
    }

    path.splice(end + 1);
    path.push({ ...path.at(-1)! });
    path.forEach((point, i) => (point.offset = i / (path.length - 1)));
    const spinX = last.spinX,
      spinY = last.spinY;
    for (const point of path) {
      point.spinX -= spinX;
      point.spinY -= spinY;
    }
  }
  duration = (end + 1) * dt * 1000;
  const a = paths[0].at(-1)!,
    b = paths[1].at(-1)!;
  return {
    paths,
    duration,
    landing: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  };
}
