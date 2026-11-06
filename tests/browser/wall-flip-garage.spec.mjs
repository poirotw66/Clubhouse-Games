import { test, expect } from '@playwright/test';

const filter=(process.env.CI_GAME_FILTER || '').trim();
const included=!filter || filter==='*' || filter.toLowerCase()==='full' || filter.split(/[\s,]+/).includes('Wall-Flip');
test.beforeEach(() => test.skip(!included,'selective CI'));
const garage=page=>page.getByTestId('vehicle-garage');

test('wall-flip garage: all five shells select, localize and persist between rendering modes', async ({page}) => {
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('wallflip.viewMode','2d'));
  await page.goto('./Games/Wall-Flip/');
  await garage(page).locator('summary').click();
  for(const id of ['sparrow','atlas','nova','mars','roadster']) {
    await garage(page).locator('button[data-vehicle="'+id+'"]').click();
    await expect(page.locator('body')).toHaveAttribute('data-vehicle',id);
    await expect(garage(page).locator('button[data-vehicle="'+id+'"]')).toBeFocused();
  }
  await garage(page).locator('button[data-vehicle="nova"]').click();
  await page.locator('.wf-launch-lang').click();
  await expect(garage(page)).toContainText('Jet prototype');
  await expect(garage(page).locator('meter[aria-label="Jet thrust"]')).toHaveAttribute('value','1.28');
  await garage(page).locator('summary').click();
  await page.getByTestId('start-mode-3d').click();
  await expect(page.locator('body')).toHaveAttribute('data-vehicle','nova',{timeout:15000});
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-vehicle','nova',{timeout:15000});
  await page.locator('#startBtn').click();
  await expect(page.locator('.wf-vehicle-live')).toHaveAttribute('data-active-vehicle','nova');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});

test('wall-flip garage: actual 3D runtime spends the selected car’s air budget', async ({page}) => {
  await page.goto('./Games/Wall-Flip/index-3d.html');
  await expect(page.locator('#startBtn')).toBeVisible({timeout:15000});
  await garage(page).locator('summary').click();
  await garage(page).locator('button[data-vehicle="atlas"]').click();
  await expect(page.locator('.wf-launch-caption')).toContainText('ATLAS');
  await garage(page).locator('summary').click();
  await page.locator('#startBtn').click();
  const used=await page.evaluate(()=>{
    const sim=window.__sim,before=sim.state.air;
    for(let i=0;i<120;i++) sim.step(1/240,{drive:false,suck:true,left:false,right:false});
    return before-sim.state.air;
  });
  expect(used).toBeCloseTo(3,7); // 8 air/s × 75% consumption × half a second.
});

test('wall-flip garage: local bests are per vehicle and custom cars cannot submit to the original board', async ({page}) => {
  let posts=0;
  await page.route(/\/rest\/v1\/wallflip_scores/,async route=>{
    if(route.request().method()==='POST') posts++;
    await route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
  await page.addInitScript(()=>{
    localStorage.setItem('wallflip3.best','456');
    localStorage.setItem('wallflip3.best.vehicle.nova','123');
  });
  await page.goto('./Games/Wall-Flip/index-3d.html');
  await expect(page.locator('#startBtn')).toBeVisible({timeout:15000});
  await expect(page.locator('#startBest')).toContainText('456');
  await garage(page).locator('summary').click();
  await garage(page).locator('button[data-vehicle="nova"]').click();
  await expect(page.locator('#startBest')).toContainText('123');
  await garage(page).locator('summary').click();
  await page.locator('#boardBtn').click();
  await expect(page.locator('#boardTitleEl')).toContainText('NOVA');
  await expect(page.locator('#boardTabs')).toBeEmpty();
  await page.evaluate(()=>{
    window.__game.score={total:777};
    window.__sim.state.land={rolls:3};
    window.__submitScore('GarageTest');
  });
  await page.waitForLoadState('networkidle');
  expect(posts).toBe(0);
  expect(await page.evaluate(()=>localStorage.getItem('wallflip3.best'))).toBe('456');
  expect(await page.evaluate(()=>localStorage.getItem('wallflip3.subT'))).toBeNull();
});

test('wall-flip garage: a result selection changes the next run without relabeling the completed car', async ({page}) => {
  await page.addInitScript(()=>{
    localStorage.setItem('wallflip.viewMode','2d');
    localStorage.setItem('wallflip.vehicle.v1','atlas');
  });
  await page.goto('./Games/Wall-Flip/');
  await page.locator('#launchStart').click();
  await page.keyboard.down('Space'); await page.keyboard.down('x');
  await page.evaluate(()=>window.__wfStep(2.5));
  await page.keyboard.up('Space'); await page.keyboard.up('x');
  await page.evaluate(()=>window.__wfStep(12));
  await expect(page.getByTestId('flight-review')).toBeVisible();
  const reviewGarage=page.getByTestId('vehicle-garage-review');
  await reviewGarage.locator('summary').click();
  await reviewGarage.locator('button[data-vehicle="nova"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-vehicle','atlas');
  await page.locator('[data-coach-retry]').click();
  await expect(page.locator('body')).toHaveAttribute('data-vehicle','nova');
  await expect(page.locator('.wf-vehicle-live')).toHaveAttribute('data-active-vehicle','nova');
});
