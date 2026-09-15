import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {AGENT_CAPABILITIES} from '../agents/definitions.mjs';
export const SKILL_IDS=['react','frontend','css','backend','api','nodejs','python','cpp','git','debugging','testing','code-review','document-analysis','pdf-analysis','paper-analysis','statistical-analysis','table-analysis','latex','research','writing','formatting'];
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../skills');
export async function loadSkills(agentId,requested=[]) {
  const capability=AGENT_CAPABILITIES[agentId];
  if(!capability||!Array.isArray(requested))throw Error('Agent Skill 설정이 올바르지 않습니다.');
  const selected=[...new Set([...capability.defaultSkills,...requested])];
  return Promise.all(selected.map(async id=>{
    if(!SKILL_IDS.includes(id)||!capability.availableSkills.includes(id))throw Error(`${agentId}에서 사용할 수 없는 Skill: ${id}`);
    const file=await realpath(path.join(root,id,'SKILL.md'));
    if(!file.startsWith(root+path.sep))throw Error('Skill 경로가 범위를 벗어났습니다.');
    const prompt=await readFile(file,'utf8');if(prompt.length>12000)throw Error('Skill 지침이 너무 큽니다.');
    return {id,prompt,file};
  }));
}
export async function availableSkills(agentId) {
  const capability=AGENT_CAPABILITIES[agentId];
  if(!capability)throw Error('Agent Skill 설정이 올바르지 않습니다.');
  return loadSkills(agentId,capability.availableSkills);
}
export function composePrompt({basePrompt='',agentRole='',task='',skills=[],available=[],projectContext='',constraints='',outputFormat=''}) {
  const catalog=available.filter(skill=>!skills.some(selected=>selected.id===skill.id));
  return [['BASE SYSTEM RULES',basePrompt],['AGENT ROLE',agentRole],['CURRENT TASK',task],['SELECTED SKILLS',skills.map(skill=>`## ${skill.id}${skill.file?`\nSkill 파일: ${skill.file}`:''}\n${skill.prompt}`).join('\n\n')],['AVAILABLE SKILLS',catalog.length?'현재 작업에 필요한 내장 Skill을 선택하고 아래 지침을 적용하세요. 사용한 Skill을 결과에 명시하세요.\n'+catalog.map(skill=>`## ${skill.id}\nSkill 파일: ${skill.file}\n${skill.prompt}`).join('\n\n'):''],['PROJECT CONTEXT',projectContext],['CONSTRAINTS',constraints],['OUTPUT FORMAT',outputFormat]].filter(([,content])=>content).map(([title,content])=>`[${title}]\n${content}`).join('\n\n');
}
