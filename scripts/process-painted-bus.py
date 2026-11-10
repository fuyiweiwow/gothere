"""Deterministic cleanup of generated art; never draws replacement artwork."""
import json
import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=Path('output/imagegen/bus-integration-v1'))
parser.add_argument('--output', type=Path, default=Path('assets/generated/painted-bus-v1'))
args = parser.parse_args()
ROOT = args.source.resolve()
DEST = args.output.resolve()
DEST.mkdir(parents=True, exist_ok=True)
REPORT = {}


def keyed(name):
    image = Image.open(ROOT / (name + '.png')).convert('RGBA')
    data = np.array(image)
    rgb = data[:, :, :3].astype(float)
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    pink = (red > 125) & (blue > 100) & (green < np.minimum(red, blue) * .76)
    data[pink] = 0
    return Image.fromarray(data)


def components(image, count):
    mask = np.array(image.getchannel('A')) > 128
    height, width = mask.shape
    visited = np.zeros_like(mask)
    found = []
    for y, x in zip(*np.nonzero(mask)):
        if visited[y, x]:
            continue
        queue = deque([(int(x), int(y))])
        visited[y, x] = True
        xmin = xmax = x
        ymin = ymax = y
        area = 0
        while queue:
            px, py = queue.popleft()
            xmin, xmax = min(xmin, px), max(xmax, px)
            ymin, ymax = min(ymin, py), max(ymax, py)
            area += 1
            for nx, ny in ((px-1, py), (px+1, py), (px, py-1), (px, py+1)):
                if 0 <= nx < width and 0 <= ny < height and mask[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = True
                    queue.append((nx, ny))
        if area > 250:
            found.append((area, (int(xmin), int(ymin), int(xmax)+1, int(ymax)+1)))
    found.sort(reverse=True)
    assert len(found) >= count, (count, found)
    return [box for _, box in found[:count]]


def sheet(name, rows, cols, height=144):
    image = keyed(name)
    boxes = components(image, rows * cols)
    boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
    ordered = []
    for row in range(rows):
        ordered.extend(sorted(boxes[row*cols:(row+1)*cols], key=lambda b: b[0]))
    sizes = [b[3]-b[1] for b in ordered]
    scale = height / max(sizes)
    frames = []
    for i, box in enumerate(ordered):
        cut = image.crop(box)
        cut = cut.resize((round(cut.width*scale), round(cut.height*scale)), Image.Resampling.LANCZOS)
        out = Image.new('RGBA', (192, 192))
        # Upper silhouette follows the torso/head; moving feet don't pull the root sideways.
        mask = np.array(cut.getchannel('A')) > 128
        _, xs = np.nonzero(mask[:max(1, round(cut.height*.3))])
        pivot = float(np.median(xs))
        x, y = round(96-pivot), 180-cut.height
        assert x >= 2 and y >= 2 and x+cut.width <= 190, (name, i, x, y, cut.size)
        out.alpha_composite(cut, (x, y))
        out.save(DEST / (name + '-' + str(i+1) + '.png'), optimize=True)
        frames.append(out)
    REPORT[name] = {'sourceBoxes': ordered, 'sharedScale': scale, 'sourceHeightCV': float(np.std(sizes)/np.mean(sizes)), 'canvas': [192, 192], 'foot': [96, 180]}
    frames[0].save(ROOT / (name+'.webp'), save_all=True, append_images=frames[1:], duration=110, loop=0, lossless=True)
    contact = Image.new('RGBA', (192*cols, 192*rows), '#fff3dc')
    for i, frame in enumerate(frames):
        contact.alpha_composite(frame, (i%cols*192, i//cols*192))
    contact.convert('RGB').save(ROOT / (name+'-contact.png'))
    return frames


hero = sheet('hero-walk', 2, 4)
for suffix in 'abc':
    sheet('passenger-'+suffix+'-walk', 2, 2)

# Idle is a cast lineup, so calibrate each different person against their own walk master.
idle = keyed('idle-cast')
for i, (name, x, y, target) in enumerate([
    ('hero-idle', 0, 0, 144), ('passenger-a-idle', 1, 0, 144),
    ('passenger-b-idle', 0, 1, 144), ('passenger-c-idle', 1, 1, 144),
]):
    cell = idle.crop((x*512, y*512, (x+1)*512, (y+1)*512))
    box = components(cell, 1)[0]
    cut = cell.crop(box)
    scale = target/cut.height
    cut = cut.resize((round(cut.width*scale), target), Image.Resampling.LANCZOS)
    mask = np.array(cut.getchannel('A')) > 128
    _, xs = np.nonzero(mask[:round(cut.height*.3)])
    out = Image.new('RGBA', (192, 192))
    out.alpha_composite(cut, (round(96-float(np.median(xs))), 180-cut.height))
    out.save(DEST / (name+'.png'), optimize=True)

# Falling poses keep ONE anatomical scale, including the horizontal final pose.
fall = keyed('hero-fall')
boxes = sorted(components(fall, 6), key=lambda b: (b[1]+b[3])/2)
boxes = sum([sorted(boxes[i:i+2], key=lambda b:b[0]) for i in range(0, 6, 2)], [])
scale = 144/(boxes[0][3]-boxes[0][1])
fall_frames = []
for i, box in enumerate(boxes):
    cut = fall.crop(box)
    cut = cut.resize((round(cut.width*scale), round(cut.height*scale)), Image.Resampling.LANCZOS)
    out = Image.new('RGBA', (192, 192))
    assert cut.width <= 188 and cut.height <= 178
    out.alpha_composite(cut, (round(96-cut.width/2), 180-cut.height))
    out.save(DEST / ('hero-fall-'+str(i+1)+'.png'), optimize=True)
    fall_frames.append(out)
REPORT['hero-fall'] = {'sourceBoxes': boxes, 'sharedScale': scale, 'foot': [96,180]}
contact = Image.new('RGBA', (192*3,192*2), '#fff3dc')
for i, frame in enumerate(fall_frames):
    contact.alpha_composite(frame, (i%3*192,i//3*192))
contact.convert('RGB').save(ROOT/'hero-fall-contact.png')

for name, max_size in [('bus', (600,250)), ('shelter',(400,280)), ('tree',(210,300))]:
    image = keyed(name)
    box = components(image,1)[0]
    cut = image.crop(box)
    cut.thumbnail(max_size,Image.Resampling.LANCZOS)
    cut.save(DEST/(name+'.png'),optimize=True)
    REPORT[name] = {'sourceBox':box,'outputSize':cut.size}

# Extract the closed leaves from the generated bus's neighboring glazed body panel.
# This reuses painted pixels; the doorway opening remains a separate editable node.
bus = keyed('bus')
door = bus.crop((807,346,1016,869))
door.thumbnail((80,180),Image.Resampling.LANCZOS)
door.save(DEST/'bus-door.png',optimize=True)

# The camera sees the road-facing flank; the curb-side entrance is hidden.
# Reuse the neighboring painted window and lower body instead of drawing a
# new door or spending another generation. Keep the original bus unchanged.
back = bus.copy()
window_panel = bus.crop((783, 339, 1079, 889)).resize((222, 550), Image.Resampling.LANCZOS)
back.alpha_composite(window_panel, (535, 339))
cab_panel = bus.crop((783, 339, 1079, 889)).resize((145, 550), Image.Resampling.LANCZOS)
back.alpha_composite(cab_panel, (1699, 339))
back = back.crop(REPORT['bus']['sourceBox'])
back.thumbnail((600, 250), Image.Resampling.LANCZOS)
back.save(DEST/'bus-back.png', optimize=True)
REPORT['bus-back'] = {'derivedFrom':'bus.png', 'panels':[{'source':[783,339,1079,889], 'destination':[535,339,757,889]}, {'source':[783,339,1079,889], 'destination':[1699,339,1844,889]}], 'outputSize':list(back.size)}

# Separate the plate into independent building/sky/ground images at authored rooflines.
plate = Image.open(ROOT/'background-clean.png').convert('RGBA')
sky = plate.crop((0,0,2048,139))
sky.resize((1200,442),Image.Resampling.LANCZOS).convert('RGB').save(DEST/'sky.webp',quality=84)
buildings = [
    ('corner',[(0,141),(546,141),(546,726),(0,726)]),
    ('tenement',[(560,265),(611,211),(1118,211),(1118,726),(560,726)]),
    ('office',[(1202,226),(1261,170),(1834,170),(1834,726),(1202,726)]),
    ('edge',[(1846,267),(1893,213),(2048,213),(2048,726),(1846,726)]),
]
for name, polygon in buildings:
    mask = Image.new('L',plate.size)
    ImageDraw.Draw(mask).polygon(polygon,fill=255)
    image = plate.copy()
    image.putalpha(mask)
    box = mask.getbbox()
    image = image.crop(box)
    image = image.resize((round(image.width*1200/2048),round(image.height*700/1152)),Image.Resampling.LANCZOS)
    image.save(DEST/(name+'.png'),optimize=True)
    REPORT[name] = {'sourceBox':box,'sceneBox':[box[0]*1200/2048,box[1]*700/1152,image.width,image.height]}
ground = plate.crop((0,726,2048,1053)).resize((1200,198),Image.Resampling.LANCZOS).convert('RGB')
ground.save(DEST/'ground.webp',quality=86)
(DEST/'processing.json').write_text(json.dumps(REPORT,indent=2),encoding='utf8')
print(json.dumps(REPORT,indent=2))
