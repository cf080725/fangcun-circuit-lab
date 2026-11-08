const words=v=>(Array.isArray(v)?v.join(' '):String(v??'')).normalize('NFKC').toLowerCase().replace(/[‐‑–—_-]/g,' ').replace(/\s+/g,' ').trim();
const fields=item=>[item.name,item.id,item.chip,item.brand,item.family,item.category,...(item.tags||[]),...(item.interfaces||[]),item.description,item.bestFor,item.guide].map(words).join(' ');
export function matchHardware(items,query){
 const q=words(query),tokens=q.split(' ').filter(Boolean);if(!tokens.length)return [...items];
 const matches=items.filter(item=>{const text=fields(item),compact=text.replace(/\s/g,'');return tokens.every(t=>text.includes(t)||compact.includes(t.replace(/\s/g,'')));});
 if(/\d/.test(q)){const exact=matches.filter(item=>{const title=words([item.name,item.id,item.chip]).replace(/\s/g,'');return tokens.every(t=>title.includes(t.replace(/\s/g,'')));});if(exact.length)return exact;}
 return matches.sort((a,b)=>{const score=x=>words(x.name)===q?100:words(x.name).includes(q)?50:words(x.tags).includes(q)?20:0;return score(b)-score(a);});
}
export function normalizeBOM(input,boards,parts){
 if(!Array.isArray(input))return [];const maps={board:new Map(boards.map(x=>[x.id,x])),part:new Map(parts.map(x=>[x.id,x]))},out=[];
 for(const row of input.slice(0,200)){if(!row||typeof row.kind!=='string'||typeof row.id!=='string'||!Object.hasOwn(maps,row.kind))continue;const item=maps[row.kind].get(row.id);if(!item)continue;const rawQty=['number','string'].includes(typeof row.quantity)?Number(row.quantity):1,qty=Math.max(1,Math.min(99,Math.floor(Number.isFinite(rawQty)?rawQty:1))),found=out.find(x=>x.id===row.id&&x.kind===row.kind);if(found)found.quantity=Math.min(99,found.quantity+qty);else out.push({id:item.id,name:item.name,kind:row.kind,quantity:qty,source:item.source});}return out;
}
