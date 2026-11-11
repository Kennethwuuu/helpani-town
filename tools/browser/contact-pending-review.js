async (page) => {
  await page.goto('http://localhost:3110/woodland');
  await page.waitForFunction(() => window.helpaniWoodland?.snapshot());
  return await page.evaluate(async () => {
    const { WoodlandScene } = await import('/woodland-scene.js?contact-pending=' + Date.now());
    const cases = [
      { name: 'low-rest-to-high', initial: 'edge', target: 'trunk', trigger: a => a.mode === 'platform-rest' },
      { name: 'low-descending-to-high', initial: 'edge', target: 'trunk', trigger: a => a.node === 'rampTop' && a.segment?.endId === 'ramp' && a.elapsed > .15 },
      { name: 'high-rest-to-low', initial: 'trunk', target: 'edge', trigger: a => a.mode === 'platform-rest' },
      { name: 'high-exit-to-low', initial: 'trunk', target: 'edge', trigger: a => a.node === 'trunk' && a.segment?.endId === 'landing' && a.elapsed > .15 },
    ];
    const results = [];
    for (const test of cases) {
      const canvas = document.createElement('canvas');
      const applies = [], observations = [];
      const scene = new WoodlandScene(canvas, { onLayoutApplied: v => applies.push({ version: v, node: scene.actor.node, mode: scene.actor.mode }), onObserve: o => observations.push(o) });
      scene.setPaused(true); scene.random = () => .25;
      scene.updateLayout({ layout: { platform: test.initial, bridge: true }, layoutVersion: 1, appliedVersion: 1 });
      let pendingAt = null, appliedAt = null, firstTargetUse = null, retainedWhileBusy = true, targetUses = 0;
      const visited = new Set(), modes = new Set();
      for (let i = 0; i < 60 * 280; i++) {
        scene.time += 1 / 60; scene.advance(1 / 60);
        const a = scene.actor;
        visited.add(a.node); modes.add(a.mode);
        if (!pendingAt && test.trigger(a) && a.node === (test.initial === 'edge' && test.name.includes('rest') ? 'edge' : test.initial === 'trunk' && test.name.includes('rest') ? 'trunk' : a.node)) {
          pendingAt = { time: scene.time, node: a.node, mode: a.mode };
          scene.updateLayout({ layout: { platform: test.target, bridge: true }, layoutVersion: 2, appliedVersion: 1 });
          if (scene.layoutVersion !== 1) throw new Error(test.name + ': occupied layout applied immediately');
          scene.updateLayout({ layout: { platform: test.target, bridge: true }, layoutVersion: 2, appliedVersion: 1 });
          scene.updateLayout({ layout: { platform: test.initial, bridge: true }, layoutVersion: 1, appliedVersion: 1 });
        }
        if (pendingAt && !appliedAt) {
          if (scene.layoutVersion === 1 && scene.layout.platform !== test.initial) retainedWhileBusy = false;
          if (scene.layoutVersion === 2) appliedAt = { time: scene.time, node: a.node, mode: a.mode };
        }
        if (appliedAt && a.mode === 'platform-rest' && a.node === test.target && !firstTargetUse) firstTargetUse = scene.time;
      }
      targetUses = observations.filter(o => o.facilityId === 'rest-platform' && o.layoutVersion === 2).length;
      if (!pendingAt || !appliedAt || !firstTargetUse || !retainedWhileBusy || targetUses !== 1 || applies.filter(a => a.version === 2).length !== 1 || !visited.has('farBranch')) throw new Error(test.name + ': pending layout/bridge regression ' + JSON.stringify({ pendingAt, appliedAt, firstTargetUse, retainedWhileBusy, targetUses, applies, visited: [...visited] }));
      results.push({ name: test.name, pendingAt, appliedAt, firstTargetUse, retainedWhileBusy, observationReportsForVersion2: targetUses, applyVersion2Count: applies.filter(a => a.version === 2).length, visited: [...visited], modes: [...modes] });
      scene.destroy();
    }
    return { passed: results.length, results };
  });
}
