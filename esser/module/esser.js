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

class EsserActorSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheet) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["esser", "sheet", "actor"],
    position: { width: 720, height: 720 },
    window: { resizable: false }
  });

  static PARTS = {
    sheet: {
      template: "systems/esser/templates/actor/actor-sheet.hbs",
      scrollable: []
    }
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.system = this.actor.system;
    ctx.skills = Object.entries(skillList()).map(([key, label]) => {
      const localized = game.i18n.localize(`ESSER.Skill.${key}`);
      return { key, label: localized === `ESSER.Skill.${key}` ? label : localized };
    });
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
    const s = foundry.utils.clamp(this.actor.system.strikes + delta, 0, this.actor.system.maxStrikes ?? 3);
    await this.actor.update({ "system.strikes": s });
    if (s >= (this.actor.system.maxStrikes ?? 3)) {
      ui.notifications.warn(`${this.actor.name} is OUT (3 Strikes).`);
    }
  }
}

// ---------- Helpers ----------
function skillList() {
  return {
    athletics: "Athletics", acrobatics: "Acrobatics", endurance: "Endurance", melee: "Melee",
    ranged: "Ranged", unarmed: "Unarmed", stealth: "Stealth", thievery: "Thievery",
    nature: "Nature", survival: "Survival", crafting: "Crafting", lore: "Lore",
    persuasion: "Persuasion", deception: "Deception", intimidation: "Intimidation", performance: "Performance",
    perception: "Perception", healing: "Healing", animal: "Animal Handling",
    spell_arcane: "Spellcasting (Arcane)", spell_divine: "Spellcasting (Divine)",
    spell_occult: "Spellcasting (Occult)", spell_primal: "Spellcasting (Primal)"
  };
}

export async function rollSkill(actor, skill, { flavor = "" } = {}) {
  const bonus = Number(actor.system.skills?.[skill] ?? 0);
  const roll = await (new Roll(`1d20 + ${bonus}`)).roll({ async: true });
  const total = roll.total;

  // Results ladder
  let result = "";
  if (total >= 20) result = "EPIC SUCCESS";
  else if (total >= 15) result = "Full success";
  else if (total >= 10) result = "Success with a cost";
  else result = "Failure with complication";

  roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `${actor.name} rolls ${flavor || skill} (bonus ${bonus >= 0 ? "+" : ""}${bonus}) → <b>${result}</b>`
  });

  return { roll, total, result };
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
