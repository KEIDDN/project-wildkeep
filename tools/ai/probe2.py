import sheet, json, sys
from PIL import Image
im = sheet.load('../../Assets/Enemy Assets/ChatGPT Image 23 sept 2026, 21_15_18.png')
B = json.load(open(sys.argv[1]))
SPLIT = {"wolf": [(0, 3)], "goblin_shaman": [(1, 2)], "orc_chieftain": [(1, 2)], "stone_golem": [(1, 2)], "necromancer": [(0, 3)], "dragon": [(0, 3)]}
poses = {}
for name, bs in B.items():
    bs = [b for b in bs if b[4] >= 300]
    res = []
    for i, b in enumerate(bs):
        sp = dict(SPLIT.get(name, []))
        if i in sp: res += sheet.split(im, b, sp[i])
        else: res.append(tuple(b[:4]))
    poses[name] = res
json.dump(poses, open(sys.argv[2], 'w'))
sprites = []
names = []
for name, ps in poses.items():
    for j, p in enumerate(ps):
        sprites.append(sheet.outline(sheet.pixelate(im, p, 2.4)))
        names.append(f"{name}:{j}")
for i, n in enumerate(names): print(i, n)
sheet.contact(sprites, scale=3, cols=12).save(sys.argv[3])
