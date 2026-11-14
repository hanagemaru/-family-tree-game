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
