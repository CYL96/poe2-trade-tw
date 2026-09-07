chrome.storage.local.get(['updated', 'translation'], ({ updated, translation }) => {
    addScript()

    if (!updated || +localStorage['local-updated'] === +updated) return
    const entries = [
        ['lscache-trade2items', translation?.items?.result],
        ['lscache-trade2stats', translation?.stats?.result],
        ['lscache-trade2data', translation?.static?.result],
        ['lscache-trade2filters', translation?.filters?.result],
    ]
    if (entries.some(([, value]) => value == null)) return

    const serialized = entries.map(([key, value]) => [key, JSON.stringify(value)])
    for (const [key, value] of serialized) {
        localStorage[key] = value
        localStorage.removeItem(`${key}-cacheexpiration`)
    }
    localStorage['local-updated'] = updated
    location.reload()
})

let addScript = () => {
    var s = document.createElement('script');
    s.src = chrome.runtime.getURL('js/translate.zh_TW.js');
    s.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(s);
}
