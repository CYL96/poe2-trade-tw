chrome.storage.onChanged.addListener((changes) => {
  for (let key in changes) {
    let value = changes[key].newValue
    if (key === 'language') {
      changeLanguage(value)
    }
    if (key === 'uiLanguage') {
      changeUILanguage(value)
    }
  }
})

let changeLanguage = async (language) => {
  if (language === 'us') {
    getCacheData(language).then(({ items, stats, static, filters }) => {
      chrome.storage.local.set({
        translation: { items, stats, static, filters },
        status: 'done',
        updated: +new Date(),
      })
    })
  }
  if (language === 'zh_tw') {
    getCacheData('us').then(async ({ items, stats, static, filters }) => {
      const translateFile = chrome.runtime.getURL('json/translate.json')
      let translate = await fetch(translateFile).then((res) => res.json())
      const passivesNotableFile = chrome.runtime.getURL('json/passivesNotable.json')
      let passivesNotable = await fetch(passivesNotableFile).then((res) => res.json())
      // items
      items.result.forEach((category) => {
        category.entries.forEach((item) => {
          let haveTranslateType = translate[item.type]
          let haveTranslate = translate[item.text]
          if (!!haveTranslate && !item.flags) {
            item.text = haveTranslate.zh_tw
          } else if (!!haveTranslateType && !item.flags) {
            item.text = haveTranslateType.zh_tw
          } else if (!!haveTranslate) {
            item.text = haveTranslate.zh_tw
          }
        })
      })
      getCacheData('zh_tw').then(({ stats: zh_stats, static: zh_static, filters: zh_filters }) => {
        // stats
        let translate_stat = {}
        zh_stats.result.forEach((category) => {
          category.entries.forEach((item) => {
            translate_stat[item.id] = item.text
          })
        })
        stats.result.forEach((category) => {
          category.entries.forEach((item) => {
            let haveTranslate = translate_stat[item.id]
            if (!!haveTranslate) {
              item.text = haveTranslate + ' (' + item.text + ')'
            }
          })
        })
        // filter
        filters = zh_filters;
        // static
        let translate_static = {}
        let translate_label = {}
        Object.keys(zh_static.result).forEach((objectKey) => {
          // 3.9 hotfix
          let rowData = zh_static.result[objectKey]
          if (!!rowData.entries) {
            translate_label[objectKey] = rowData.label
            rowData = rowData.entries
          }
          rowData.forEach((item) => {
            translate_static[item.id] = item.text
          })
        })
        Object.keys(static.result).forEach((objectKey) => {
          // 3.9 hotfix
          let rowData = static.result[objectKey]
          if (!!rowData.entries) {
            rowData.label = translate_label[objectKey]
            rowData = rowData.entries
          }
          rowData.forEach((item) => {
            let haveTranslate = translate_static[item.id]
            if (!!haveTranslate) {
              item.text = haveTranslate + ' (' + item.text + ')'
            }
          })
        })
        // finish
        chrome.storage.local.set({
          translation: { items, stats, static, passivesNotable, filters },
          status: 'done',
          updated: +new Date(),
          statusUI: 'progress',
        })
        chrome.storage.local.get('uiLanguage', ({ uiLanguage }) => {
          changeUILanguage(uiLanguage)
        })
      })
    })
  }
}

let changeUILanguage = async (UILanguage) => {
  let UILanguageJSON = {}
  chrome.storage.local.get('language', ({ language }) => {
    if (language === 'zh_tw') {
      chrome.storage.local.get(['UILanguage_zh_tw'], async ({ UILanguage_zh_tw }) => {
        UILanguageJSON = UILanguage_zh_tw
        if (!!UILanguage_zh_tw === false) {
          let translateFile = chrome.runtime.getURL('json/translate.zh_TW.json')
          let translateText = await fetch(translateFile).then((res) => res.json())
          UILanguageJSON = translateText
          chrome.storage.local.set({ UILanguage_zh_tw: UILanguageJSON })
        }
        setUILanguage(UILanguage, UILanguageJSON)
      })
    }
    if (language === 'zh_cn') {
      chrome.storage.local.get(['UILanguage_zh_cn'], async ({ UILanguage_zh_cn }) => {
        UILanguageJSON = UILanguage_zh_cn
        if (!!UILanguage_zh_cn === false) {
          let translateFile = chrome.runtime.getURL('json/translate.zh_CN.json')
          let translateText = await fetch(translateFile).then((res) => res.json())
          UILanguageJSON = translateText
          chrome.storage.local.set({ UILanguage_zh_cn: UILanguageJSON })
        }
        setUILanguage(UILanguage, UILanguageJSON)
      })
    }
    if (language === 'us') {
      setUILanguage(UILanguage, UILanguageJSON)
    }
  })
}

let setUILanguage = (UILanguage, UILanguageJSON) => {
  if (UILanguage === 'ZhUs') {
    Object.keys(UILanguageJSON).forEach((objectKey) => {
      UILanguageJSON[objectKey] = UILanguageJSON[objectKey] + ' (' + objectKey + ')'
    })
    chrome.storage.local.set({
      UILanguage: UILanguageJSON,
      statusUI: 'done',
      updated: +new Date(),
    })
  }
  if (UILanguage === 'Zh') {
    chrome.storage.local.set({
      UILanguage: UILanguageJSON,
      statusUI: 'done',
      updated: +new Date(),
    })
  }
  if (UILanguage === 'Us') {
    chrome.storage.local.set({
      UILanguage: {},
      statusUI: 'done',
      updated: +new Date(),
    })
  }
}

let getCacheData = (language) => {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(`cache_${language}`, (storage) => {
        let cache = storage[`cache_${language}`] || {}
        let isEmptyObject = Object.keys(cache).length === 0
        if (isEmptyObject) {
          let data = fetchData[language]()
          resolve(data)
        } else {
          resolve(cache)
        }
      })
    } catch (error) {
      reject(error)
    }
  })
}

let fetchData = {
  async us() {
    let us_url = 'https://www.pathofexile.com/api/trade2/data/'
    let items = await fetch(`${us_url}items`).then((res) => res.json())
    let stats = await fetch(`${us_url}stats`).then((res) => res.json())
    let static = await fetch(`${us_url}static`).then((res) => res.json())
    let filters = await fetch(`${us_url}filters`).then((res) => res.json())
    chrome.storage.local.set({ cache_us: { items, stats, static, filters } })
    return { items, stats, static, filters }
  },
  async zh_tw() {
    let us_url = 'https://pathofexile.tw/api/trade2/data/'
    try {
      let stats = await fetch(`${us_url}stats`).then((res) => res.json())
      let static = await fetch(`${us_url}static`).then((res) => res.json())
      let filters = await fetch(`${us_url}filters`).then((res) => res.json())
      chrome.storage.local.set({ cache_zh_tw: { stats, static, filters } })
      return { stats, static, filters }
    } catch (error) {
      console.log(error)
    }
  },
}
