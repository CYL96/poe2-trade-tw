import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const baseUrl = 'https://poe2db.tw/data/passive-skill-tree/4.5/'
const languages = { us: 'en', tw: 'zh_tw', cn: 'zh_cn' }

// These source strings are internal fields, not localized game descriptions.
// Translate the field literally and retain the raw English in the bilingual output.
const internalFields = {
  'base physical damage reduction rating no display [200]': ['內部資料：基礎物理傷害減免值（不顯示）[200]', '内部数据：基础物理伤害减免值（不显示）[200]'],
  '\nbase strength [5]\nbase dexterity [5]\nbase intelligence [5]': ['內部資料：基礎力量 [5]\n內部資料：基礎敏捷 [5]\n內部資料：基礎智慧 [5]', '内部数据：基础力量 [5]\n内部数据：基础敏捷 [5]\n内部数据：基础智慧 [5]'],
  'focus decay delay ms [5000]': ['內部資料：專注衰減延遲（毫秒）[5000]', '内部数据：专注衰减延迟（毫秒）[5000]'],
  'consume all owl feathers on dodge [1]': ['內部資料：閃避時消耗所有貓頭鷹羽毛 [1]', '内部数据：闪避时消耗所有猫头鹰羽毛 [1]'],
  'additional physical damage reduction % per jade [1]': ['內部資料：每層玉石的額外物理傷害減免百分比 [1]', '内部数据：每层玉石的额外物理伤害减免百分比 [1]'],
  'max jade stacks [10]': ['內部資料：玉石層數上限 [10]', '内部数据：玉石层数上限 [10]'],
  'life remnants gain per globe [1]': ['內部資料：每個球體獲得的生命殘跡 [1]', '内部数据：每个球体获得的生命残迹 [1]'],
  'base unaffected by bleeding [1]': ['內部資料：不受流血影響 [1]', '内部数据：不受流血影响 [1]'],
  'can see monster categories [1]': ['內部資料：可查看怪物類別 [1]', '内部数据：可查看怪物类别 [1]'],
  'base maximum number of gemling barrier stacks [3]': ['內部資料：基礎寶石屏障層數上限 [3]', '内部数据：基础宝石屏障层数上限 [3]'],
  carried_spectral_bell: ['內部資料：攜帶幽魂鐘', '内部数据：携带幽魂钟'],
  'number of infernal familiars allowed [1]': ['內部資料：允許的獄火魔寵數量 [1]', '内部数据：允许的狱火魔宠数量 [1]'],
  'max demon form stacks [10]': ['內部資料：惡魔形態層數上限 [10]', '内部数据：恶魔形态层数上限 [10]'],
  'ascendancy bear companion takes % damage before you [8]': ['內部資料：昇華熊盟友優先承受的傷害百分比 [8]', '内部数据：升华熊伙伴优先承受的伤害百分比 [8]'],
  'ascendancy spirit walker sacred notable taken [1]': ['內部資料：已配置靈行者神聖核心天賦 [1]', '内部数据：已配置灵行者神圣核心天赋 [1]'],
  'head hunt without a corpse [1]': ['內部資料：無屍體時獵首 [1]', '内部数据：无尸体时猎首 [1]'],
  'ascendancy enable fire djinn passive [1]': ['內部資料：啟用昇華火焰巨靈天賦 [1]', '内部数据：启用升华火焰巨灵天赋 [1]'],
  'is focused totem [1]': ['內部資料：專注圖騰 [1]', '内部数据：专注图腾 [1]'],
  'max owl feathers [3]': ['內部資料：貓頭鷹羽毛上限 [3]', '内部数据：猫头鹰羽毛上限 [3]'],
  'stone skin duration ms [20000]': ['內部資料：石膚持續時間（毫秒）[20000]', '内部数据：石肤持续时间（毫秒）[20000]'],
  'stone skin grants attack damage +% final you use yourself [15]': ['內部資料：石膚賦予自身使用的攻擊傷害最終百分比加成 [15]', '内部数据：石肤赋予自身使用的攻击伤害最终百分比加成 [15]'],
  'stone skin grants damage reduction life threshold % [30]': ['內部資料：石膚傷害減免的生命門檻百分比 [30]', '内部数据：石肤伤害减免的生命阈值百分比 [30]'],
  'stone skin grants damage taken +% final [-40]': ['內部資料：石膚承受傷害最終百分比加成 [-40]', '内部数据：石肤承受伤害最终百分比加成 [-40]'],
  'stone skin grants stun threshold +% final [50]': ['內部資料：石膚暈眩門檻最終百分比加成 [50]', '内部数据：石肤晕眩阈值最终百分比加成 [50]'],
  'gain random charge every X ms from total socketed gem attribute requirements [5000]': ['內部資料：依插槽寶石能力需求總和，每隔指定毫秒獲得隨機能量球 [5000]', '内部数据：依插槽宝石属性需求总和，每隔指定毫秒获得随机充能球 [5000]'],
  'base max adaptations [3]': ['內部資料：基礎適應層數上限 [3]', '内部数据：基础适应层数上限 [3]'],
  'gain unbound ailment stacks [1]': ['內部資料：獲得無縛異常狀態層數 [1]', '内部数据：获得无缚异常状态层数 [1]'],
}

function plainText(text) {
  return text.replace(/\[([^\]|]+)(?:\|([^\]]+))?\]/g, (whole, key, label) => {
    if (label != null) return label
    if (/^-?\d+$/.test(key)) return whole
    // Repair two malformed bilingual keywords in the current source export.
    return key.replace(/^[A-Za-z]+(?=\p{Script=Han})/u, '')
  })
}

function lines(stats, language) {
  return stats.flatMap((stat) => {
    const override = language === 'us' ? null : internalFields[stat]?.[language === 'tw' ? 0 : 1]
    return plainText(override ?? stat).split(/\r?\n/)
  }).map((line) => line.trim()).filter(Boolean)
}

export async function buildPassives() {
  const trees = Object.fromEntries(await Promise.all(Object.keys(languages).map(async (language) => {
    const url = `${baseUrl}data_${language}.json?5`
    const response = await fetch(url)
    assert(response.ok, `${url}: HTTP ${response.status}`)
    return [language, await response.json()]
  })))
  const passives = {}
  let nodes = 0
  let notables = 0
  let excluded = 0
  for (const [id, english] of Object.entries(trees.us.nodes)) {
    if (id === 'root' || !english.name || !english.stats) continue
    const traditional = trees.tw.nodes[id]
    const simplified = trees.cn.nodes[id]
    assert(traditional?.id === english.id && simplified?.id === english.id, `Mismatched node ${id}`)
    // Empty development placeholders are not game passives. Keep localized empty
    // nodes (masteries and ascendancy starts) without inventing effects.
    if (!english.stats.length && !/\p{Script=Han}/u.test(traditional.name)) {
      excluded++
      continue
    }
    const name = english.name.replace(/\s+/g, ' ').trim()
    const variant = {
      ids: [Number(id)],
      en: { name, desc: lines(english.stats, 'us') },
      zh_tw: { name: traditional.name.trim(), desc: lines(traditional.stats, 'tw') },
      zh_cn: { name: simplified.name.trim(), desc: lines(simplified.stats, 'cn') },
    }
    for (const language of ['zh_tw', 'zh_cn']) {
      assert(/\p{Script=Han}/u.test(variant[language].name), `Untranslated name ${id}: ${language}`)
      assert(variant[language].desc.every((line) => /\p{Script=Han}/u.test(line)), `Untranslated effect ${id}: ${language}`)
    }
    const variants = passives[name] ??= []
    const existing = variants.find((entry) => JSON.stringify(entry.en) === JSON.stringify(variant.en))
    if (existing) {
      // Some duplicate nodes use slightly different localized names. Effects
      // must agree; the lowest numeric node ID supplies the canonical name.
      assert.deepEqual(existing.zh_tw.desc, variant.zh_tw.desc, `Conflicting Traditional effects ${id}`)
      assert.deepEqual(existing.zh_cn.desc, variant.zh_cn.desc, `Conflicting Simplified effects ${id}`)
      existing.ids.push(Number(id))
    } else {
      variants.push(variant)
    }
    nodes++
    if (english.isNotable && !english.ascendancyName && !english.ascendancyId) notables++
  }
  const sorted = Object.fromEntries(Object.entries(passives).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
  const variants = Object.values(sorted).reduce((total, entries) => total + entries.length, 0)
  return {
    source: { version: '4.5', urls: Object.keys(languages).map((language) => `${baseUrl}data_${language}.json?5`) },
    coverage: { nodes, names: Object.keys(sorted).length, variants, mainNotables: notables, excludedEmptyPlaceholders: excluded },
    passives: sorted,
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const data = await buildPassives()
  const target = new URL('../json/passivesNotable.json', import.meta.url)
  if (process.argv.includes('--check')) {
    assert.deepEqual(JSON.parse(await readFile(target, 'utf8')), data, 'Passive snapshot differs from source; run node scripts/update-passives.mjs')
  } else {
    await writeFile(target, JSON.stringify(data, null, 2) + '\n')
  }
  console.log(JSON.stringify(data.coverage, null, 2))
}
