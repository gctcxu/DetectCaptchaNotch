import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import cv from 'opencv4nodejs'
import { get } from 'https';
import fs from 'fs'

const getPuzzleNotch = (bgPath, tpPath) => {
  const bg = cv.imread(bgPath, cv.IMREAD_UNCHANGED);
  const bgAlpha = bg.cvtColor(cv.COLOR_RGB2RGBA)

  const tp = cv.imread(tpPath);
  const tpAplha = cv.imread(tpPath, cv.IMREAD_UNCHANGED);

  let bgGray = bg.cvtColor(cv.COLOR_RGB2GRAY)
  let tpGray = tp.cvtColor(cv.COLOR_RGB2GRAY)

  cv.imwrite('./bgGray.png', bgGray)
  cv.imwrite('./tpGray.png', tpGray)

  const tpDark = tp.mul(0.55)
  cv.imwrite('./tpDark.png', tpDark)

  let mask = tpGray.threshold(10, 255, cv.THRESH_BINARY)
  cv.imwrite('mask.png', mask)

  const result = bg.matchTemplate(tpDark, cv.TM_SQDIFF, mask)

  let { minLoc } = cv.minMaxLoc(result)

  const mergedImg = bgAlpha.copy()
  const bgAry = bgAlpha.getDataAsArray()
  const tpAry = tpAplha.getDataAsArray()

  for(let i=0; i<tp.rows; i++){
    for(let j=0; j<tp.cols; j++){
      mergedImg.set(minLoc.y + i, minLoc.x + j, new cv.Vec4(parseInt(tpAry[i][j][0] * 0.3 + bgAry[minLoc.y + i][minLoc.x + j][0] * 0.7), parseInt(tpAry[i][j][1] * 0.3 + bgAry[minLoc.y + i][minLoc.x + j][1] * 0.7), parseInt(tpAry[i][j][2] * 0.3 + bgAry[minLoc.y + i][minLoc.x + j][2] * 0.7), 255))
    }
  }

  cv.imwrite('result.png', mergedImg)

  return minLoc
}

const crackGeetest = async () => {
  puppeteer.use(StealthPlugin())

  const browser = await puppeteer.launch({headless: false})
  const page = await browser.newPage()

  await page.goto('https://www.geetest.com/adaptive-captcha-demo')
  await page.waitForTimeout(500)
  const btn = await page.$('.tab-item-1')
  btn.click()
  await page.waitForTimeout(500)
  const btn2 = await page.$('.geetest_btn_click')
  btn2.click()
  await page.waitForSelector('.geetest_bg')

  let bgImg = await page.$eval('.geetest_bg', (e) => e.style.backgroundImage)
  bgImg = bgImg.match(/"(.*)"/)[1]
  await writeImageFile(bgImg, './bg.png')

  let tpImg = await page.$eval('.geetest_slice_bg', (e) => e.style.backgroundImage)
  tpImg = tpImg.match(/"(.*)"/)[1]
  await writeImageFile(tpImg, './tp.png')

  const minLoc = getPuzzleNotch('./bg.png', './tp.png')

  slicePuzzle(page, minLoc)
}

const writeImageFile = (imageSrc, filePath) => {
  return new Promise((resolve) => {
    get(imageSrc, (res) => {
      res.pipe(fs.createWriteStream(filePath)).on('finish', resolve)
    })
  })
}

const slicePuzzle = async (page, loc) => {
  const handle = await page.$('.geetest_btn')
  const boundingBox = await handle.boundingBox()

  const posX = boundingBox.x + boundingBox.width/2
  const posY = boundingBox.y + boundingBox.height/2

  await page.mouse.move(posX, posY, {steps: 25})
  await page.mouse.down()
	await page.waitForTimeout(250);

  await page.mouse.move(posX + loc.x, posY, {steps: 25})
  await page.mouse.up()
}

//crackGeetest()

getPuzzleNotch('./bg.png', './tp.png')
