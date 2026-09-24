import type { PanelId } from "../store/uiStore";
import type { Archetype, VillagerLook } from "../engine/entities/villager";
import type { TimeOfDay } from "../game/time/clock";

/**
 * Every named NPC: who they are, what they say, and when they're around.
 * Areas place NPCs by id; game/npcs.ts picks what they say (rotating talk
 * sets, night lines, reactions to your Honor, today's event, gossip about
 * what you've been up to) and tracks friendship.
 *
 * English text lives here; other languages in i18n/npcs-*.ts (same ids and
 * shapes — lines are written, not translated).
 *
 * Placeholders in lines: {player} {deaths} {lost} {won} {stolen} {floor}.
 */
export type Personality = "friendly" | "suspicious" | "weird" | "drunk" | "greedy" | "funny" | "annoying" | "mysterious" | "grumpy" | "shy";

export interface NpcDef {
  id: string;
  name: string;
  /** Pack sprite (monsters, a few originals)… */
  sprite: string;
  /** …or a villager outfit: an archetype (random but stable per NPC) or an
   * explicit look. Takes precedence over `sprite`. */
  look?: Archetype | VillagerLook;
  tint?: number;
  portrait?: string;
  verb?: string;
  personality?: Personality[];
  /** Rotating sets of lines; each talk plays the next set. */
  talk: string[][];
  night?: string[][];
  /** One-liners said out loud now and then when you're nearby. */
  barks?: string[];
  /**
   * Situational lines, by key:
   *  honorHigh / honorLow  — how they treat a hero / a menace
   *  event:<eventId>       — today's world event
   *  gossip                — the tavern knows what you did
   *  returned              — back from wherever they vanished to
   *  hit                   — you hit them with a sword. Rude.
   */
  lines?: Record<string, string[]>;
  /** Another NPC they bicker with (their barks answer each other). */
  feud?: string;
  /** Can become more than a friend (future relationship system). */
  romanceable?: boolean;
  /** Panel to open after the last line. */
  next?: { panel: PanelId; data?: Record<string, unknown> };
  /** Present between these hours (wraps past midnight). Omit = always. */
  hours?: [number, number];
  /** Where they are through the day: a town spot ("plaza", "market"…),
   * "tavern", or "home" (not around). See engine/Schedules.ts. */
  schedule?: Partial<Record<TimeOfDay, string>>;
  /** Something they do for you when you talk (once a day). */
  service?: "heal";
  /** Days they're mysteriously away (see game/npcs.ts isAway). */
  awayEvery?: { period: number; days: number[] };
}

const defs: NpcDef[] = [
  // ---- village ----------------------------------------------------------------
  {
    id: "mira",
    name: "Mira the Merchant",
    sprite: "npc_peasant",
    look: { skin: 0xeebd96, eyes: 0x4a8a3a, hair: 0x8a3a2a, longHair: true, tunic: 0x3a6ab8, belt: 0x6a4a34, pants: 0x5a4634, boots: 0x5a3a22, apron: 0xe8d8b0 },
    portrait: "coin_bag",
    personality: ["friendly", "greedy"],
    hours: [7, 20],
    talk: [
      ["Wood, stone, ore, herbs — I buy it all.", "Gems especially. A good ruby pays for a month of ale."],
      ["Deeper ore sells for more. Silver, gold… mithril, if you're brave enough to dig for it."],
      ["Return scrolls? Make 'em at the bench in the forge yard. Planks and a healroot. Worth every copper."],
      ["I don't buy anything that's still warm from someone else's pocket. House rule."],
    ],
    barks: ["Fresh potions! Barely expired!", "Everything must go! Except the counter. I need the counter.", "Buying ore, selling hope."],
    lines: {
      honorHigh: ["Ah, my favourite customer! I've knocked a little off, don't tell anyone."],
      honorLow: ["Hands where I can see them, please. Yes, both. Thank you."],
      "event:festival": ["Festival day! Everybody's selling, nobody's haggling. I love it."],
      "event:merchant": ["There's a travelling merchant in the plaza. Prices like that ought to be illegal. Mine, I mean. His are criminal."],
    },
    next: { panel: "shop" },
  },
  {
    id: "bram",
    name: "Bram the Smith",
    sprite: "npc_knight",
    look: { skin: 0xd9a070, eyes: 0x6a4a2a, hair: null, beard: 0x3a2418, tunic: 0x3a3232, belt: 0x2a1a12, apron: 0x6a4228, pants: 0x3a3a40, boots: 0x2a2020, scale: 1.08 },
    portrait: "anvil",
    personality: ["grumpy", "friendly"],
    hours: [8, 19],
    talk: [
      ["Bring me ingots and I'll forge you something that won't snap on an orc's skull.", "No ingots? Smelt ore and coal in the furnace behind me."],
      ["Iron picks chew through copper and silver. Steel bites through gold. Mithril… that's the stuff of legends."],
      ["Every tool I make lets you dig deeper. Every blade lets you fight deeper. That's the whole trick, friend."],
      ["Helmets and boots now, too. Folk kept coming back with dented heads and cold feet."],
    ],
    barks: ["*CLANG* *CLANG*", "Hot metal, cold beer. That's the life.", "Mind the sparks!"],
    lines: {
      honorLow: ["I'll sell you a sword. I just don't have to like it."],
      hit: ["Did you just— at a SMITHY? Bold."],
    },
    next: { panel: "crafting", data: { station: "forge" } },
  },
  {
    id: "apprentice",
    name: "Dorrin's Apprentice",
    sprite: "npc_knight",
    look: "miner",
    personality: ["friendly", "shy"],
    hours: [6, 21],
    talk: [
      ["The Old Mine's open to anyone with a pick. Stone, coal and iron up top — the deeper you go, the better it gets."],
      ["Folk say the mine rearranges itself every time you go down. Keeps the ore fresh, I suppose."],
    ],
    barks: ["One day I'll have my own pick. A real one.", "Is it lunch yet?"],
  },
  {
    id: "tobin",
    name: "Old Tobin",
    sprite: "npc_wizard",
    look: { skin: 0xf0c8a8, eyes: 0x6a6a8a, hair: 0xe8e4dc, longHair: true, beard: 0xe8e4dc, tunic: 0x4a3a6a, pants: 0x3a3244, boots: 0x3a2a20, pointy: 0x3a2a5a, scale: 0.95 },
    personality: ["mysterious", "friendly"],
    talk: [
      [
        "The Old Barrow, friend. Orcs dug their way in from below and made it their den.",
        "It goes down and down. Every fifth floor something big guards the way — beat it and you'll remember the path next time.",
        "Die down there... and you'll lose what you found.",
      ],
      ["If the monsters start hitting too hard, go home. Better steel, stronger arms, then try again. The Depths aren't going anywhere."],
      ["Between you and me, half those orcs clock off at sundown. Seen 'em in the tavern. Lovely manners, actually."],
    ],
    night: [["Can't sleep either? The barrow hums at night. Old bones, old grudges."]],
    barks: ["In my day, dungeons had standards.", "Mmh. Weather's turning. Or I am."],
    lines: {
      "event:strike": ["The orcs are on strike, can you believe it! Picket line and everything. Floor one's never been so polite."],
    },
  },
  {
    id: "finn",
    name: "Shady Finn",
    sprite: "npc_rogue",
    look: "stranger",
    personality: ["suspicious", "funny"],
    hours: [9, 2],
    awayEvery: { period: 9, days: [4, 5, 6] },
    talk: [
      ["Psst. The Whisperwood east of here has everything a starving adventurer needs. Paths change every night, mind."],
      ["North of the woods, the Deepwood. Gold veins. Frost crystals. And past the brambles… something older. Bring a steel axe."],
      ["Madame Vex spins a wheel at the tavern now. Pretty colours. Pretty expensive."],
      ["Things fall off carts, friend. Sometimes I'm standing near the cart. That's all I'm saying."],
    ],
    barks: ["Psst.", "I was never here.", "Nice boots. Shame if they… no, forget it."],
    lines: {
      returned: ["Where was I? Geese. A lot of geese. They had a boat.", "Don't ask. Seriously. The geese might be listening."],
      honorLow: ["Now THAT'S a reputation. Let's talk business sometime."],
      honorHigh: ["Ugh. A hero. Keep your voice down, you'll ruin my image."],
    },
  },
  {
    id: "watchman",
    name: "Night Watchman",
    sprite: "npc_knight",
    look: "guard",
    personality: ["suspicious"],
    hours: [21, 6],
    talk: [["Quiet night. Mostly. The tavern's still roaring if you've coin to lose."], ["Moonpetals only bloom after dark, they say. Out in the woods."]],
    barks: ["Halt! Oh. Carry on.", "Twelve o'clock and all's… fine, I suppose."],
    lines: {
      honorLow: ["I've got my eye on you. This one. The other one's for the tavern."],
      honorHigh: ["Evening, hero. Sleep well, we've got it covered."],
    },
  },
  {
    id: "hale",
    name: "Hale the Woodcutter",
    sprite: "npc_knight",
    look: { skin: 0xd9a070, eyes: 0x4a3a2a, hair: 0x4a3024, beard: 0x4a3024, tunic: 0x8a3a2a, belt: 0x3a2a20, pants: 0x4a4434, boots: 0x3a2a20, hood: 0x4a5a34, scale: 1.08 },
    personality: ["friendly"],
    talk: [
      ["Funny wood, this. The paths grow back different every night — never the same forest twice.", "Oaks for wood, grey boulders for stone, herbs in the clearings. Golden oaks need an iron axe."],
      ["See a wall of brambles across a trail? Chop through it. Folk hide the best spots behind those."],
      ["Deer spook if you charge 'em. Walk slow, or bring a bow. Boars… boars just charge you back."],
    ],
    barks: ["Timber!", "Good wood today.", "Smell that? Pine and ambition."],
  },
  {
    id: "dorrin",
    name: "Dorrin the Miner",
    sprite: "npc_peasant",
    look: { skin: 0xb97c52, eyes: 0x2a2a2a, hair: 0x2a2020, beard: 0x2a2020, tunic: 0x5a5048, pants: 0x3a3a40, boots: 0x2a2020, cap: 0xd8a038 },
    portrait: "pickaxe_iron",
    personality: ["friendly", "funny"],
    talk: [
      ["Welcome to the Old Mine! The tunnels shift every time you come down — don't ask me how.", "Grey rock gives stone. Black seams are coal. Rusty streaks are iron. Find the ladder to go deeper."],
      ["Copper shows up around floor five, silver around ten, gold past fifteen. You'll need better picks for those."],
      ["Watch for cracked ceilings further down. And every fifth floor there's a lift stop — ride it back down next time."],
    ],
    barks: ["Rock and stone!", "Did you hear that? No? Good."],
  },
  {
    id: "hob",
    name: "Farmer Hob",
    sprite: "npc_peasant",
    look: "farmer",
    personality: ["friendly", "funny"],
    hours: [15, 23],
    talk: [
      ["Best turnips in three valleys, me. Forty years of turnips.", "Worst blackjack player in three valleys too. Forty years of that as well."],
      ["The trick is to hit on twenty. Surprise the dealer. ...It surprises me every time, too."],
      ["My pig, Duchess, is smarter than me. She won't gamble. She won't even look at the wheel."],
    ],
    barks: ["Just one more hand for the turnip money…", "Duchess would know what to do.", "Hit me! No, wait—"],
    lines: {
      "event:pig": ["DUCHESS! Have you seen Duchess? Pink, clever, judgemental? She's out again!"],
      gossip: ["Lost {lost} gold at the tables, have you? Welcome to the club. Meetings are every night."],
    },
  },

  // ---- the Tipsy Wyvern -----------------------------------------------------------
  {
    id: "greta",
    name: "Greta the Barkeep",
    sprite: "npc_barkeep",
    look: { skin: 0xeebd96, eyes: 0x3a6ac0, hair: 0xd8b060, longHair: true, tunic: 0x8a3a3a, belt: 0x3a2a20, pants: 0x4a3434, boots: 0x3a2a20, apron: 0xe8e0d0, scale: 1.06 },
    portrait: "beer",
    personality: ["friendly", "grumpy"],
    talk: [
      ["Welcome to the Tipsy Wyvern! Stew's hot, ale's cold.", "And if you're feeling lucky... Silas deals Blackjack upstairs, and Vex spins the wheel. Don't say I didn't warn you."],
      ["The pantry's through the kitchen. Help yourself to the leftovers crate — once a day, mind."],
      ["See Morg by the fire? Orc. Works in the Barrow. Tips better than any human in this room."],
    ],
    night: [["Busy night! Everyone comes in after dark. The gamblers especially."]],
    barks: ["Who ordered the stew? Somebody ordered the stew.", "No singing on the tables! Lyra, that means you too.", "Last orders! ...I'm joking. We never close."],
    lines: {
      honorHigh: ["For you, love, first one's on the house."],
      honorLow: ["Pay first. And keep your hands off my tankard, I've counted them."],
      gossip: ["Word is you lost {lost} gold upstairs. Silas bought new boots. Coincidence?"],
      "event:brawl": ["If you're going to throw a chair, throw it at the wall. The WALL."],
      "event:festival": ["Festival prices tonight! Well. Festival-ish."],
    },
    next: { panel: "tavern" },
  },
  {
    id: "pip",
    name: "Pip",
    sprite: "npc_barmaid",
    look: { skin: 0xf6d2b4, eyes: 0x4a8a3a, hair: 0xc8482a, longHair: true, tunic: 0x3a7a5a, belt: 0x3a2a20, pants: 0x3a3a30, boots: 0x3a2a20, apron: 0xe8e0d0, scale: 0.92 },
    personality: ["friendly", "annoying"],
    romanceable: true,
    talk: [
      ["Careful in the Old Barrow, love. The orcs don't tip.", "Well, except Morg."],
      ["Coming through! Hot stew, mind your elbows!"],
      ["I hear everything in here. EVERYTHING. Ask me about the watchman and the goat. Actually, don't."],
    ],
    barks: ["Coming through!", "Mind your elbows!", "Who's the stew for?!", "Hot plate! Hot plate!"],
    lines: {
      gossip: ["Died {deaths} times and still coming back? You're either brave or daft, love. I like it either way."],
    },
  },
  {
    id: "rowan",
    name: "Sir Rowan",
    sprite: "npc_knight",
    look: "adventurer",
    personality: ["friendly"],
    romanceable: true,
    talk: [
      ["I cleared the Old Barrow in my youth. Grukk the Warboss was a pup back then.", "Floor ten is where the crypt begins. The dead there guard older treasure."],
      ["My advice? Armour before swords. Dead heroes hit very hard for about three seconds."],
      ["A helm, friend. Get a helm. I've seen what a skeleton can do with a femur."],
    ],
    barks: ["In my day we fought with sticks. Uphill.", "Mmm, that's a fine ale."],
    lines: {
      honorHigh: ["They're calling you a hero out there. It suits you. Don't let it go to your head — it weighs more than a helmet."],
    },
  },
  {
    id: "cook",
    name: "Cook",
    sprite: "npc_peasant",
    look: { skin: 0xd9a070, eyes: 0x6a4a2a, hair: 0x2a2020, tunic: 0xe8e0d0, belt: 0x8a8a8a, pants: 0x5a5a5a, boots: 0x3a2a20, apron: 0xf0f0e8, cap: 0xf0f0e8, scale: 1.1 },
    personality: ["grumpy"],
    feud: "pip",
    talk: [["Out of my kitchen! ...Unless you've brought mushrooms. Glowcaps make a lovely stew."], ["You want recipes? Get yourself a proper kitchen. A big house has room for one."], ["Venison? You bring me a deer, I'll make you cry. In a good way."]],
    barks: ["WHO touched my ladle?!", "Pip! The stew doesn't walk itself!", "It's not burnt. It's caramelised."],
    lines: {
      honorLow: ["Somebody's been at my pies. I know it was you. I can smell guilt. It smells like apples."],
    },
  },
  {
    id: "silas",
    name: "Silas the Dealer",
    sprite: "npc_wizard",
    look: "noble",
    portrait: "coin_bag",
    verb: "Gamble with",
    personality: ["greedy", "mysterious"],
    talk: [
      ["Welcome to the Gilded Gamble, friend. Blackjack's the game. You versus the house.", "Get closer to twenty-one than me without going over. A natural Blackjack pays three to two. I stand on seventeen."],
      ["Back again? The cards remember you. So does the house."],
    ],
    barks: ["Place your bets.", "The house thanks you.", "Fortune favours… well. Me."],
    lines: {
      gossip: ["{won} gold won, {lost} lost. The house keeps very good books, friend."],
    },
    next: { panel: "blackjack" },
  },
  {
    id: "vex",
    name: "Madame Vex",
    sprite: "npc_rogue",
    look: { skin: 0xc8a8d8, eyes: 0xd8b040, hair: 0x2a2020, longHair: true, tunic: 0x5a2a6a, pants: 0x3a2a44, boots: 0x2a2020, pointy: 0x4a2a5a, cape: 0x2a1a3a },
    portrait: "coin_bag",
    verb: "Gamble with",
    personality: ["mysterious", "greedy"],
    talk: [
      ["The Wheel of Fates, darling. Nineteen pockets: nine Crimson, nine Shadow, and the Dragon.", "Bet a colour, odd or even, or a single number if you feel blessed. The Dragon eats everything."],
      ["The wheel doesn't care who you are. That's what I love about it."],
    ],
    barks: ["Round and round, darling.", "The Dragon is hungry tonight."],
    next: { panel: "roulette" },
  },
  {
    id: "lyra",
    name: "Lyra the Bard",
    sprite: "npc_maid",
    look: { skin: 0xf6d2b4, eyes: 0x3a9aa8, hair: 0xd8b060, longHair: true, tunic: 0x3a9aa8, belt: 0x8a5a34, pants: 0x5a4a3a, boots: 0x5a3a22, cap: 0xb84a3a, cape: 0xd8a038 },
    personality: ["friendly", "funny"],
    romanceable: true,
    talk: [
      ["♪ Oh the orc king lost his crown, down, down, down in the barrow… ♪", "Requests cost a copper. Complaints cost two."],
      ["♪ The miner dug for silver and he found a dragon's tooth… ♪", "It's a work in progress."],
      ["I play every night. The wheel-spinners tip best when they're winning."],
      ["I'm writing a ballad about you. It's mostly about the time you fell over. It's very moving."],
    ],
    barks: ["♪ La la laaa… ♪", "♪ Down, down, down in the barrow… ♪", "♪ Oh, the stew was cold and the ale was warm… ♪"],
    lines: {
      honorHigh: ["♪ And the hero came home and the village did cheer… ♪ That one's about you. Obviously."],
      honorLow: ["♪ Lock up your pies, lock up your purse… ♪ Just a song. No reason."],
      gossip: ["{deaths} deaths? That's a whole album."],
    },
  },
  {
    id: "gambler_1",
    name: "Nervous Gambler",
    sprite: "npc_peasant",
    look: "gambler",
    personality: ["annoying"],
    talk: [["Just one more hand. Then I'm going home. Definitely."], ["I had a system. The system had me."]],
    barks: ["One more. Just one.", "Come on, come on, come on…", "I can feel it. This is the one."],
  },
  {
    id: "gambler_2",
    name: "Lucky Lou",
    sprite: "npc_rogue",
    look: "gambler",
    personality: ["funny", "greedy"],
    hours: [16, 3],
    talk: [["The trick is knowing when to walk away. I've never done it, but I know it's the trick."], ["Luck's a skill, friend. Practise it. Open chests, find rare stuff — it rubs off."]],
    barks: ["Lady Luck owes me money.", "Ha! Ha. …Ha."],
  },
  {
    id: "traveler_1",
    name: "Weary Traveler",
    sprite: "npc_knight",
    look: "traveler",
    personality: ["friendly"],
    talk: [["Walked here from the coast. Heard your dungeon goes down forever. Heard wrong, I hope."], ["The coast has sea monsters. You have an orc who does crosswords. I'm staying."]],
    barks: ["My feet. My poor feet."],
  },
  {
    id: "traveler_2",
    name: "Merchant From Afar",
    sprite: "npc_wizard",
    look: "wizard",
    personality: ["suspicious", "greedy"],
    hours: [12, 23],
    talk: [
      ["In the capital, mithril sells for its weight in gold. Out here? You dig it yourself. Charming."],
      ["Nineteen pockets on that wheel. The Dragon comes up one time in nineteen — five point two six percent.", "I'm not a gambler. I'm just… very well read. On wheels. Specifically that one."],
      ["Silas re-shuffles at twenty cards left. Four decks. Not that I've counted. Why would anyone count."],
    ],
    barks: ["Five point two six…", "Interesting. Very interesting."],
  },
  {
    id: "patron_1",
    name: "Tipsy Patron",
    sprite: "npc_peasant",
    look: "drunk",
    personality: ["drunk", "funny"],
    hours: [17, 3],
    talk: [["*hic* Have you tried… the stew? *hic* Neither have I."], ["You've got a… *hic* …a face. Good for you."]],
    barks: ["*hic*", "I love this song! What song is this?", "I'm not drunk, the FLOOR is."],
  },
  {
    id: "patron_2",
    name: "Off-Duty Guard",
    sprite: "npc_knight",
    look: "drunk",
    personality: ["funny"],
    hours: [18, 2],
    talk: [["Don't tell the captain I'm here. Or that I lost my boots at the wheel."], ["Morg and I work opposite sides of the same job, really. He guards things. I guard things. Solidarity."]],
    barks: ["Shh. I'm not here.", "Has anyone seen my boots?"],
  },
  {
    id: "bouncer",
    name: "Brute the Bouncer",
    sprite: "npc_knight",
    look: { skin: 0x8e5a3a, eyes: 0x2a2a2a, hair: null, beard: 0x2a2020, tunic: 0x2a2a2a, belt: 0x5a3a22, pants: 0x2a2a30, boots: 0x2a2020, scale: 1.18 },
    personality: ["grumpy", "shy"],
    talk: [["Back room's for serious players. Gambling level five, or you're not getting past me."], ["...I also do watercolours. Don't tell anyone."]],
    barks: ["...", "Members only.", "Nice night for it."],
  },
  {
    // The punchline: the monsters you fight have lives.
    id: "morg",
    name: "Morg (off duty)",
    sprite: "orc",
    personality: ["friendly", "funny", "grumpy"],
    hours: [17, 2],
    feud: "rattles",
    talk: [
      ["Evenin'. Yes, I'm an orc. Yes, from the Barrow. No, I'm not working. It's past six.", "Twelve-hour shifts guarding a staircase. And the dental plan? Don't get me started."],
      ["Wait… you're the one who keeps coming down floor three. Durg needs a new helmet because of you.", "No hard feelings. It's the job. Buy me an ale and we'll call it even."],
      ["My mum wanted me to be a blacksmith. Now I get hit by blacksmiths' customers. Life's funny."],
      ["I'm knitting Grukk a scarf. Boss gets cold. Big fella, small circulation."],
    ],
    night: [["Late shift tomorrow. Floor five. If you see a big orc in a knitted scarf, go easy on him, eh?"]],
    barks: ["Ahh. Nothing like an ale after a long day of lurking.", "Oi, bone-bag. Your deal.", "Don't look at me like that, I'm off the clock."],
    lines: {
      honorHigh: ["You're alright, for a surface-dweller. Don't tell the lads I said that."],
      honorLow: ["Even WE don't nick from Greta, mate. Even us."],
      gossip: ["{deaths} times you've gone down in the Barrow, eh? The lads have a tally on the wall. You're very popular."],
      "event:strike": ["We're on strike! Better torches, shorter shifts, and no more adventurers before breakfast!", "Solidarity, mate. …You don't want to join a union, do you?"],
      hit: ["OI. Not in here. In here I'm a CUSTOMER."],
    },
  },
  {
    id: "rattles",
    name: "Rattles",
    sprite: "skeleton",
    personality: ["funny", "weird"],
    hours: [18, 3],
    feud: "morg",
    talk: [
      ["Evening! Don't mind me. I'm just here for the atmosphere. I don't have lungs, but I like the atmosphere."],
      ["I keep asking Silas for a hit. He keeps saying I've got no body to hit. Every night. Every night, that joke."],
      ["People say gambling's a waste. I've got nothing to lose. I checked. It's all gone. Everything."],
    ],
    barks: ["Hit me! …Oh, he did. My rib.", "Bone appétit!", "Morg cheats at cards. With his TUSKS.", "I'm not skinny, I'm big-boned. Mostly boned."],
    lines: {
      gossip: ["You died {deaths} times? Amateur. I've been dead for three hundred years."],
      hit: ["Ow! Well. Not 'ow'. But rude."],
    },
  },
  {
    id: "wick",
    name: "Old Wick",
    sprite: "npc_wizard",
    look: "elder",
    personality: ["drunk", "weird"],
    hours: [14, 4],
    talk: [
      ["Want some advice? Course you do. The trick to mining… is to lick the rock. If it tastes like money, dig."],
      ["Never fight a skeleton on a Tuesday. They're stronger on Tuesdays. Or I'm weaker. One of us."],
      ["Stand on twelve. Always stand on twelve. That's how I lost my house. Twice."],
      ["The mushrooms in the Deepwood? Eat the glowing ones. Trust me. …Actually don't trust me."],
    ],
    barks: ["I've seen things. Mostly the bottom of this mug.", "Lick the rock!", "Did I ever tell you about the goat?"],
  },
  {
    id: "hooded",
    name: "Hooded Stranger",
    sprite: "npc_rogue",
    look: "stranger",
    personality: ["mysterious", "weird"],
    hours: [20, 4],
    talk: [
      ["You have died {deaths} times, {player}. The Barrow remembers every one of them."],
      ["{stolen} things have gone missing since you arrived. The village counts. So do I."],
      ["The wheel has a memory. The deck has a memory. Only people forget."],
    ],
    barks: ["…", "It is not yet time.", "I know what you did. Also what you're about to do."],
    lines: {
      honorHigh: ["Such a bright light. Moths gather. So do other things."],
      honorLow: ["Ah. A kindred shadow."],
    },
  },
  {
    id: "merchant_travel",
    name: "Zoltan the Travelling Merchant",
    sprite: "npc_wizard",
    look: "merchant",
    portrait: "coin_bag",
    personality: ["greedy", "weird"],
    talk: [["Wares! Wondrous wares! From lands you've never heard of, at prices you'll never forget!", "No refunds. No questions. Some answers."]],
    barks: ["Wares!", "Everything genuine! Mostly!", "Today only! Possibly tomorrow!"],
    next: { panel: "shop", data: { stock: "travelling" } },
  },
  {
    id: "stranger_box",
    name: "Mysterious Traveler",
    sprite: "npc_rogue",
    look: "stranger",
    personality: ["mysterious"],
    talk: [["A box. Fifty gold. What's inside? Something. Perhaps wonderful. Perhaps a sock.", "Do you feel lucky? You should. Or you shouldn't. That's the fun."]],
    barks: ["Boxes…", "Fifty gold. One box. One destiny."],
    next: { panel: "shop", data: { stock: "mystery" } },
  },
  // ---- townsfolk with daily routines (engine/Schedules.ts) ------------------------------------
  {
    id: "ned",
    name: "Farmer Ned",
    sprite: "npc_peasant",
    look: { skin: 0xd9a070, eyes: 0x4a3a2a, hair: 0x7a4a2a, beard: 0x7a4a2a, tunic: 0x6a5a3a, belt: 0x4a3024, pants: 0x4a4434, boots: 0x3a2a20, hat: 0xe8c878 },
    personality: ["grumpy", "funny"],
    schedule: { morning: "garden", day: "garden", evening: "tavern" },
    feud: "mags",
    talk: [
      ["Turnips, I'm telling you. Turnips are the future. Everyone laughs until the siege comes and they're eating MY turnips."],
      ["Mags says my carrots are 'aggressively orange'. Mags can say what she likes. From over THERE."],
      ["Something's been eating the lettuces at night. I've narrowed it down to: a rabbit, a goblin, or Hob."],
    ],
    barks: ["Turnips don't grow themselves.", "Mags! Your cat's in my beans again!", "Rain. Finally. Or not. Typical."],
  },
  {
    id: "mags",
    name: "Old Mags",
    sprite: "npc_peasant",
    look: { skin: 0xf0c8a8, eyes: 0x6a6a8a, hair: 0xc8c8c0, longHair: true, tunic: 0x6a4a6a, belt: 0x4a3a4a, pants: 0x4a3a44, boots: 0x3a2a30, cape: 0x8a6a8a, scale: 0.92 },
    personality: ["annoying", "funny"],
    schedule: { morning: "plaza", day: "plaza", evening: "fountain" },
    feud: "ned",
    talk: [
      ["Seventy-three years in this village and I've seen everything twice. The second time was worse."],
      ["Ned grows turnips the size of a baby's head. It's not natural. I've written to the Council. There is no Council. I wrote anyway."],
      ["You're the one who fell in the barrow, aren't you? No? You've got the face of someone who'll fall in the barrow."],
    ],
    barks: ["In my day this was all fields.", "Ned! Your turnips are LOOKING at me!", "Young people. Always walking somewhere."],
  },
  {
    id: "tam",
    name: "Tam",
    sprite: "npc_peasant",
    look: { skin: 0xeebd96, eyes: 0x3a6ac0, hair: 0xa86a36, tunic: 0xb84a3a, pants: 0x5a4634, boots: 0x5a3a22, cap: 0x3a6ab8, scale: 0.76 },
    personality: ["funny", "annoying"],
    schedule: { morning: "plaza", day: "market" },
    talk: [
      ["Are you an adventurer? Have you killed a dragon? Have you killed TWO dragons? Can I hold your sword? Can I hold it now?"],
      ["Bea says if you swallow a moonpetal you can see ghosts. I swallowed three. Nothing. Bea's a liar. Also I feel funny."],
    ],
    barks: ["Race you!", "I'm not supposed to be here!", "BEA! BEA, LOOK!"],
  },
  {
    id: "bea",
    name: "Bea",
    sprite: "npc_peasant",
    look: { skin: 0xb97c52, eyes: 0x4a8a3a, hair: 0x2a2020, longHair: true, tunic: 0xd8a038, pants: 0x5a4a3a, boots: 0x4a3024, scale: 0.74 },
    personality: ["weird", "shy"],
    schedule: { morning: "plaza", day: "garden" },
    talk: [
      ["I'm going to be a witch when I grow up. Or a baker. Or a witch who bakes. Evil bread."],
      ["Tam swallowed three moonpetals. I didn't tell him to. I just said it *could* happen. Words are powerful."],
    ],
    barks: ["Shh, I'm hunting a beetle.", "Tam's being stupid again.", "Do you want to see a worm?"],
  },
  {
    id: "bryn",
    name: "Guard Bryn",
    sprite: "npc_knight",
    look: { skin: 0xeebd96, eyes: 0x3a6ac0, hair: 0xd8b060, longHair: true, tunic: 0x8a8a98, belt: 0x5a3a22, pants: 0x3a3a4a, boots: 0x3a3a44, helm: 0xb8c0cc, cape: 0x3a5aa8 },
    personality: ["grumpy", "friendly"],
    schedule: { morning: "street_w", day: "market", evening: "street_e" },
    talk: [
      ["Keep your blade sheathed in the village. Last week someone 'practised' on the well. The well lost."],
      ["Quiet day. I love a quiet day. Nobody's ever written a song about a quiet day, and that's how I like it."],
    ],
    lines: { honorLow: ["I've got my eye on you. Both eyes. I've been practising."] },
    barks: ["Move along.", "No running near the stalls.", "Everything's fine. Suspiciously fine."],
  },
  {
    id: "gus",
    name: "Gus the Miner",
    sprite: "npc_peasant",
    look: { skin: 0x8e5a3a, eyes: 0x2a2a2a, hair: 0x2a2020, beard: 0x3a3030, tunic: 0x5a5048, pants: 0x3a3a40, boots: 0x2a2020, cap: 0xd8a038, scale: 1.1 },
    personality: ["friendly", "drunk"],
    schedule: { morning: "mine", day: "mine", evening: "tavern", night: "tavern" },
    talk: [
      ["Thirty years down that hole. Know what I found? Rocks. Lovely rocks. Some shiny ones. Mostly rocks."],
      ["If you hear tapping in the deep galleries, don't tap back. I tapped back once. We're still not on speaking terms."],
    ],
    night: [["*hic* …the thing about stone… is it's always there for you. Unlike Maureen."]],
    barks: ["Coal! Beautiful coal!", "Mind your head. And your feet. And the rest.", "Another round, Greta!"],
  },
  {
    id: "ingrid",
    name: "Ingrid the Scholar",
    sprite: "npc_wizard",
    look: { skin: 0xf6d2b4, eyes: 0x6a4a2a, hair: 0x4a3024, longHair: true, tunic: 0x2a4a6a, belt: 0x8a5a34, pants: 0x3a3a4a, boots: 0x3a2a20, cap: 0x6a2a2a, cape: 0x6a2a2a },
    personality: ["weird", "friendly"],
    schedule: { day: "fountain", evening: "tavern" },
    talk: [
      ["I'm writing the definitive history of Wildkeep. Chapter one: 'A Village.' Chapter two: 'Still a Village.' It gets exciting in chapter nine."],
      ["Fun fact: the barrow is older than the village. Less fun fact: so are the things in it."],
      ["The tavern's name is technically slander. There was never a wyvern. There was a very tipsy goose."],
    ],
    barks: ["Fascinating.", "That's a footnote.", "Have you considered reading?"],
  },
  {
    id: "may",
    name: "Sister May",
    sprite: "npc_wizard",
    look: { skin: 0xeebd96, eyes: 0x3a9aa8, hair: 0xd8b060, tunic: 0xe8e0d0, belt: 0xb84a3a, pants: 0xd8d0c0, boots: 0x6a4a34, hood: 0xf0ece0 },
    personality: ["friendly", "shy"],
    schedule: { morning: "plaza", day: "plaza" },
    service: "heal",
    talk: [
      ["Hold still. There. You're mended. Try to come back in the same number of pieces tomorrow."],
      ["Bruises, cuts, a mild curse? I can do bruises and cuts. Curses are Tuesdays."],
    ],
    lines: {
      healed: ["Hold still… there. Good as new. Well — good as slightly used."],
      healthy: ["You look fine to me. Come back when something's falling off."],
    },
    barks: ["Mind your step, dear.", "Healing is free. Gratitude is appreciated.", "Bless you. Did you sneeze? Bless you anyway."],
  },
  {
    id: "bella",
    name: "Bella",
    sprite: "npc_peasant",
    look: { skin: 0xf6d2b4, eyes: 0x4a8a3a, hair: 0xd8b060, longHair: true, tunic: 0xd87a9a, belt: 0x8a5a34, pants: 0x6a4a5a, boots: 0x5a3a22, apron: 0x8ac87a },
    personality: ["friendly", "funny"],
    schedule: { morning: "stall_bella", day: "stall_bella", evening: "tavern" },
    talk: [["Flowers! Herbs! Pies! Everything at my stall was grown with love. And a bit of manure. Mostly love."]],
    barks: ["Fresh pies!", "Flowers for someone special?", "Herbs! Picked this morning, promise!"],
    next: { panel: "shop", data: { stock: "merchant", merchant: "bella" } },
  },
  {
    id: "tomas",
    name: "Tomas",
    sprite: "npc_peasant",
    look: "farmer",
    personality: ["greedy", "funny"],
    schedule: { morning: "stall_tomas", day: "stall_tomas" },
    talk: [["Meat, bread, arrows, and a sock I found. The sock's not for sale. The sock's for luck."]],
    barks: ["Roast haunch! Hot-ish!", "Arrows, cheap as chips!", "Don't touch the sock."],
    next: { panel: "shop", data: { stock: "merchant", merchant: "tomas" } },
  },
  {
    id: "barnaby",
    name: "Barnaby",
    sprite: "npc_peasant",
    look: "drunk",
    personality: ["drunk", "funny"],
    schedule: { morning: "street_e", day: "tavern", evening: "tavern", night: "plaza" },
    talk: [
      ["You know what your problem is? You've got a face. Everyone's got a face. That's the problem. Faces."],
      ["Best advice I ever got: never fight a goose. Second best advice: if you do fight a goose, go for the knees. Geese don't have knees. That's the trick."],
      ["Want some advice? Put all your gold on red. Then all your gold on black. Then you've got it covered. Can't lose. *hic*"],
    ],
    barks: ["♪ Ohhh the wyvern was tipsy and so was I ♪", "*hic*", "Who moved the ground?", "I'm not drunk, I'm *festive*."],
  },

  // ---- travelling merchants (see data/merchants.ts) ----------------------------------------
  {
    id: "grisby",
    name: "Grisby the Peddler",
    sprite: "ai_goblin",
    portrait: "coin_bag",
    personality: ["greedy", "funny", "suspicious"],
    talk: [
      ["Customer! A real one! Everything's genuine, everything's legal, everything's *mine*.", "Where'd I get it? Found it. Where'd I find it? Near its owner."],
      ["Yes, I'm a goblin. Yes, my cousins are in the Barrow trying to stab you. We don't talk. Family, eh?"],
      ["That potion? Tested it myself. Well — tested it on Nargle. Nargle's fine. Nargle's *mostly* fine."],
    ],
    barks: ["Wares! Barely stolen!", "No refunds, no receipts, no questions.", "Psst. Human. Want a sock?"],
    lines: { hit: ["OI! I've got a *permit*! Somewhere!"] },
    next: { panel: "shop", data: { stock: "merchant", merchant: "grisby" } },
  },
  {
    id: "olwen",
    name: "Old Olwen",
    sprite: "npc_peasant",
    look: { skin: 0xf0c8a8, eyes: 0x4a8a3a, hair: 0xd8d8d0, longHair: true, tunic: 0x5a6a3a, pants: 0x4a4434, boots: 0x4a3024, hood: 0x6a7a44, cape: 0x4a5a34, scale: 0.94 },
    portrait: "herb",
    personality: ["friendly", "weird"],
    talk: [
      ["Healroot for cuts, moonpetal for the soul, emberbloom for when your soul needs a good kick.", "Sixty years I've walked these woods. The woods have walked me back twice."],
      ["Don't eat the blue mushrooms, dear. Well. Don't eat them *twice*."],
    ],
    barks: ["Herbs! Roots! Opinions!", "Mind the nettles, dearie.", "The trees are gossiping about you."],
    next: { panel: "shop", data: { stock: "merchant", merchant: "olwen" } },
  },
  {
    id: "lucky_lou",
    name: "Lucky Lou",
    sprite: "npc_rogue",
    look: "gambler",
    portrait: "dice",
    personality: ["greedy", "funny"],
    talk: [
      ["Lou's the name, luck's the game. I sell fortune by the ounce.", "Why am I selling luck instead of using it? Friend. *Friend.* Don't ask the hard questions."],
      ["These dice? Never lost a roll. Also never been allowed back in a tavern. Swings and roundabouts."],
    ],
    barks: ["Feeling lucky? You look lucky.", "Fortune favours the buyer!", "Charms! Trinkets! Absolutely no curses!"],
    next: { panel: "shop", data: { stock: "merchant", merchant: "lou" } },
  },
  {
    id: "sir_reginald",
    name: "Sir Reginald (Retired)",
    sprite: "npc_knight",
    look: { skin: 0xeebd96, eyes: 0x3a6ac0, hair: 0xe8e4dc, beard: 0xe8e4dc, tunic: 0x7a7a88, belt: 0x5a3a22, pants: 0x3a3a4a, boots: 0x3a3a44, cape: 0x8a2a3a },
    portrait: "helm_iron",
    personality: ["friendly", "annoying"],
    talk: [
      ["This helm saw me through the Siege of Grumbleford! Well. I saw the siege. From a hill. Through the helm.", "Yours for a very reasonable sum."],
      ["Forty years of knighthood and all I've got to show for it is this armour and a bad knee. Buy the armour. Keep away from the knee."],
    ],
    barks: ["Quality steel! Lightly dented!", "In my day we had *proper* dragons.", "Everything must go, including me, eventually."],
    next: { panel: "shop", data: { stock: "merchant", merchant: "reginald" } },
  },
  {
    id: "rika",
    name: "Rika the Trapper",
    sprite: "npc_rogue",
    look: "hunter",
    portrait: "bow_wood",
    personality: ["grumpy", "shy"],
    talk: [
      ["Arrows. Bows. Meat. Don't haggle, don't chat, don't step on the snare behind you.", "…The other snare. Yes. That one."],
      ["Wolves come out after dark. They're not evil. They're hungry. Big difference if you're the one being eaten? No."],
    ],
    barks: ["Quiet. You'll scare the rabbits.", "Arrows, two a coin.", "Hm."],
    next: { panel: "shop", data: { stock: "merchant", merchant: "rika" } },
  },

  {
    id: "dice_goblin",
    name: "Goblin Gambler",
    sprite: "ai_goblin",
    personality: ["funny", "greedy"],
    talk: [
      ["Oi! Adventurer! We're on our break. Union rules. No stabbing on the break.", "Fancy a throw? Ten gold. Beat our roll and you get twenty-five. It's very fair. We checked."],
      ["Don't tell the Warboss we've got dice. He thinks we're 'patrolling'. We ARE patrolling. Sitting down."],
      ["Nargle's cheating. Nargle's always cheating. Nargle, put the other dice DOWN."],
    ],
    lines: { hit: ["BREAK TIME! IT'S BREAK TIME!", "Oi! Not during the game!"] },
    barks: ["Snake eyes!", "Come on, come on…", "Nargle!", "Double or nothing!"],
  },

  // ---- forest encounters (see engine/world/areas/encounters.ts) ------------------------------
  {
    id: "ottis",
    name: "Ottis the Woodsman",
    sprite: "npc_peasant",
    look: { skin: 0xd9a070, eyes: 0x6a4a2a, hair: 0x7a4a2a, beard: 0x7a4a2a, tunic: 0x8a3a2a, belt: 0x4a3024, pants: 0x4a4434, boots: 0x3a2a20, cap: 0x5a6a3a, scale: 1.06 },
    portrait: "axe_iron",
    personality: ["friendly", "funny"],
    talk: [["Have you seen an axe? About this long, axe-shaped, answers to 'Bertha'?"]],
    lines: {
      "quest:start": [
        "Have you seen an axe? About this long, axe-shaped, answers to 'Bertha'?",
        "I put her down for ONE nap. One. Woke up, gone. Somewhere in these woods, she is.",
        "Find her and I'll make it worth your while. Don't tell anyone a woodsman lost his axe. I'll never live it down.",
      ],
      "quest:waiting": ["Still no Bertha? She's got a red handle. And a lot of personality."],
      "quest:found": ["BERTHA! My girl! Look at you, all covered in leaves.", "Here — for your trouble. And if anyone asks, I never lost her. She went for a walk."],
      "quest:done": ["Me and Bertha are never splitting up again. Well. Unless she gets stuck in a stump."],
    },
    barks: ["Bertha? BERTHA?", "An axe doesn't just walk off…", "Who naps next to a cliff edge? Me, apparently."],
  },
  {
    id: "petunia",
    name: "Nan Petunia",
    sprite: "npc_peasant",
    look: { skin: 0xf6d2b4, eyes: 0x3a6ac0, hair: 0xe8e4dc, longHair: true, tunic: 0xa86a8a, belt: 0x6a4a34, pants: 0x5a4a5a, boots: 0x4a3024, apron: 0xe8e0d0, scale: 0.9 },
    portrait: "herb",
    personality: ["friendly", "annoying"],
    talk: [["Five herbs, dear. Five! My knees won't bend for them any more and my soup won't make itself."]],
    lines: {
      "quest:start": ["Oh, a young person with working knees! Bring Nan five herbs and she'll pay you properly. None of this 'exposure' nonsense."],
      "quest:ready": ["Five herbs! Lovely. Smell that. That's soup, that is. That's soup and a nap."],
      "quest:waiting": ["Five herbs, dear. You've got {have}. Nan can count, you know."],
      "quest:done": ["Soup's on. I'd invite you, but I'm eating it all. That's the point of soup."],
    },
    barks: ["My knees!", "Five herbs. Is it so much to ask?", "In my day, herbs came to YOU."],
  },
  {
    id: "sir_loin",
    name: "Sir Loin of Beefshire",
    sprite: "npc_knight",
    look: { skin: 0xeebd96, eyes: 0x4a8a3a, hair: 0xd8b060, tunic: 0x9a9aa8, belt: 0x5a3a22, pants: 0x3a3a4a, boots: 0x3a3a44, helm: 0xb8c0cc, cape: 0x3a5aa8 },
    portrait: "sword_iron",
    personality: ["funny", "friendly"],
    talk: [["I'm lost. Please don't ask how. I had a map. The map had a squirrel on it. I followed the squirrel."]],
    lines: {
      "quest:start": [
        "Ah! A local! Splendid. I'm on a grand quest to slay the Dread Beast of the Deepwood.",
        "Which way is the Deepwood? …North. Right. And which way is north? …I see. Yes. I knew that.",
        "Take this, for your trouble. A knight always pays his debts. With whatever's in his pockets.",
      ],
      "quest:done": ["Onwards! To glory! …Via the path, this time. Not the squirrel."],
    },
    barks: ["Onwards! Er. Which way is onwards?", "Has anyone seen a squirrel with a map?", "I am definitely not lost. I am *questing*."],
  },
  {
    id: "grubnak",
    name: "Grubnak",
    sprite: "orc",
    personality: ["friendly", "funny"],
    talk: [
      ["Oh — oh no. You're the adventurer. From the Barrow. Look, I'm on my day off.", "I'm not going to stab you. You're not going to stab me. We're going to sit here and enjoy this sandwich like civilised people."],
      ["Ten years I've been guarding floor two. Ten years. Do you know how many times somebody says 'good morning'? None."],
      ["The boss wants us to 'lurk with more menace'. I don't even know what that means. I lurk fine."],
    ],
    lines: { hit: ["On my DAY OFF? Right. I'm telling HR.", "Oi! Picnic rules! Picnic rules!"] },
    barks: ["Nice day for it.", "Don't tell the boss you saw me.", "Mmh. Pickles."],
  },
  {
    id: "prophet",
    name: "The Mushroom Prophet",
    sprite: "npc_wizard",
    look: { skin: 0xc9e0b0, eyes: 0xd8b040, hair: 0x9a9a9a, longHair: true, beard: 0xcfcfcf, tunic: 0x6a2a2a, belt: 0x3a2a20, pants: 0x3a2a2a, boots: 0x2a2020, pointy: 0xc83a3a },
    portrait: "mushroom",
    personality: ["mysterious", "weird"],
    talk: [["The spores have spoken. Sit. Listen. Or don't. The spores already know which."]],
    lines: {
      prophecy: [
        "A great fortune awaits you… at the bottom of something. Possibly a well. Possibly a pie.",
        "Beware the man with two left boots. He is not dangerous. He is just very, very lost.",
        "You will lose something small today and find something large. The spores are unclear on whether it is a bear.",
        "The dice will favour you once. Only once. The spores won't say when. The spores are *petty*.",
        "Someone in the village loves you. Or owes you money. Spores are bad with feelings.",
        "Tonight the moon is watching. It is not impressed. Try harder.",
      ],
    },
    barks: ["The spores whisper…", "Mmmmushrooms.", "I have seen the future. It is damp."],
  },
  {
    id: "sleepwalker",
    name: "Hob (Asleep)",
    sprite: "npc_peasant",
    look: { skin: 0xeebd96, eyes: 0x4a3a2a, hair: 0xa86a36, tunic: 0xe8e0d0, belt: 0xe8e0d0, pants: 0xe8e0d0, boots: 0xd9a070, cap: 0xc83a3a },
    portrait: "sleep",
    personality: ["weird", "funny"],
    talk: [
      ["…five more minutes, Mum…", "…no, Duchess, the pig doesn't get the big bed…", "*snore*"],
      ["…I'd like to report a turnip…", "…it knows what it did…", "*snrrk*"],
    ],
    barks: ["zzz…", "…not the turnips…", "*snore*"],
  },
  // ---- happenings (engine/world/happenings.ts): small scenes around town ----------
  {
    id: "wendel",
    name: "Old Wendel",
    sprite: "npc_peasant",
    look: "elder",
    personality: ["grumpy"],
    talk: [["That fence has been on MY side of the line for forty years."]],
    barks: ["Forty years!", "That's MY fence!", "I was here before your GRANDMOTHER!", "Measure it! Go on, measure it!"],
  },
  {
    id: "pruett",
    name: "Widow Pruett",
    sprite: "npc_peasant",
    look: "noble",
    personality: ["annoying"],
    talk: [["His fence. HIS fence. It's leaning on my roses."]],
    barks: ["My roses!", "Leaning! It's LEANING!", "You moved it in the night!", "Wendel, you old goat!"],
  },
  {
    id: "nico",
    name: "Nimble Nico",
    sprite: "npc_peasant",
    look: "gambler",
    personality: ["greedy", "funny", "suspicious"],
    talk: [["Find the pea, win the purse! Easy as breathing! Easier, for some of you!"]],
    barks: ["Find the pea! Ten gold!", "Keep your eye on the cup!", "Everybody wins! Eventually!", "Round and round she goes…"],
  },
  {
    id: "wim",
    name: "Slick Wim",
    sprite: "npc_peasant",
    look: "traveler",
    personality: ["suspicious"],
    talk: [["What? I'm just walking. Fast. Normally fast."]],
    barks: ["Nothing to see here!", "Excuse me! Pardon! Coming through!"],
  },
  // ---- Mirror Lake -------------------------------------------------------------
  {
    id: "marit",
    name: "Marit the Angler",
    sprite: "npc_peasant",
    look: { skin: 0xd8a888, eyes: 0x3a5a7a, hair: 0x9a9a92, longHair: true, tunic: 0x5a7a4a, belt: 0x4a3424, pants: 0x4a4a5a, boots: 0x3a2a1a, hat: 0xc8b070, scale: 0.97 },
    portrait: "rod_wood",
    personality: ["funny", "friendly"],
    hours: [5, 22],
    talk: [
      ["Morning. Or afternoon. Out here you stop counting and start waiting."],
      ["Worms make them bite quicker. Nights bring up the odd ones — Moonscale, mostly. Glows like a lantern someone dropped."],
      ["Tobin says he caught a golden carp in '42. I say Tobin says a lot of things."],
      ["Cook your fish in a kitchen: grilled, or a proper stew. A stew'll keep you going all day."],
    ],
    night: [["The lake talks at night. Mostly it says 'plop'. Sometimes something bigger."]],
    barks: ["…Nothing. Again.", "Come on, come on…", "Plop.", "That one had shoulders."],
    lines: {
      "event:storm": ["Best fishing all year, a storm. Worst hat weather, though."],
      honorHigh: ["Word is you're a decent sort. Sit. Don't talk. That's the best compliment I give."],
    },
  },
  // ---- the Crooked Tower -----------------------------------------------------------
  {
    id: "ysolde",
    name: "Ysolde of the Crooked Tower",
    sprite: "npc_wizard",
    look: { skin: 0xe8c0a0, eyes: 0x8a5ac8, hair: 0xd8d0e8, longHair: true, tunic: 0x4a2a7a, belt: 0xc8a040, pants: 0x3a2a5a, boots: 0x2a1a3a, pointy: 0x5a3a8a, scale: 0.98 },
    portrait: "spellbook",
    personality: ["mysterious", "grumpy", "funny"],
    talk: [
      ["Magic is mostly paperwork. The rest is not setting your eyebrows on fire. Spark first; eyebrows later."],
      ["Mana comes back on its own if you stop flinging it about. Blue potions help. So does not dying."],
      ["The tower leans because it's listening. To what, I'd rather not say. It gets embarrassed."],
      ["I have more to teach. You have more to prove. We'll get there. Slowly. I'm very old and very patient and very busy."],
    ],
    night: [["Stars are out. Don't talk to me, I'm counting them. …You made me lose count."]],
    barks: ["Hmm.", "Where did I put the… no.", "Stop touching the tower."],
    lines: {
      honorLow: ["I know what you've been up to. The stars gossip. Mind you, so does Greta."],
      honorHigh: ["The village speaks well of you. The village also thinks I eat children. Grain of salt."],
    },
  },
  // ---- Lower Wildkeep (engine/world/areas/townSouth.ts) --------------------------------
  {
    id: "garrick",
    name: "Garrick the Hunter",
    sprite: "npc_peasant",
    look: "hunter",
    portrait: "bow_wood",
    personality: ["grumpy", "friendly"],
    schedule: { morning: "lodge", day: "lodge", evening: "tavern" },
    next: { panel: "shop", data: { stock: "hunter" } },
    talk: [
      ["Hunting's simple. Animals notice you before you notice them. Walk, don't run — running's the loudest thing you can do.", "Deer and rabbits bolt. Boars don't. Boars come for you. Respect the boar."],
      ["Bow's best: shoot from outside their nerves. A sword works if you can corner something, which you can't."],
      ["Bring me hides, meat, antlers. I pay better than Mira for them — she just piles them next to the turnips."],
      ["Roast your meat at home before you eat it. I shouldn't have to say that. I've had to say that."],
    ],
    barks: ["Quiet feet, quiet feet.", "Smell that? Boar. Or Ned.", "Hide's worth more in one piece."],
  },
  {
    id: "alma",
    name: "Sister Alma",
    sprite: "npc_peasant",
    look: { skin: 0xe8c0a0, eyes: 0x5a6a8a, hair: 0x5a4030, longHair: true, tunic: 0xe8e0d0, belt: 0x8a7050, pants: 0xc8c0b0, boots: 0x6a5a4a, cape: 0x6a8ab0, scale: 0.96 },
    portrait: "clover",
    personality: ["friendly", "shy"],
    schedule: { morning: "shrine", day: "shrine", evening: "shrine" },
    talk: [
      ["The shrine's for everyone. Sit a while. Say something, or don't — she listens either way."],
      ["The alms box feeds three families this winter. Every coin counts. So does every kindness, but those don't buy bread."],
      ["People think honour's about never doing wrong. It isn't. It's about what you do next."],
    ],
    barks: ["Peace on your road.", "Mind the step, it's older than me.", "Candles don't light themselves. Mostly."],
    lines: {
      honorLow: ["I've heard things. I'm not here to judge you. I'm here in case you'd like to do better."],
      honorHigh: ["The whole lane talks about you. Kindly, for once. Well done."],
    },
  },
  {
    id: "nell",
    name: "Nell",
    sprite: "npc_peasant",
    look: "farmer",
    personality: ["funny"],
    schedule: { morning: "pen", day: "pen", evening: "plaza" },
    talk: [
      ["These two are Turnip and Also Turnip. Hob named them. Hob names everything Turnip."],
      ["Duchess is the famous one. These are the ones who stay in the pen. Unsung heroes."],
      ["Want a tip? Pigs can find truffles. These two can find the one gap in any fence."],
    ],
    barks: ["Back, Turnip. BACK.", "Who left the gate— never mind, it's shut.", "Sooey!"],
  },
  {
    id: "otto",
    name: "Old Otto",
    sprite: "npc_peasant",
    look: "drunk",
    personality: ["drunk", "funny"],
    schedule: { morning: "shrine", day: "lane", evening: "tavern", night: "tavern" },
    talk: [
      ["I've lost my shoe. The left one. Or the right. The one that isn't here.", "Last I had it I was at the lake. Or the lake was at me."],
      ["Tobin says he caught a golden carp. I saw it. It was a boot. Might've been my boot."],
      ["When I was young we had no map. We had a stick. You pointed it and walked. Mostly into trees."],
    ],
    barks: ["Where's me shoe…", "Lovely day. Lovely. Is it day?", "I'm not drunk, I'm relaxed in the legs."],
  },
  {
    id: "kid_tilly",
    name: "Tilly",
    sprite: "npc_peasant",
    look: "child",
    personality: ["annoying", "funny"],
    hours: [8, 20],
    talk: [["Tag! You're it! …You have to run after us. That's how it WORKS."], ["Bo says you're a knight. I say you're a very tall farmer."], ["Did you know the shrine angel moves at night? Bo told me. Bo lies."]],
    barks: ["You're it!", "Can't catch me!", "BO! BO! YOU'RE IT!"],
  },
  {
    id: "kid_bo",
    name: "Bo",
    sprite: "npc_peasant",
    look: "child",
    personality: ["funny", "shy"],
    hours: [8, 20],
    talk: [["I'm going to be an adventurer. I've got a stick and everything."], ["Tilly cheats at tag. She says 'you're it' and then says she was never it. That's not how it works."], ["There's a dummy in the yard. I fight it every day. I'm winning, I think. It doesn't say."]],
    barks: ["Not it!", "Tilly, WAIT!", "Hiyaaa!"],
  },
];

export const NPCS: Record<string, NpcDef> = Object.fromEntries(defs.map((d) => [d.id, d]));

export function getNpc(id: string): NpcDef {
  const d = NPCS[id];
  if (!d) throw new Error(`Unknown NPC: ${id}`);
  return d;
}

/** Is the NPC around at this minute of the day? (Absences are checked in
 * game/npcs.ts, which knows the day.) */
export function npcPresent(def: NpcDef, minute: number): boolean {
  if (!def.hours) return true;
  const h = minute / 60;
  const [from, to] = def.hours;
  return from <= to ? h >= from && h < to : h >= from || h < to;
}
