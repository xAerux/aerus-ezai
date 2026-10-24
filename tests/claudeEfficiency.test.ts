import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { articleById, searchKnowledge } from '../src/knowledgeCatalog.ts'
import { efficiencyPitfalls, efficiencyPlaybook, efficiencySources, efficiencyStrategies, effortLevels } from '../src/claudeEfficiencyContent.ts'

test('Claude and Codex Crunch live in Tools instead of the Knowledge lesson catalog',()=>{
 assert.equal(articleById('claude-token-efficiency'),undefined)
 assert.ok(!searchKnowledge('Claude Token Efficiency','better').some(a=>a.id==='claude-token-efficiency'))
 const knowledge=readFileSync(new URL('../src/KnowledgeCenter.tsx',import.meta.url),'utf8')
 const tools=readFileSync(new URL('../src/AerusToolsShowcase.tsx',import.meta.url),'utf8')
 assert.doesNotMatch(knowledge,/AerusCrunchGuides|Aerus Claude Crunch|Aerus Codex Crunch/)
 assert.match(tools,/AerusCrunchGuides/)
 assert.match(tools,/Aerus Claude Crunch/)
 assert.match(tools,/Aerus Codex Crunch/)
})

test('the settings panel offers a saved color wheel and three full-range appearance sliders',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
 const styles=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8')
 assert.match(app,/aerus-theme-v1/)
 assert.match(app,/aria-label="Accent color wheel"/)
 assert.equal((app.match(/type="range" min="0" max="100"/g)||[]).length,3)
 assert.match(styles,/\.compact \.page-installers \.installer-card\{min-height:120px/)
 assert.match(styles,/\.compact \.topbar\{height:58px\}/)
})

test('Claude Crunch provides editable, local-only Memory and project CLAUDE.md prompts',()=>{
 const component=readFileSync(new URL('../src/AerusCrunchGuides.tsx',import.meta.url),'utf8')
 assert.match(component,/ez-ai-claude-memory-prompt-v1/)
 assert.match(component,/ez-ai-claude-md-prompt-v1/)
 assert.match(component,/Tell Claude what to change/)
 assert.match(component,/project-specific CLAUDE\.md/)
 assert.match(component,/wait for my approval before changing Memory/)
 assert.match(component,/do not overwrite or create files until I approve/)
 assert.match(component,/EZ AI does not connect to Claude/)
})
test('the guide preserves fourteen ranked strategies, ten pitfalls and the practical playbook',()=>{
 assert.equal(efficiencyStrategies.length,14)
 assert.deepEqual(efficiencyStrategies.map(s=>s.rank),Array.from({length:14},(_,i)=>i+1))
 assert.equal(efficiencyPitfalls.length,10)
 assert.equal(efficiencyPlaybook.length,8)
 assert.ok(efficiencyStrategies.some(s=>s.title.includes('Claude Mem')||s.detail.includes('claude-mem')))
})

test('effort comparison and monthly estimate use the supplied snapshot numbers',()=>{
 assert.deepEqual(effortLevels.map(x=>[x.name,x.cost,x.index]),[['Low',0.41,36],['Medium',0.59,41],['High',1.08,47],['Xhigh',2.74,52],['Max',7.6,56]])
 assert.equal(Math.round(25*4.33*0.59),64)
 assert.equal(Math.round(25*4.33*7.6),823)
})

test('bundled citations are HTTPS and evidence classes are present',()=>{
 assert.ok(efficiencySources.length>=35)
 for(const item of efficiencySources) assert.equal(new URL(item.url).protocol,'https:')
 for(const kind of ['Official','Independent','Author-measured','Vendor claim']) assert.ok(efficiencyStrategies.some(s=>s.evidence.includes(kind as never)))
})

test('the guide remains educational and the Pricing shortcut selects the existing calculator',()=>{
 const component=readFileSync(new URL('../src/ClaudeEfficiencyGuide.tsx',import.meta.url),'utf8')
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
 assert.match(app,/ez-ai-value-view-v1/)
 assert.match(component,/Open Pricing → Save Money calculator/)
 assert.doesNotMatch(component,/setup-claude-efficiency\.ps1|npx claude-mem install|plugin install/i)
 assert.match(component,/NO SETTINGS CHANGED/)
})
