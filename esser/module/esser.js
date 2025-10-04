// module/esser.js
Hooks.once("init", async function () {
  console.log("ESSER | Initialising");
  const ActorsCollection = foundry.documents.collections.Actors;
  const CoreActorSheet = foundry.appv1?.sheets?.ActorSheet;

  if (CoreActorSheet) {
    ActorsCollection.unregisterSheet("core", CoreActorSheet);
  }
  ActorsCollection.registerSheet("esser", EsserActorSheet, { types: ["character"], makeDefault: true });
  ActorsCollection.registerSheet("esser", EsserNpcSheet, { types: ["npc"], makeDefault: true });
});

const { HandlebarsApplicationMixin } = foundry.applications.api;

const BaseActorSheet = HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheet);

const ActorImageControlsMixin = (Base) => class extends Base {
  async _onEditActorImage(event) {
    event.preventDefault();
    const target = event.currentTarget;
    const editPath = target?.dataset.edit;
    if (!editPath) return;

    const current = foundry.utils.getProperty(this.actor, editPath) ?? "";

    const pickerOptions = {
      type: "image",
      current,
      allowUpload: true,
      callback: async (path) => {
        const update = {};
        foundry.utils.setProperty(update, editPath, path);
        await this.actor.update(update);
      }
    };

    const FilePickerCls = foundry?.applications?.apps?.FilePicker?.implementation
      ?? foundry?.applications?.FilePicker
      ?? globalThis.FilePicker;

    if (typeof FilePickerCls?.fromUser === "function") {
      return FilePickerCls.fromUser(pickerOptions);
    }

    if (typeof FilePickerCls === "function") {
      const filePicker = new FilePickerCls(pickerOptions);
      return filePicker.render(true);
    }

    return this._fallbackImagePrompt(editPath, current);
  }

  async _onPreviewActorImage(event) {
    event?.preventDefault?.();

    const img = this.actor?.img;
    if (!img) {
      ui.notifications.warn(game.i18n.localize("ESSER.NoPortraitSet"));
      return null;
    }

    const title = this.actor?.name ?? game.i18n.localize?.("ESSER.CharacterPortrait") ?? "Portrait";
    const safeTitle = foundry.utils.escapeHTML?.(title) ?? title;
    const safeImg = foundry.utils.escapeHTML?.(img) ?? img;

    let previewDialog;
    const canShare = Boolean(game?.user?.isGM);
    const buttons = {};

    if (canShare) {
      buttons.share = {
        label: game.i18n.localize("ESSER.ShowToPlayers"),
        callback: async () => {
          await this._onShowActorImage();
          return false;
        }
      };
    }

    buttons.close = {
      label: game.i18n.localize("ESSER.Close"),
      callback: () => previewDialog?.close?.()
    };

    const content = `
      <div class="esser-image-preview-frame">
        <figure>
          <img src="${safeImg}" alt="${safeTitle}" />
          <figcaption>${safeTitle}</figcaption>
        </figure>
      </div>
    `.trim();

    previewDialog = new Dialog({
      title,
      content,
      buttons,
      default: canShare ? "share" : "close"
    }, {
      classes: ["esser", "image-preview-dialog"]
    });

    previewDialog.render(true);
    return previewDialog;
  }

  async _onViewActorImage(event) {
    return this._onPreviewActorImage(event);
  }

  async _onShowActorImage(event) {
    event?.preventDefault?.();

    if (!game?.user?.isGM) {
      ui.notifications.warn(game.i18n.localize("ESSER.GMOnlyShare"));
      return null;
    }

    const img = this.actor?.img;
    if (!img) {
      ui.notifications.warn(game.i18n.localize("ESSER.NoPortraitSet"));
      return null;
    }

    const title = this.actor?.name ?? game.i18n.localize?.("ESSER.CharacterPortrait") ?? "Portrait";
    const ImagePopoutCls = this._resolveImagePopoutClass();

    if (typeof ImagePopoutCls === "function") {
      const popout = new ImagePopoutCls(img, { title });
      try {
        if (typeof popout.render === "function") {
          popout.render(true);
        }
        if (typeof popout.shareImage === "function") {
          await popout.shareImage();
          ui.notifications.info(game.i18n.localize("ESSER.ImageShared"));
          return popout;
        }
        ui.notifications.warn(game.i18n.localize("ESSER.ImageShareUnavailable"));
        return popout;
      } catch (error) {
        console.error(error);
        ui.notifications.error(game.i18n.localize("ESSER.ImageShareFailed"));
        return popout;
      }
    }

    ui.notifications.warn(game.i18n.localize("ESSER.ImageShareUnavailable"));
    window.open(img, "_blank", "noopener");
    return null;
  }

  _resolveImagePopoutClass() {
    return foundry?.applications?.api?.ImagePopout
      ?? globalThis.ImagePopout
      ?? foundry?.applications?.apps?.ImagePopout;
  }

  async _fallbackImagePrompt(editPath, current) {
    const title = game.i18n.localize?.("ESSER.CharacterPortrait") ?? "Character Portrait";
    const safeCurrent = foundry.utils.escapeHTML?.(current) ?? current;
    const content = `
      <p>${game.i18n.localize?.("ESSER.PortraitPromptHint") ?? "Enter an image URL to use for this character."}</p>
      <div class="form-group">
        <label>${game.i18n.localize?.("ESSER.ImagePath") ?? "Image Path"}</label>
        <input type="text" name="img-path" value="${safeCurrent}" placeholder="https://..." />
      </div>
    `.trim();

    const result = await Dialog.prompt({
      title,
      content,
      label: game.i18n.localize?.("ESSER.Confirm") ?? "Confirm",
      rejectClose: false,
      callback: (html) => {
        const root = html instanceof HTMLElement ? html : html[0];
        return root?.querySelector?.("input[name='img-path']")?.value?.trim();
      }
    });

    if (!result) return null;

    const update = {};
    foundry.utils.setProperty(update, editPath, result);
    return this.actor.update(update);
  }
};

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

const NPC_FOCUS_SLOT_COUNT = 4;

class EsserActorSheet extends ActorImageControlsMixin(BaseActorSheet) {
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
    ctx.actor = this.actor;
    ctx.system = this.actor.system;
    ctx.canShowImage = Boolean(game?.user?.isGM);
    const attributeOptions = attributeRankOptions();
    const skillOptions = skillRankOptions();
    ctx.skillGroups = prepareAttributeGroups(this.actor, attributeOptions, skillOptions);
    return ctx;
  }

  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);
    if (partId !== "sheet") return;

    htmlElement.querySelectorAll("input[name], select[name], textarea[name]").forEach((element) => {
      element.addEventListener("change", (event) => {
        const target = event.currentTarget;
        if (!target?.name) return;

        try {
          const update = {};
          const value = coerceInputValue(target);
          if (value === undefined) return;

          foundry.utils.setProperty(update, target.name, value);
          this.actor.update(update).catch((error) => console.error(error));
        } catch (error) {
          console.error(error);
        }
      });
    });

    htmlElement.querySelectorAll("[data-action='roll-skill']").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const skill = event.currentTarget.dataset.skill;
        rollSkill(this.actor, skill, { flavor: game.i18n.localize(`ESSER.Skill.${skill}`) });
      });
    });

    htmlElement.querySelectorAll("[data-action='edit-image']").forEach((button) => {
      button.addEventListener("click", (event) => this._onEditActorImage(event));
    });

    htmlElement.querySelectorAll("[data-action='preview-image'], [data-action='view-image']").forEach((button) => {
      button.addEventListener("click", (event) => this._onPreviewActorImage(event));
    });

    htmlElement.querySelectorAll("[data-action='show-image']").forEach((button) => {
      button.addEventListener("click", (event) => this._onShowActorImage(event));
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

  async _updateObject(event, formData) {
    const expanded = expandSubmitData(formData);
    return this.actor.update(expanded);
  }

}

class EsserNpcSheet extends ActorImageControlsMixin(BaseActorSheet) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["esser", "sheet", "actor", "npc"],
    position: { width: 640, height: 640 },
    window: { resizable: true }
  });

  static PARTS = {
    sheet: {
      template: "systems/esser/templates/actor/npc-sheet.hbs",
      scrollable: [".sheet-body"]
    }
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.actor = this.actor;
    ctx.system = this.actor.system;
    ctx.skillOptions = npcSkillOptions();
    ctx.focusSlots = prepareNpcFocusSlots(this.actor, ctx.skillOptions);
    ctx.quickSummary = npcSummaryLine(this.actor);
    ctx.canShowImage = Boolean(game?.user?.isGM);
    return ctx;
  }

  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);
    if (partId !== "sheet") return;

    htmlElement.querySelectorAll("input[name], select[name], textarea[name]").forEach((element) => {
      element.addEventListener("change", (event) => {
        const target = event.currentTarget;
        if (!target?.name) return;

        try {
          const update = {};
          const value = coerceInputValue(target);
          if (value === undefined) return;

          foundry.utils.setProperty(update, target.name, value);
          this.actor.update(update).catch((error) => console.error(error));
        } catch (error) {
          console.error(error);
        }
      });
    });

    htmlElement.querySelectorAll("[data-action='npc-roll']").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const skill = event.currentTarget.dataset.skill;
        this._onNpcRoll(skill);
      });
    });

    htmlElement.querySelectorAll("[data-action='npc-opposed']").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const skill = event.currentTarget.dataset.skill;
        this._onNpcOpposed(skill);
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

    htmlElement.querySelectorAll("[data-action='edit-image']").forEach((button) => {
      button.addEventListener("click", (event) => this._onEditActorImage(event));
    });

    htmlElement.querySelectorAll("[data-action='preview-image'], [data-action='view-image']").forEach((button) => {
      button.addEventListener("click", (event) => this._onPreviewActorImage(event));
    });

    htmlElement.querySelectorAll("[data-action='show-image']").forEach((button) => {
      button.addEventListener("click", (event) => this._onShowActorImage(event));
    });

    const statBlockInput = htmlElement.querySelector("[data-role='npc-stat-block']");
    if (statBlockInput) {
      const importStatBlock = async () => {
        const raw = statBlockInput.value?.trim();
        if (!raw) {
          ui.notifications.warn(game.i18n.localize("ESSER.NPC.StatBlockEmpty"));
          return;
        }

        const imported = await this._importNpcStatBlock(raw);
        if (imported) {
          statBlockInput.value = "";
        }
      };

      const importButton = htmlElement.querySelector("[data-action='npc-import-stat-block']");
      if (importButton) {
        importButton.addEventListener("click", (event) => {
          event.preventDefault();
          importStatBlock();
        });
      }

      statBlockInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          importStatBlock();
        }
      });

      statBlockInput.addEventListener("paste", (event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (!text) return;
        event.preventDefault();
        statBlockInput.value = text.trim();
        importStatBlock();
      });
    }
  }

  async _modStrikes(delta) {
    const maxStrikes = this.actor.system.maxStrikes ?? 3;
    const s = clamp(this.actor.system.strikes + delta, 0, maxStrikes);
    await this.actor.update({ "system.strikes": s });
    if (s >= maxStrikes) {
      ui.notifications.warn(`${this.actor.name} is OUT (${maxStrikes} Strikes).`);
    }
  }

  async _onNpcRoll(skill) {
    if (!skill) {
      ui.notifications.warn(game.i18n.localize("ESSER.NPC.NoSkillSelected"));
      return;
    }
    await rollSkill(this.actor, skill, { flavor: game.i18n.localize(`ESSER.Skill.${skill}`) });
  }

  async _onNpcOpposed(skill) {
    if (!skill) {
      ui.notifications.warn(game.i18n.localize("ESSER.NPC.NoSkillSelected"));
      return;
    }

    const targets = Array.from(game?.user?.targets ?? []);
    const defenderToken = targets.find((token) => token?.actor && token.actor !== this.actor) ?? targets[0];
    const defender = defenderToken?.actor;
    if (!defender) {
      ui.notifications.warn(game.i18n.localize("ESSER.NPC.TargetRequired"));
      return;
    }

    await opposedCompare(this.actor, defender, skill);
  }

  async _importNpcStatBlock(text) {
    const parsed = parseNpcStatBlock(text);
    if (!parsed) {
      if (looksLikeNpcStatBlock(text)) {
        ui.notifications.warn(game.i18n.localize("ESSER.NPC.PasteUnrecognized"));
      }
      return false;
    }

    try {
      await this._applyParsedNpcStatBlock(parsed);
      ui.notifications.info(game.i18n.localize("ESSER.NPC.PasteImported"));
      return true;
    } catch (error) {
      console.error(error);
      ui.notifications.error(game.i18n.localize("ESSER.NPC.PasteUnrecognized"));
      return false;
    }
  }

  async _applyParsedNpcStatBlock(parsed) {
    const update = {};

    if (parsed.name) {
      update.name = parsed.name;
    }

    if (parsed.tier) {
      foundry.utils.setProperty(update, "system.tier", parsed.tier);
    }

    if (Number.isFinite(parsed.bonus)) {
      foundry.utils.setProperty(update, "system.bonus", parsed.bonus);
    }

    const currentMaxStrikes = this.actor.system.maxStrikes ?? 3;
    const maxStrikes = Number.isFinite(parsed.maxStrikes)
      ? Math.max(1, parsed.maxStrikes)
      : currentMaxStrikes;
    const strikes = Number.isFinite(parsed.strikes)
      ? Math.max(0, parsed.strikes)
      : this.actor.system.strikes ?? 0;

    if (Number.isFinite(parsed.maxStrikes)) {
      foundry.utils.setProperty(update, "system.maxStrikes", maxStrikes);
    }

    foundry.utils.setProperty(update, "system.strikes", clamp(strikes, 0, maxStrikes));

    if (parsed.coreTrait) {
      foundry.utils.setProperty(update, "system.coreTrait", parsed.coreTrait);
    }

    if (Object.prototype.hasOwnProperty.call(parsed, "concept") && parsed.concept !== undefined) {
      foundry.utils.setProperty(update, "system.concept", parsed.concept ?? "");
    }

    return this.actor.update(update);
  }
}

// ---------- Helpers ----------
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function expandSubmitData(formData) {
  const raw = typeof formData?.toObject === "function"
    ? formData.toObject()
    : (formData?.object ?? formData);
  const expanded = foundry.utils.expandObject(foundry.utils.deepClone(raw));
  delete expanded._id;
  return expanded;
}

function coerceInputValue(element) {
  if (!(element instanceof HTMLElement)) return undefined;

  if (element.type === "checkbox") {
    return element.checked;
  }

  const dtype = element.dataset.dtype ?? "String";
  const rawValue = element.value;

  switch (dtype) {
    case "Number": {
      if (rawValue === "" || rawValue === null || rawValue === undefined) return 0;
      const parsed = Number(rawValue);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    case "Boolean":
      return rawValue === "true";
    default:
      return rawValue;
  }
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
  if (!actor) return null;

  if (actor.type === "npc") {
    return rollNpcSkill(actor, skill, { flavor });
  }

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

async function rollNpcSkill(actor, skill, { flavor = "" } = {}) {
  const { totalBonus, baseBonus, extraBonus, label } = npcSkillInfo(actor, skill);
  const effectiveLabel = flavor || label || skill;

  const roll = await (new Roll(`1d20 + ${totalBonus}`)).evaluate();
  const total = roll.total;

  let result = "";
  if (total >= 20) result = "EPIC SUCCESS";
  else if (total >= 15) result = "Full success";
  else if (total >= 10) result = "Success with a cost";
  else result = "Failure with complication";

  const breakdown = [
    `${game.i18n.localize("ESSER.NPC.BaseBonus")} ${formatModifier(baseBonus)}`,
    extraBonus ? `${game.i18n.localize("ESSER.NPC.ExtraBonus")} ${formatModifier(extraBonus)}` : null
  ].filter(Boolean).join(", ");

  roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `${actor.name} rolls ${effectiveLabel} (bonus ${formatModifier(totalBonus)}${breakdown ? ` • ${breakdown}` : ""}) → <b>${result}</b>`
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

function npcSkillOptions() {
  const placeholder = game.i18n.localize("ESSER.NPC.SelectSkill");
  const options = Object.entries(SKILL_LABELS).map(([value, label]) => ({ value, label }));
  return [{ value: "", label: `— ${placeholder} —` }, ...options];
}

function prepareNpcFocusSlots(actor, skillOptions) {
  const baseBonus = Number(actor.system?.bonus ?? 0);
  const slots = ensureNpcFocusSlots(actor.system?.focus?.slots);
  const placeholder = skillOptions[0]?.label ?? "—";

  return slots.map((slot, index) => {
    const skill = slot?.skill ?? "";
    const extra = Number(slot?.extra ?? 0);
    const label = skill
      ? localizeOrFallback(`ESSER.Skill.${skill}`, SKILL_LABELS[skill] ?? skill)
      : placeholder;
    const options = skillOptions.map((option) => ({
      ...option,
      selected: option.value === skill
    }));

    return {
      index,
      skill,
      extra,
      total: baseBonus + extra,
      totalDisplay: formatModifier(baseBonus + extra),
      label,
      hasSkill: Boolean(skill),
      options
    };
  });
}

function ensureNpcFocusSlots(slots) {
  const prepared = Array.isArray(slots) ? slots.map((slot) => ({
    skill: slot?.skill ?? "",
    extra: Number(slot?.extra ?? 0)
  })) : [];

  while (prepared.length < NPC_FOCUS_SLOT_COUNT) {
    prepared.push({ skill: "", extra: 0 });
  }

  return prepared.slice(0, NPC_FOCUS_SLOT_COUNT);
}

function npcSummaryLine(actor) {
  const name = actor?.name?.trim() || game.i18n.localize("ESSER.CharacterName");
  const tier = actor?.system?.tier?.trim() || game.i18n.localize("ESSER.NPC.Tier");
  const baseBonus = Number(actor?.system?.bonus ?? 0);
  const strikes = Number(actor?.system?.strikes ?? 0);
  const maxStrikes = Number(actor?.system?.maxStrikes ?? 3);
  const coreTrait = actor?.system?.coreTrait?.trim() || game.i18n.localize("ESSER.NPC.CoreTrait");
  return `${name} – ${tier}, ${formatModifier(baseBonus)}, Strikes ${strikes}/${maxStrikes}, ${coreTrait}`;
}

function parseNpcStatBlock(text) {
  if (typeof text !== "string") return null;

  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return null;

  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  let summary = parseNpcSummaryLine(lines[0]);
  if (!summary) {
    summary = parseAlternateNpcStatBlock(lines);
  }
  if (!summary) return null;

  const conceptLabel = game?.i18n?.localize?.("ESSER.Concept") ?? "Concept";
  const conceptRegex = new RegExp(`^(?:${escapeRegExp(conceptLabel)}|Concept)\s*:\\s*(.+)$`, "i");
  const conceptMatch = lines.slice(1).map((line) => line.match(conceptRegex)).find(Boolean);
  if (conceptMatch) {
    summary.concept = conceptMatch[1].trim();
  }

  return summary;
}

function parseNpcSummaryLine(line) {
  if (typeof line !== "string") return null;
  const dashMatch = line.match(/^\s*(.+?)\s+[–—-]\s+(.+)$/);
  if (!dashMatch) return null;

  const name = dashMatch[1]?.trim();
  const remainder = dashMatch[2]?.trim();
  if (!name || !remainder) return null;

  const segments = remainder.split(",").map((part) => part.trim()).filter(Boolean);
  if (segments.length < 3) return null;

  const tier = segments.shift();
  const bonusPart = segments.shift();
  const strikesPart = segments.shift();
  const coreTrait = segments.join(", ").trim();

  const bonusMatch = bonusPart.match(/[+-]?\d+/);
  if (!bonusMatch) return null;
  const bonus = Number.parseInt(bonusMatch[0], 10);

  const strikeInfo = parseNpcStrikes(strikesPart);
  if (!strikeInfo) return null;

  return {
    name,
    tier,
    bonus,
    strikes: strikeInfo.strikes,
    maxStrikes: strikeInfo.maxStrikes,
    coreTrait
  };
}

function parseAlternateNpcStatBlock(lines) {
  if (!Array.isArray(lines) || lines.length < 2) return null;

  const headerMatch = lines[0].match(/^\s*(.+?)(?:\s*\((.+?)\))?\s*$/);
  const name = headerMatch?.[1]?.trim();
  const tier = headerMatch?.[2]?.trim() || undefined;
  if (!name) return null;

  const detailLine = lines.slice(1).find((line) => /strike/i.test(line));
  if (!detailLine) return null;

  const bonusMatch = detailLine.match(/[+-]?\d+/);
  if (!bonusMatch) return null;
  const bonus = Number.parseInt(bonusMatch[0], 10);
  if (!Number.isFinite(bonus)) return null;

  const strikeInfo = parseAlternateNpcStrikes(detailLine);

  const traitLabel = game?.i18n?.localize?.("ESSER.NPC.CoreTrait") ?? "Core Trait";
  const traitRegex = new RegExp(`^(?:${escapeRegExp(traitLabel)}|Trait)\s*:\\s*(.+)$`, "i");
  const traitMatch = lines.slice(1).map((line) => line.match(traitRegex)).find(Boolean);
  const coreTrait = traitMatch ? traitMatch[1].trim() : undefined;

  return {
    name,
    tier,
    bonus,
    strikes: strikeInfo?.strikes ?? 0,
    maxStrikes: strikeInfo?.maxStrikes,
    coreTrait
  };
}

function parseAlternateNpcStrikes(text) {
  if (typeof text !== "string") return null;

  const match = text.match(/(\d+)\s*(\+)?\s*Strikes?/i);
  if (!match) return null;

  const value = Number.parseInt(match[1], 10);
  if (!Number.isFinite(value)) return null;

  const hasPlus = Boolean(match[2]);
  if (hasPlus) {
    return { strikes: 0, maxStrikes: value };
  }

  return { strikes: value };
}

function parseNpcStrikes(text) {
  if (typeof text !== "string") return null;
  const cleaned = text.replace(/strikes?/gi, "").trim();
  const match = cleaned.match(/(\d+)(?:\s*\/\s*(\d+))?/);
  if (!match) return null;

  const strikes = Number.parseInt(match[1], 10);
  const maxStrikes = match[2] ? Number.parseInt(match[2], 10) : undefined;

  if (!Number.isFinite(strikes)) return null;

  return { strikes, maxStrikes };
}

function looksLikeNpcStatBlock(text) {
  if (typeof text !== "string") return false;
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return false;
  const firstLine = normalized.split("\n")[0]?.trim();
  if (!firstLine) return false;
  const summaryFormat = /[–—-]/.test(firstLine) && firstLine.includes(",");
  const alternateFormat = /\(.+?\)/.test(firstLine);
  return (summaryFormat && /strikes/i.test(normalized)) || (alternateFormat && /strike/i.test(normalized));
}

function npcSkillInfo(actor, skill) {
  const baseBonus = Number(actor?.system?.bonus ?? 0);
  const slots = ensureNpcFocusSlots(actor?.system?.focus?.slots);
  const match = slots.find((slot) => slot?.skill === skill);
  const extraBonus = match ? Number(match.extra ?? 0) : 0;
  const label = skill
    ? localizeOrFallback(`ESSER.Skill.${skill}`, SKILL_LABELS[skill] ?? skill)
    : game.i18n.localize("ESSER.NPC.SelectSkill");
  return {
    baseBonus,
    extraBonus,
    totalBonus: baseBonus + extraBonus,
    label
  };
}

function escapeRegExp(string) {
  if (typeof string !== "string") return "";
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
