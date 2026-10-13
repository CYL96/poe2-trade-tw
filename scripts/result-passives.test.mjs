import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const source = await readFile(new URL('../js/result.js', import.meta.url), 'utf8')
const snapshot = JSON.parse(await readFile(new URL('../json/passivesNotable.json', import.meta.url), 'utf8'))
const chakra = [
  '30% increased Stun Recovery',
  'Regenerate 3% of maximum Life over 1 second when Stunned',
  '+1 to Stun Threshold per Dexterity',
]

async function matcher(passives = snapshot.passives, language = 'zh_tw') {
  const context = vm.createContext({
    chrome: {
      storage: { local: { get(key, callback) {
        callback(key === 'language' ? { language } : {
          [`cache_${language}`]: { stats: { result: [] } }, cache_us: { stats: { result: [] } },
        })
      } } },
      runtime: { getURL: (path) => path },
    },
    fetch: async (path) => ({ json: async () => path.endsWith('passivesNotable.json') ? { passives } : {} }),
    MutationObserver: class { observe() {} },
    document: { documentElement: {} },
    window: { setTimeout() {} },
  })
  vm.runInContext(source, context)
  await new Promise((resolve) => setImmediate(resolve))
  return vm.runInContext('matchPassive', context)
}

const match = await matcher()

test('Megalomaniac effects match in all six orders without changing translation', () => {
  for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
    const translated = match('Chakra of Stability', order.map((index) => chakra[index]).join('\n'))
    assert.equal(translated.name, '穩定脈輪')
    assert.deepEqual(Array.from(translated.desc), snapshot.passives['Chakra of Stability'][0].zh_tw.desc)
  }
  assert.equal(match('Strong Chin', snapshot.passives['Strong Chin'][0].en.desc.join('\n')).name, '強力下顎')
})

test('Cluster Bombs accepts one additional projectile grammar without guessing quantities', () => {
  const detonation = '50% increased Grenade Detonation Time'
  const projectile = 'Grenade Skills Fire an additional Projectile'
  for (const text of [projectile, 'Grenade Skills Fire 1 additional Projectile', 'Grenade Skills Fire 1 additional Projectiles']) {
    const translated = match('Cluster Bombs', `${detonation}\n${text}`)
    assert.equal(translated?.name, '團簇炸彈')
    assert.deepEqual(Array.from(translated.desc), ['增加50%擲彈引爆時間', '擲彈技能發射額外1個投射物'])
  }
  assert.equal(match('Cluster Bombs', `${projectile}\n${detonation}`)?.name, '團簇炸彈')
  for (const text of [
    'Grenade Skills Fire 2 additional Projectiles', 'Grenade Skills Fire -1 additional Projectile',
    'Grenade Skills Fire no additional Projectile', `${projectile} when Stunned`,
  ]) assert.equal(match('Cluster Bombs', `${detonation}\n${text}`), undefined)
  assert.equal(match('Cluster Bombs', `51% increased Grenade Detonation Time\n${projectile}`), undefined)
  assert.equal(match('Cluster Bombs', projectile), undefined)
})

test('counted effect grammar covers other passive families without discarding counts or conditions', () => {
  const cases = [
    ['Pierce the Heart', 'Arrows Pierce an additional Target'],
    ['Vocal Empowerment', 'Warcries Empower an additional Attack'],
    ["Hunter's Talisman", '+1 Charm Slot'],
    ['Intricate Sigils', '+1 Charm Slot'],
    ['One with the Storm', 'Quarterstaff Skills that consume Power Charges count as consuming 1 additional Power Charge'],
    ['One with the Storm', 'Quarterstaff Skills that consume Power Charges count as consuming an additional Power Charge'],
    ['Martial Adept', 'When you gain Combo, gain an additional Combo'],
    ['Reactive Growth', 'Adapt 1 time to the highest Elemental Damage Type of each Hit you take'],
    ['Reactive Growth', 'Adapt to the highest Elemental Damage Type of each Hit you take'],
    ["The Mórrigan's Guidance", 'Gain 1 Vivid Wisp when Vivid Stampede ends'],
    ["The Mórrigan's Guidance", 'Gain a Vivid Wisp when Vivid Stampede ends'],
    ['Sanguine Tides', 'Gain 1 Life Flask Charge per 2% Life spent'],
    ['Incessant Cacophony', 'You can apply 1 additional Curses'],
    ['Whispers of Doom', 'You can apply 1 additional Curse'],
    ['Vale Shelter', 'Charms gain 0.15 charge per Second'],
    ['Augmented Flesh', 'Grants 2 additional Skill Slot'],
    ['Passive Point', 'Grants 1 Passive Skill Point'],
    ['Passive Points', 'Grants 1 Passive Skill Point'],
    ['Run and Gun', 'Projectile Attacks have a 12% chance to fire 2 additional Projectiles while moving'],
    ['Quick Fingers', '+24% Surpassing chance to fire 1 additional Arrows'],
    ['Grenadier', 'Grenade Skills have +1 Cooldown Use'],
    ['Draiocht Cleansing', 'Remove a Curse after Channelling for 2 seconds'],
  ]
  for (const [name, line] of cases) {
    const original = snapshot.passives[name][0]
    const effects = original.en.desc.join('\n')
    const replacementIndex = original.en.desc.findIndex((effect) =>
      effect.toLowerCase().split(/\s+/)[0] === line.toLowerCase().split(/\s+/)[0])
    assert.ok(replacementIndex >= 0, name)
    const page = original.en.desc.with(replacementIndex, line).join('\n')
    const localized = match(name, page)
    assert.equal(localized?.name, original.zh_tw.name, `${name}: ${line}`)
    assert.deepEqual(Array.from(localized.desc), original.zh_tw.desc, name)
    assert.equal(match(name, `${page}\n${line}`), undefined, `${name}: duplicate`)
    assert.equal(match(name, page.replace(line, `${line} when Frozen`)), undefined, `${name}: extra condition`)
    assert.equal(match(name, effects)?.name, original.zh_tw.name, `${name}: original`)
  }
  for (const [name, page] of [
    ['Pierce the Heart', 'Arrows Pierce 2 additional Targets'],
    ['Vocal Empowerment', 'Warcries Empower -1 additional Attacks'],
    ["Hunter's Talisman", '-1 Charm Slot'],
    ['Vale Shelter', 'Charms gain 0.16 charge per Second'],
    ['One with the Storm', 'Quarterstaff Skills that consume Frenzy Charges count as consuming 1 additional Power Charge'],
    ['Reactive Growth', 'Adapt 2 times to the highest Elemental Damage Type of each Hit you take'],
    ['Reactive Growth', 'Adapt to the lowest Elemental Damage Type of each Hit you take'],
  ]) assert.equal(match(name, page), undefined, name)
})

test('every localized snapshot variant preserves effects when reordered or rewrapped', async () => {
  for (const language of ['zh_tw', 'zh_cn']) {
    const localizedMatch = language === 'zh_tw' ? match : await matcher(snapshot.passives, language)
    for (const [name, entries] of Object.entries(snapshot.passives)) {
      for (const entry of entries) {
        if (!entry.en.desc.length) continue
        const reversed = [...entry.en.desc].reverse()
        for (const page of [reversed.join('\n'), reversed.join(' ').replace(/ /g, '\n')]) {
          const localized = localizedMatch(name, page)
          assert.equal(localized?.name, entry[language].name, `${language}: ${name}: ${entry.ids}`)
          assert.deepEqual(Array.from(localized.desc), entry[language].desc, `${language}: ${name}: ${entry.ids}`)
        }
      }
    }
  }
})

test('snapshot-wide numeric changes never select a stale same-name effect', () => {
  for (const [name, entries] of Object.entries(snapshot.passives)) {
    for (const entry of entries) {
      const text = entry.en.desc.join('\n')
      if (!/\d/.test(text)) continue
      const changed = text.replace(/\d+(?:\.\d+)?/, '987654321')
      assert.equal(match(name, changed), undefined, `${name}: ${entry.ids}`)
    }
  }
})

test('complete effects may wrap or share lines; names ignore case and whitespace', () => {
  const effects = chakra.join(' ').replace('maximum Life', 'maximum\nLife').toUpperCase()
  assert.equal(match('  CHAKRA\n OF   STABILITY  ', effects).name, '穩定脈輪')
})

test('changed values, signs, conditions, missing, extra and duplicated effects remain English', () => {
  const effects = chakra.join('\n')
  for (const changed of [
    effects.replace('30%', '31%'), effects.replace('+1', '-1'),
    effects.replace('when Stunned', 'when Frozen'),
    chakra.slice(0, 2).join('\n'), `${effects}\n${chakra[0]}`,
    [chakra[0], chakra[0], chakra[2]].join('\n'),
  ]) assert.equal(match('Chakra of Stability', changed), undefined)
  assert.equal(match('Unknown Passive', effects), undefined)
})

test('same-name variants select the actual complete effect, never just the name', () => {
  assert.deepEqual(Array.from(match('Accuracy', '12% increased Accuracy Rating').desc), ['增加12%命中值'])
  assert.deepEqual(Array.from(match('Accuracy', '8% increased Accuracy Rating').desc), ['增加8%命中值'])
  assert.equal(match('Accuracy', '13% increased Accuracy Rating'), undefined)
})

test('existing equivalent cooldown and curse grammar remains accepted', async () => {
  const local = await matcher({ Grammar: [{
    en: { name: 'Grammar', desc: ['Skills have +1 Cooldown Use', 'Remove a Curse when Hit'] },
    zh_tw: { name: '語法', desc: ['技能冷卻次數+1', '被擊中時移除一個詛咒'] },
  }] })
  assert.equal(local('Grammar', 'Remove up to 1 Curses when Hit\nSkills have +1 Cooldown Uses').name, '語法')
  assert.equal(local('Grammar', 'Remove up to 2 Curses when Hit\nSkills have +1 Cooldown Uses'), undefined)
})

test('prefix overlap backtracks, effect multiplicity is retained, ambiguity is refused', async () => {
  const variant = (desc, name) => ({ en: { name: 'Overlap', desc }, zh_tw: { name, desc: ['效果'] } })
  const local = await matcher({
    Overlap: [variant(['A', 'AB', 'A'], '重疊')],
    Ambiguous: [variant(['A', 'B'], '甲'), variant(['B', 'A'], '乙')],
  })
  assert.equal(local('Overlap', 'AB A A').name, '重疊')
  assert.equal(local('Overlap', 'AB A'), undefined)
  assert.equal(local('Overlap', 'AB B A'), undefined)
  assert.equal(local('Ambiguous', 'B A'), null)
})
