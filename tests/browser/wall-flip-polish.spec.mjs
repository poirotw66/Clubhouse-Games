import { test, expect } from '@playwright/test';

const filter=(process.env.CI_GAME_FILTER || '').trim();
const included=!filter||filter==='*'||filter.toLowerCase()==='full'||filter.split(/[\s,]+/).includes('Wall-Flip');
test.beforeEach(()=>test.skip(!included,'selective CI'));

for(const vehicle of ['roadster','mars'])for(const mode of ['2d','3d']) {
  test(`wall-flip polish: ${mode} ${vehicle} launches above the fold and B activates both jets`,async({page,isMobile},testInfo)=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(({mode,vehicle})=>{
      localStorage.setItem('wallflip.viewMode',mode);localStorage.setItem('wallflip.vehicle.v1',vehicle);
    },{mode,vehicle});
    await page.goto('./Games/Wall-Flip/'+(mode==='3d'?'index-3d.html':''));
    const start=page.locator(mode==='3d'?'#startBtn':'#launchStart');
    await expect(start).toBeVisible({timeout:15000});
    const bounds=await start.boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y+bounds.height).toBeLessThanOrEqual(page.viewportSize().height);
    await start.click();
    const coach=page.getByTestId('flight-coach');
    await expect(coach).toBeVisible();
    expect((await coach.boundingBox()).height).toBeLessThan(page.viewportSize().height*.3);
    if(isMobile) {
      await expect(page.locator('#pad [data-act="brake"]')).toBeVisible();
      await page.locator('#pad [data-act="brake"]').tap();
    }
    await page.screenshot({path:testInfo.outputPath('polished-gameplay-'+mode+'.png')});
    if(mode==='3d') {
      await expect(page.locator('#stuntCockpit')).toBeHidden();
      await page.locator('#telemetryBtn').click();
      await expect(page.locator('#teleRoll')).toHaveText('0.0°');
      await expect(page.locator('#attitudeBadge')).not.toContainText('倒掛');
      await page.locator('#telemetryBtn').click();
      if(isMobile) await expect(page.locator('#pad [data-act="brake"]')).toBeVisible();
      await page.locator('#mutebtn').click();
      await page.keyboard.down('b');
      await expect.poll(()=>page.evaluate(()=>window.__sim.state.left&&window.__sim.state.right)).toBe(true);
      await expect.poll(()=>page.evaluate(()=>window.__sim.state.vy>0&&window.__sim.state.y>.66)).toBe(true);
      await page.locator('[data-flight-toggle]').focus();
      await page.keyboard.up('b');
      await expect.poll(()=>page.evaluate(()=>window.__sim.state.left||window.__sim.state.right)).toBe(false);
    } else {
      await page.keyboard.down('b');
      await page.evaluate(()=>window.__wfStep(.5));
      await expect(coach).toHaveAttribute('data-flight-stage','climb');
      await page.keyboard.up('b');
    }
    expect(errors).toEqual([]);
  });
}
