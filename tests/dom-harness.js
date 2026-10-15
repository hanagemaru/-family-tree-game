// A deliberately small, non-rendering DOM/event shim for app integration tests.
// This tests the real app handlers, not browser layout or Safari behavior.
import {readFileSync} from 'node:fs';
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#39;',"'");
class Element{
 constructor(tag,env){this.tagName=tag.toLowerCase();this.env=env;this.children=[];this.parentElement=null;this.attributes={};this.dataset={};this.style={};this.listeners={};this._text='';this.disabled=false;this.hidden=false;this.open=false;this.captures=new Set();}
 get id(){return this.attributes.id||'';}set id(id){this.attributes.id=id;}
 get className(){return this.attributes.class||'';}set className(value){this.attributes.class=value;}
 get classList(){const element=this;return {contains:name=>element.className.split(/\s+/).includes(name),add:(...names)=>{element.className=[...new Set([...element.className.split(/\s+/).filter(Boolean),...names])].join(' ');},remove:(...names)=>{element.className=element.className.split(/\s+/).filter(x=>!names.includes(x)).join(' ');},toggle(name,force){const has=this.contains(name),next=force===undefined?!has:force;if(next)this.add(name);else this.remove(name);return next;}};}
 setAttribute(name,value){this.attributes[name]=String(value);if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);if(name==='disabled')this.disabled=true;if(name==='hidden')this.hidden=true;if(name==='style')for(const entry of String(value).split(';')){const colon=entry.indexOf(':');if(colon>=0)this.style[entry.slice(0,colon).trim()]=entry.slice(colon+1).trim();}}
 getAttribute(name){return this.attributes[name]??null;}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}set textContent(value){this._text=String(value);this.children=[];}
 set innerHTML(html){this.children=[];this._text='';const stack=[this];for(const token of String(html).match(/<[^>]+>|[^<]+/g)||[]){if(token.startsWith('<!'))continue;if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}if(token.startsWith('<')){const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;const element=new Element(tag,this.env),attributes=token.slice(tag.length+1,-1);for(const match of attributes.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))element.setAttribute(match[1],decode(match[2]??match[3]??match[4]??''));const parent=stack.at(-1);element.parentElement=parent;parent.children.push(element);if(!['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'].includes(tag)&&!token.endsWith('/>'))stack.push(element);}else stack.at(-1)._text+=decode(token);}}
 matches(selector){return selector.split(',').some(item=>{const s=item.trim();if(s.startsWith('#'))return this.id===s.slice(1);if(s.startsWith('.'))return this.classList.contains(s.slice(1));if(s.startsWith('[')){const m=s.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return !!m&&this.getAttribute(m[1])!==null&&(m[2]===undefined||this.getAttribute(m[1])===m[2]);}return this.tagName===s;});}
 querySelectorAll(selector){const results=[];for(const c of this.children){if(c.matches(selector))results.push(c);results.push(...c.querySelectorAll(selector));}return results;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 closest(selector){for(let n=this;n;n=n.parentElement)if(n.matches(selector))return n;return null;}
 addEventListener(type,listener){(this.listeners[type]||=[]).push(listener);}
 fire(type,props={}){const event={type,target:this,button:0,detail:1,pointerId:1,clientX:0,clientY:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...props};for(let n=this;n;n=props.bubbles===false?null:n.parentElement)for(const fn of n.listeners[type]||[])fn(event);return event;}
 click(props={}){if(!this.disabled)this.fire('click',props);}
 setPointerCapture(id){this.captures.add(id);}hasPointerCapture(id){return this.captures.has(id);}releasePointerCapture(id){this.captures.delete(id);}
 focus(){}showModal(){this.open=true;}close(){this.open=false;this.fire('close',{bubbles:false});}
 get clientWidth(){return this.id==='board'?360:0;}get clientHeight(){return this.id==='board'?300:0;}
 getBoundingClientRect(){if(this.id==='board')return {left:16,top:180,right:376,bottom:480,width:360,height:300};return {left:0,top:0,right:44,bottom:44,width:44,height:44};}
}
let run=0;
export async function loadApp(saved){
 const originals=new Map(['document','window','localStorage','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','setInterval','performance'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const env={now:0,timers:[]},root=new Element('document',env);root.innerHTML=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const document=root;document.getElementById=id=>root.querySelector('#'+id);document.body=root.querySelector('body');document.hidden=false;
 const window=new Element('window',env);window.scrollTo=()=>{};
 const values=new Map(saved?[['family-tree-game:v1',JSON.stringify(saved)]]:[]);
 const globals={document,window,localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},ResizeObserver:class{observe(){}},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},setInterval:fn=>{env.timers.push(fn);return env.timers.length;},performance:{now:()=>env.now}};
 for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 await import(`../src/app.js?dom-test=${++run}`);
 const $=id=>document.getElementById(id);
 return {$,window,document,storage:()=>JSON.parse(values.get('family-tree-game:v1')),advance(ms){env.now+=ms;env.timers.forEach(fn=>fn());},restore(){for(const [key,descriptor] of originals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}};
}
