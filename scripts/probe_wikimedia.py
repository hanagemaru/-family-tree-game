"""Probe Wikimedia's public APIs with low-volume requests before starting batch research."""
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen
from urllib.error import URLError
import json, time

USER_AGENT = "HanagePedigreeResearch/0.1 (open-source horse card game; source attribution)"
queries = [
 ("wikidata", "https://www.wikidata.org/w/api.php?" + urlencode({"action":"wbgetentities","ids":"Q7939315","props":"sitelinks|labels","format":"json"})),
 ("japanese-wikipedia", "https://ja.wikipedia.org/w/api.php?" + urlencode({"action":"query","prop":"revisions","rvprop":"content","rvslots":"main","titles":"ウオッカ (競走馬)","format":"json"})),
 ("japanese-rest", "https://ja.wikipedia.org/w/rest.php/v1/page/" + quote("ウオッカ_(競走馬)") + "/html")
]
for name,url in queries:
 try:
  with urlopen(Request(url,headers={"User-Agent":USER_AGENT,"Accept":"application/json,text/html"}),timeout=15) as resp:
   body=resp.read(200000)
   print(name,"HTTP",resp.status,"bytes",len(body),"sample",body[:300].decode('utf-8','replace').replace('\n',' '))
 except Exception as exc:
  print(name,"ERROR",type(exc).__name__,str(exc))

# Inspect only the infobox parameter lines, never dump full copyrighted articles.
import re
for horse in ["ウオッカ (競走馬)","トウカイテイオー","マカヒキ (競走馬)","パンサラッサ (競走馬)","レッドベルオーブ","レッドルゼル"]:
 url="https://ja.wikipedia.org/w/api.php?"+urlencode({"action":"query","prop":"revisions","rvprop":"content|ids","rvslots":"main","titles":horse,"format":"json","formatversion":"2"})
 try:
  with urlopen(Request(url,headers={"User-Agent":USER_AGENT}),timeout=15) as resp:
   data=json.load(resp)
  pages=data.get("query",{}).get("pages",[])
  page=pages[0] if pages else {}
  text=(page.get("revisions",[{}])[0].get("slots",{}).get("main",{}).get("content","") if page.get("revisions") else "")
  mother=re.findall(r'(?m)^\s*\|\s*(?:母|母馬|[Dd]am|[Mm]other)\s*=.*$',text[:12000])
  print("SAMPLE",horse,"wikiTitle",page.get("title"),"exists",not page.get("missing"),"mother-raw",mother[:3])
 except Exception as exc:
  print("SAMPLE",horse,"ERROR",type(exc).__name__,str(exc))
