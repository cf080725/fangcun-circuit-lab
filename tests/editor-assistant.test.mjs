import test from "node:test";
import assert from "node:assert/strict";
import { createEditorAssistant, explainSourceLine, explainSource, completionCandidates, lexicalSource, indentSelection } from "../dist/editor-assistant.js";

// Minimal browser-facing fixture: exercise the registered keyboard handlers and
// normal textarea insertion, without replacing the editor's completion logic.
class EditorElement extends EventTarget {
  constructor(value = "") {
    super();
    this.value = value;
    this.selectionStart = value.length;
    this.selectionEnd = value.length;
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.clientHeight = 500;
    this.clientWidth = 600;
    this.hidden = true;
    this.innerHTML = "";
    this.style = {};
    this.attributes = new Map();
  }

  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }

  setRangeText(replacement, start, end, selectionMode = "preserve") {
    this.value = this.value.slice(0, start) + replacement + this.value.slice(end);
    if (selectionMode === "select") {
      this.setSelectionRange(start, start + replacement.length);
    } else {
      this.setSelectionRange(start + replacement.length, start + replacement.length);
    }
  }

  querySelectorAll() {
    return [];
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }

  focus() {
    this.dispatchEvent(new Event("focus"));
  }
}

function fixture(initial = "", context = {}) {
  const textarea = new EditorElement(initial);
  const annotations = new EditorElement();
  const popup = new EditorElement();
  const hint = new EditorElement();
  const assistant = createEditorAssistant({
    textarea,
    annotations,
    popup,
    hint,
    getContext: () => ({
      language: "arduino",
      pins: ["D2", "D13", "A0"],
      board: { logicVoltage: 5, adcMax: 1023 },
      ...context,
    }),
    explain: () => null,
    onRun: () => {},
  });

  function press(key, properties = {}) {
    const event = new Event("keydown", { cancelable: true });
    Object.assign(event, {
      key,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      isComposing: false,
      keyCode: 0,
      ...properties,
    });
    textarea.dispatchEvent(event);

    // Printable keys use the browser's default insertion only when the editor
    // did not consume them. Composition commits belong to the IME, not this stub.
    if (!event.defaultPrevented && !event.isComposing && event.keyCode !== 229 && key.length === 1) {
      textarea.setRangeText(key, textarea.selectionStart, textarea.selectionEnd, "end");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return event;
  }

  return { textarea, popup, press, assistant, hint, annotations };
}

for (const source of [
  "delay(500);",
  "values[2] = 3;",
  "if (1) {delay(10);}",
]) {
  test(`typing a complete statement preserves its closing delimiters: ${source}`, () => {
    const editor = fixture();
    for (const character of source) editor.press(character);
    assert.equal(editor.textarea.value, source);
    assert.equal(editor.textarea.selectionStart, source.length);
    assert.equal(editor.textarea.selectionEnd, source.length);
  });
}

for (const properties of [{ isComposing: true }, { keyCode: 229 }]) {
  test(`IME Enter is left to the input method: ${JSON.stringify(properties)}`, () => {
    const original = "// 输入中文注释";
    const editor = fixture(original);
    const event = editor.press("Enter", properties);
    assert.equal(event.defaultPrevented, false, "IME confirmation must not be consumed as a newline");
    assert.equal(editor.textarea.value, original);
    assert.equal(editor.textarea.selectionStart, original.length);
  });
}

for (const [prefix, name] of [["void set", "setup"], ["void loo", "loop"]]) {
  test(`Tab completes ${name} after an existing void without duplicating it`, () => {
    const editor = fixture(prefix);
    editor.textarea.dispatchEvent(new Event("input", { bubbles: true }));
    assert.equal(editor.popup.hidden, false, "the intended completion must be visible before Tab");
    const event = editor.press("Tab");
    assert.equal(event.defaultPrevented, true);
    assert.match(editor.textarea.value, new RegExp(`^void ${name}\\(\\)\\s*\\{`));
    assert.equal((editor.textarea.value.match(/\bvoid\b/g) || []).length, 1);
    assert.match(editor.textarea.value, /}\s*$/);
  });
}

test("a one-line conditional GPIO write is explained as conditional", () => {
  const explanation = explainSourceLine(
    "if (digitalRead(2) == LOW) digitalWrite(13, HIGH);",
    null,
    { logicVoltage: 5, adcMax: 1023 },
  );
  assert.match(explanation.plain, /判断|条件|如果/, "the explanation must preserve the if condition");
  assert.match(explanation.plain, /才|成立|满足/, "the output action must be described as conditional");
  assert.notEqual(explanation.title, "改变输出电平", "do not describe the whole line as an unconditional write");
});

test('Tab indents selected lines without deleting code, and Shift+Tab reverses it',()=>{
 const editor=fixture('alpha();\nbeta();\nlast();');editor.textarea.setSelectionRange(0,17);
 let inputs=0;editor.textarea.addEventListener('input',()=>inputs++);
 editor.press('Tab');assert.equal(editor.textarea.value,'    alpha();\n    beta();\nlast();');assert.equal(inputs,1);
 editor.press('Tab',{shiftKey:true});assert.equal(editor.textarea.value,'alpha();\nbeta();\nlast();');assert.equal(inputs,2);
});

test('single-line selected text is preserved and outdent at line start never deletes content',()=>{
 const editor=fixture('    int value=1;');editor.textarea.setSelectionRange(8,13);editor.press('Tab');assert.equal(editor.textarea.value,'        int value=1;');
 editor.press('Tab',{shiftKey:true});assert.equal(editor.textarea.value,'    int value=1;');
 const edit=indentSelection('abc',0,0,{outdent:true});assert.equal(edit.text,'abc');assert.equal(edit.selectionStart,0);
 const blank=indentSelection('\nnext',0,1);assert.equal(blank.start,0);assert.equal(blank.end,0);assert.equal(blank.text,'    ');
});

test('composition lifecycle suppresses completion and pairing even when an intermediate event lacks isComposing',()=>{
 const editor=fixture('GPIO_Se',{language:'spl'});editor.textarea.dispatchEvent(new Event('compositionstart'));
 editor.textarea.dispatchEvent(new Event('input'));assert.equal(editor.popup.hidden,true);
 const enter=editor.press('Enter');assert.equal(enter.defaultPrevented,false);
 editor.press('(');assert.equal(editor.textarea.value,'GPIO_Se(');
 editor.textarea.dispatchEvent(new Event('compositionend'));assert.equal(editor.popup.hidden,true);
});

test('completion and bracket assistance stay outside strings, character literals and multiline comments',()=>{
 for(const text of ['/* note\nGPIO_Se','// GPIO_Se','const char *s="GPIO_Se',"char c='("]){
  const editor=fixture(text,{language:'spl'});editor.assistant.showCompletions();assert.equal(editor.popup.hidden,true,text);editor.press('(');assert.equal(editor.textarea.value,text+'(',text);
 }
 const afterURL='const char *url="https://example.test"; GPIO_Se';assert.ok(completionCandidates(afterURL,afterURL.length).items.some(x=>x.label==='GPIO_SetBits'));
 const escaped='const char *s="a\\\" // still string';assert.equal(lexicalSource(escaped).state,'string');
});

test('mid-token completion replaces the full identifier and keeps existing arguments and semicolon',()=>{
 const source='GPIO_SetBits(GPIOA, GPIO_Pin_0);',editor=fixture(source,{language:'spl'});editor.textarea.setSelectionRange(7,7);editor.assistant.showCompletions();editor.press('Tab');assert.equal(editor.textarea.value,source);
 const partial=fixture('GPIO_Se;',{language:'spl'});partial.textarea.setSelectionRange(7,7);partial.assistant.showCompletions();partial.press('Tab');assert.equal(partial.textarea.value,'GPIO_SetBits(GPIOA, GPIO_Pin_0);');
});

test('moving the caret invalidates an old completion replacement range',()=>{
 const editor=fixture('GPIO_Se',{language:'spl'});editor.assistant.showCompletions();assert.equal(editor.popup.hidden,false);
 editor.press('ArrowLeft');assert.equal(editor.popup.hidden,true);
 editor.assistant.showCompletions();editor.textarea.setSelectionRange(0,0);editor.textarea.dispatchEvent(new Event('select'));assert.equal(editor.popup.hidden,true);
});

test('struct-member completion suggests fields and ignores declarations hidden in comments',()=>{
 const text='GPIO_InitTypeDef gpio;\ngpio.GPIO_M';const data=completionCandidates(text,text.length);assert.deepEqual(data.items.map(x=>x.label),['GPIO_Mode']);
 const comment='// int ghost;\ngho';assert.equal(completionCandidates(comment,comment.length).items.some(x=>x.label==='ghost'),false);
 const fn='int helper(int value){return value;}\nhel';assert.equal(completionCandidates(fn,fn.length).items[0].kind,'用户函数');
});

test('completion has an active descendant and Escape then Tab releases keyboard focus',()=>{
 const editor=fixture('GPIO_',{language:'spl'});editor.assistant.showCompletions();assert.equal(editor.textarea.getAttribute('aria-expanded'),'true');
 const first=editor.textarea.getAttribute('aria-activedescendant');editor.press('ArrowDown');assert.notEqual(editor.textarea.getAttribute('aria-activedescendant'),first);
 editor.press('Escape');assert.equal(editor.textarea.getAttribute('aria-expanded'),'false');assert.equal(editor.textarea.getAttribute('aria-activedescendant'),null);
 assert.equal(editor.press('Tab').defaultPrevented,false,'keyboard users must be able to leave the textarea');
});

test('paired Enter keeps the closing brace aligned; comment braces do not create phantom indentation',()=>{
 const editor=fixture('    if (1) {    }');const cursor=editor.textarea.value.indexOf('{')+1;editor.textarea.setSelectionRange(cursor,cursor);editor.press('Enter');assert.equal(editor.textarea.value,'    if (1) {\n        \n    }');
 const comment=fixture('    // {');comment.press('Enter');assert.equal(comment.textarea.value,'    // {\n    ');
 const trailing=fixture('if (1) { // condition');trailing.press('Enter');assert.equal(trailing.textarea.value,'if (1) { // condition\n    ');
 const pair=fixture('()');pair.textarea.setSelectionRange(1,1);pair.press('Backspace');assert.equal(pair.textarea.value,'');
});

test('Ctrl+/ comments and uncomments selected lines without deleting content',()=>{
 const editor=fixture('    one();\n    two();');editor.textarea.setSelectionRange(0,editor.textarea.value.length);
 editor.press('/',{ctrlKey:true});assert.equal(editor.textarea.value,'    // one();\n    // two();');
 editor.press('/',{ctrlKey:true});assert.equal(editor.textarea.value,'    one();\n    two();');
 const blank=fixture('');blank.press('/',{ctrlKey:true});assert.equal(blank.textarea.value,'// ');blank.press('/',{ctrlKey:true});assert.equal(blank.textarea.value,'');
});

test('SPL explanations resolve each successive config use to PA0 or PB1 without treating fields as hardware writes',()=>{
 const source='void main(void){\nGPIO_InitTypeDef gpio;\ngpio.GPIO_Pin = GPIO_Pin_0;\ngpio.GPIO_Mode = GPIO_Mode_Out_PP;\nGPIO_Init(GPIOA, &gpio);\ngpio.GPIO_Pin = GPIO_Pin_1;\ngpio.GPIO_Mode = GPIO_Mode_IPU;\nGPIO_Init(GPIOB, &gpio);\n}';
 const explanations=explainSource(source,null,{id:'bluepill'});
 assert.match(explanations[2].plain,/PA0/);assert.match(explanations[2].plain,/没有改变硬件/);assert.match(explanations[4].plain,/PA0/);
 assert.match(explanations[5].plain,/PB1/);assert.match(explanations[7].plain,/PB1/);assert.match(explanations[6].plain,/读1.*读0/);
 const pins=explainSourceLine('GPIO_SetBits(GPIOA, GPIO_Pin_0 | GPIO_Pin_2);');assert.match(pins.plain,/PA0、PA2/);assert.match(pins.technical,/开漏/);
});

test('clock, speed, timer and USART explanations distinguish frequently confused quantities',()=>{
 assert.match(explainSourceLine('RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA | RCC_APB2Periph_ADC1, ENABLE);').plain,/GPIOA.*ADC1.*电源/);
 const speed=explainSourceLine('gpio.GPIO_Speed = GPIO_Speed_50MHz;');assert.match(speed.plain,/50 MHz/);assert.match(speed.plain,/不是CPU主频/);
 assert.match(explainSourceLine('timer.TIM_Prescaler = 71;').plain,/72/);assert.match(explainSourceLine('timer.TIM_Period = 999;').plain,/1000/);
 assert.match(explainSourceLine('TIM_SetCompare1(TIM2, 50);').plain,/不是直接的百分数/);
 assert.match(explainSourceLine('serial.USART_BaudRate = 9600;').plain,/不是每秒9600个字符/);
});

test('comment bodies, quoted API text and reversed flag comparisons are not explained as unconditional hardware work',()=>{
 const lines=explainSource('/*\nGPIO_SetBits(GPIOA, GPIO_Pin_0);\n*/\nconst char *s="gpio.GPIO_Mode = GPIO_Mode_Out_PP;";');
 assert.match(lines[1].title,/注释/);assert.match(lines[3].title,/存储位置/);
 const opposite=explainSourceLine('while (ADC_GetFlagStatus(ADC1, ADC_FLAG_EOC) == SET) {}');assert.match(opposite.plain,/实际条件|方向不同/);assert.doesNotMatch(opposite.plain,/未完成就继续等/);
 const correct=explainSourceLine('while (ADC_GetFlagStatus(ADC1, ADC_FLAG_EOC) == RESET) {}');assert.match(correct.plain,/未完成就继续等/);
 assert.match(explainSourceLine('digitalWrite(13, HIGH);',null,{logicVoltage:5}).plain,/INPUT.*上拉/);
});

test('all shipped SPL example lines have readable explanations and explicit static scope',async()=>{
 const {examples}=await import('../dist/content.js');
 for(const example of examples)for(const [filename,source] of Object.entries(example.files)){
  const lines=explainSource(source,null,{id:'bluepill',logicVoltage:3.3,adcMax:4095});assert.equal(lines.length,source.split('\n').length,filename);
  for(const line of lines){assert.ok(line.title&&line.plain&&line.technical);assert.match(line.scope,/静态/);}
 }
});
