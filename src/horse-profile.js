/** Evidence-only, spoiler-safe information about cards already placed. */
const esc=value=>String(value??'').replace(/[&<>"']/g,x=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[x]);
const HTTPS=/^https:\/\/(?:www\.wikidata\.org|ja\.wikipedia\.org|en\.wikipedia\.org|www\.jra\.go\.jp|jra\.jp|www\.jbis\.or\.jp|www\.jbis\.jp|prc\.jp|www\.breeders\.co\.jp|world\.jra-van\.jp|commons\.wikimedia\.org)\//;
const IMAGE=/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//;

/** Return only source-checked, user-useful content. No parents/descendants. */
export function horseProfileHtml(horse,{profile,photo,articleUrl,sexLabel}={}){
 if(!horse || !horse.id)return '';
 const victories=Array.isArray(profile?.majorWins)?profile.majorWins.filter(w=>w&&typeof w.race==='string').slice(0,5):[];
 const record=profile?.raceRecord;
 const validRecord=record&&Number.isInteger(record.starts)&&Number.isInteger(record.wins)&&
  record.starts>=0&&record.starts<=200&&record.wins>=0&&record.wins<=record.starts;
 const description=typeof profile?.description==='string'?profile.description:'';
 const header='<div class="horse-profile-heading"><h2>'+esc(horse.name)+'</h2>'+
   '<p class="horse-profile-meta">'+[
    Number.isInteger(horse.birthYear)?horse.birthYear+'年生':null,sexLabel||null
   ].filter(Boolean).map(esc).join(' · ')+'</p>'+
   (description?'<p class="horse-profile-description">'+esc(description)+'</p>':'')+'</div>';
 const picture=photo&&IMAGE.test(photo.photoUrl||'')?
  '<img class="horse-profile-photo" src="'+esc(photo.photoUrl)+'" alt="'+esc(horse.name)+'の写真" loading="lazy" decoding="async">':'';
 const photoCredit=photo&&typeof photo.filePage==='string'&&photo.filePage.startsWith('https://commons.wikimedia.org/')?
  '<div class="horse-profile-photo-credit">'+esc(photo.artist||'')+' · <a target="_blank" rel="noopener noreferrer" href="'+esc(photo.filePage)+'">'+esc(photo.license||'写真の出典')+'</a></div>':'';
 const achievement=victories.length?
  '<section class="horse-profile-achievements"><h3>主な勝ち鞍</h3><ul>'+victories.map(w=>
   '<li>'+esc(w.race)+(Number.isInteger(w.year)?'（'+w.year+'年）':'')+'</li>').join('')+'</ul></section>':'';
 const career=validRecord?'<p class="horse-profile-record">競走成績 <strong>'+record.starts+'戦'+record.wins+'勝</strong></p>':'';
 const sources=Array.isArray(profile?.sources)?profile.sources.filter(s=>
  s&&typeof s.label==='string'&&HTTPS.test(s.url||'')):[];
 if(!sources.length&&articleUrl&&HTTPS.test(articleUrl))
  sources.push({url:articleUrl,label:'Wikipediaの記事'});
 const links=sources.slice(0,3).map(s=>
  '<a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.label)+'</a>').join(' · ');
 const empty=!achievement&&!career&&!description?
  '<p class="horse-profile-empty">競走成績などの情報はまだありません。</p>':'';
 return '<section class="horse-profile" aria-label="配置済みの競走馬プロフィール">'+
  (picture?'<div class="horse-profile-visual">'+picture+'</div>':'')+
  header+career+achievement+empty+
  (links?'<div class="horse-profile-sources">出典：'+links+'</div>':'')+
  photoCredit+'</section>';
}
