import test from 'node:test'
import assert from 'node:assert/strict'
import { articleById, knowledgeArticles, knowledgeResources, knowledgeSections, learningGoals, searchKnowledge } from '../src/knowledgeCatalog.ts'

test('Knowledge has exactly three primary sections and all required platform pages', () => {
  assert.deepEqual(knowledgeSections.map(section=>section.id),['models','platforms','better'])
  const platforms=knowledgeArticles.filter(item=>item.section==='platforms'&&item.kind==='platform')
  assert.deepEqual(new Set(platforms.map(item=>item.title)),new Set(['ChatGPT','OpenAI Codex','Claude','Claude Code','Gemini','Grok','Cursor','Ollama','OpenCode','LM Studio','ComfyUI','StarNet','Comfy Cloud']))
})

test('model families and task paths cover the requested learning areas', () => {
  for (const id of ['gpt','claude','gemini','grok','qwen','deepseek','mistral','gemma','local-models']) assert.ok(articleById(`family-${id}`),`${id} family article exists`)
  assert.equal(learningGoals.length,6)
  for (const goal of learningGoals) assert.ok(articleById(goal.articleId),`${goal.id} path exists`)
  assert.ok(articleById('coding-task-template')?.levels.Intermediate[0].includes('Failure recovery'))
  assert.ok(articleById('memory-types')?.levels.Advanced[0].includes('retention'))
})

test('every article has substantial three-level guidance and an HTTPS source', () => {
  assert.ok(knowledgeArticles.length>=44)
  const ids=new Set<string>()
  for (const item of knowledgeArticles) {
    assert.ok(!ids.has(item.id),`duplicate article id ${item.id}`);ids.add(item.id)
    for (const level of ['Beginner','Intermediate','Advanced'] as const) assert.ok(item.levels[level].some(text=>text.trim().length>=45),`${item.id} has substantive ${level} guidance`)
    assert.ok(item.sources.length>0,`${item.id} has a source`)
    for (const ref of item.sources) assert.equal(new URL(ref.url).protocol,'https:')
  }
})

test('search is local and filters by section, tags, family, and topic', () => {
  assert.ok(searchKnowledge('quantization','models').some(item=>item.id==='context-quantization'))
  assert.ok(searchKnowledge('permissions','better').some(item=>item.id==='agent-permissions'))
  assert.ok(searchKnowledge('Ollama').some(item=>item.id==='platform-ollama'))
  assert.equal(searchKnowledge('not a real EZ AI topic').length,0)
})

test('resource library documents maintainer, status, setup, privacy, and valid official repository identity', () => {
  assert.equal(knowledgeResources.length,8)
  const resourceIds=new Set<string>()
  for (const item of knowledgeResources) {
    assert.ok(!resourceIds.has(item.id));resourceIds.add(item.id)
    assert.ok(item.maintainer&&item.supports.length&&item.solves&&item.setup&&item.privacy&&item.verifiedAt)
    assert.ok(['Official','Community'].includes(item.status))
    assert.equal(new URL(item.repository).hostname,'github.com')
    assert.match(item.repository,/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
  }
})


test('expanded practical lessons preserve original pages and distinct three-level content',()=>{
 for(const id of ['codex-project-instructions','codex-skills-memory','phase-recovery','local-agent-setup','comfyui-workflow-basics','lora-practical-guide']){
  const a=articleById(id)!; assert.ok(a);assert.ok(a.levels.Beginner.length>=3);assert.notDeepEqual(a.levels.Beginner,a.levels.Advanced)
 }
 assert.deepEqual(knowledgeSections.map(s=>s.title),['Understand AI','Apps & Pricing','Improve Your AI'])
 const l=articleById('lora-practical-guide')!;const text=Object.values(l.levels).flat().join(' ');for(const word of ['base model','strength','reference','Training','license','Troubleshoot'])assert.ok(text.toLowerCase().includes(word.toLowerCase()))
})

import {gitLessons,gitExamples} from '../src/gitLearning.ts'
test('GitHub path has practical Git/LFS source-backed lessons and copyable safe steps',()=>{
 assert.equal(gitLessons.length,8)
 for(const lesson of gitLessons){assert.ok(articleById(lesson.id));assert.equal(lesson.sources[0].url.startsWith('https://docs.github.com/'),true)}
 assert.match(gitExamples['github-lfs'],/git lfs track/);assert.match(gitExamples['github-checkpoints'],/git diff --staged/)
 assert.ok(gitLessons.some(a=>a.levels.Beginner.join(' ').includes('100 MiB')))
 assert.ok(gitLessons.some(a=>a.levels.Beginner.join(' ').includes('10 GiB')))
})
