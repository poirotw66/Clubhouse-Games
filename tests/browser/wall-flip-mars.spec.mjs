import {test,expect} from '@playwright/test';

const filter=(process.env.CI_GAME_FILTER||'').trim();
const included=!filter||filter==='*'||filter.toLowerCase()==='full'||filter.split(/[\s,]+/).includes('Wall-Flip');
test.beforeEach(()=>test.skip(!included,'selective CI'));

for(const mode of ['2d','3d'])test(`wall-flip Mars rover: ${mode} selects and lands while holding descent controls`,async({page,isMobile},testInfo)=>{
  test.setTimeout(45000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{
    if(response.url().includes('/assets/mars-royale-surface')&&response.status()>=400)errors.push('Rover surface asset failed: '+response.status());
  });
  await page.addInitScript(mode=>localStorage.setItem('wallflip.viewMode',mode),mode);
  await page.goto('./Games/Wall-Flip/'+(mode==='3d'?'index-3d.html':''));
  const garage=page.getByTestId('vehicle-garage');
  await garage.locator('summary').click();
  await garage.locator('[data-vehicle="mars"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-vehicle','mars');
  await expect.poll(()=>page.evaluate(()=>performance.getEntriesByType('resource').some(entry=>entry.name.includes('/assets/mars-royale-surface')&&entry.decodedBodySize>0))).toBe(true);
  await expect(garage).toContainText('尊榮火星車');
  await expect(garage).toContainText('833%');
  const endurance=garage.locator('meter[aria-label="空氣續航"]');
  expect(await endurance.evaluate(meter=>meter.value)).toBeCloseTo(1/.12,8);
  await garage.locator('summary').click();
  await page.screenshot({path:testInfo.outputPath('mars-rover-garage-'+mode+'.png')});
  await page.locator(mode==='3d'?'#startBtn':'#launchStart').click();
  if(mode==='3d') {
    // Launch and stunt in one task so live animation cannot move the takeoff
    // between fixed-step input and an asynchronous UI assertion.
    const stunt=await page.evaluate(()=>{
      const sim=window.__sim;
      let duration=0;
      for(let i=0;i<2400;i++) {
        const s=sim.state;
        if(s.mode==='landed'||s.mode==='crash'||duration>=1.6)break;
        const input={drive:s.mode==='road',suck:s.mode==='road'&&s.u>0,left:false,right:false};
        if(s.mode==='air'&&s.clear){input.left=true;duration+=1/240;}
        sim.step(1/240,input);
      }
      return {mode:sim.state.mode,duration};
    });
    expect(stunt.mode).toBe('air');expect(stunt.duration).toBeGreaterThanOrEqual(1.6);
    await expect(page.locator('[data-flight-keys]')).toContainText('快降');
    if(isMobile)await expect(page.locator('#pad [data-act="suck"] span')).toHaveText('快降');
    const result=await page.evaluate(()=>{
      const sim=window.__sim;
      for(let i=0;i<10000;i++) {
        const s=sim.state;
        if(s.mode==='landed'||s.mode==='crash')break;
        sim.step(1/240,{drive:false,suck:true,left:true,right:true});
      }
      return {mode:sim.state.mode,air:sim.state.air};
    });
    expect(result.mode).toBe('landed');expect(result.air).toBeGreaterThan(75);
  } else {
    await page.keyboard.down('Space');await page.keyboard.down('x');
    await page.evaluate(()=>window.__wfStep(2.5));
    await expect(page.locator('[data-flight-keys]')).toContainText('快降');
    if(isMobile)await expect(page.locator('#pad [data-act="stick"] span')).toHaveText('快降');
    await page.keyboard.up('Space');await page.keyboard.down('b');
    await page.evaluate(()=>window.__wfStep(16));
    await page.keyboard.up('b');await page.keyboard.up('x');
    expect(await page.evaluate(()=>window.__stats.win)).toBe(true);
  }
  await expect(page.getByTestId('flight-review')).toBeVisible({timeout:10000});
  await expect(page.locator('.wf-vehicle-live')).toHaveAttribute('data-active-vehicle','mars');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});
