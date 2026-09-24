import type { AreaId } from "../game/core/types";

/**
 * Quests as data. A quest is a short chain of stages; each stage is one
 * objective. When the last stage is done you go back to someone (the giver
 * by default) for the reward. Progress comes from gameplay events (see
 * game/quests.ts), so a quest never needs code of its own.
 *
 * English text lives here; Spanish in i18n/quests-es.ts (same ids, same
 * shapes — written, not translated).
 */
export type Objective =
  /** Kill monsters (any, or these kinds), optionally only in one place. */
  | { kind: "kill"; enemies?: string[]; count: number; area?: AreaId }
  /** Kill one particular boss. */
  | { kind: "boss"; enemy: string }
  /** Have these in your bag (handed over when you turn the quest in). */
  | { kind: "gather"; items: { item: string; count: number }[] }
  /** A quest item placed in the world, guarded (see game/quests.ts spawns). */
  | { kind: "find"; item: string; area: AreaId; minFloor?: number; guards?: string[] }
  /** Get somewhere: an area, or a depth of the dungeon / mine. */
  | { kind: "reach"; area: AreaId; floor?: number }
  /** Talk to someone (may offer choices). */
  | { kind: "talk"; npc: string; choices?: QuestChoice[] }
  | { kind: "hunt"; animals?: string[]; count: number }
  /** Pocket things without being seen. */
  | { kind: "steal"; count: number }
  /** Net winnings at the tables (losses count against you). */
  | { kind: "gamble"; win: number }
  | { kind: "craft"; item: string }
  | { kind: "harvest"; count: number; crop?: string }
  | { kind: "drink"; count: number };

export interface QuestChoice {
  id: string;
  /** Immediate consequences of picking it. */
  gold?: number;
  honor?: number;
  friendship?: Record<string, number>;
  /** 0..1: a coin toss. Wins apply `gold`; losses apply `loseGold`. */
  gamble?: number;
  loseGold?: number;
  drunk?: number;
}

export interface QuestReward {
  gold?: number;
  xp?: number;
  items?: { item: string; count: number }[];
  talentPoints?: number;
  honor?: number;
  friendship?: Record<string, number>;
  /** World flags set on completion (unlocks). */
  flags?: string[];
}

export interface QuestText {
  title: string;
  /** Journal description. */
  summary: string;
  /** What the giver says when offering it. */
  offer: string[];
  /** One objective line per stage (tracker + journal). */
  stages: string[];
  /** Said if you talk to the giver while it's in progress. */
  remind: string[];
  /** Said when you hand it in. */
  complete: string[];
  /** Talk stages: what the other person says, by stage index. */
  talk?: Record<number, string[]>;
  /** Choice labels and the replies they get. */
  choices?: Record<string, { label: string; reply: string[] }>;
}

export type QuestKind = "story" | "side" | "shady" | "board";

export interface QuestDef {
  id: string;
  kind: QuestKind;
  /** NPC who offers it ("board" = the notice board). */
  giver: string;
  /** Who takes it back (defaults to the giver). */
  returnTo?: string;
  requires?: { level?: number; quests?: string[]; flags?: string[] };
  stages: Objective[];
  rewards: QuestReward;
  /** Where the guide arrow points while you go back (town spawn names). */
  returnSpot?: { area: AreaId; spawn: string };
  text: QuestText;
}

const q = (d: QuestDef) => d;

export const QUESTS: QuestDef[] = [
  q({
    id: "iron_shipment",
    kind: "story",
    giver: "bram",
    stages: [{ kind: "find", item: "iron_crate", area: "forest", guards: ["goblin", "goblin"] }],
    rewards: { gold: 60, xp: 90, items: [{ item: "iron_bar", count: 3 }], friendship: { bram: 10 }, honor: 2 },
    returnSpot: { area: "town", spawn: "forge_door" },
    text: {
      title: "The Lost Shipment",
      summary: "Dorrin's apprentice was hauling a crate of iron to Bram through the Whisperwood. He came back without the crate, the cart, or his left boot.",
      offer: [
        "You. Adventurer. You've got legs and a sword, that's two more than my supplier.",
        "Dorrin's lad was bringing me a crate of iron through the Whisperwood. Came back white as flour, no crate, one boot. Says goblins.",
        "Find that crate and I'll pay you, and I'll forge you something with some of it. Deal?",
      ],
      stages: ["Find the iron crate in the Whisperwood", "Bring the crate back to Bram"],
      remind: ["Crate's somewhere in the Whisperwood. Look for goblins looking pleased with themselves."],
      complete: ["That's my iron! Goblins didn't even open it. Can't read the labels, bless them.", "Here. Pay, and three ingots straight off the top. Don't spend it all on the wheel."],
    },
  }),
  q({
    id: "greta_tab",
    kind: "side",
    giver: "greta",
    stages: [
      {
        kind: "talk",
        npc: "barnaby",
        choices: [
          { id: "pay", gold: -40, honor: 3, friendship: { barnaby: 12, greta: 6 } },
          { id: "lean", gold: 40, honor: -4, friendship: { barnaby: -15 } },
          { id: "dice", gamble: 0.5, gold: 40, loseGold: 40, friendship: { barnaby: 8 } },
        ],
      },
    ],
    rewards: { gold: 15, xp: 70, friendship: { greta: 8 } },
    text: {
      title: "Barnaby's Tab",
      summary: "Barnaby owes the Tipsy Wyvern forty gold and three weeks of apologies. Greta wants the gold. The apologies are optional.",
      offer: [
        "Barnaby. Forty gold on the slate, three weeks old, and he still asks for 'the usual'.",
        "Get it out of him. I don't care how. Well — I care a little. Don't break the furniture, it's mine.",
      ],
      stages: ["Get Barnaby to settle his tab", "Tell Greta how it went"],
      remind: ["Barnaby's usually wherever the ale is. Try the plaza, then try the floor."],
      complete: ["Forty gold! Whatever you did, don't tell me. Here's something for your trouble.", "And your next ale's on the house. One ale. I know you."],
      talk: {
        0: ["The tab? Ahh. The TAB. Listen, friend. Faces. We've all got faces. Mine owes Greta money.", "I can't pay. I could… not pay faster? Or — ooh — dice! Double or nothing!"],
      },
      choices: {
        pay: { label: "Pay it for him (−40g)", reply: ["You'd do that? For a face like mine? I'll tell everyone you're a saint. A saint with no money, now, but a saint."] },
        lean: { label: "Lean on him until he pays (dishonourable)", reply: ["Alright, ALRIGHT. Here. That was my boot money. I'll be walking home in socks. One sock."] },
        dice: { label: "Dice: double or nothing (50%)", reply: ["The bones are cast! The bones… have landed. Somewhere. Hold on, one went under the bench."] },
      },
    },
  }),
  q({
    id: "wolf_nights",
    kind: "side",
    giver: "bryn",
    requires: { level: 3 },
    stages: [{ kind: "kill", enemies: ["wolf"], count: 4 }],
    rewards: { gold: 90, xp: 150, honor: 5, friendship: { bryn: 8 }, items: [{ item: "arrow", count: 15 }] },
    text: {
      title: "Wolves at the Fence",
      summary: "Something's been taking Farmer Ned's sheep at night. Guard Bryn says wolves. Ned says witches. Bryn is right.",
      offer: ["Grey wolves. They come out of the Whisperwood after dark and help themselves to Ned's flock.", "I can't leave my post. You can. Thin the pack — four should teach the rest some manners."],
      stages: ["Hunt down 4 grey wolves (they roam the woods after dark)"],
      remind: ["Wolves prowl the woods at night. Bring a torch. Or a bigger sword."],
      complete: ["Four wolves. Ned owes you a sheep. He won't give you one, but he owes you.", "Here's the watch's thanks, and some arrows. Try the bow on the next pack."],
    },
  }),
  q({
    id: "rattles_femur",
    kind: "side",
    giver: "rattles",
    requires: { level: 3 },
    stages: [{ kind: "find", item: "rattles_femur", area: "dungeon", minFloor: 3, guards: ["skeleton", "skeleton_archer"] }],
    rewards: { gold: 80, xp: 190, friendship: { rattles: 15 }, items: [{ item: "rabbit_foot", count: 1 }] },
    text: {
      title: "A Leg to Stand On",
      summary: "Rattles, the tavern's friendliest skeleton, lost his left femur on the job. It's somewhere below floor three of the Barrow.",
      offer: [
        "Funny story. I was on shift in the Barrow, somebody rolled a boulder, and now I'm hopping.",
        "My left femur's down there somewhere — floor three or deeper. The lads guarding it won't give it back. Professional pride.",
        "Bring it back and I'll give you my lucky charm. It's not mine either. Long story.",
      ],
      stages: ["Recover Rattles' femur (Barrow, floor 3 or deeper)", "Return the femur to Rattles"],
      remind: ["Floor three or deeper. You'll know it — it's the one bone that looks embarrassed."],
      complete: ["MY LEG! Oh, I've missed you. *click* There. Symmetrical again.", "Here — a rabbit's foot. The rabbit and I agreed it's luckier for you than for either of us."],
    },
  }),
  q({
    id: "grukk_bounty",
    kind: "story",
    giver: "rowan",
    requires: { level: 4 },
    stages: [{ kind: "boss", enemy: "orc_warrior" }],
    rewards: { gold: 150, xp: 350, talentPoints: 1, honor: 4, friendship: { rowan: 10 } },
    text: {
      title: "The Warboss of the Barrow",
      summary: "Sir Rowan fought Grukk when the Warboss was a pup. The pup grew up. He holds the fifth floor of the Old Barrow.",
      offer: ["I cleared the Barrow when Grukk was a pup. He's a Warboss now. Holds the fifth floor, and he's getting ideas.", "Put him down, and I'll teach you a thing or two I learned the hard way."],
      stages: ["Defeat Grukk the Warboss (Barrow, floor 5)"],
      remind: ["Fifth floor. He charges in straight lines — let him meet a wall."],
      complete: ["Grukk, down! I'd have liked to see his face. Actually no, I've seen his face.", "Sit. Listen. There's a trick to it…"],
    },
  }),
  q({
    id: "hollow_vigil",
    kind: "story",
    giver: "rowan",
    requires: { quests: ["grukk_bounty"], level: 7 },
    stages: [{ kind: "boss", enemy: "skeleton_warrior" }],
    rewards: { gold: 300, xp: 700, talentPoints: 1, honor: 5, items: [{ item: "steel_spear", count: 1 }], friendship: { rowan: 12 } },
    text: {
      title: "The Hollow Vigil",
      summary: "On the tenth floor, where the barrow becomes a crypt, a knight keeps a vigil nobody asked him to keep. Rowan knew him, once.",
      offer: ["There's a knight on the tenth floor. The Hollow Knight, they call him now. I called him Aldric.", "He swore to guard the crypt until relieved. Nobody ever came. Go and relieve him, would you? Gently. With a spear."],
      stages: ["Lay the Hollow Knight to rest (Barrow, floor 10)"],
      remind: ["His shield is his whole heart. Get round it, or break it."],
      complete: ["Relieved of duty. Finally. Thank you.", "Take my old partisan. Aldric would've wanted it used on someone who deserved it."],
    },
  }),
  q({
    id: "finn_job",
    kind: "shady",
    giver: "finn",
    stages: [{ kind: "steal", count: 1 }],
    rewards: { gold: 60, xp: 80, honor: -3, friendship: { finn: 15 }, items: [{ item: "loaded_dice", count: 1 }], flags: ["finn_trust"] },
    text: {
      title: "A Small Favour",
      summary: "Shady Finn wants to know if you've got 'quick hands and a quiet conscience'. Pocket something without being seen. Anything.",
      offer: [
        "Psst. You look like someone who's never been caught. Yet.",
        "Little test. Pocket something — a purse, a pie, I don't care — and don't get seen. Then come tell me about it.",
        "Pass, and I've got a pair of dice that'll change your life. Or at least your evenings.",
      ],
      stages: ["Steal something without being seen", "Tell Finn you did it"],
      remind: ["Nobody watching, nobody the wiser. That's the whole art."],
      complete: ["Clean as a whistle! Nobody saw a thing, did they? Course not.", "Here. Loaded. Sixes, mostly. Don't use them on Silas, he'll know. He always knows."],
    },
  }),
  q({
    id: "lucky_streak",
    kind: "shady",
    giver: "gambler_2",
    requires: { level: 2 },
    stages: [{ kind: "gamble", win: 150 }],
    rewards: { xp: 120, items: [{ item: "singing_horseshoe", count: 1 }], friendship: { gambler_2: 10 } },
    text: {
      title: "Hot Streak",
      summary: "Lucky Lou swears the tables are 'running hot'. Come out 150 gold ahead at the tables and he'll part with his humming horseshoe. Losses count against you.",
      offer: ["Feel that? The tables are running HOT tonight. I can feel it in my knees.", "Get a hundred and fifty ahead — net, mind, the losses count — and my singing horseshoe's yours. I'd do it myself but my knees say no."],
      stages: ["Come out 150 gold ahead at the tables"],
      remind: ["Up and down, up and down. The trick is to stop on an up. I've never done it."],
      complete: ["You DID it! You stopped on an up! Teach me. No — don't. It'd ruin me.", "The horseshoe. It hums when you find something good. Also when you don't."],
    },
  }),
  q({
    id: "may_salves",
    kind: "side",
    giver: "may",
    stages: [{ kind: "gather", items: [{ item: "healroot_salve", count: 2 }] }],
    rewards: { gold: 60, xp: 150, honor: 6, friendship: { may: 12 } },
    text: {
      title: "The Infirmary Shelf",
      summary: "Sister May is out of healroot salve and the village keeps finding new ways to hurt itself.",
      offer: ["The salve shelf's empty, and Tam's discovered climbing. I need two jars of healroot salve.", "Healroot, herbs and a glowcap, simmered — any kitchen will do. You'll have one soon, the way you're going."],
      stages: ["Bring Sister May 2 healroot salves"],
      remind: ["Two jars. Healroot, herbs, a glowcap. Tam's already bleeding again."],
      complete: ["Oh, bless you. That'll keep Tam in one piece until Thursday at least.", "Take this — and come to me when you're hurt. I'll never charge you."],
    },
  }),
  q({
    id: "tomas_hides",
    kind: "side",
    giver: "tomas",
    stages: [{ kind: "gather", items: [{ item: "hide", count: 3 }, { item: "meat_raw", count: 3 }] }],
    rewards: { gold: 70, xp: 110, friendship: { tomas: 10 }, items: [{ item: "arrow", count: 20 }] },
    text: {
      title: "Stock for the Stall",
      summary: "Tomas's market stall sells meat, bread, arrows, and one sock. He's short of the first one.",
      offer: ["Business is booming and my larder is not. Three hides and three cuts of meat, fresh from the woods.", "I'll pay fair and throw in arrows. Not the sock. The sock stays."],
      stages: ["Bring Tomas 3 hides and 3 raw meat"],
      remind: ["Deer, boar, whatever's slow enough. Three hides, three meat."],
      complete: ["Beautiful. That'll sell by noon. Here's your pay, and arrows — try not to shoot anything I'd have bought."],
    },
  }),
  q({
    id: "ingrid_depths",
    kind: "story",
    giver: "ingrid",
    requires: { level: 5 },
    stages: [
      { kind: "reach", area: "dungeon", floor: 8 },
      { kind: "gather", items: [{ item: "bone", count: 10 }] },
    ],
    rewards: { gold: 150, xp: 420, talentPoints: 1, items: [{ item: "return_scroll", count: 2 }], friendship: { ingrid: 12 } },
    text: {
      title: "Chapter Nine",
      summary: "Ingrid's history of Wildkeep finally gets exciting in chapter nine. She needs someone to go and see floor eight, and bring back… specimens.",
      offer: [
        "Chapter nine! The Barrow! Nobody who goes past floor seven comes back and writes it down.",
        "Go to floor eight. Look around. Then bring me ten old bones — for, um, scholarly reasons. Very scholarly. Not soup.",
      ],
      stages: ["Reach floor 8 of the Old Barrow", "Bring Ingrid 10 old bones"],
      remind: ["Floor eight, then bones. Ten. I've labelled the jars already."],
      complete: ["Ten bones and a first-hand account! Chapter nine writes itself. Well, I write it. But faster.", "In return, a little learning — and two return scrolls, for the chapters you've yet to live."],
    },
  }),
  q({
    id: "dorrin_deep",
    kind: "side",
    giver: "dorrin",
    requires: { level: 3 },
    stages: [{ kind: "reach", area: "mine", floor: 10 }],
    rewards: { gold: 120, xp: 250, items: [{ item: "crystal", count: 2 }, { item: "coal", count: 10 }], friendship: { dorrin: 10 } },
    text: {
      title: "Canary Work",
      summary: "Dorrin hasn't been below floor nine of the Old Mine since 'the incident'. He'd like to know if it's still down there.",
      offer: ["There's a floor ten. I know there is. I went once, and then there was the incident.", "Go down and have a look for me. If it's still there, don't tell it I sent you."],
      stages: ["Reach floor 10 of the Old Mine"],
      remind: ["Ten floors. The lift stops every five, so it's not as bad as it sounds. It's slightly bad."],
      complete: ["Floor ten! And you came back up! With all your limbs! Here — crystals, and coal for the smelter. Proper miner's pay."],
    },
  }),
  q({
    id: "tam_tooth",
    kind: "side",
    giver: "tam",
    stages: [{ kind: "gather", items: [{ item: "orc_tusk", count: 1 }] }],
    rewards: { gold: 5, xp: 50, honor: 2, friendship: { tam: 20 }, items: [{ item: "old_sock", count: 1 }] },
    text: {
      title: "A Real Monster Tooth",
      summary: "Tam wants a monster tooth. A REAL one. Orc tusks count. Tam has promised payment 'in treasure'.",
      offer: ["Have you got a monster tooth? A real one? An ORC one? I'll give you TREASURE.", "Real treasure. I've been saving it. It's under my bed. It's the best thing I own."],
      stages: ["Give Tam an orc tusk"],
      remind: ["Orc tooth. ORC TOOTH. Please."],
      complete: ["IT'S SO BIG. I'm going to show EVERYONE.", "Here's the treasure. It's a sock. It's a really good sock. It was my grandad's. He's got the other one."],
    },
  }),
  q({
    id: "hooded_petals",
    kind: "shady",
    giver: "hooded",
    requires: { level: 4 },
    stages: [{ kind: "gather", items: [{ item: "moonpetal", count: 3 }] }],
    rewards: { xp: 260, talentPoints: 1, honor: -2 },
    text: {
      title: "Petals for the Stranger",
      summary: "The Hooded Stranger wants three moonpetals and no questions. The pay is knowledge. The rumours will be free.",
      offer: ["Three moonpetals. They bloom only at night, in the old woods.", "Bring them, and I will teach you something that cannot be taught. Ask me what they're for, and I will not."],
      stages: ["Bring the stranger 3 moonpetals (they bloom at night)"],
      remind: ["Three. At night. Do not ask."],
      complete: ["Good. Very good. Close your eyes. …There. You feel it? That was not there before.", "Tell no one. They will talk anyway. They always do."],
    },
  }),
  q({
    id: "hob_seeds",
    kind: "story",
    giver: "hob",
    stages: [{ kind: "gather", items: [{ item: "herb", count: 5 }] }],
    rewards: { xp: 60, items: [{ item: "hoe", count: 1 }, { item: "watering_can", count: 1 }, { item: "turnip_seed", count: 6 }, { item: "carrot_seed", count: 4 }], friendship: { hob: 10 }, flags: ["farm_unlocked"] },
    text: {
      title: "Duchess Ate the Seeds",
      summary: "Farmer Hob's prize pig ate his seed bag. He'll trade you seeds — and the garden across from your cottage — for wild herbs to replant his herb row.",
      offer: [
        "Duchess ate the seed bag. The whole bag. And the bag. She's fine. I'm not.",
        "Bring me five wild herbs for my herb row, and I'll give you what seeds I've got left — and turn the soil in the garden across from your cottage. Everyone should grow something.",
      ],
      stages: ["Bring Hob 5 wild herbs"],
      remind: ["Five herbs. Whisperwood's full of them. Don't let Duchess see you."],
      complete: [
        "Lovely. Here — my spare hoe, my old watering can, turnips and carrots.",
        "Your garden's across the street from your cottage. Hoe the ground, plant, water every day, fill the can at the barrel. And don't let anyone tell you turnips aren't the future.",
      ],
    },
  }),
  q({
    id: "hob_harvest",
    kind: "side",
    giver: "hob",
    requires: { quests: ["hob_seeds"] },
    stages: [{ kind: "harvest", count: 6 }],
    rewards: { gold: 40, xp: 120, items: [{ item: "strawberry_seed", count: 3 }, { item: "pumpkin_seed", count: 2 }], friendship: { hob: 10 } },
    text: {
      title: "First Harvest",
      summary: "Hob wants to see what you can grow. Six crops from your own garden, and he'll share his 'good' seeds.",
      offer: ["Well? Anything coming up? Water every day, mind — dry soil just sits there sulking.", "Pick six crops from your own patch and I'll give you the good seeds. Strawberries. And a pumpkin, if you've the patience of a saint."],
      stages: ["Harvest 6 crops from your garden"],
      remind: ["Water daily. Sleep on it. Soil does its best work while you snore."],
      complete: ["Look at that! A farmer! Duchess, look! …She's asleep. She's proud of you really.", "Strawberries keep fruiting once they're up. Pumpkins take three days. Worth every one."],
    },
  }),
  q({
    id: "morg_contest",
    kind: "shady",
    giver: "morg",
    stages: [{ kind: "drink", count: 4 }],
    rewards: { gold: 30, xp: 70, items: [{ item: "orc_tusk", count: 2 }], friendship: { morg: 15 } },
    text: {
      title: "The Barrow Challenge",
      summary: "Morg says no adventurer has ever out-drunk an orc. Four drinks at the Tipsy Wyvern, and you've a claim to fame. Or to a headache.",
      offer: ["You. Adventurer. Ever had a proper drink? Not that frothy stuff. Well — that too.", "Four drinks. Tonight. You keep up with an orc, and I'll give you something from the Barrow nobody'll ask questions about."],
      stages: ["Have 4 drinks at the tavern (Greta's menu)"],
      remind: ["Four. I've had nine. I'm fine. I'm FINE."],
      complete: ["HAH! Still standing! Mostly! An honorary orc, you are.", "Here — tusks. Wear one on a string. People will think you're dangerous. Or odd."],
    },
  }),
  q({
    id: "marit_worms",
    kind: "side",
    giver: "marit",
    stages: [{ kind: "gather", items: [{ item: "bait", count: 3 }] }],
    rewards: { xp: 50, items: [{ item: "fishing_rod", count: 1 }], friendship: { marit: 12 } },
    text: {
      title: "Worms for Marit",
      summary: "Marit fishes off the pier at Mirror Lake and has run out of worms. Worms turn up when you dig — in your garden, say — and Mira sells them too.",
      offer: [
        "Shh. You'll scare the carp. They're very sensitive. Emotionally.",
        "I'm out of worms, and I'm not leaving this pier while the pike are biting. Bring me three? Dig them up — they turn up when you hoe a garden. Or Mira sells them, if you like paying for dirt.",
        "Do that and my old rod's yours. I've got a better one. Don't tell the old one.",
      ],
      stages: ["Bring Marit 3 worms (dig in the garden, or buy them from Mira)"],
      remind: ["Three worms. Wriggly ones. The pike can tell."],
      complete: [
        "Lovely wrigglers. Here — my old rod. Face open water, press to cast, and wait for the float to dip.",
        "When the \"!\" shows, strike straight away. Too early, empty hook. Too late, empty hook and a smug fish.",
      ],
    },
  }),
  q({
    id: "marit_pike",
    kind: "side",
    giver: "marit",
    requires: { quests: ["marit_worms"] },
    stages: [{ kind: "gather", items: [{ item: "fish_pike", count: 1 }] }],
    rewards: { gold: 60, xp: 140, items: [{ item: "angler_rod", count: 1 }], friendship: { marit: 15 } },
    text: {
      title: "The One With the Teeth",
      summary: "A pike has been stealing Marit's catches for weeks. She wants it caught. By someone else. With a better rod, ideally — pike snap cheap line.",
      offer: [
        "There's a pike in this lake that's been nicking my fish right off the hook. I call him the Tax Man.",
        "Catch him — or any pike — and bring him here. I want to look him in the eye. Cheap rods snap on pike, mind; you'll lose a few before one lands.",
      ],
      stages: ["Catch a pike at Mirror Lake and show it to Marit"],
      remind: ["The Tax Man's still out there. I can feel him judging me."],
      complete: ["THAT'S HIM. Look at that face. Unrepentant.", "Take my good rod. Brass reel, springy spine. You've earned it; I've earned a nap."],
    },
  }),
  q({
    id: "star_lock",
    kind: "story",
    giver: "tobin",
    returnTo: "ysolde",
    requires: { level: 3 },
    stages: [
      { kind: "reach", area: "tower_hill" },
      { kind: "gather", items: [{ item: "crystal", count: 1 }, { item: "moonpetal", count: 2 }] },
    ],
    returnSpot: { area: "tower_hill", spawn: "door" },
    rewards: { xp: 220, items: [{ item: "mana_potion", count: 3 }], friendship: { ysolde: 10 }, flags: ["tower_open", "magic_learned"] },
    text: {
      title: "The Star-Shaped Lock",
      summary: "There's a tower on the western hill that leans like it's eavesdropping. Tobin says a mage lives there, and that the door has a lock nobody's ever opened.",
      offer: [
        "You've seen the tower up on the western hill? The crooked one. Lights in the windows at night, and nobody's gone in or out in forty years.",
        "A mage lives there. Ysolde. She taught me my letters, once, and then she stopped answering the door.",
        "Go and have a look. Read what's written around it. Maybe she'll answer you. She never answers me.",
      ],
      stages: ["Visit the Crooked Tower (west of the village)", "Bring 'cold from below and light from the night': a Frost Crystal and 2 Moonpetals, to the tower door"],
      remind: ["Cold from below… the mine's full of cold. And moonpetals only open at night. Don't ask me how I know that."],
      talk: {},
      complete: [
        "…Frost from the deep and petals from the dark. Well. Somebody can read.",
        "The lock turns. Come in, then. Wipe your feet. — I'm Ysolde. And you, apparently, are going to learn magic.",
        "Here: this is Spark. Press {k:cast} and it flies where you're looking. It drinks mana — the blue bar. Blue potions bring it back. Don't point it at me.",
      ],
    },
  }),
  q({
    id: "spark_practice",
    kind: "story",
    giver: "ysolde",
    requires: { quests: ["star_lock"] },
    stages: [{ kind: "kill", count: 6 }],
    rewards: { gold: 60, xp: 160, talentPoints: 1, items: [{ item: "mana_potion", count: 2 }], friendship: { ysolde: 10 } },
    text: {
      title: "Practice, Not Theory",
      summary: "Ysolde wants you to use Spark on something that deserves it. Anything with teeth will do.",
      offer: ["Theory is for people with time. Go and Spark something. Six somethings. Things with teeth, ideally, not the neighbours.", "Come back when your fingers smell of lightning."],
      stages: ["Defeat 6 enemies (Spark counts double in spirit)"],
      remind: ["Six. Teeth. Lightning. Off you go."],
      complete: ["You smell of ozone and smugness. Good.", "Here's a talent point — spend it on the Magic branch if you've any sense. I'll have more to teach you when you're ready."],
    },
  }),
  q({
    id: "garrick_boar",
    kind: "side",
    giver: "garrick",
    stages: [{ kind: "hunt", animals: ["boar"], count: 1 }],
    rewards: { gold: 50, xp: 90, items: [{ item: "arrow", count: 20 }], friendship: { garrick: 12 } },
    text: {
      title: "Respect the Boar",
      summary: "A boar has been tearing up the Whisperwood trails. Garrick wants it dealt with, and wants to see if you can.",
      offer: [
        "There's a boar in the Whisperwood that's been flattening anyone on the east trail. Big. Angry. Probably has a name.",
        "Boars don't run — they charge. Step aside when it lowers its head, then hit it while it's turning round. Bring it down and I'll pay.",
      ],
      stages: ["Hunt a boar in the Whisperwood"],
      remind: ["When it scrapes the ground, move. Don't be proud about it."],
      complete: ["Hah. Still in one piece. Good.", "Here's your pay, and twenty arrows. A bow's the civilised way to do it, next time."],
    },
  }),
  q({
    id: "otto_shoe",
    kind: "side",
    giver: "otto",
    stages: [{ kind: "find", item: "otto_shoe", area: "lake" }],
    rewards: { gold: 20, xp: 50, honor: 3, friendship: { otto: 15 } },
    text: {
      title: "One Shoe Short",
      summary: "Old Otto has lost a shoe. He's fairly sure it was at Mirror Lake. He's fairly sure about most things, and usually wrong.",
      offer: ["I've lost a shoe. It's at the lake. I think. I walked back with one foot very cold.", "Find it and I'll give you… something. Twenty gold. And my eternal whatsit. Gratitude."],
      stages: ["Find Otto's shoe at Mirror Lake", "Bring the shoe back to Otto"],
      remind: ["Still one shoe. Still one very cold foot."],
      complete: ["MY SHOE. You beauty. Look at it. It's wet. It's perfect.", "Here. Twenty gold. Don't tell anyone I had twenty gold."],
    },
  }),
  q({
    id: "alma_bell",
    kind: "side",
    giver: "alma",
    requires: { level: 2 },
    stages: [{ kind: "find", item: "shrine_bell", area: "deep_forest", guards: ["goblin", "goblin", "goblin"] }],
    rewards: { gold: 45, xp: 120, honor: 6, items: [{ item: "repair_kit", count: 1 }], friendship: { alma: 15 } },
    text: {
      title: "The Missing Bell",
      summary: "Somebody took the shrine's little bronze bell. Sister Alma has heard it ringing, faintly, from the direction of the Deepwood. Goblins, probably.",
      offer: [
        "Our bell's gone. The little one that rings for the morning prayer. And yesterday, from the Deepwood, I heard it. Ding. Ding. Very pleased with itself.",
        "Goblins love anything shiny that makes a noise. Would you bring it home? Gently, if you can. Firmly, if you must.",
      ],
      stages: ["Find the shrine bell in the Deepwood", "Bring the bell back to Sister Alma"],
      remind: ["Listen for the ding. And for goblins. Mostly the goblins."],
      complete: ["Oh, you found it. Listen — it still rings true.", "Thank you. The whole lane will hear it in the morning, and some of them will even know it was you."],
    },
  }),
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((d) => [d.id, d]));

// ---- the notice board: small daily contracts ----------------------------------------

/** What board contracts can ask for. */
export const BOARD_TEMPLATES = {
  cull: [
    { enemies: ["skeleton", "skeleton_rogue", "bone_rattler"], key: "skeletons", minFloor: 1 },
    { enemies: ["orc", "orc_rogue", "orc_brute", "orc_archer"], key: "orcs", minFloor: 1 },
    { enemies: ["goblin", "goblin_shaman", "powder_goblin"], key: "goblins", minFloor: 2 },
    { enemies: ["ghost", "wraith"], key: "spirits", minFloor: 6 },
    { enemies: ["slime", "shroomling", "wolf"], key: "wildlife", minFloor: 0 },
  ],
  supply: [
    { item: "wood", count: [15, 30] },
    { item: "stone", count: [15, 30] },
    { item: "coal", count: [6, 12] },
    { item: "iron_ore", count: [5, 10] },
    { item: "herb", count: [6, 12] },
    { item: "mushroom", count: [4, 8] },
    { item: "hide", count: [2, 4] },
    { item: "plank", count: [6, 12] },
  ],
  /** Added to the supply list once your garden is open. */
  crops: [
    { item: "turnip", count: [4, 8] },
    { item: "carrot", count: [4, 8] },
    { item: "potato", count: [4, 8] },
  ],
} as const;
