import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
fs.mkdirSync('worker',{recursive:true});
fs.writeFileSync('worker/version.mjs',`export const commit=${JSON.stringify(commit)};\n`);
fs.writeFileSync('frontend/dist/deployment.json',JSON.stringify({repository:'pierce403/cthulhu-launcher',commit,originalHerokuCommit:'e1dd5f0b2b9fd7be04a9aa70f3a2a6798e8b55ac'})+'\n');
