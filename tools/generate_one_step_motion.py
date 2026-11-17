"""Build the isolated policy motion from a single smooth, symmetric density.

Run with: python -m pip install numpy contourpy matplotlib pillow
          python tools/generate_one_step_motion.py
This is an illustrative density evolution, not a recorded policy rollout.
All contour levels come from the SAME field. No image warping, tracing,
per-contour interpolation, or smoothing of extracted paths is used.
"""
from pathlib import Path
import json
import numpy as np
import contourpy
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/projects/optiflow'
LEVELS = [.025, .17, .40, .70]
COLORS = ['#efd3e0', '#e9bdd1', '#e2a9c3', '#dd99b8']
DOMAIN = .65
axis = np.linspace(-DOMAIN, DOMAIN, 401)
X, Y = np.meshgrid(axis, axis)

def density(t):
    field = np.zeros_like(X)
    for side in (-1, 1):
        for lower in (False, True):
            cx = side * (.13 if lower else .27) * t
            cy = (-.10 if lower else .29) * t
            angle = side * (-np.pi / 4 if lower else np.pi / 4)
            dx, dy = X - cx, Y - cy
            u = dx * np.cos(angle) + dy * np.sin(angle)
            v = -dx * np.sin(angle) + dy * np.cos(angle)
            major = .09 * (1 - t) + (.10 if lower else .14) * t
            minor = .09 * (1 - t) + (.045 if lower else .065) * t
            field += (.04 if lower else 1) * np.exp(-.5 * ((u / major)**2 + (v / minor)**2))
    # A small smooth bridge keeps the outer support connected, without holes.
    field += .025 * t * np.exp(-.5 * (X**2 + (Y - .035 * t)**2) / .11**2)
    field /= field.max()
    # Concentrate the high-density cores toward the tips of the two lobes.
    # The compact gate is zero near the outer contour, preserving its envelope.
    cores = np.zeros_like(field)
    for side in (-1, 1):
        angle = side * np.pi / 4
        dx, dy = X - side * .35 * t, Y - .37 * t
        u = dx * np.cos(angle) + dy * np.sin(angle)
        v = -dx * np.sin(angle) + dy * np.cos(angle)
        major, minor = .09 * (1 - t) + .075 * t, .09 * (1 - t) + .038 * t
        cores += np.exp(-.5 * ((u / major)**2 + (v / minor)**2))
    gate = np.clip((field - .04) / .12, 0, 1)
    gate = gate * gate * (3 - 2 * gate)
    # Compress the broad component monotonically below the second contour.
    # A subtractive gate would introduce false ridges around the mode interior.
    compressed = np.where(field > LEVELS[0],
                          LEVELS[0] + .10 * (1 - np.exp(-np.maximum(field - LEVELS[0], 0) / .10)),
                          field)
    field = (1 - t) * field + t * (compressed + cores * gate)
    assert np.max(np.abs(field - field[:, ::-1])) < 1e-12
    return field

def paths(t):
    generator = contourpy.contour_generator(x=axis, y=axis, z=density(t), name='serial')
    result = []
    for level in LEVELS:
        pieces = []
        loops = generator.lines(level)
        assert len(loops) == 1 if level == LEVELS[0] else 1 <= len(loops) <= 2, 'Unexpected contour island'
        for points in loops:
            assert np.allclose(points[0], points[-1]), 'Contour must stay inside frame'
            coords = np.column_stack(((points[:, 0] + DOMAIN) / (2 * DOMAIN) * 400,
                                      (DOMAIN - points[:, 1]) / (2 * DOMAIN) * 400))
            pieces.append('M' + 'L'.join(f'{x:.2f},{y:.2f}' for x, y in coords) + 'Z')
        result.append(''.join(pieces))
    return result

frames = [paths(i / 96) for i in range(97)]
(OUT / 'one-step-motion.json').write_text(json.dumps({'size': 400, 'colors': COLORS, 'frames': frames}, separators=(',', ':')))

# An inspectable overview includes the actual splitting transition.
fig, axes = plt.subplots(2, 4, figsize=(12, 6))
for ax, t in zip(axes.flat, [0, .2, .4, .5, .6, .75, .9, 1]):
    z = density(t)
    ax.set_facecolor('#f8ebf2')
    ax.contourf(X, Y, z, levels=LEVELS + [2], colors=COLORS)
    ax.contour(X, Y, z, levels=LEVELS, colors='#242124', linewidths=1.1)
    ax.set_aspect('equal'); ax.set_xticks([]); ax.set_yticks([])
    ax.set_title(f'{round(t * 100)}%', fontsize=11)
fig.tight_layout()
fig.savefig(OUT / 'one-step-motion-stages.png', dpi=160)
plt.close(fig)

# Small animated preview for review outside the site. The browser uses 60 Hz.
fig = plt.figure(figsize=(4, 4), dpi=120)
ax = fig.add_axes([.035, .035, .93, .93])
images = []
for i in range(41):
    t = i / 40
    t = t * t * (3 - 2 * t)
    ax.clear(); ax.set_facecolor('#f8ebf2')
    z = density(t)
    ax.contourf(X, Y, z, levels=LEVELS + [2], colors=COLORS)
    ax.contour(X, Y, z, levels=LEVELS, colors='#242124', linewidths=1.3)
    ax.set_aspect('equal'); ax.set_xticks([]); ax.set_yticks([])
    for spine in ax.spines.values(): spine.set_linewidth(1.8)
    fig.canvas.draw()
    images.append(Image.fromarray(np.asarray(fig.canvas.buffer_rgba()).copy()).convert('RGB'))
durations = [800] + [20] * 39 + [1600]
images[0].save(OUT / 'one-step-motion.gif', save_all=True, append_images=images[1:], duration=durations, loop=0, disposal=2)
plt.close(fig)
print(f'Generated {len(frames)} contour frames. All frames satisfy reflection symmetry and closed contours.')
