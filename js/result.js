const affix_zh = {}
const affix_us = {}
// passives Notable description
let passivesNotable = []
let passives_notable_zh = {}
let passives_notable_us = {}

// language
let lang = ''

chrome.storage.local.get('language', ({ language }) => {
  if (!language || language === 'us') return
  lang = language
  chrome.storage.local.get([`cache_${language}`, 'cache_us'], (storage) => {
    let cache_zh = storage[`cache_${language}`]
    let cache_us = storage['cache_us']
    if (!cache_zh) return
    let stats_zh = cache_zh.stats
    let stats_us = cache_us.stats
    // console.log('stats_zh', stats_zh)
    stats_zh.result.forEach((element) => {
      element.entries.forEach((entry) => {
        affix_zh[entry.id] = entry.text
      })
    })
    stats_us.result.forEach((element) => {
      element.entries.forEach((entry) => {
        affix_us[entry.id] = entry.text
      })
    })
    chrome.storage.local.get(['translation'], ({ translation }) => {
      passivesNotable = translation.passivesNotable
      checkLoaded()
    })
  })
})

const checkLoaded = () => {
  const selector = '[data-field], .notableProperty'
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1 && (node.matches(selector) || node.querySelector(selector))) {
          translate()
          return
        }
      }
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
  translate()
}

let timer
const translate = () => {
  if (timer) {
    window.clearTimeout(timer)
  }
  timer = window.setTimeout(() => {
    // mods
    let mods = document.querySelectorAll('[data-field]') // [data-mod] [data-field]
    Array.prototype.filter
      .call(mods, (elm) => !~elm.className.indexOf('translated'))
      .forEach((elm) => {
        let field = elm.dataset['field']
          .split('.')
          .filter((e, i) => i > 0)
          .join('.')
        let originalString = elm.innerText
        let usString = affix_us[field]
        let zhString = affix_zh[field]
        // console.log('================')
        // console.log('field', field)
        // console.log('================')
        if (!!usString === false || !!zhString === false) {
          //   console.log('Mismatch', field, usString, zhString)
          elm.classList.add('translated')
          return
        }
        // console.log('usString', usString)
        // console.log('zhString', zhString)
        usString = usString.replace(/\[[a-zA-Z '\-]+?\|(.+?)\]/g, '$1').replace(/\[([a-zA-Z '\-]+?)\]/g, '$1')
        zhString = zhString.replace(/\[[a-zA-Z '\-]+?\|(.+?)\]/g, '$1').replace(/\[([a-zA-Z '\-]+?)\]/g, '$1')
        // console.log('usString', usString)
        // console.log('zhString', zhString)
        // wtf
        // # Added Passive Skills are Jewel Sockets
        // 1 Added Passive Skill is a Jewel Socket
        if (originalString === '1 Added Passive Skill is a Jewel Socket') {
          //   console.log('originalString', originalString)
          //   console.log('field', field)
        }
        if (field === 'explicit.stat_4079888060' || field === 'enchant.stat_4079888060') {
          originalString = originalString.replace('Skill is a Jewel Socket', 'Skills are Jewel Sockets')
        }
        // [修正] 魔血詞 最左邊 # 的魔法功能型藥劑持續套用它的藥劑效果至你身上
        if (field === 'explicit.stat_2388347909') {
          // Leftmost # Magic Utility Flasks constantly apply their Flask Effects to you
          // Leftmost # Magic Utility Flask constantly applies its Flask Effect to you
          usString = usString.replace('Flask constantly applies its Flask Effect to you', 'Flasks constantly apply their Flask Effects to you')
        }
        // [修正] "攻擊有 #% 機率造成流血" 被翻成 "攻擊無法造成流血"
        if (field === 'explicit.stat_1923879260') {
          zhString = '攻擊有 #% 機率造成流血'
        }
        // Cluster Jewel - Added Small Passive Skills grant
        if (field === 'enchant.stat_2954116742') {
          // passives Notable
          let passivesNotableString = originalString.split('Allocates ')[1]
          let passivesNotableIndex = passives_notable_us.findIndex(({ text }) => text === passivesNotableString)
          let passivesNotableZh = passives_notable_zh[passivesNotableIndex]
          if (!!passivesNotableZh) {
            zhString = zhString.replace('#', '') + passivesNotableZh.text
          } else {
            zhString = elm.innerText
          }
        } else if (!!~usString.indexOf('#')) {
          // commom
          // fixed " (Local)"
          usString = usString.split(' (')[0]
          let regExpString = usString
            .replace(/\+/gim, '\\+')
            .replace(/%/gim, '\\%')
            .replace(/#/gim, '(\\S+)')
          let affixRegExp = new RegExp(regExpString, 'igm')
          let match = affixRegExp.exec(originalString)
          // console.log('affixRegExp', affixRegExp)
          // console.log('originalString', originalString)
          // console.log('match', match)
          // increased 增加 reduced 減少 嘗試對調比對
          if (!!match === false) {
            if (originalString.indexOf('increased') >= 0) {
              // console.log('increased', originalString)
              usString = usString.replace(/increased/gim, 'reduced')
              zhString = zhString.replace(/增加/gim, '減少')
              regExpString = usString
                .replace(/\+/gim, '\\+')
                .replace(/%/gim, '\\%')
                .replace(/#/gim, '(\\S+)')
              affixRegExp = new RegExp(regExpString, 'igm')
              match = affixRegExp.exec(originalString)
            } else if (originalString.indexOf('reduced') >= 0) {
              // console.log('reduced', originalString)
              usString = usString.replace(/reduced/gim, 'increased')
              zhString = zhString.replace(/減少/gim, '增加')
              regExpString = usString
                .replace(/\+/gim, '\\+')
                .replace(/%/gim, '\\%')
                .replace(/#/gim, '(\\S+)')
              affixRegExp = new RegExp(regExpString, 'igm')
              match = affixRegExp.exec(originalString)
            }
          }
          if (match && match.length >= 1) {
            match.shift()
            zhString = zhString.replace(/#/gim, () => match.shift())
          } else {
            // 是否為固定數值
            let numRange = elm.parentNode.querySelector('.lc .d')?.innerText.replace('&nbsp;', '').trim().slice(1, -1)
            // console.log('numRange', numRange)
            if (Number.isNaN(numRange)) {
              zhString = zhString.replace(/#/gim, numRange)
            } else if (numRange) {
              const myArray = numRange.split('—', 2);
              // console.log(myArray)
              if (myArray[0] == myArray[1]) {
                zhString = zhString.replace(/#/gim, myArray[0])
              } else {
               zhString = elm.innerText
              }
            }
          }
        } else if (usString !== originalString) {
          // [Bow Attacks fire an additional Arrow]
          // [Bow Attacks fire 2 additional Arrows]
          let numberRegExp = new RegExp('\\d+')
          let originalNumber = numberRegExp.exec(originalString)
          let zhNumber = numberRegExp.exec(zhString)
          if (originalNumber && originalNumber.length > 0) {
            originalNumber = originalNumber.shift()
            if (zhNumber && zhNumber.length > 0) {
              zhNumber = zhNumber.shift()
              zhString = zhString.replace(zhNumber, () => originalNumber)
            } else {
              zhString = zhString.replace(/#/gim, () => originalNumber)
            }
          }
        }
        elm.classList.add('translated')
        // elm.innerText = zhString
        // elm.innerHTML = `${elm.innerText}<div style="color: #83838d;font-size: 12px;">${zhString}</div>`
        elm.innerHTML = `${zhString}<div style="color: #83838d;font-size: 12px;">${elm.innerText}</div>`
      })

    // passives Notable description
    let passiveNotableDescription = document.querySelectorAll('.notableProperty')
    Array.prototype.filter
      .call(passiveNotableDescription, (elm) => !~elm.className.indexOf('translated'))
      .forEach((elm) => {
        let colourAugmented = elm.querySelector('.colourAugmented')
        let name = colourAugmented.innerText
        let translate = passivesNotable[name] && passivesNotable[name][lang]
        if (!translate) {
          return
        }
        colourAugmented.innerText = translate.name
        elm.querySelector('.lc').innerHTML = elm
          .querySelector('.lc')
          .innerHTML.split('<br>')
          .map((html, index) => {
            if (index === 0) {
              return html
            }
            return translate.desc[index - 1]
          })
          .join('<br>')
        elm.classList.add('translated')
      })
  }, 100)
}
