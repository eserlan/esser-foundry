// module/esser.js
Hooks.once("init", async function () {
  console.log("ESSER | Initialising");
  const ActorsCollection = foundry.documents.collections.Actors;
  const CoreActorSheet = foundry.appv1?.sheets?.ActorSheet;

  if (CoreActorSheet) {
    ActorsCollection.unregisterSheet("core", CoreActorSheet);
  }
  ActorsCollection.registerSheet("esser", EsserActorSheet, { types: ["character"], makeDefault: true });
});

const { HandlebarsApplicationMixin } = foundry.applications.api;

const SKILL_LABELS = {
  athletics: "Athletics", acrobatics: "Acrobatics", endurance: "Endurance", melee: "Melee",
  ranged: "Ranged", unarmed: "Unarmed", stealth: "Stealth", thievery: "Thievery",
  nature: "Nature", survival: "Survival", crafting: "Crafting", lore: "Lore",
  persuasion: "Persuasion", deception: "Deception", intimidation: "Intimidation", performance: "Performance",
  perception: "Perception", healing: "Healing", animal: "Animal Handling",
  spell_arcane: "Spellcasting (Arcane)", spell_divine: "Spellcasting (Divine)",
  spell_occult: "Spellcasting (Occult)", spell_primal: "Spellcasting (Primal)"
};

const ATTRIBUTE_DEFS = {
  might: {
    labelKey: "ESSER.Attribute.might",
    label: "Might",
    descriptionKey: "ESSER.AttributeDescription.might",
    description: "Strength, endurance, melee prowess.",
    default: 2,
    skills: ["athletics", "endurance", "melee", "unarmed"]
  },
  agility: {
    labelKey: "ESSER.Attribute.agility",
    label: "Agility",
    descriptionKey: "ESSER.AttributeDescription.agility",
    description: "Dexterity, speed, stealth, ranged attacks.",
    default: 1,
    skills: ["acrobatics", "stealth", "thievery", "ranged"]
  },
  mind: {
    labelKey: "ESSER.Attribute.mind",
    label: "Mind",
    descriptionKey: "ESSER.AttributeDescription.mind",
    description: "Intelligence, lore, and the arcane.",
    default: 0,
    skills: ["nature", "survival", "crafting", "lore", "perception", "healing",
      "spell_arcane", "spell_divine", "spell_occult", "spell_primal"]
  },
  charm: {
    labelKey: "ESSER.Attribute.charm",
    label: "Charm",
    descriptionKey: "ESSER.AttributeDescription.charm",
    description: "Persuasion, trickery, and presence.",
    default: 0,
    skills: ["persuasion", "deception", "intimidation", "performance", "animal"]
  }
};

const SKILL_RANK_DEFS = [
  { value: 0, labelKey: "ESSER.SkillRank.untrained" },
  { value: 2, labelKey: "ESSER.SkillRank.skilled" },
  { value: 4, labelKey: "ESSER.SkillRank.expert" },
  { value: 6, labelKey: "ESSER.SkillRank.master" }
];

const SKILL_RANK_LOOKUP = SKILL_RANK_DEFS.reduce((acc, rank) => {
  const key = rank.labelKey?.split(".").pop();
  if (key) {
    acc[key.toLowerCase()] = rank.value;
  }
  return acc;
}, {});

const SKILL_TO_ATTRIBUTE = Object.entries(ATTRIBUTE_DEFS).reduce((acc, [attributeKey, def]) => {
  for (const skill of def.skills) {
    acc[skill] = attributeKey;
  }
  return acc;
}, {});

class EsserActorSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheet) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["esser", "sheet", "actor"],
    position: { width: 720, height: 720 },
    window: { resizable: true }
  });

  static PARTS = {
    sheet: {
      template: "systems/esser/templates/actor/actor-sheet.hbs",
      scrollable: [".sheet-body"]
    }
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.system = this.actor.system;
    const attributeOptions = attributeRankOptions();
    const skillOptions = skillRankOptions();
    ctx.skillGroups = prepareAttributeGroups(this.actor, attributeOptions, skillOptions);
    return ctx;
  }

  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);
    if (partId !== "sheet") return;

    htmlElement.querySelectorAll("[data-action='roll-skill']").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const skill = event.currentTarget.dataset.skill;
        rollSkill(this.actor, skill, { flavor: game.i18n.localize(`ESSER.Skill.${skill}`) });
      });
    });

    htmlElement.querySelectorAll("[data-action='strike-inc']").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        this._modStrikes(1);
      });
    });

    htmlElement.querySelectorAll("[data-action='strike-dec']").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        this._modStrikes(-1);
      });
    });
  }

  async _modStrikes(delta) {
    const maxStrikes = this.actor.system.maxStrikes ?? 3;
    const s = clamp(this.actor.system.strikes + delta, 0, maxStrikes);
    await this.actor.update({ "system.strikes": s });
    if (s >= maxStrikes) {
      ui.notifications.warn(`${this.actor.name} is OUT (3 Strikes).`);
    }
  }
}

// ---------- Helpers ----------
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function skillList() {
  return foundry.utils.deepClone(SKILL_LABELS);
}

function attributeRankOptions() {
  return [2, 1, 0].map((value) => ({ value, label: formatModifier(value) }));
}

function skillRankOptions() {
  return SKILL_RANK_DEFS.map((rank) => ({
    value: rank.value,
    label: game.i18n.localize(rank.labelKey)
  }));
}

function prepareAttributeGroups(actor, attributeOptions, skillOptions) {
  return Object.entries(ATTRIBUTE_DEFS).map(([key, def]) => {
    const label = localizeOrFallback(def.labelKey, def.label);
    const description = localizeOrFallback(def.descriptionKey, def.description);
    const currentValue = Number(actor.system.attributes?.[key] ?? def.default ?? 0);
    return {
      key,
      label,
      description,
      value: currentValue,
      displayValue: formatModifier(currentValue),
      ranks: attributeOptions.map((option) => ({
        ...option,
        selected: option.value === currentValue
      })),
      skills: def.skills.map((skillKey) => {
        const skillLabel = localizeOrFallback(`ESSER.Skill.${skillKey}`, SKILL_LABELS[skillKey] ?? skillKey);
        const skillRaw = actor.system.skills?.[skillKey];
        const { bonus: skillValue, found: hasSkillValue } = extractSkillBonus(skillRaw);
        return {
          key: skillKey,
          label: skillLabel,
          value: hasSkillValue ? skillValue : 0,
          ranks: skillOptions.map((option) => ({
            ...option,
            selected: option.value === (hasSkillValue ? skillValue : 0)
          }))
        };
      })
    };
  });
}

function localizeOrFallback(key, fallback) {
  const localized = game.i18n.localize(key);
  if (localized === key) return fallback;
  return localized;
}

function formatModifier(value) {
  return value >= 0 ? `+${value}` : `${value}`;
}

export async function rollSkill(actor, skill, { flavor = "" } = {}) {
  const skillBonus = resolveSkillBonus(actor.system.skills?.[skill]);
  const attributeKey = SKILL_TO_ATTRIBUTE[skill];
  const attributeDef = attributeKey ? ATTRIBUTE_DEFS[attributeKey] : null;
  const attributeBonus = attributeKey
    ? Number(actor.system.attributes?.[attributeKey] ?? attributeDef?.default ?? 0)
    : 0;
  const totalBonus = attributeBonus + skillBonus;

  const roll = await (new Roll(`1d20 + ${totalBonus}`)).evaluate();
  const total = roll.total;

  // Results ladder
  let result = "";
  if (total >= 20) result = "EPIC SUCCESS";
  else if (total >= 15) result = "Full success";
  else if (total >= 10) result = "Success with a cost";
  else result = "Failure with complication";

  const attributeLabel = attributeDef ? localizeOrFallback(attributeDef.labelKey, attributeDef.label) : null;
  const skillLabel = localizeOrFallback(`ESSER.Skill.${skill}`, SKILL_LABELS[skill] ?? skill);

  const breakdown = [
    attributeLabel ? `${attributeLabel} ${formatModifier(attributeBonus)}` : null,
    `${skillLabel} ${formatModifier(skillBonus)}`
  ].filter(Boolean).join(", ");

  roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `${actor.name} rolls ${flavor || skill} (bonus ${formatModifier(totalBonus)}${breakdown ? ` • ${breakdown}` : ""}) → <b>${result}</b>`
  });

  return { roll, total, result };
}

function resolveSkillBonus(rawValue) {
  const { bonus } = extractSkillBonus(rawValue);
  return bonus;
}

function extractSkillBonus(value) {
  if (value === null || value === undefined) {
    return { bonus: 0, found: false };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return { bonus: value, found: true };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return { bonus: 0, found: false };

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      return { bonus: numeric, found: true };
    }

    const lookup = SKILL_RANK_LOOKUP[trimmed.toLowerCase()];
    if (lookup !== undefined) {
      return { bonus: lookup, found: true };
    }

    return { bonus: 0, found: false };
  }

  if (typeof value === "object") {
    let bonusTotal = 0;
    let bonusFound = false;
    for (const key of ["bonus", "value", "rank", "score"]) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;

      const result = extractSkillBonus(value[key]);
      if (!result.found) continue;

      if (key === "bonus") {
        bonusTotal += result.bonus;
        bonusFound = true;
        continue;
      }

      return { bonus: result.bonus + bonusTotal, found: true };
    }

    if (bonusFound) return { bonus: bonusTotal, found: true };
  }

  return { bonus: 0, found: false };
}

// Utility for opposed comparison (reused by macro)
export async function opposedCompare(attacker, defender, skill) {
  const A = await rollSkill(attacker, skill, { flavor: `Opposed (${skill}) – Attacker` });
  const D = await rollSkill(defender, skill, { flavor: `Opposed (${skill}) – Defender` });

  const diff = A.total - D.total;
  let outcome;
  if (diff >= 5) outcome = "Hit: Defender takes 1 Strike.";
  else if (diff >= 1) outcome = "Glancing: shove/disarm/weaken.";
  else outcome = "Defense holds: Attacker risks 1 Strike.";

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content: `<p><b>Opposed Result</b>: ${outcome} <br/>Δ = ${diff} (A:${A.total} vs D:${D.total})</p>`
  });
  return { diff, outcome };
}
