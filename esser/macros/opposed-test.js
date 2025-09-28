// Select exactly two tokens: first = Attacker, second = Defender.
if ((canvas.tokens.controlled?.length ?? 0) !== 2) {
  return ui.notifications.warn("Select exactly TWO tokens: attacker then defender.");
}
const [attTok, defTok] = canvas.tokens.controlled;
const attacker = attTok.actor, defender = defTok.actor;

const skills = attacker.system.skills ?? {};
const choices = Object.keys(skills).map(k => `<option value="${k}">${game.i18n.localize(`ESSER.Skill.${k}`) || k}</option>`).join("");

new Dialog({
  title: "ESSER Opposed Test",
  content: `<p>Choose skill:</p><select id="esser-sel">${choices}</select>`,
  buttons: {
    go: {
      label: "Roll",
      callback: async (html) => {
        const key = html.find("#esser-sel").val();
        const mod = await import(`/systems/esser/module/esser.js`);
        const result = await mod.opposedCompare(attacker, defender, key);

        // Auto-apply Strikes per ESSER logic
        if (result.diff >= 5) await defender.update({ "system.strikes": Math.min((defender.system.strikes ?? 0) + 1, defender.system.maxStrikes ?? 3) });
        else if (result.diff <= 0) await attacker.update({ "system.strikes": Math.min((attacker.system.strikes ?? 0) + 1, attacker.system.maxStrikes ?? 3) });
      }
    },
    cancel: { label: "Cancel" }
  }
}).render(true);
