import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXTRA_RESOURCES } from '../dist/catalog-data.js';
import {
  RESOURCE_ROUTES,
  createResourceLibraryModel,
  learningTrack,
  localPDFPath,
  mountResourceLibrary,
  prepareResources,
  readingGuide,
  resourceSourceKind,
  safeResourceURL,
} from '../dist/resource-library.js';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const original = JSON.parse(fs.readFileSync(path.join(projectRoot,'dist/resources.json'),'utf8'));
const resources = [...original,...EXTRA_RESOURCES];

function memoryStorage(initial = null) {
  let value=initial;
  return {
    getItem() { return value; },
    setItem(key,next) { value=next; },
    inspect() { return value ? JSON.parse(value) : null; },
  };
}

test('counts are derived from the supplied resource records, not presentation labels', () => {
  const model=createResourceLibraryModel(resources);
  const counts=model.counts();
  assert.equal(counts.total,new Set(resources.map(resource=>resource.id)).size);
  assert.equal(counts.downloaded,resources.filter(resource=>localPDFPath(resource)).length);
  assert.equal(counts.downloaded,0);
  assert.equal(counts.creator,14);
  assert.equal(counts.official,49);
  assert.equal(counts.mirror,2);
  assert.equal(counts.creator+counts.official+counts.mirror,counts.total);
  assert.equal(counts.favorites,0);
  assert.equal(counts.recent,0);
});

test('the ten STM32 manuals in the public catalogue retain their reading links', () => {
  const documents=prepareResources(original).filter(resource=>/^st-(?:0[1-9]|10)$/.test(resource.id));
  assert.equal(documents.length,10);
  for(const resource of documents) {
    assert.equal(resource.status,'link_only',resource.id);
    assert.equal(resource.localPdf,'',resource.id);
    assert.ok(resource.originalUrl&&resource.sourceUrl,resource.id);
    assert.ok(resource.reading_hint,resource.id);
    assert.ok(Number.isInteger(resource.pages)&&resource.pages>0);
    for(const field of ['download_url','bytes','sha256'])assert.ok(!(field in resource),`${resource.id}: ${field}`);
  }
});

test('author courses and public mirrors cannot appear in the manufacturer filter', () => {
  assert.equal(resourceSourceKind({category:'作者官方课程'}),'creator');
  assert.equal(resourceSourceKind({category:'ST文档公开镜像'}),'mirror');
  assert.equal(resourceSourceKind({category:'厂商中文教程'}),'official');
  const model=createResourceLibraryModel(resources);
  model.setFilters({source:'official'});
  assert.ok(model.results().length>0);
  assert.ok(model.results().every(resource=>!/^作者/.test(resource.category)&&!/镜像/.test(resource.category)));
  assert.ok(!model.results().some(resource=>resource.id==='jiangxie-video'||resource.id==='st-04'));
});

test('a PDF URL and a link-only status never imply a downloaded document', () => {
  const remote={id:'remote',title:'Online PDF',status:'link_only',url:'https://example.com/manual.pdf'};
  const inconsistent={...remote,id:'inconsistent',download_url:'./docs/manual.pdf'};
  assert.equal(localPDFPath(remote),'');
  assert.equal(localPDFPath(inconsistent),'');
  const model=createResourceLibraryModel([remote,inconsistent]);
  model.setFilters({downloaded:true});
  assert.equal(model.results().length,0);
});

test('human search fields support multiword Chinese queries and I2C spelling', () => {
  const model=createResourceLibraryModel(resources);
  model.setFilters({query:'GPIO   中文'});
  const matches=model.results();
  assert.ok(matches.some(resource=>resource.id==='st-01'));
  assert.ok(matches.every(resource=>resource.language==='中文'));
  model.setFilters({query:'I2C'});
  assert.ok(model.results().some(resource=>resource.id==='jiangxie-oled'));
  model.setFilters({query:'link_only'});
  assert.equal(model.results().length,0,'internal status strings should not pollute search results');
});

test('author, language, board family, and local-file filters compose', () => {
  const local={
    id:'fixture-manual',title:'Fixture PDF',author:'Example Author',language:'中文',
    family:'STM32',status:'downloaded',download_url:'./docs/fixture.pdf',
  };
  const fixtures=[
    local,
    {...local,id:'fixture-other-author',author:'Another Author'},
    {...local,id:'fixture-other-language',language:'英文'},
    {...local,id:'fixture-other-family',family:'RP2040'},
    {...local,id:'fixture-online',status:'link_only',url:'https://example.com/fixture.pdf'},
  ];
  assert.equal(localPDFPath(local),'./docs/fixture.pdf');
  const model=createResourceLibraryModel(fixtures);
  assert.equal(model.counts().downloaded,4);
  model.setFilters({author:'Example Author',language:'中文',family:'STM32',downloaded:true});
  assert.deepEqual(model.results().map(resource=>resource.id),['fixture-manual']);
  model.setFilters({downloaded:false});
  assert.deepEqual(model.results().map(resource=>resource.id),['fixture-manual','fixture-online']);
});

test('clearing one filter preserves the others, and clearing all restores the shelf', () => {
  const model=createResourceLibraryModel(resources);
  model.setFilters({author:'江协科技',language:'英文',query:'STM32'});
  assert.equal(model.results().length,0);
  model.setFilters({language:'all'});
  assert.equal(model.filters().author,'江协科技');
  assert.equal(model.filters().query,'STM32');
  assert.ok(model.results().length>0);
  model.resetFilters();
  assert.equal(model.results().length,resources.length);
  assert.equal(model.filters().query,'');
  assert.equal(model.filters().collection,'all');
});

test('family selection uses actual families and does not label unknown records as STM32', () => {
  const model=createResourceLibraryModel(resources);
  model.setFilters({family:'RP2040'});
  assert.ok(model.results().some(resource=>resource.id==='extra-pico-sdk'));
  assert.ok(model.results().every(resource=>resource.families.includes('RP2040')));
  const record=prepareResources([{id:'new-document',title:'Unknown family'}])[0];
  assert.deepEqual(record.families,['未标注']);
  assert.deepEqual(prepareResources([resources.find(resource=>resource.id==='st-01')])[0].families,['STM32']);
});

test('favorites are persisted by resource ID and restored in another model instance', () => {
  const storage=memoryStorage();
  const model=createResourceLibraryModel(resources,{storage});
  assert.deepEqual(model.toggleFavorite('jiangxie-video'),{favorite:true,persisted:true});
  model.toggleFavorite('st-01');
  model.setFilters({collection:'favorites'});
  assert.deepEqual(model.results().map(resource=>resource.id).sort(),['jiangxie-video','st-01']);
  const reopened=createResourceLibraryModel(resources,{storage});
  assert.equal(reopened.counts().favorites,2);
  assert.equal(reopened.isFavorite('st-01'),true);
  assert.deepEqual(Object.keys(storage.inspect()).sort(),['favorites','recent','version']);
  assert.equal(storage.inspect().favorites.includes('https://'),false);
});

test('unfavoriting updates counts and the favorites result set immediately', () => {
  const model=createResourceLibraryModel(resources);
  model.toggleFavorite('st-01');
  model.setFilters({collection:'favorites'});
  assert.equal(model.results().length,1);
  model.toggleFavorite('st-01');
  assert.equal(model.counts().favorites,0);
  assert.equal(model.results().length,0);
});

test('recent reading records only explicit opens, deduplicates them, and sorts by time', () => {
  let time=1000;
  const model=createResourceLibraryModel(resources,{storage:memoryStorage(),now:()=>++time});
  model.find('st-01');
  model.toggleFavorite('st-01');
  assert.equal(model.counts().recent,0,'looking up or favoriting a record is not a reading event');
  model.markRead('st-01');
  model.markRead('jiangxie-video');
  model.markRead('st-01');
  model.setFilters({collection:'recent'});
  assert.deepEqual(model.results().map(resource=>resource.id),['st-01','jiangxie-video']);
  assert.equal(model.counts().recent,2);
  assert.equal(model.getState().recent[0].openedAt,1003);
});

test('unknown IDs cannot create favorites or reading history', () => {
  const model=createResourceLibraryModel(resources);
  model.toggleFavorite('missing-id');
  assert.equal(model.markRead('missing-id'),false);
  assert.equal(model.counts().favorites,0);
  assert.equal(model.counts().recent,0);
});

test('recent history is limited without inventing reading progress', () => {
  let time=1000;
  const model=createResourceLibraryModel(resources,{now:()=>++time});
  for(const resource of resources.slice(0,40))model.markRead(resource.id);
  const history=model.getState().recent;
  assert.equal(history.length,30);
  assert.equal(history[0].id,resources[39].id);
  assert.ok(history.every(item=>Object.keys(item).sort().join(',')==='id,openedAt'));
});

test('blocked browser storage retains current-page favorites without claiming persistence', () => {
  const blocked={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  const model=createResourceLibraryModel(resources,{storage:blocked});
  assert.deepEqual(model.toggleFavorite('st-01'),{favorite:true,persisted:false});
  assert.equal(model.isFavorite('st-01'),true);
  assert.equal(model.getState().persistenceAvailable,false);
});

test('malformed saved state does not break access to the resource collection', () => {
  const model=createResourceLibraryModel(resources,{storage:memoryStorage('{invalid json')});
  assert.equal(model.counts().total,resources.length);
  assert.equal(model.counts().favorites,0);
  assert.equal(model.counts().recent,0);
  const invalid=memoryStorage(JSON.stringify({version:1,favorites:{bad:true},recent:[{id:'st-01',openedAt:'yesterday'},null]}));
  const reopened=createResourceLibraryModel(resources,{storage:invalid});
  assert.equal(reopened.counts().recent,0);
});

test('learning routes reference existing resources and preserve an explicit reading order', () => {
  for(const route of RESOURCE_ROUTES) {
    const model=createResourceLibraryModel(resources);
    assert.ok(route.ids.every(id=>model.find(id)),`${route.id} has a nonexistent resource`);
    model.setFilters({route:route.id});
    assert.deepEqual(model.results().map(resource=>resource.id),route.ids);
    assert.equal(route.steps.length,3);
  }
});

test('default STM32 learning routes do not mix HAL or Arduino projects into the SPL path', () => {
  const model=createResourceLibraryModel(resources);
  for(const id of ['first-light','read-input']) {
    const route=RESOURCE_ROUTES.find(item=>item.id===id);
    assert.match(route.framework,/STM32F103.*SPL/);
    for(const resourceId of route.ids) {
      const track=learningTrack(model.find(resourceId));
      assert.ok(!track||track.key==='spl',`${resourceId} mixes another framework into ${id}`);
    }
  }
  const first=RESOURCE_ROUTES.find(route=>route.id==='first-light');
  assert.deepEqual(first.ids.slice(0,2),['jiangxie-video','jiangxie-pack']);
  const hal=learningTrack(model.find('extra-embedfire-hal'));
  assert.equal(hal.key,'hal');
  assert.match(hal.note,/不能直接混用/);
  assert.equal(learningTrack(model.find('tietou-video')),null,'do not guess an unspecified course framework');
});

test('reading guides reuse recorded hints and do not invent document locations', () => {
  const source=resources.find(resource=>resource.id==='st-04');
  const guide=readingGuide(source);
  assert.equal(guide.start,source.reading_hint);
  assert.equal(guide.goal,source.description);
  assert.equal(guide.questions.length,3);
  const fallback=readingGuide({title:'新的资料',tags:[]});
  assert.ok(!/第\s*\d+\s*(页|章)/.test(fallback.start));
  assert.equal(fallback.practice,null);
});

test('normalization does not mutate source records or create duplicate trimmed IDs', () => {
  const source={id:' one ',title:'  Title  ',category:'作者官方教程',language:'中文'};
  const before=JSON.stringify(source);
  const normalized=prepareResources([source,{id:'one',title:'duplicate'},null,{}, {id:'no-title'}]);
  assert.equal(JSON.stringify(source),before);
  assert.equal(normalized.length,1);
  assert.equal(normalized[0].id,'one');
  assert.equal(normalized[0].title,'Title');
});

test('external links and local previews reject executable URLs and path traversal', () => {
  assert.equal(safeResourceURL('https://www.st.com/path'),'https://www.st.com/path');
  for(const value of ['javascript:alert(1)','data:text/html,test','//example.com','https://user:password@example.com',''])assert.equal(safeResourceURL(value),'');
  for(const download_url of ['https://example.com/a.pdf','javascript:alert(1)','./docs/../a.pdf','./docs/%2e%2e/a.pdf','./docs/a\\b.pdf','./docs/a.html']) {
    assert.equal(localPDFPath({status:'downloaded',download_url}),'',download_url);
  }
});

test('refresh reports only currently available favorites but restores them when records return', () => {
  const model=createResourceLibraryModel(resources);
  model.toggleFavorite('st-01');
  model.refresh(resources.filter(resource=>resource.id!=='st-01'));
  assert.equal(model.counts().favorites,0);
  model.refresh(resources);
  assert.equal(model.counts().favorites,1);
  model.setFilters({source:'toString',collection:'invalid',route:'missing'});
  assert.equal(model.filters().source,'all');
  assert.equal(model.filters().collection,'all');
  assert.equal(model.filters().route,'all');
});

test('mounting requires a real container and reports a useful integration error', () => {
  assert.throws(()=>mountResourceLibrary(null,resources),/存在的容器/);
});
