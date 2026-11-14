import {cp,mkdir,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist');
await mkdir('dist/data');
for(const path of ['index.html','style.css','sports-card.css','launch.css','manifest.webmanifest','src','favicon.svg']) await cp(path,`dist/${path}`,{recursive:true});
await cp('data/horse-pedigree.v1.json','dist/data/horse-pedigree.v1.json');
console.log('Built static game in dist/');
