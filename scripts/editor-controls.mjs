/** Follow the same panel navigation a person uses; never force hidden controls. */
export async function openPanel(page,name,options={}) {
  await page.locator('#editor-tab-'+name).click(options);
}
export async function choosePlacement(page,kind) {
  await openPanel(page,'library');
  await page.locator('#library-search').fill('');
  await page.locator('[data-category="all"]').click();
  await page.locator('[data-tool="'+kind+'"]').click();
}
