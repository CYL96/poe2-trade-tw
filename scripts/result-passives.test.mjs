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

async function matcher(passives = snapshot.passives) {
  const context = vm.createContext({
    chrome: {
      storage: { local: { get(key, callback) {
        callback(key === 'language' ? { language: 'zh_tw' } : {
          cache_zh_tw: { stats: { result: [] } }, cache_us: { stats: { result: [] } },
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
