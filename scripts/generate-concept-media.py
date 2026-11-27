"""Rebuild the original explanatory artwork with Python and Pillow."""

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE = (560, 300)
PAPER = "#f6efd9"
INK = "#2e3028"
MUTED = "#645b48"
RUST = "#a84d3d"
PINE = "#345d53"
RULE = "#c9bb98"
ROOT = Path(__file__).resolve().parents[1] / "content" / "ideas"
FONTS = Path("/usr/share/fonts/truetype/dejavu")
TITLE = ImageFont.truetype(str(FONTS / "DejaVuSans-Bold.ttf"), 23)
LABEL = ImageFont.truetype(str(FONTS / "DejaVuSans.ttf"), 14)
MONO = ImageFont.truetype(str(FONTS / "DejaVuSansMono.ttf"), 13)


def plate(title, subtitle):
    image = Image.new("RGB", SIZE, PAPER)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((12, 12, 548, 288), radius=12, outline=RULE, width=2)
    draw.text((30, 25), title, font=TITLE, fill=INK)
    draw.text((30, 262), subtitle, font=MONO, fill=MUTED)
    return image, draw


def dot(draw, x, y, radius, color):
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)


def diverging_paths():
    # The same logistic map starts twice from slightly different inputs.
    states = [[0.4100], [0.4102]]
    for series in states:
        for _ in range(28):
            series.append(3.9 * series[-1] * (1 - series[-1]))
    for step in range(2, 29):
        image, draw = plate("Two nearby starting points", f"SAME RULE  /  STEP {step:02d}")
        for y in (92, 139, 186, 233):
            draw.line((45, y, 515, y), fill=RULE)
        for index, (series, color) in enumerate(zip(states, (PINE, RUST))):
            path = [(45 + i * 16.5, 233 - 145 * value) for i, value in enumerate(series[: step + 1])]
            draw.line(path, fill=color, width=3, joint="curve")
            dot(draw, *path[-1], 5 if index == 0 else 4, color)
        draw.text((369, 59), "Start A", fill=PINE, font=LABEL)
        draw.text((457, 59), "Start B", fill=RUST, font=LABEL)
        yield image


def mixing_particles():
    randomizer = random.Random(23)
    particles = [(randomizer.uniform(72, 168), randomizer.uniform(98, 208)) for _ in range(37)]
    steps = [randomizer.uniform(0, math.tau) for _ in particles]
    speeds = [randomizer.uniform(9, 17) for _ in particles]
    for frame in range(38):
        image, draw = plate("A drop spreads", "SCHEMATIC  /  BOUNDED CONTAINER")
        draw.rounded_rectangle((42, 72, 518, 238), radius=10, outline=RULE, width=2)
        for index, (x, y) in enumerate(particles):
            dot(draw, x, y, 4, RUST)
            heading = steps[index] + randomizer.uniform(-0.8, 0.8)
            dx, dy = math.cos(heading) * speeds[index], math.sin(heading) * speeds[index]
            nx, ny = x + dx, y + dy
            if nx < 51 or nx > 509:
                nx = x - dx
                heading = math.pi - heading
            if ny < 81 or ny > 229:
                ny = y - dy
                heading = -heading
            particles[index] = nx, ny
            steps[index] = heading
        if frame % 2 == 0 or frame > 34:
            yield image


def selection_generations():
    randomizer = random.Random(91)
    slots = list(range(36))
    randomizer.shuffle(slots)
    priorities = {slot: rank for rank, slot in enumerate(slots)}
    for generation, broad in enumerate((8, 9, 12, 18, 21, 25)):
        image, draw = plate("A population changes over time", f"ILLUSTRATIVE MODEL  /  GENERATION {generation + 1}")
        draw.text((43, 60), "Narrow beak", font=LABEL, fill=PINE)
        draw.text((373, 60), "Broad beak", font=LABEL, fill=RUST)
        for slot in range(36):
            x, y = 65 + (slot % 12) * 39, 111 + (slot // 12) * 48
            large = priorities[slot] < broad
            color = RUST if large else PINE
            draw.polygon(((x - 10, y - 9), (x + 13, y), (x - 10, y + (9 if large else -2))), fill=color)
        yield image


def save(slug, name, frames, duration, poster):
    directory = ROOT / slug / "media"
    directory.mkdir(parents=True, exist_ok=True)
    frames = list(frames)
    frames[poster].save(directory / f"{name}.png", optimize=True)
    frames[0].save(
        directory / f"{name}.webp", save_all=True, append_images=frames[1:],
        duration=[duration] * (len(frames) - 1) + [950], loop=0, quality=78, method=6,
    )


if __name__ == "__main__":
    save("butterfly-effect", "nearby-paths", diverging_paths(), 130, 21)
    save("entropy", "spreading-ink", mixing_particles(), 150, 10)
    save("natural-selection", "beak-generations", selection_generations(), 620, 2)
