import sheet, sys
from PIL import Image
im = sheet.load('../../Assets/Enemy Assets/ChatGPT Image 23 sept 2026, 21_15_18.png')
REG = {
 "orc_archer": (490, 20, 885, 110), "skeleton_archer": (1390, 20, 1765, 110),
 "goblin": (40, 150, 425, 245), "goblin_shaman": (470, 150, 925, 245), "wolf": (930, 150, 1335, 245), "giant_rat": (1355, 150, 1730, 245),
 "spider": (35, 285, 480, 363), "bat": (505, 285, 955, 363), "slime": (970, 280, 1335, 363), "poison_slime": (1365, 280, 1765, 363),
 "mushroom": (40, 395, 500, 496), "treant": (515, 395, 905, 496), "bandit": (930, 395, 1335, 496), "bandit_archer": (1375, 395, 1765, 496),
 "ghost": (45, 525, 430, 628), "wraith": (455, 525, 870, 628), "cultist": (920, 525, 1305, 628), "bone_mage": (1350, 525, 1735, 628),
 "orc_chieftain": (10, 665, 472, 836), "stone_golem": (474, 665, 872, 836), "necromancer": (872, 665, 1232, 836), "dragon": (1232, 665, 1774, 836),
}
out = {}
for name, r in REG.items():
    sub = im.crop(r)
    bs = sorted(sheet.blobs(sub, min_area=40, merge=1), key=lambda b: b[0])
    out[name] = [(b[0] + r[0], b[1] + r[1], b[2] + r[0], b[3] + r[1], b[4]) for b in bs]
    print(name, [(b[0], b[1], b[2]-b[0], b[3]-b[1], b[4]) for b in out[name]])
import json; json.dump(out, open(sys.argv[1], 'w'))
