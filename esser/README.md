# ESSER – Foundry System (v0.1.0)

**Install (dev):**
1. Place the `esser` folder in your Foundry `Data/systems/` directory.
2. Restart Foundry. Create a new World using the **ESSER** system.

**PCs/NPCs:**
- Use the default **Character** type.
- Set **Concept**, fill a few **Skills** with +1/+2/+3, others at 0.
- Track **Strikes** (0–3) on the sheet.

**Rolling:**
- Click 🎲 beside a skill → d20 + bonus and result ladder in chat.

**Initiative:**
- Initiative rolls use the Agility attribute (1d20 + Agility bonus).
- Use the Combat Tracker to roll initiative for all combatants.
- NPCs have an Agility field on their sheet for initiative rolls.

**Opposed Tests:**
- Select attacker then defender tokens.
- Run macro: `macros/opposed-test.js` (drag to hotbar).
- It compares results and auto-applies Strikes.

**Five-Room Dungeon:**
- A `Scene` compendium “ESSER Adventure Frames” is included; add five scenes and label: Entrance, Puzzle, Twist, Climax, Resolution.

**Level Up System:**
- Characters start at Level 1 and can advance to Level 5.
- Click the "Level Up" button on the character sheet to open the level-up dialog.
- Choose from the available options based on your current level:
  - **Level 2 – Adventurer:** Gain 1 new Skilled skill OR +1 attribute (max +3)
  - **Level 3 – Veteran:** Upgrade 1 skill (Skilled → Expert, or Expert → Master) OR gain a new Skilled skill
  - **Level 4 – Hero:** Increase 1 attribute by +1 OR upgrade a skill
  - **Level 5 – Champion:** Gain 1 new Expert skill OR 1 new Master skill (if fitting the story)
