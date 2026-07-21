"""Generate an Elden Ring-themed icon for the app."""
import math
import os

try:
    from PIL import Image, ImageDraw
except ImportError:
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image, ImageDraw

# Create a 256x256 icon
size = 256
img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Dark background circle
cx, cy = size // 2, size // 2
draw.ellipse([8, 8, size - 8, size - 8], fill=(15, 15, 25, 255))

# Outer gold ring (the Elden Ring)
ring_thickness = 12
outer_r = size // 2 - 16
inner_r = outer_r - ring_thickness
gold = (212, 175, 55, 255)

for angle in range(360):
    rad = math.radians(angle)
    x1 = cx + int(outer_r * math.cos(rad))
    y1 = cy + int(outer_r * math.sin(rad))
    x2 = cx + int(inner_r * math.cos(rad))
    y2 = cy + int(inner_r * math.sin(rad))
    draw.line([x1, y1, x2, y2], fill=gold, width=2)

# Inner gold circle (the eye)
inner_circle_r = 30
draw.ellipse(
    [cx - inner_circle_r, cy - inner_circle_r, cx + inner_circle_r, cy + inner_circle_r],
    outline=gold,
    width=8,
)

# Center dot
draw.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=gold)

# Two curved arcs
for offset_angle in [45, 225]:
    rad = math.radians(offset_angle)
    arc_cx = cx + int(60 * math.cos(rad))
    arc_cy = cy + int(60 * math.sin(rad))
    draw.arc(
        [arc_cx - 40, arc_cy - 40, arc_cx + 40, arc_cy + 40],
        start=-(offset_angle),
        end=-(offset_angle) + 180,
        fill=gold,
        width=4,
   )

# Save
build_dir = os.path.join(os.path.dirname(__file__), "build")
os.makedirs(build_dir, exist_ok=True)

png_path = os.path.join(build_dir, "icon.png")
ico_path = os.path.join(build_dir, "icon.ico")

img.save(png_path)
img.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

print(f"PNG saved: {png_path}")
print(f"ICO saved: {ico_path}")
print("Done!")
