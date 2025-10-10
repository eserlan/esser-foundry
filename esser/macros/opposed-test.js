;(async () => {
// Select exactly two tokens: first = Attacker, second = Defender.
    if ((canvas.tokens.controlled?.length ?? 0) !== 2) {
        return ui.notifications.warn("Select exactly TWO tokens: attacker then defender.");
    }
    const [attTok, defTok] = canvas.tokens.controlled;
    const attacker = attTok.actor, defender = defTok.actor;

    const skills = attacker.system.skills ?? {};
    const choices = Object.keys(skills)
        .map(k => `<option value="${k}">${game.i18n.localize(`ESSER.Skill.${k}`) || k}</option>`)
        .join("");

    const DialogV2 = foundry?.applications?.api?.DialogV2;
    if (DialogV2) {
        const content = `<p>Choose skill:</p><select id="esser-sel">${choices}</select>`;
        const selection = await DialogV2.wait({
            window: {title: "ESSER Opposed Test", icon: "fa-solid fa-scale-balanced"},
            content,
            buttons: [
                {action: "cancel", label: game.i18n.localize?.("ESSER.LevelUpCancel") ?? "Cancel"},
                {
                    action: "go",
                    label: game.i18n.localize?.("ESSER.NPC.Roll") ?? "Roll",
                    default: true,
                    callback: (event, button, dialog) => {
                        const root = dialog instanceof HTMLElement ? dialog : dialog?.element ?? dialog;
                        return root?.querySelector?.("#esser-sel")?.value;
                    }
                }
            ],
            close: () => null
        });

        if (!selection) return;
        const key = selection;
        const mod = await import(`/systems/esser/module/esser.js`);
        const result = await mod.opposedCompare(attacker, defender, key);

        // Auto-apply Strikes per ESSER logic
        if (result.diff >= 5) await defender.update({"system.strikes": Math.min((defender.system.strikes ?? 0) + 1, defender.system.maxStrikes ?? 3)});
        else if (result.diff <= 0) await attacker.update({"system.strikes": Math.min((attacker.system.strikes ?? 0) + 1, attacker.system.maxStrikes ?? 3)});
    } else {
        // Fallback without DialogV2: prompt for a skill key
        const key = await new Promise((resolve) => {
            const sel = window.prompt("Enter skill key for opposed test (e.g., athletics)", Object.keys(skills)[0] ?? "");
            resolve(sel);
        });
        if (!key) return;
        const mod = await import(`/systems/esser/module/esser.js`);
        const result = await mod.opposedCompare(attacker, defender, key);
        if (result.diff >= 5) await defender.update({"system.strikes": Math.min((defender.system.strikes ?? 0) + 1, defender.system.maxStrikes ?? 3)});
        else if (result.diff <= 0) await attacker.update({"system.strikes": Math.min((attacker.system.strikes ?? 0) + 1, attacker.system.maxStrikes ?? 3)});
    }
})();
