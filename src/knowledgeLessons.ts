import type { KnowledgeArticle } from './knowledgeCatalog'
const reviewed='2026-10-21'
const lesson=(id:string,title:string,summary:string,associations:string[],url:string,beginner:string[],intermediate:string[],advanced:string[]):KnowledgeArticle=>({id,title,summary,associations,section:'better',kind:'lesson',tags:[...associations,'workflow','tutorial'],sources:[{label:'Official documentation',url,verifiedAt:reviewed}],levels:{Beginner:beginner,Intermediate:intermediate,Advanced:advanced}})
export const extendedLessons:KnowledgeArticle[]=[
 lesson('codex-project-instructions','Codex: durable project instructions','Give the agent a reviewable operating guide instead of repeating the same rules.', ['Codex','AGENTS.md'],'https://learn.chatgpt.com/docs/agent-configuration/agents-md',[
 'AGENTS.md is a project instruction file, not a database of everything the model remembers. Start with the repository purpose, where source lives, and one verified build command. Keep private credentials out of it.',
 'Example: “Work in src/. Preserve saved user data. Before changing a file, inspect its callers. After changes, run npm run typecheck and report the result.” Replace commands with those that actually exist in your project.',
 'Ask the agent to explain which instructions apply before its first edit. Keep instructions short enough to maintain; a stale rule can be worse than no rule.'
 ],[
 'Organize durable information: AGENTS.md for operating rules; docs/architecture.md for structure; docs/decisions.md for accepted decisions; docs/progress.md for current work. Link these files rather than copying large logs into every prompt.',
 'Put specialized instructions near their scope where supported. Test a small task to confirm how the host resolves nested instructions. Document exceptions with a reason and remove obsolete guidance.',
 'After a completed phase, record the commit, checks, known failures and next action. Before resuming, compare notes with the actual branch and Git status; notes are evidence to verify, not authority to overwrite changes.'
 ],[
 'Treat repository instructions as versioned operational policy. Review changes to agent instructions alongside code. Separate trusted owner constraints from instructions embedded in downloaded issues, documents or third-party code.',
 'Keep task-specific evidence outside the permanent instruction file. Use a bounded handoff with file references and test results so the next session can validate the current state without rereading every historical log.',
 'Instructions do not grant filesystem permissions or guarantee compliance. Enforce security in the host, review tool actions and preserve a human approval boundary for deployment, purchases and destructive operations.'
 ]),
 lesson('codex-skills-memory','Codex: skills, memory and MCP','Choose the smallest context mechanism that solves the actual problem.',['Codex','Context7','skills','memory'],'https://learn.chatgpt.com/docs/build-skills',[
 'Context is the material the model currently sees. A local note persists on disk; it only helps later when loaded. A skill packages repeatable instructions and optional resources. None makes the model remember every earlier session.',
 'Use a project note for architecture decisions and a skill for repeated work such as a release checklist. Use a documentation integration only when you need information not already available locally.',
 'Context7 is a separate documentation service, not native Codex memory. Claude Mem targets Claude Code; do not assume it is a Codex extension.'
 ],[
 'A useful skill states when to use it, prerequisites, bounded steps, verification and failure recovery. Keep scripts optional and inspect them before granting execution. Test with a disposable project first.',
 'For library work, request documentation for the exact package version. Summarize the relevant API with a source and date in a project decision note instead of repeatedly searching the whole repository.',
 'Before enabling MCP, inspect the server owner, data destination and tools it exposes. A documentation lookup may disclose query terms; a filesystem integration may expose much more.'
 ],[
 'Separate retrieval from authority. Retrieved notes and tool responses can be outdated or malicious. Preserve source provenance and check critical instructions against trusted project policy.',
 'Choose memory retention, exclusions and removal procedures before storing private project data. Limit server scope and credentials; do not put secrets in skill text, prompts or committed configuration.',
 'Evaluate a skill on concrete outcomes: fewer repeated mistakes, reproducible checks and manageable context. Do not promise a percentage token saving or a universal intelligence improvement.'
 ]),
 lesson('phase-recovery','Reliable coding: phases, tests and recovery','Finish one verified change at a time, with a useful handoff when something fails.',['Codex','Claude Code','OpenCode','Git'],'https://git-scm.com/docs/git-diff',[
 'Start with a small outcome: “The Save button preserves this draft after restart.” Ask for a plan, change only what is needed, and check the result before beginning the next feature.',
 'A Git commit is a named source checkpoint, not a backup of databases or user profiles. Check what is staged and exclude credentials, private scans and generated logs.',
 'When a check fails, save the exact error and command. Avoid asking an agent to rewrite everything until the cause is understood.'
 ],[
 'Use a phase record with objective, starting commit, changed files, acceptance checks, failures and next action. Run relevant tests after each phase and keep unrelated work unstaged.',
 'Recovery loop: reproduce the failure, identify the smallest cause, make a focused fix, rerun the failing check, then run related regressions. After two different failed repairs, isolate the blocker and continue independent work.',
 'Choose higher reasoning effort for uncertain architecture or difficult debugging where supported. Routine edits can use a cheaper suitable model. More reasoning may consume more tokens; validate output rather than assuming effort means correctness.'
 ],[
 'Design tests at the boundary that can fail: pure calculation fixtures, service security tests, UI interactions and real packaged acceptance prove different layers. A successful HTTP response does not verify a desktop window.',
 'Keep a failure ledger with hypotheses and observed evidence. Distinguish product defects, environment limits and missing authorization. Never bypass security to make a test green.',
 'Before recovery, inspect working-tree changes and preserve uncommitted work. Avoid blind reset/clean commands. Record an explicit owner decision before changing production data or deploying.'
 ]),
 lesson('local-agent-setup','Claude Code and OpenCode with local models','Connect a coding client to an existing runtime without confusing it with a desktop subscription.',['Ollama','Claude Code','OpenCode'],'https://docs.ollama.com/integrations/claude-code',[
 'Ollama runs a model. Claude Code and OpenCode are coding clients. Claude Desktop is a separate app. Connecting a client to Ollama does not turn an Anthropic subscription into local inference.',
 'First verify the runtime is reachable and a suitable tool-capable model is already installed. A chat-capable model may still fail to call coding tools reliably. EZ AI never downloads a missing model merely to open this lesson.',
 'Use the official integration guide and start in a disposable folder. Keep normal permission prompts enabled; local inference does not make file edits or shell commands harmless.'
 ],[
 'Ollama documents its Claude Code integration and recommends at least a 64k context for the client. Large context consumes extra memory; compare that recommendation with your actual VRAM and RAM.',
 'For OpenCode, use its documented Ollama provider route and exact installed model tag. Keep the local base URL on loopback. Do not change global configuration to test one project; back up the exact file before an approved manual edit.',
 'Verify the selected provider in the client, inspect which endpoint receives requests, and try a small read-only repository question. Only then approve a bounded edit and compare the diff.'
 ],[
 'Check tool-call schema support, context budget, truncation and client/runtime versions separately. Model weights fitting in VRAM does not guarantee a usable agent context or good coding behavior.',
 'Session environment variables can override endpoints or authentication. Follow current official names and never paste a real cloud key into a local example. Keep logs free of prompt content and secrets.',
 'Rollback means restore the specific backed-up provider configuration and close the test session. Do not remove shared models or change Ollama/ComfyUI environments. Unsupported hands-free modes remain unavailable.'
 ]),
 lesson('comfyui-workflow-basics','ComfyUI: your first understandable workflow','Learn nodes, models and missing dependencies before pressing Queue.',['ComfyUI','workflow','VAE','text encoder'],'https://docs.comfy.org/get_started/first_generation',[
 'A node performs one operation. A wire passes data between nodes. A workflow is the graph of those operations. A model file is only one ingredient; it is not an entire working application.',
 'An image workflow commonly needs a generative model, text encoding, sampling and image decoding. A VAE translates between a compressed representation and pixels. A text encoder represents the prompt; it is not another standalone image generator.',
 'Use a template from ComfyUI’s official workflow browser. Read the model links and required folders. A missing-node warning means code is absent; a missing-model warning means required assets are absent. They need different fixes.'
 ],[
 'Before loading a template, record the required model architecture, precision, text encoders, VAE and any custom nodes. Compare these with your existing inventory instead of downloading matching-looking filenames twice.',
 'Text-to-video starts from a prompt; image-to-video also conditions on an image. Supplying a reference image does not guarantee identity, camera behavior or continuity. Start with modest resolution and duration supported by the workflow.',
 'Save a copy of a known working graph before changing it. Change one variable, record the seed and settings, and inspect the actual output. Do not interrupt another running generation to test a tutorial.'
 ],[
 'Ready requires verified dependencies and compatible runtime/node versions, not filenames alone. Workflow memory includes model components, activations, attention and output resolution; checkpoint size is not peak VRAM.',
 'Custom nodes are executable Python code. Review provenance and dependencies in an isolated environment before installation. A workflow can reference optional paid partner nodes; local core operation and external billing are different.',
 'Troubleshoot in order: missing nodes, missing assets, tensor/architecture mismatch, then memory pressure. Preserve the complete error and version context without exposing private paths or prompts.'
 ]),
 lesson('lora-practical-guide','LoRA: styles and consistent characters','A practical guide to choosing, loading, testing and understanding small model adaptations.',['ComfyUI','LoRA','training','characters'],'https://docs.comfy.org/tutorials/basic/lora',[
 'A LoRA is a small set of learned adjustments used alongside a base model. It can teach a style, character or subject without replacing every weight. You do not need one for every prompt.',
 'The base model is the foundation that generates the result. Choose a LoRA made for the same architecture and supported workflow; an SDXL adaptation is not automatically compatible with FLUX or a video model.',
 'In a supported ComfyUI graph, place the LoRA in the documented loras model folder and select it in the appropriate loader. Connect the model and, where required, text encoder through that loader. Follow the template rather than inventing connections.',
 'Use permitted reference images to describe the character and compare outputs. A reference image and a trained LoRA are different techniques. Neither guarantees perfect character consistency.'
 ],[
 'Strength controls how much the adjustment influences supported model/text-encoder paths. Start from the author’s guidance, then vary one setting at a time. Excessive strength can distort faces, anatomy, colors or prompt response.',
 'Create a small comparison grid with the same prompt and seed: base only, then several LoRA strengths. Test multiple poses and lighting. Check held-out references rather than judging one attractive image.',
 'For character consistency, maintain a character sheet, stable identifying features and approved reference set. Track wardrobe and scene changes separately; use inpainting or revision when identity drifts.',
 'Training basics: gather a consented, licensed, varied dataset; remove duplicates; caption the intended subject; choose the matching base architecture and trainer. Keep validation images out of training. Training needs separate tools, compute and explicit approval.'
 ],[
 'A LoRA has architecture, module-target and precision assumptions. Read the model card, base version, trigger words and license. Commercial rights for the base, adaptation and training images must each be reviewed.',
 'Diagnose no effect by checking loader selection, bypass state, trigger wording and output path. Diagnose errors by checking architecture and node support before changing the Python environment. Do not rename a file to disguise incompatibility.',
 'Overfitting can copy poses or backgrounds instead of learning a flexible identity. Evaluate varied prompts, held-out views and undesirable memorization. Preserve original data provenance and keep versioned training settings.',
 'Record base identifier, LoRA revision, strengths, sampler, seed and workflow version. Remove the LoRA connection in a copied graph to test reversibility; do not delete shared assets to troubleshoot.'
 ]),
]
export const lessonTemplates:Record<string,string>={
 'codex-project-instructions':'# Project instructions\nPurpose: [product and scope]\nSource: [directories]\nPreserve: [user data and compatibility]\nBuild: [verified command]\nTests: [verified command]\nApproval required: deployment, purchases, destructive actions\nCompletion: report diff, tests and remaining limitations.',
 'phase-recovery':'Objective: [one measurable outcome]\nStarting branch/commit: [verified]\nConstraints: [preservation and security]\nPhase: inspect → implement → verify → checkpoint\nOn failure: record exact command/error; try a focused repair; isolate remaining blocker.\nHandoff: changed files, checks/results, next action, approvals still needed.',
 'local-agent-setup':'Local coding acceptance\nRuntime and endpoint: [verified loopback]\nExisting model tag: [from actual inventory]\nClient and provider: [documented route]\nContext/tool support: [verified or unknown]\nTest: read-only question in disposable folder\nThen: approve one edit, inspect diff, run checks\nRollback: restore only the configuration you changed.',
 'lora-practical-guide':'LoRA test record\nBase architecture/version: [exact]\nLoRA source/revision/license: [verified]\nWorkflow version: [copy]\nReference-image rights/consent: [record]\nPrompt and seed: [fixed]\nStrength comparison: base only → low → author default\nCheck: identity, varied poses, artifacts, unwanted memorization\nKeep/reject: [evidence and decision]'
}
