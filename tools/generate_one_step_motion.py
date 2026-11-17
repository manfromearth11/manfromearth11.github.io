"""Build the isolated policy motion from a single smooth, symmetric density.

Run with: python -m pip install numpy contourpy matplotlib pillow
          python tools/generate_one_step_motion.py
This is an illustrative density evolution, not a recorded policy rollout.
Contour formation, tip concentration, and lower extension evolve together
from the first frame. The final contour geometry stays fixed between revisions.
No raster image warping, tracing, or smoothing of extracted paths is used.
"""
from pathlib import Path
import json
import numpy as np
import contourpy
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Circle
from matplotlib.path import Path as GeometryPath
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
        # Nested, equal-orientation ellipses retain their span while their
        # centers move farther outward at higher density levels.
        dx, dy = X - side * .27 * t, Y - .29 * t
        u = (side * dx + dy) / np.sqrt(2)
        v = (side * dx - dy) / np.sqrt(2)
        major, minor = .09 * (1 - t) + .13 * t, .09 * (1 - t) + .060 * t
        apex, skew = .22 * t, .065 * t
        delta = u - apex
        coefficient = major**2 - skew**2
        radius = (skew * delta + np.sqrt(major**2 * delta**2
                  + coefficient * (major / minor)**2 * v**2)) / coefficient
        cores += np.exp(-.5 * radius**2)
    gate = np.clip((field - .04) / .12, 0, 1)
    gate = gate * gate * (3 - 2 * gate)
    # Compress the broad component monotonically below the second contour.
    # A subtractive gate would introduce false ridges around the mode interior.
    compressed = np.where(field > LEVELS[0],
                          LEVELS[0] + .020 * (1 - np.exp(-np.maximum(field - LEVELS[0], 0) / .020)),
                          field)
    concentration = 1 - (1 - t)**2
    field = (1 - concentration) * field + concentration * (compressed + cores * gate)
    assert np.max(np.abs(field - field[:, ::-1])) < 1e-12
    return field

def contours(t):
    generator = contourpy.contour_generator(x=axis, y=axis, z=density(t), name='serial')
    result = []
    motion = t * t * (3 - 2 * t)
    shift = 19 * motion
    transition = 120 * (1 - t) + 15 * t

    def side_weight(coords):
        u = np.clip((coords[:, 0] - 200) / transition, -1, 1)
        return u * (1.5 - .5 * u * u)

    for level in LEVELS:
        rings = []
        loops = generator.lines(level)
        assert len(loops) == 1 if level == LEVELS[0] else 1 <= len(loops) <= 2, 'Unexpected contour island'
        for points in loops:
            assert np.allclose(points[0], points[-1]), 'Contour must stay inside frame'
            coords = np.column_stack(((points[:, 0] + DOMAIN) / (2 * DOMAIN) * 400,
                                      (DOMAIN - points[:, 1]) / (2 * DOMAIN) * 400))
            if level != LEVELS[0]:
                side = side_weight(coords)
                coords += shift / np.sqrt(2) * np.column_stack((side, -side**2))
            rings.append(coords)
        result.append(rings)

    # One continuous symmetric map also works before an inner ring splits.
    # It has no late-stage activation or separate translation phase.
    second = np.concatenate(result[1])
    hinge = ((np.minimum(second[:, 0], 400 - second[:, 0]) + second[:, 1]) / np.sqrt(2)).min() + 30
    for rings in result[1:]:
        for ring in rings:
            side = side_weight(ring)
            axial = (np.minimum(ring[:, 0], 400 - ring[:, 0]) + ring[:, 1]) / np.sqrt(2)
            distance = np.maximum(axial - hinge, 0)
            extension = .25 * motion * distance**2 / (distance + 16)
            ring += extension[:, None] / np.sqrt(2) * np.column_stack((-side, side**2))

    envelope = GeometryPath(result[0][0])
    for rings in result[1:]:
        for ring in rings:
            assert envelope.contains_points(ring[:-1]).all(), f'Inner contour crossed outer boundary at {t}'
    for parents, children in zip(result, result[1:]):
        boundaries = [GeometryPath(parent) for parent in parents]
        for child in children:
            inside = np.logical_or.reduce([boundary.contains_points(child[:-1]) for boundary in boundaries])
            assert inside.all(), f'Nested contours crossed at {t}'
    return result

def paths(t):
    return [''.join('M' + 'L'.join(f'{x:.2f},{y:.2f}' for x, y in ring) + 'Z'
                    for ring in rings) for rings in contours(t)]

def plot_frame(ax, t):
    ax.set_facecolor('#fafcfe')
    for color, rings in zip(COLORS, contours(t)):
        for ring in rings:
            ax.add_patch(Polygon(ring, closed=True, facecolor=color, edgecolor='#242124', linewidth=1.3))
    phase = np.clip((t - .5) / .5, 0, 1)
    growth = phase * phase * (3 - 2 * phase)
    if growth > 0:
        ax.add_patch(Circle((200, 200), 7 * growth, facecolor='#d887ad', edgecolor='#242124',
                            linewidth=1.3 * min(1, growth * 3), alpha=min(1, growth * 8)))
    ax.set_xlim(0, 400); ax.set_ylim(400, 0)
    ax.set_aspect('equal'); ax.set_xticks([]); ax.set_yticks([])

frames = [paths(i / 96) for i in range(97)]
(OUT / 'one-step-motion.json').write_text(json.dumps({'size': 400, 'colors': COLORS, 'centerCircle': [200, 200, 7], 'centerCircleFill': '#d887ad', 'frames': frames}, separators=(',', ':')))

# An inspectable overview includes the actual splitting transition.
fig, axes = plt.subplots(2, 4, figsize=(12, 6))
for ax, t in zip(axes.flat, [0, .2, .4, .5, .6, .75, .9, 1]):
    plot_frame(ax, t)
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
    ax.clear(); plot_frame(ax, t)
    for spine in ax.spines.values(): spine.set_linewidth(1.8)
    fig.canvas.draw()
    images.append(Image.fromarray(np.asarray(fig.canvas.buffer_rgba()).copy()).convert('RGB'))
durations = [800] + [20] * 39 + [1600]
images[0].save(OUT / 'one-step-motion.gif', save_all=True, append_images=images[1:], duration=durations, loop=0, disposal=2)
plt.close(fig)
print(f'Generated {len(frames)} contour frames. All frames satisfy reflection symmetry and closed contours.')
