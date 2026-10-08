const affix_zh = {}
const affix_us = {}
// passives Notable description
let passivesNotable = []
let itemNames = {}
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
    Promise.all([
      fetch(chrome.runtime.getURL('json/passivesNotable.json')).then((response) => response.json()),
      fetch(chrome.runtime.getURL('json/translate.json')).then((response) => response.json()),
    ]).then(([notables, names]) => {
      passivesNotable = notables.passives
      itemNames = names
      checkLoaded()
    })
  })
})

const checkLoaded = () => {
  const selector = '[data-field], .item-popup__header, .item-popup span[style*="--colour-augmented"]'
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

// Advanced item descriptions can split values and ranges across lines.
const matchAffix = (template, text) => {
  const pattern = template.split(' (')[0].split('#').map((part) =>
    part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
  ).join('\\s*([+\\-\\d(][\\d.,+\\-()—–\\s]*?)\\s*')
  return new RegExp(`^\\s*${pattern}\\s*$`, 'i').exec(text)
}

let timer
const translate = () => {
  if (timer) {
    window.clearTimeout(timer)
  }
  timer = window.setTimeout(() => {
    // Result titles are separate from the translated item search options.
    document.querySelectorAll('.item-popup__header').forEach((header) => {
      if (header.classList.contains('translated')) return
      const lines = header.querySelectorAll('.item-popup__header-line')
      const name = lines.length > 1 ? lines[0] : null
      const type = lines[lines.length - 1]
      if (!type) return
      const originalType = type.innerText.trim()
      const originalName = name?.innerText.trim()
      const localizedType = itemNames[originalType]?.[lang]?.split(' (')[0]
      const localizedItem = itemNames[`${originalName} ${originalType}`]?.[lang]?.split(' (')[0]
      const localizedName = localizedType && localizedItem?.endsWith(` ${localizedType}`)
        ? localizedItem.slice(0, -localizedType.length - 1)
        : null
      for (const [element, text, original] of [[name, localizedName, originalName], [type, localizedType, originalType]]) {
        if (!element || !text || text === original) continue
        element.textContent = text
        // Native header lines have a fixed layout; keep English in the tooltip.
        element.title = original
      }
      if (localizedType) header.classList.add('translated')
    })

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
          let match = matchAffix(usString, originalString)
          // increased 增加 reduced 減少 嘗試對調比對
          if (!!match === false) {
            if (/reduced/i.test(originalString) && /increased/i.test(usString)) {
              usString = usString.replace(/increased/gi, 'reduced')
              zhString = zhString.replace(/增加/g, '減少')
              match = matchAffix(usString, originalString)
            } else if (/increased/i.test(originalString) && /reduced/i.test(usString)) {
              usString = usString.replace(/reduced/gi, 'increased')
              zhString = zhString.replace(/減少/g, '增加')
              match = matchAffix(usString, originalString)
            }
          }
          if (match && match.length >= 1) {
            match.shift()
            zhString = zhString.replace(/#/gim, () => match.shift())
          } else {
            // Leave unmatched text untouched instead of duplicating English or guessing values.
            return
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

    // The current trade renderer uses an augmented name span followed by breaks.
    const passiveNames = document.querySelectorAll('.item-popup div > span[style*="--colour-augmented"]')
    passiveNames.forEach((colourAugmented) => {
        const description = colourAugmented.parentElement
        if (description.classList.contains('translated') || !description.querySelector('br')) return
        const name = colourAugmented.innerText.replace(/\s+/g, ' ').trim()
        const lines = description.innerHTML.split(/<br\s*\/?\s*>/i)
        const effects = lines.slice(1).map((html) => {
          const text = document.createElement('span')
          text.innerHTML = html
          return text.textContent
        }).join(' ')
        // Normalize known equivalent grammar, retaining every number and condition.
        const normalize = (text) => text
          .replace(/\bCooldown Uses\b/gi, 'Cooldown Use')
          .replace(/\bRemove (?:up to 1 Curses?|a Curse)\b/gi, 'Remove 1 Curse')
          .replace(/\s+/g, '').toLowerCase()
        const variant = passivesNotable[name]?.find((entry) =>
          normalize(entry.en.desc.join(' ')) === normalize(effects)
        )
        const localized = variant?.[lang]
        // Never replace an unknown or changed effect with a same-name passive.
        if (!localized) return
        const english = document.createElement('div')
        english.style.cssText = 'color: #83838d; font-size: 12px;'
        lines.forEach((html, index) => {
          const text = document.createElement('span')
          text.innerHTML = html
          if (index) english.appendChild(document.createElement('br'))
          english.appendChild(document.createTextNode(text.textContent))
        })
        colourAugmented.textContent = localized.name
        description.replaceChildren(colourAugmented)
        for (const text of localized.desc) {
          description.append(document.createElement('br'), document.createTextNode(text))
        }
        description.appendChild(english)
        description.classList.add('translated')
      })
  }, 100)
}
