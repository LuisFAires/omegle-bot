const axios = require('axios')
const https = require('https')

function rdn(min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min)) + min
}

async function solve(page, mainWindow) {
  try {

    //wait to load
    await page.waitForFunction(() => {
      const iframe = document.querySelector('iframe[src*="api2/anchor"]')
      if (!iframe) return false

      return !!iframe.contentWindow.document.querySelector('#recaptcha-anchor')
    })

    //checkbox click
    let frames = await page.frames()
    const recaptchaFrame = frames.find(frame => frame.url().includes('api2/anchor'))
    const checkbox = await recaptchaFrame.$('#recaptcha-anchor')
    await checkbox.click({ delay: rdn(30, 150) })

    //verify if there's a challenge after checkbox
    const challenge = await page.waitForFunction(() => {
      let iframe;
      iframe = document.querySelector('iframe[src*="api2/anchor"]')
      if(iframe == null || !!iframe.contentWindow.document.querySelector('#recaptcha-anchor[aria-checked="true"]')){
        return "no challenge"
      }
      iframe = document.querySelector('iframe[src*="api2/bframe"]')
      const img = iframe.contentWindow.document.querySelector('.rc-image-tile-wrapper img')
      if(img && img.complete){
        return "there's a challenge"
      }
    }, { timeout: 5000 })
    if (challenge._remoteObject.value === "no challenge") return true
    
    //clicks audio button
    frames = await page.frames()
    const imageFrame = frames.find(frame => frame.url().includes('api2/bframe'))
    const audioButton = await imageFrame.$('#recaptcha-audio-button')
    await audioButton.click({ delay: rdn(30, 150) })

    while (true) {

      //looks for audio download button
      try {
        await page.waitForFunction(() => {
          const iframe = document.querySelector('iframe[src*="api2/bframe"]')
          if (!iframe) return false

          return !!iframe.contentWindow.document.querySelector('.rc-audiochallenge-tdownload-link')
        }, { timeout: 5000 })
      } catch (e) {
        mainWindow.webContents.send('activity',e.toString());
        return "Captcha: unable to solve!!!";
        continue
      }

      //looks for audio download link
      const audioLink = await page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="api2/bframe"]')
        return iframe.contentWindow.document.querySelector('#audio-source').src
      })

      //gets the audio
      const audioBytes = await page.evaluate(audioLink => {
        return (async () => {
          const response = await window.fetch(audioLink)
          const buffer = await response.arrayBuffer()
          return Array.from(new Uint8Array(buffer))
        })()
      }, audioLink)

      //sends the audio to the AI
      const httsAgent = new https.Agent({ rejectUnauthorized: false })
      const response = await axios({
        httsAgent,
        method: 'post',
        url: 'https://api.wit.ai/speech?v=20220622',
        data: new Uint8Array(audioBytes).buffer,
        headers: {
          Authorization: 'Bearer MVWCVY3FVGZDLK7I7Y7O6QVETQ2RSZA3',
          'Content-Type': 'audio/mpeg3'
        }
      })

      //check the response from the AI
      let audioTranscript = null;
      try {
        audioTranscript = response.data.match('"text": "(.*)",')[1].trim()
      } catch (e) {
        const reloadButton = await imageFrame.$('#recaptcha-reload-button')
        await reloadButton.click({ delay: rdn(30, 150) })
        continue
      }

      //types the response and verify
      const input = await imageFrame.$('#audio-response')
      await input.click({ delay: rdn(30, 150) })
      await input.type(audioTranscript, { delay: rdn(30, 75) })

      const verifyButton = await imageFrame.$('#recaptcha-verify-button')
      await verifyButton.click({ delay: rdn(30, 150) })

      try {
        //check if solved
        await page.waitForFunction(() => {
          const iframe = document.querySelector('iframe[src*="api2/anchor"]')
          if(iframe == null || !!iframe.contentWindow.document.querySelector('#recaptcha-anchor[aria-checked="true"]')){
            return true
          }
        }, { timeout: 5000 })

        return true;
        return page.evaluate(() => document.getElementById('g-recaptcha-response').value)

      } catch (e) {
        mainWindow.webContents.send('activity',"Captcha: answer not aceppted, tryng again...");
        mainWindow.webContents.send('activity',stop);
        continue
      }
    }
  } catch (e) {
    mainWindow.webContents.send('activity',e.toString());
    return "Captcha: unable to solve!!!";
  }
}

module.exports = solve
