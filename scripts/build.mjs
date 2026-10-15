import {cp,mkdir,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist');
for(const path of ['index.html','style.css','src','favicon.svg']) await cp(path,`dist/${path}`,{recursive:true});
console.log('Built static game in dist/');
