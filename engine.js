import {getBoardProfile, canonicalPin, boardPinNumber} from "./board-profiles.js";
/**
 * STM32 Learning Lab — C source behaviour simulator.
 * This is an intentionally bounded, deterministic teaching interpreter. It does
 * not compile ARM instructions, run Keil binaries, or model electrical physics.
 * C source is tokenised and parsed into an AST; no eval/new Function is used.
 */
export const ENGINE_CAPABILITIES = Object.freeze({
  kind: "c-source-behaviour", version: "1.0.0", target: "STM32F103C8T6",
  coreClockHz: 72000000, instructionAccurate: false, binaryFirmware: false,
  supported: ["C integer/float expressions", "variables and basic arrays", "struct fields",
    "user functions and multiple C files", "if/while/for/do/switch", "GPIO", "RCC",
    "timer PWM", "ADC single channel", "USART polling", "virtual delays", "Arduino pulse input via modeled signals",
    "Arduino Wire I²C reads and writes", "OLED teaching APIs"],
  unsupported: ["ARM ELF/HEX/BIN execution", "interrupt dispatch", "DMA transfers",
    "general pointer arithmetic", "dynamic allocation", "full C standard library",
    "instruction-cycle timing", "analogue transistor physics", "full STM32 peripheral register map"]
});

const locOf = (x) => ({ file: x?.file || "main.c", line: x?.line || 1, column: x?.column || 1 });
const diag = (code, plain, technical, fix, loc, severity = "error") => ({
  code, severity, plain, message: plain, technical, fix, ...locOf(loc)
});
export class CompileError extends Error {
  constructor(diagnostics) {
    super(diagnostics[0]?.plain || "源码无法解析");
    this.name = "CompileError"; this.diagnostics = diagnostics;
  }
}
class RuntimeFault extends Error {
  constructor(diagnostic) { super(diagnostic.plain); this.diagnostic = diagnostic; }
}
const err = (code, plain, technical, fix, loc) => { throw new CompileError([diag(code, plain, technical, fix, loc)]); };

const TYPE_WORDS = new Set(["void", "char", "short", "int", "long", "float", "double",
  "signed", "unsigned", "uint8_t", "uint16_t", "uint32_t", "uint64_t", "int8_t",
  "int16_t", "int32_t", "int64_t", "u8", "u16", "u32", "s8", "s16", "s32",
  "size_t", "bool", "_Bool", "byte", "word", "boolean", "FunctionalState", "FlagStatus", "ITStatus", "BitAction",
  "GPIO_InitTypeDef", "TIM_TimeBaseInitTypeDef", "TIM_OCInitTypeDef", "TIM_ICInitTypeDef",
  "ADC_InitTypeDef", "USART_InitTypeDef", "NVIC_InitTypeDef", "EXTI_InitTypeDef",
  "GPIO_TypeDef", "TIM_TypeDef", "ADC_TypeDef", "USART_TypeDef"]);
const QUALIFIERS = new Set(["const", "volatile", "static", "extern", "register", "auto",
  "__IO", "__I", "__O", "__STATIC_INLINE", "inline"]);
const STRUCTS = {
  GPIO_InitTypeDef: ["GPIO_Pin", "GPIO_Speed", "GPIO_Mode"],
  TIM_TimeBaseInitTypeDef: ["TIM_Prescaler", "TIM_CounterMode", "TIM_Period", "TIM_ClockDivision", "TIM_RepetitionCounter"],
  TIM_OCInitTypeDef: ["TIM_OCMode", "TIM_OutputState", "TIM_OutputNState", "TIM_Pulse", "TIM_OCPolarity", "TIM_OCNPolarity", "TIM_OCIdleState", "TIM_OCNIdleState"],
  TIM_ICInitTypeDef: ["TIM_Channel", "TIM_ICPolarity", "TIM_ICSelection", "TIM_ICPrescaler", "TIM_ICFilter"],
  ADC_InitTypeDef: ["ADC_Mode", "ADC_ScanConvMode", "ADC_ContinuousConvMode", "ADC_ExternalTrigConv", "ADC_DataAlign", "ADC_NbrOfChannel"],
  USART_InitTypeDef: ["USART_BaudRate", "USART_WordLength", "USART_StopBits", "USART_Parity", "USART_Mode", "USART_HardwareFlowControl"],
  NVIC_InitTypeDef: ["NVIC_IRQChannel", "NVIC_IRQChannelPreemptionPriority", "NVIC_IRQChannelSubPriority", "NVIC_IRQChannelCmd"],
  EXTI_InitTypeDef: ["EXTI_Line", "EXTI_Mode", "EXTI_Trigger", "EXTI_LineCmd"]
};
const BUILTIN_HEADERS = new Set(["stm32f10x.h", "stm32f10x_conf.h", "system_stm32f10x.h",
  "core_cm3.h", "misc.h", "stdint.h", "stddef.h", "stdbool.h", "stdio.h", "string.h",
  "math.h", "stdlib.h", "delay.h", "oled.h", "arduino.h", "wire.h"]);
const isVirtualHeader = (name) => BUILTIN_HEADERS.has(name.toLowerCase()) || /^stm32f10x_(gpio|rcc|tim|adc|usart|exti|dma|spi|i2c|pwr|bkp|rtc|flash|wdg|wwdg|iwdg|dac|can|crc|fsmc|sdio|debug)\.h$/i.test(name);
const basename = (name) => String(name).replace(/\\/g, "/").split("/").pop();

function normalizeFiles(files) {
  const out = {};
  if (Array.isArray(files)) {
    for (const f of files) out[f.name || f.path || f.filename] = String(f.content ?? f.code ?? f.text ?? "");
  } else {
    for (const [k, v] of Object.entries(files || {})) out[k] = typeof v === "string" ? v : String(v?.content ?? v?.code ?? v?.text ?? "");
  }
  return out;
}
function unescapeC(str) {
  return str.replace(/\\(x[0-9a-fA-F]+|[0-7]{1,3}|.)/gs, (_, c) => {
    const m = { n: "\n", r: "\r", t: "\t", "0": "\0", "\\": "\\", "'": "'", '"': '"', b: "\b", f: "\f", v: "\v" };
    if (Object.hasOwn(m, c)) return m[c];
    if (c[0] === "x") return String.fromCharCode(parseInt(c.slice(1), 16));
    if (/^[0-7]+$/.test(c)) return String.fromCharCode(parseInt(c, 8));
    return c;
  });
}
function tokenize(text, sourceLines, fallback = { file: "main.c", line: 1 }) {
  const tokens = []; let i = 0, row = 0, col = 1;
  const loc = () => ({ file: sourceLines?.[row]?.file || fallback.file, line: sourceLines?.[row]?.line || (fallback.line + row), column: col });
  const advance = (n = 1) => { while (n-- > 0) { if (text[i++] === "\n") { row++; col = 1; } else col++; } };
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) { advance(); continue; }
    if (text.startsWith("//", i)) { while (i < text.length && text[i] !== "\n") advance(); continue; }
    if (text.startsWith("/*", i)) {
      const start = loc(); advance(2);
      while (i < text.length && !text.startsWith("*/", i)) advance();
      if (i >= text.length) err("UNCLOSED_COMMENT", "这段注释没有结束。", "缺少注释结束符 */。", "在注释末尾补上 */。", start);
      advance(2); continue;
    }
    const start = loc();
    if (ch === '"' || ch === "'") {
      const quote = ch; advance(); let raw = "", closed = false;
      while (i < text.length) {
        if (text[i] === quote) { advance(); closed = true; break; }
        if (text[i] === "\\" && i + 1 < text.length) { raw += text[i]; advance(); raw += text[i]; advance(); }
        else { raw += text[i]; advance(); }
      }
      if (!closed) err("UNCLOSED_STRING", "文字或字符的引号没有配对。", "字符串或字符常量未闭合。", "检查单引号或双引号是否一一对应。", start);
      const value = unescapeC(raw);
      tokens.push({ type: quote === '"' ? "string" : "number", value: quote === '"' ? value : (value.charCodeAt(0) || 0), raw: quote + raw + quote, ...start });
      continue;
    }
    const number = text.slice(i).match(/^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(?:[uUlLfF]*)/);
    if (number) {
      const raw = number[0]; let clean = raw.replace(/[uUlLfF]+$/, "");
      if (/^0[xX]/.test(raw)) clean = raw.replace(/[uUlL]+$/, "");
      const value = /^0[bB]/.test(clean) ? parseInt(clean.slice(2), 2) : /^0[0-7]+$/.test(clean) && clean.length > 1 ? parseInt(clean, 8) : Number(clean);
      tokens.push({ type: "number", value, raw, ...start }); advance(raw.length); continue;
    }
    const id = text.slice(i).match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
    if (id) { tokens.push({ type: "id", value: id[0], ...start }); advance(id[0].length); continue; }
    const op = ["<<=", ">>=", "...", "++", "--", "->", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "==", "!=", "<=", ">=", "&&", "||", "<<", ">>"].find(o => text.startsWith(o, i));
    if (op) { tokens.push({ type: "op", value: op, ...start }); advance(op.length); continue; }
    if ("{}()[];,.?:+-*/%&|^!~=<>".includes(ch)) { tokens.push({ type: "op", value: ch, ...start }); advance(); continue; }
    err("UNRECOGNIZED_CHARACTER", "这里有源码不认识的符号：" + ch, "词法分析无法识别该字符。", "检查是否使用了中文标点，C 代码中的括号、分号应使用英文字符。", start);
  }
  tokens.push({ type: "eof", value: "<eof>", ...loc() }); return tokens;
}
function expandMacros(tokens, macros, depth = 0) {
  if (depth > 30) err("MACRO_RECURSION", "宏定义互相绕回来了。", "宏展开超过 30 层。", "检查 #define 是否直接或间接引用自己。", tokens[0]);
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i], macro = t.type === "id" ? macros.get(t.value) : null;
    if (!macro || t.type === "eof") { out.push(t); continue; }
    let replacement = macro.tokens;
    if (macro.params) {
      if (tokens[i + 1]?.value !== "(") { out.push(t); continue; }
      i += 2; const args = []; let level = 0, cur = [];
      for (; i < tokens.length; i++) {
        const v = tokens[i].value;
        if (v === "(") level++;
        if (v === ")" && level === 0) { if (cur.length || macro.params.length) args.push(cur); break; }
        if (v === ")") level--;
        if (v === "," && level === 0) { args.push(cur); cur = []; } else cur.push(tokens[i]);
      }
      if (tokens[i]?.value !== ")") err("MACRO_ARGUMENTS", "宏调用的括号没有结束。", "函数式宏缺少右括号。", "补上 ) 并检查参数数量。", t);
      if (args.length !== macro.params.length) err("MACRO_ARGUMENTS", "宏的参数数量不对。", t.value + " 需要 " + macro.params.length + " 个参数。", "核对 #define 和调用位置。", t);
      replacement = replacement.flatMap(tok => {
        const index = macro.params.indexOf(tok.value); return index < 0 ? [tok] : args[index];
      });
    }
    const nextMacros = new Map(macros); nextMacros.delete(t.value);
    const expanded = expandMacros(replacement.map(tok => ({ ...tok, ...locOf(t) })), nextMacros, depth + 1);
    out.push(...expanded.filter(tok => tok.type !== "eof"));
  }
  return out;
}
function preprocess(filename, files, diagnostics, predefinedMacros = {STM32F10X_MD:1,USE_STDPERIPH_DRIVER:1}) {
  const macros = new Map();
  for (const [name,value] of Object.entries(predefinedMacros)) macros.set(name,{tokens:tokenize(String(value),null,{file:filename,line:1}).filter(t=>t.type!=="eof")});
  const visitedOnce = new Set(), stack = [];
  function condition(text, where) {
    let s = text.replace(/defined\s*\(\s*(\w+)\s*\)|defined\s+(\w+)/g, (_, a, b) => macros.has(a || b) ? "1" : "0");
    const toks = expandMacros(tokenize(s, null, where).filter(t => t.type !== "eof"), macros);
    // Preprocessor conditionals are deliberately limited to integer truth tests.
    const p = new Parser([...toks, { type: "eof", value: "<eof>", ...where }], diagnostics);
    const expression = p.expression(0);
    const calc = n => {
      if (n.kind === "literal") return Number(n.value) || 0;
      if (n.kind === "id") return 0;
      if (n.kind === "unary") { const v = calc(n.value); return n.op === "!" ? +!v : n.op === "~" ? ~v : n.op === "-" ? -v : v; }
      if (n.kind === "binary") return calculate(n.op, calc(n.left), calc(n.right));
      if (n.kind === "conditional") return calc(n.test) ? calc(n.yes) : calc(n.no);
      err("PREPROCESSOR_CONDITION", "这个条件编译表达式暂时不支持。", "#if 只支持整数常量与逻辑运算。", "改成 #ifdef 宏名，或暂时保留需要编译的那一支。", where);
    };
    return !!calc(expression);
  }
  function include(name) {
    if (stack.includes(name)) err("INCLUDE_CYCLE", "头文件循环包含，没有保护。", stack.concat(name).join(" → "), "为头文件添加 #ifndef / #define / #endif 保护。", { file: name, line: 1 });
    if (visitedOnce.has(name)) return [];
    stack.push(name);
    const src = files[name].replace(/\r\n?/g, "\n").replace(/\\\n/g, " ");
    const lines = src.split("\n"), out = [], conditions = []; let active = true;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i], where = { file: name, line: i + 1, column: 1 };
      const directive = line.match(/^\s*#\s*(\w+)\s*(.*)$/);
      if (!directive) { if (active) out.push({ ...where, text: line }); continue; }
      const cmd = directive[1], body = directive[2].replace(/\/\/.*$/, "").trim();
      if (["if", "ifdef", "ifndef"].includes(cmd)) {
        const own = cmd === "ifdef" ? macros.has(body) : cmd === "ifndef" ? !macros.has(body) : active ? condition(body, where) : false;
        conditions.push({ parent: active, matched: own, elseUsed: false }); active = active && own; continue;
      }
      if (cmd === "else" || cmd === "elif") {
        const c = conditions[conditions.length - 1];
        if (!c || c.elseUsed) err("PREPROCESSOR_PAIR", "条件编译的分支没有配对。", "#" + cmd + " 缺少对应 #if，或重复 #else。", "检查 #if / #else / #endif。", where);
        const next = !c.matched && (cmd === "else" || condition(body, where));
        active = c.parent && next; c.matched ||= next; c.elseUsed = cmd === "else"; continue;
      }
      if (cmd === "endif") {
        const c = conditions.pop(); if (!c) err("PREPROCESSOR_PAIR", "#endif 没有对应的开始。", "条件编译块不匹配。", "检查 #if / #ifndef / #endif。", where);
        active = c.parent; continue;
      }
      if (!active) continue;
      if (cmd === "include") {
        const target = body.match(/^[<"]([^>"]+)[>"]/);
        if (!target) err("INCLUDE_FORMAT", "头文件名字没有写完整。", "#include 需要引号或尖括号。", '例如 #include "stm32f10x.h"。', where);
        const requested = target[1], base = basename(requested);
        if (isVirtualHeader(base)) {
          // ST/Delay/OLED headers are a documented model interface, never executed.
          continue;
        }
        const key = Object.keys(files).find(f => f === requested || basename(f) === base);
        if (!key) err("MISSING_HEADER", "项目里缺少头文件 " + base + "。", "无法解析用户头文件。", "把对应 .h 文件一并导入，或检查 #include 的名字。", where);
        out.push(...include(key)); continue;
      }
      if (cmd === "define") {
        const def = body.match(/^([A-Za-z_]\w*)(\(([^)]*)\))?\s*(.*)$/);
        if (!def) err("MACRO_FORMAT", "宏定义格式不完整。", "无法解析 #define。", "例如 #define LED_PIN GPIO_Pin_0。", where);
        const params = def[2] ? (def[3].trim() ? def[3].split(",").map(x => x.trim()) : []) : null;
        if (def[4].includes("#")) err("MACRO_UNSUPPORTED", "这里用了暂未支持的宏技巧。", "不支持宏字符串化 # 或拼接 ##。", "用普通常量或函数替代后运行。", where);
        const mt = tokenize(def[4] || "", null, where).filter(t => t.type !== "eof");
        macros.set(def[1], { params, tokens: mt }); continue;
      }
      if (cmd === "undef") { macros.delete(body); continue; }
      if (cmd === "pragma" && body === "once") { visitedOnce.add(name); continue; }
      if (cmd === "error") err("PREPROCESSOR_ERROR", "源码主动停止了编译：" + body, "#error 指令。", "检查条件编译选项。", where);
      if (cmd === "warning") { diagnostics.push(diag("SOURCE_WARNING", body, "#warning 指令。", "查看作者给出的说明。", where, "warning")); continue; }
      err("PREPROCESSOR_UNSUPPORTED", "暂时不能处理 #" + cmd + "。", "不支持的预处理指令。", "保留普通 C 源码和已支持的 #include / #define / 条件编译。", where);
    }
    if (conditions.length) err("PREPROCESSOR_PAIR", "条件编译块没有结束。", "缺少 #endif。", "在文件末尾补齐对应 #endif。", { file: name, line: lines.length });
    stack.pop(); return out;
  }
  const lines = include(filename);
  return expandMacros(tokenize(lines.map(l => l.text).join("\n"), lines, { file: filename, line: 1 }), macros);
}

const BIN_BP = { ",": 1, "=": 2, "+=": 2, "-=": 2, "*=": 2, "/=": 2, "%=": 2, "&=": 2, "|=": 2, "^=": 2, "<<=": 2, ">>=": 2,
  "||": 4, "&&": 5, "|": 6, "^": 7, "&": 8, "==": 9, "!=": 9, "<": 10, "<=": 10, ">": 10, ">=": 10, "<<": 11, ">>": 11, "+": 12, "-": 12, "*": 13, "/": 13, "%": 13 };
const ASSIGN_OPS = new Set(["=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>="]);
class Parser {
  constructor(tokens, diagnostics) {
    this.tokens = tokens; this.i = 0; this.diagnostics = diagnostics; this.types = new Set(TYPE_WORDS);
    this.structs = structuredClone(STRUCTS); this.aliases = {}; this.loopDepth = 0; this.switchDepth = 0;
  }
  get t() { return this.tokens[this.i] || this.tokens[this.tokens.length - 1]; }
  peek(n = 1) { return this.tokens[this.i + n] || this.tokens[this.tokens.length - 1]; }
  is(v) { return this.t.value === v; }
  eat(v) { if (this.is(v)) { const t = this.t; this.i++; return t; } return null; }
  take() { const t = this.t; this.i++; return t; }
  need(v) {
    const t = this.eat(v);
    if (!t) err("SYNTAX", "这里需要 " + v + "，但看到的是 " + (this.t.type === "eof" ? "文件结尾" : this.t.value) + "。", "C 语法不完整。", v === ";" ? "检查上一句末尾是否漏了英文分号 ;。" : "检查括号、逗号和花括号是否配对。", this.t);
    return t;
  }
  needId() {
    if (this.t.type !== "id") err("EXPECTED_NAME", "这里需要一个名字。", "声明或成员访问缺少标识符。", "使用英文、数字、下划线命名，名字不能以数字开头。", this.t);
    return this.take();
  }
  startsType() { return this.types.has(this.t.value) || QUALIFIERS.has(this.t.value) || this.is("struct") || this.is("enum"); }
  type() {
    const parts = [], loc = this.t; let constant = false, external = false, isStatic = false;
    while (QUALIFIERS.has(this.t.value)) { const v = this.take().value; constant ||= v === "const"; external ||= v === "extern"; isStatic ||= v === "static"; }
    if (this.eat("struct")) {
      const name = this.needId().value; parts.push(name);
      if (!this.structs[name]) err("UNKNOWN_STRUCT", "还不知道结构体 " + name + " 里有什么。", "未声明的结构体类型。", "先定义结构体，或使用标准库提供的 InitTypeDef。", loc);
    } else {
      while (this.types.has(this.t.value)) {
        parts.push(this.take().value);
        if (!["signed", "unsigned", "short", "long", "int", "char", "double"].includes(parts[parts.length - 1])) break;
        if (!["signed", "unsigned", "short", "long", "int", "char", "double"].includes(this.t.value)) break;
      }
    }
    while (QUALIFIERS.has(this.t.value)) { constant ||= this.take().value === "const"; }
    if (!parts.length) err("UNKNOWN_TYPE", "这里需要先写变量或函数的类型。", "未识别的类型声明。", "例如 int、uint16_t 或 GPIO_InitTypeDef。", loc);
    return { name: parts.join(" "), constant, external, static: isStatic, loc };
  }
  program() {
    const functions = {}, globals = [], prototypes = new Set();
    while (this.t.type !== "eof") {
      if (this.eat(";")) continue;
      if (this.eat("typedef")) { this.typedef(); continue; }
      if (this.is("enum")) { globals.push(...this.enumDecl()); continue; }
      if (this.is("struct") && (this.peek(2).value === "{" || this.peek().value === "{")) { this.structDecl(); continue; }
      const type = this.type(); let pointer = 0; while (this.eat("*")) pointer++;
      const name = this.needId();
      if (this.eat("(")) {
        const params = [];
        if (!this.eat(")")) {
          if (this.is("void") && this.peek().value === ")") { this.take(); this.take(); }
          else {
            do {
              if (this.eat("...")) err("VARIADIC_UNSUPPORTED", "自定义可变参数函数暂时不支持。", "不支持用户定义的 ... 参数。", "使用固定数量参数。内置 printf 可以使用。", this.t);
              const pt = this.type(); let pp = 0; while (this.eat("*")) pp++;
              const pn = this.t.type === "id" ? this.take().value : "_arg" + params.length;
              if (this.eat("[")) { if (!this.is("]")) this.expression(2); this.need("]"); pp++; }
              params.push({ name: pn, type: pt.name, pointer: pp });
            } while (this.eat(","));
            this.need(")");
          }
        }
        if (this.eat(";")) { prototypes.add(name.value); continue; }
        const body = this.block();
        if (functions[name.value]) err("DUPLICATE_FUNCTION", "函数 " + name.value + " 写了两遍。", "重复的函数定义。", "保留一个实现；头文件只写函数声明。", name);
        functions[name.value] = { name: name.value, returnType: type.name, pointer, params, body, loc: name };
      } else {
        globals.push(...this.declarationTail(type, name, pointer)); this.need(";");
      }
    }
    return { functions, globals, prototypes: [...prototypes], structs: this.structs, aliases: this.aliases };
  }
  structFields() {
    this.need("{"); const fields = [];
    while (!this.eat("}")) {
      if (this.t.type === "eof") this.need("}");
      this.type(); do { while (this.eat("*")) {} const n = this.needId().value; fields.push(n);
        if (this.eat("[")) { this.expression(2); this.need("]"); }
      } while (this.eat(",")); this.need(";");
    }
    return fields;
  }
  structDecl() {
    this.need("struct"); const name = this.needId().value; const fields = this.structFields();
    this.structs[name] = fields; this.types.add(name); this.need(";");
  }
  typedef() {
    if (this.eat("struct")) {
      const tag = this.t.type === "id" && this.peek().value === "{" ? this.take().value : null;
      const fields = this.structFields(); const name = this.needId().value; this.need(";");
      this.types.add(name); this.structs[name] = fields;
      if (tag) { this.types.add(tag); this.structs[tag] = fields; } return;
    }
    const from = this.type(); while (this.eat("*")) {}
    const name = this.needId().value; this.need(";"); this.types.add(name); this.aliases[name] = from.name;
  }
  enumDecl() {
    const loc = this.need("enum"); if (this.t.type === "id") this.take(); this.need("{");
    const globals = []; let previous = null;
    while (!this.is("}")) {
      const n = this.needId(); const init = this.eat("=") ? this.expression(2) : previous ? { kind: "binary", op: "+", left: { kind: "id", name: previous, loc: n }, right: { kind: "literal", value: 1, loc: n }, loc: n } : { kind: "literal", value: 0, loc: n };
      globals.push({ name: n.value, type: "int", constant: true, init, dimensions: [], pointer: 0, loc: n }); previous = n.value;
      if (!this.eat(",")) break;
    }
    this.need("}"); this.need(";"); return globals;
  }
  initializer() {
    const loc = this.t;
    if (this.eat("{")) {
      const values = [];
      while (!this.is("}")) { values.push(this.initializer()); if (!this.eat(",")) break; }
      this.need("}"); return { kind: "initlist", values, loc };
    }
    return this.expression(2);
  }
  declarationTail(type, firstName, firstPointer = 0) {
    const decls = []; let name = firstName, pointer = firstPointer;
    do {
      if (!name) { pointer = 0; while (this.eat("*")) pointer++; name = this.needId(); }
      const dimensions = [];
      while (this.eat("[")) { dimensions.push(this.is("]") ? null : this.expression(2)); this.need("]"); }
      const init = this.eat("=") ? this.initializer() : null;
      decls.push({ name: name.value, type: type.name, constant: type.constant, external: type.external, static: type.static, pointer, dimensions, init, loc: name }); name = null;
    } while (this.eat(","));
    return decls;
  }
  block() {
    const loc = this.need("{"), statements = [];
    while (!this.is("}")) {
      if (this.t.type === "eof") this.need("}");
      statements.push(this.statement());
    }
    this.need("}"); return { kind: "block", statements, loc };
  }
  statement() {
    const loc = this.t;
    if (this.is("{")) return this.block();
    if (this.eat(";")) return { kind: "empty", loc };
    if (this.eat("if")) {
      this.need("("); const test = this.expression(0); this.need(")"); const yes = this.statement(), no = this.eat("else") ? this.statement() : null;
      return { kind: "if", test, yes, no, loc };
    }
    if (this.eat("while")) {
      this.need("("); const test = this.expression(0); this.need(")"); this.loopDepth++; const body = this.statement(); this.loopDepth--;
      return { kind: "while", test, body, loc };
    }
    if (this.eat("do")) {
      this.loopDepth++; const body = this.statement(); this.loopDepth--; this.need("while"); this.need("(");
      const test = this.expression(0); this.need(")"); this.need(";"); return { kind: "do", test, body, loc };
    }
    if (this.eat("for")) {
      this.need("("); let init = null, test = null, update = null;
      if (!this.is(";")) {
        if (this.startsType()) { const type = this.type(); let ptr = 0; while (this.eat("*")) ptr++; init = { kind: "decl", declarations: this.declarationTail(type, this.needId(), ptr), loc }; }
        else init = { kind: "expr", value: this.expression(0), loc };
      }
      this.need(";"); if (!this.is(";")) test = this.expression(0); this.need(";");
      if (!this.is(")")) update = this.expression(0); this.need(")");
      this.loopDepth++; const body = this.statement(); this.loopDepth--; return { kind: "for", init, test, update, body, loc };
    }
    if (this.eat("switch")) {
      this.need("("); const test = this.expression(0); this.need(")"); this.need("{");
      const cases = []; let current = null; this.switchDepth++;
      while (!this.is("}")) {
        if (this.t.type === "eof") this.need("}");
        if (this.eat("case")) { const value = this.expression(2); this.need(":"); current = { value, statements: [] }; cases.push(current); }
        else if (this.eat("default")) { this.need(":"); current = { value: null, statements: [] }; cases.push(current); }
        else { if (!current) err("SWITCH_LABEL", "switch 里面需要先写 case 或 default。", "没有分支标签的语句。", "为该分支添加 case 值:。", this.t); current.statements.push(this.statement()); }
      }
      this.switchDepth--; this.need("}"); return { kind: "switch", test, cases, loc };
    }
    if (this.eat("return")) { const value = this.is(";") ? null : this.expression(0); this.need(";"); return { kind: "return", value, loc }; }
    if (this.eat("break")) {
      if (!this.loopDepth && !this.switchDepth) err("BREAK_OUTSIDE_LOOP", "break 只能用于跳出循环或 switch。", "break 不在有效上下文中。", "检查它是否放在 while、for 或 switch 内。", loc);
      this.need(";"); return { kind: "break", loc };
    }
    if (this.eat("continue")) {
      if (!this.loopDepth) err("CONTINUE_OUTSIDE_LOOP", "continue 只能写在循环里面。", "continue 不在循环上下文中。", "检查 while 或 for 的花括号。", loc);
      this.need(";"); return { kind: "continue", loc };
    }
    if (["goto", "asm", "__asm", "__asm__"].includes(this.t.value)) err("UNSUPPORTED_SYNTAX", "这里用到了本平台尚未模拟的 C 功能。", "暂不支持 " + this.t.value + "。", "使用普通函数、条件和循环；汇编或完整固件请在真实工具链运行。", loc);
    if (this.startsType()) {
      const type = this.type(); let ptr = 0; while (this.eat("*")) ptr++;
      const declarations = this.declarationTail(type, this.needId(), ptr); this.need(";"); return { kind: "decl", declarations, loc };
    }
    const value = this.expression(0); this.need(";"); return { kind: "expr", value, loc };
  }
  expression(min = 0) {
    let left = this.unary();
    while (true) {
      const op = this.t.value;
      if (op === "?" && min <= 3) {
        const loc = this.take(); const yes = this.expression(0); this.need(":"); const no = this.expression(3);
        left = { kind: "conditional", test: left, yes, no, loc }; continue;
      }
      const bp = BIN_BP[op]; if (bp === undefined || bp < min) break;
      const loc = this.take(), right = this.expression(ASSIGN_OPS.has(op) ? bp : bp + 1);
      left = { kind: ASSIGN_OPS.has(op) ? "assign" : "binary", op, left, right, loc };
    }
    return left;
  }
  unary() {
    const loc = this.t;
    if (["+", "-", "!", "~", "&", "*", "++", "--"].includes(this.t.value)) {
      const op = this.take().value; return { kind: "unary", op, value: this.unary(), loc };
    }
    if (this.eat("sizeof")) {
      if (this.is("(") && (this.types.has(this.peek().value) || QUALIFIERS.has(this.peek().value))) {
        this.take(); const type = this.type(); let pointer = 0; while (this.eat("*")) pointer++; this.need(")");
        return { kind: "sizeof", type: type.name, pointer, loc };
      }
      return { kind: "sizeof", value: this.unary(), loc };
    }
    if (this.is("(") && (this.types.has(this.peek().value) || QUALIFIERS.has(this.peek().value))) {
      this.take(); const type = this.type(); let pointer = 0; while (this.eat("*")) pointer++; this.need(")");
      return { kind: "cast", type: type.name, pointer, value: this.unary(), loc };
    }
    let expr;
    if (this.eat("(")) { expr = this.expression(0); this.need(")"); }
    else if (this.t.type === "number" || this.t.type === "string") {
      const t = this.take(); let value = t.value;
      if (t.type === "string") while (this.t.type === "string") value += this.take().value;
      expr = { kind: "literal", value, character: t.raw?.startsWith("\'") || false, float: t.type === "number" && !t.raw?.startsWith("\'") && !/^0[xXbB]/.test(t.raw || "") && /[.eEfF]/.test(t.raw || ""), loc: t };
    } else if (this.t.type === "id") { const t = this.take(); expr = { kind: "id", name: t.value, loc: t }; }
    else err("EXPECTED_EXPRESSION", "这里缺少一个值或表达式。", "无法在此位置解析 " + this.t.value + "。", "检查赋值右侧、函数参数以及多余的逗号。", this.t);
    while (true) {
      const at = this.t;
      if (this.eat("(")) {
        const args = []; if (!this.is(")")) do { args.push(this.expression(2)); } while (this.eat(","));
        this.need(")"); expr = { kind: "call", callee: expr, args, loc: expr.loc }; continue;
      }
      if (this.eat("[")) { const index = this.expression(0); this.need("]"); expr = { kind: "index", object: expr, index, loc: at }; continue; }
      if (this.eat(".") || this.eat("->")) { const key = this.needId().value; expr = { kind: "member", object: expr, key, loc: at }; continue; }
      if (this.eat("++")) { expr = { kind: "postfix", op: "++", value: expr, loc: at }; continue; }
      if (this.eat("--")) { expr = { kind: "postfix", op: "--", value: expr, loc: at }; continue; }
      break;
    }
    return expr;
  }
}

const CONSTANTS = {
  ENABLE: 1, DISABLE: 0, SET: 1, RESET: 0, SUCCESS: 1, ERROR: 0, Bit_SET: 1, Bit_RESET: 0,
  true: 1, false: 0, NULL: 0, EOF: -1, SystemCoreClock: 72000000,
  GPIO_Mode_AIN: 0x00, GPIO_Mode_IN_FLOATING: 0x04, GPIO_Mode_IPD: 0x28, GPIO_Mode_IPU: 0x48,
  GPIO_Mode_Out_OD: 0x10, GPIO_Mode_Out_PP: 0x14, GPIO_Mode_AF_OD: 0x18, GPIO_Mode_AF_PP: 0x1c,
  GPIO_Speed_2MHz: 2, GPIO_Speed_10MHz: 1, GPIO_Speed_50MHz: 3, GPIO_Pin_All: 0xffff,
  RCC_APB2Periph_AFIO: 0x01, RCC_APB2Periph_GPIOA: 0x04, RCC_APB2Periph_GPIOB: 0x08,
  RCC_APB2Periph_GPIOC: 0x10, RCC_APB2Periph_GPIOD: 0x20, RCC_APB2Periph_GPIOE: 0x40,
  RCC_APB2Periph_GPIOF: 0x80, RCC_APB2Periph_GPIOG: 0x100, RCC_APB2Periph_ADC1: 0x200,
  RCC_APB2Periph_ADC2: 0x400, RCC_APB2Periph_TIM1: 0x800, RCC_APB2Periph_SPI1: 0x1000,
  RCC_APB2Periph_USART1: 0x4000, RCC_APB2Periph_ADC3: 0x8000,
  RCC_APB1Periph_TIM2: 0x01, RCC_APB1Periph_TIM3: 0x02, RCC_APB1Periph_TIM4: 0x04,
  RCC_APB1Periph_TIM5: 0x08, RCC_APB1Periph_TIM6: 0x10, RCC_APB1Periph_TIM7: 0x20,
  RCC_APB1Periph_SPI2: 0x4000, RCC_APB1Periph_SPI3: 0x8000,
  RCC_APB1Periph_USART2: 0x20000, RCC_APB1Periph_USART3: 0x40000,
  RCC_APB1Periph_UART4: 0x80000, RCC_APB1Periph_UART5: 0x100000,
  RCC_APB1Periph_I2C1: 0x200000, RCC_APB1Periph_I2C2: 0x400000,
  RCC_APB1Periph_PWR: 0x10000000, RCC_APB1Periph_BKP: 0x08000000,
  TIM_CounterMode_Up: 0, TIM_CounterMode_Down: 0x10, TIM_CounterMode_CenterAligned1: 0x20,
  TIM_CKD_DIV1: 0, TIM_CKD_DIV2: 0x100, TIM_CKD_DIV4: 0x200,
  TIM_OCMode_Timing: 0, TIM_OCMode_Active: 0x10, TIM_OCMode_Inactive: 0x20,
  TIM_OCMode_Toggle: 0x30, TIM_OCMode_PWM1: 0x60, TIM_OCMode_PWM2: 0x70,
  TIM_OutputState_Disable: 0, TIM_OutputState_Enable: 1,
  TIM_OutputNState_Disable: 0, TIM_OutputNState_Enable: 4,
  TIM_OCPolarity_High: 0, TIM_OCPolarity_Low: 2, TIM_OCNPolarity_High: 0, TIM_OCNPolarity_Low: 8,
  TIM_OCIdleState_Reset: 0, TIM_OCIdleState_Set: 0x100,
  TIM_OCNIdleState_Reset: 0, TIM_OCNIdleState_Set: 0x200,
  TIM_OCPreload_Enable: 8, TIM_OCPreload_Disable: 0,
  TIM_PSCReloadMode_Update: 0, TIM_PSCReloadMode_Immediate: 1,
  TIM_Channel_1: 0, TIM_Channel_2: 4, TIM_Channel_3: 8, TIM_Channel_4: 12,
  TIM_IT_Update: 1, TIM_IT_CC1: 2, TIM_FLAG_Update: 1, TIM_FLAG_CC1: 2,
  TIM_Select_VCM: 0, TIM_EventSource_Update: 1,
  ADC_Mode_Independent: 0, ADC_ExternalTrigConv_None: 0xe0000,
  ADC_DataAlign_Right: 0, ADC_DataAlign_Left: 0x800, ADC_FLAG_EOC: 2,
  ADC_FLAG_AWD: 1, ADC_FLAG_JEOC: 4, ADC_FLAG_JSTRT: 8, ADC_FLAG_STRT: 0x10,
  RCC_PCLK2_Div2: 0, RCC_PCLK2_Div4: 0x4000, RCC_PCLK2_Div6: 0x8000, RCC_PCLK2_Div8: 0xc000,
  USART_WordLength_8b: 0, USART_WordLength_9b: 0x1000, USART_StopBits_1: 0,
  USART_StopBits_0_5: 0x1000, USART_StopBits_2: 0x2000, USART_StopBits_1_5: 0x3000,
  USART_Parity_No: 0, USART_Parity_Even: 0x400, USART_Parity_Odd: 0x600,
  USART_Mode_Rx: 4, USART_Mode_Tx: 8, USART_HardwareFlowControl_None: 0,
  USART_HardwareFlowControl_RTS: 0x100, USART_HardwareFlowControl_CTS: 0x200,
  USART_HardwareFlowControl_RTS_CTS: 0x300, USART_FLAG_PE: 1, USART_FLAG_FE: 2,
  USART_FLAG_NE: 4, USART_FLAG_ORE: 8, USART_FLAG_IDLE: 0x10, USART_FLAG_RXNE: 0x20,
  USART_FLAG_TC: 0x40, USART_FLAG_TXE: 0x80, USART_IT_RXNE: 0x525,
  NVIC_PriorityGroup_0: 0x700, NVIC_PriorityGroup_1: 0x600, NVIC_PriorityGroup_2: 0x500,
  NVIC_PriorityGroup_3: 0x400, NVIC_PriorityGroup_4: 0x300,
  EXTI_Mode_Interrupt: 0, EXTI_Mode_Event: 4, EXTI_Trigger_Rising: 8,
  EXTI_Trigger_Falling: 0xc, EXTI_Trigger_Rising_Falling: 0x10,
  GPIO_Remap_SWJ_Disable: 0x4000000, GPIO_Remap_SWJ_JTAGDisable: 0x2000000,
  GPIO_Remap_SWJ_NoJTRST: 0x1000000, GPIO_FullRemap_TIM2: 0x300,
  GPIO_PartialRemap1_TIM2: 0x100, GPIO_PartialRemap2_TIM2: 0x200
};
for (let i = 0; i < 16; i++) {
  CONSTANTS["GPIO_Pin_" + i] = 1 << i;
  CONSTANTS["GPIO_PinSource" + i] = i;
  CONSTANTS["EXTI_Line" + i] = 1 << i;
}
for (let i = 0; i < 7; i++) CONSTANTS["GPIO_PortSourceGPIO" + String.fromCharCode(65 + i)] = i;
for (let i = 0; i < 18; i++) CONSTANTS["ADC_Channel_" + i] = i;
["1Cycles5", "7Cycles5", "13Cycles5", "28Cycles5", "41Cycles5", "55Cycles5", "71Cycles5", "239Cycles5"].forEach((n, i) => CONSTANTS["ADC_SampleTime_" + n] = i);
Object.assign(CONSTANTS, { EXTI0_IRQn: 6, EXTI1_IRQn: 7, EXTI2_IRQn: 8, EXTI3_IRQn: 9, EXTI4_IRQn: 10, EXTI9_5_IRQn: 23, EXTI15_10_IRQn: 40, TIM1_UP_IRQn: 25, TIM2_IRQn: 28, TIM3_IRQn: 29, TIM4_IRQn: 30, USART1_IRQn: 37, USART2_IRQn: 38, USART3_IRQn: 39, ADC1_2_IRQn: 18 });
const MODE_NAMES = Object.fromEntries(Object.entries(CONSTANTS).filter(([k]) => k.startsWith("GPIO_Mode_")).map(([k, v]) => [v, k]));
const APB2 = { GPIOA: 4, GPIOB: 8, GPIOC: 16, GPIOD: 32, GPIOE: 64, GPIOF: 128, GPIOG: 256, ADC1: 512, ADC2: 1024, TIM1: 2048, SPI1: 4096, USART1: 16384, ADC3: 32768, AFIO: 1 };
const APB1 = { TIM2: 1, TIM3: 2, TIM4: 4, TIM5: 8, TIM6: 16, TIM7: 32, SPI2: 0x4000, SPI3: 0x8000, USART2: 0x20000, USART3: 0x40000, UART4: 0x80000, UART5: 0x100000, I2C1: 0x200000, I2C2: 0x400000, PWR: 0x10000000, BKP: 0x08000000 };
const PWM_PINS = { TIM1: ["PA8", "PA9", "PA10", "PA11"], TIM2: ["PA0", "PA1", "PA2", "PA3"], TIM3: ["PA6", "PA7", "PB0", "PB1"], TIM4: ["PB6", "PB7", "PB8", "PB9"] };
const ADC_PINS = ["PA0", "PA1", "PA2", "PA3", "PA4", "PA5", "PA6", "PA7", "PB0", "PB1", "PC0", "PC1", "PC2", "PC3", "PC4", "PC5"];
const API_NAMES = [
  "RCC_APB2PeriphClockCmd", "RCC_APB1PeriphClockCmd", "RCC_ADCCLKConfig", "RCC_AHBPeriphClockCmd",
  "GPIO_Init", "GPIO_StructInit", "GPIO_SetBits", "GPIO_ResetBits", "GPIO_WriteBit", "GPIO_Write",
  "GPIO_ReadInputDataBit", "GPIO_ReadOutputDataBit", "GPIO_ReadInputData", "GPIO_ReadOutputData",
  "GPIO_DeInit", "GPIO_PinRemapConfig", "GPIO_EXTILineConfig",
  "Delay_ms", "Delay_us", "Delay_s", "delay_ms", "delay_us", "Delay_Init",
  "TIM_InternalClockConfig", "TIM_TimeBaseInit", "TIM_TimeBaseStructInit", "TIM_OCStructInit",
  "TIM_Cmd", "TIM_SetCounter", "TIM_GetCounter", "TIM_SetAutoreload", "TIM_PrescalerConfig",
  "TIM_ARRPreloadConfig", "TIM_CtrlPWMOutputs", "TIM_GenerateEvent", "TIM_ITConfig",
  "TIM_GetITStatus", "TIM_ClearITPendingBit", "TIM_GetFlagStatus", "TIM_ClearFlag",
  "ADC_Init", "ADC_StructInit", "ADC_RegularChannelConfig", "ADC_Cmd", "ADC_ResetCalibration",
  "ADC_GetResetCalibrationStatus", "ADC_StartCalibration", "ADC_GetCalibrationStatus",
  "ADC_SoftwareStartConvCmd", "ADC_GetFlagStatus", "ADC_GetConversionValue", "ADC_ClearFlag",
  "ADC_ExternalTrigConvCmd",
  "USART_Init", "USART_StructInit", "USART_Cmd", "USART_SendData", "USART_ReceiveData",
  "USART_GetFlagStatus", "USART_ClearFlag", "USART_ITConfig", "USART_GetITStatus", "USART_ClearITPendingBit",
  "NVIC_Init", "NVIC_PriorityGroupConfig", "EXTI_Init", "EXTI_StructInit", "EXTI_GetITStatus", "EXTI_ClearITPendingBit",
  "OLED_Init", "OLED_Clear", "OLED_ShowChar", "OLED_ShowString", "OLED_ShowNum",
  "OLED_ShowSignedNum", "OLED_ShowHexNum", "OLED_ShowBinNum", "OLED_Update",
  "printf", "puts", "putchar", "sprintf", "strlen", "strcmp", "strcpy", "memset", "memcpy",
  "abs", "labs", "fabs", "sqrt", "sin", "cos", "pow", "round", "floor", "ceil",
  "SystemInit", "SystemCoreClockUpdate", "__NOP", "__disable_irq", "__enable_irq", "assert_param",
  "SysTick_Config"
];
for (let i = 1; i <= 4; i++) API_NAMES.push("TIM_OC" + i + "Init", "TIM_OC" + i + "PreloadConfig", "TIM_SetCompare" + i, "TIM_GetCapture" + i);
const ARDUINO_APIS = ["pinMode", "digitalWrite", "digitalRead", "analogRead", "analogWrite",
  "analogReadResolution", "analogWriteResolution", "analogWriteFrequency",
  "delay", "delayMicroseconds", "millis", "micros", "pulseIn", "tone", "noTone", "map", "constrain", "min", "max", "F",
  "ArduinoSerial_begin", "ArduinoSerial_end", "ArduinoSerial_print", "ArduinoSerial_println",
  "ArduinoSerial_available", "ArduinoSerial_read", "ArduinoSerial_peek", "ArduinoSerial_write", "ArduinoSerial_flush",
  "ArduinoWire_begin", "ArduinoWire_beginTransmission", "ArduinoWire_write", "ArduinoWire_endTransmission",
  "ArduinoWire_requestFrom", "ArduinoWire_available", "ArduinoWire_read", "ArduinoWire_peek"];
API_NAMES.push(...ARDUINO_APIS);
export const SUPPORTED_APIS = Object.freeze([...API_NAMES]);
const API_SET = new Set(API_NAMES);
// Arity is part of the compatibility layer: a missing GPIO_WriteBit third
// argument must be diagnosed, not treated as an implicit zero.
const API_ARITY = {};
const arities = (n, names) => names.split(" ").filter(Boolean).forEach(name => API_ARITY[name] = n);
arities(0, "Delay_Init OLED_Init OLED_Clear OLED_Update SystemInit SystemCoreClockUpdate __NOP __disable_irq __enable_irq");
arities(1, "GPIO_StructInit GPIO_ReadInputData GPIO_ReadOutputData GPIO_DeInit Delay_ms Delay_us Delay_s delay_ms delay_us TIM_InternalClockConfig TIM_TimeBaseStructInit TIM_OCStructInit TIM_GetCounter ADC_StructInit ADC_ResetCalibration ADC_GetResetCalibrationStatus ADC_StartCalibration ADC_GetCalibrationStatus ADC_GetConversionValue USART_StructInit USART_ReceiveData NVIC_Init NVIC_PriorityGroupConfig EXTI_Init EXTI_StructInit EXTI_GetITStatus EXTI_ClearITPendingBit puts putchar strlen abs labs fabs sqrt sin cos round floor ceil assert_param SysTick_Config RCC_ADCCLKConfig");
arities(2, "RCC_APB2PeriphClockCmd RCC_APB1PeriphClockCmd RCC_AHBPeriphClockCmd GPIO_Init GPIO_SetBits GPIO_ResetBits GPIO_Write GPIO_ReadInputDataBit GPIO_ReadOutputDataBit GPIO_PinRemapConfig GPIO_EXTILineConfig TIM_TimeBaseInit TIM_Cmd TIM_SetCounter TIM_SetAutoreload TIM_ARRPreloadConfig TIM_CtrlPWMOutputs TIM_GenerateEvent TIM_GetITStatus TIM_ClearITPendingBit TIM_GetFlagStatus TIM_ClearFlag ADC_Init ADC_Cmd ADC_SoftwareStartConvCmd ADC_GetFlagStatus ADC_ClearFlag ADC_ExternalTrigConvCmd USART_Init USART_Cmd USART_SendData USART_GetFlagStatus USART_ClearFlag USART_GetITStatus USART_ClearITPendingBit strcmp strcpy pow");
arities(3, "GPIO_WriteBit TIM_PrescalerConfig TIM_ITConfig USART_ITConfig OLED_ShowChar OLED_ShowString memset memcpy");
arities(4, "ADC_RegularChannelConfig OLED_ShowNum OLED_ShowSignedNum OLED_ShowHexNum OLED_ShowBinNum");
for (let i = 1; i <= 4; i++) { API_ARITY["TIM_OC" + i + "Init"] = 2; API_ARITY["TIM_OC" + i + "PreloadConfig"] = 2; API_ARITY["TIM_SetCompare" + i] = 2; API_ARITY["TIM_GetCapture" + i] = 1; }
arities(0, "millis micros ArduinoSerial_end ArduinoSerial_available ArduinoSerial_read ArduinoSerial_peek ArduinoSerial_flush ArduinoWire_begin");
arities(0, "ArduinoWire_available ArduinoWire_read ArduinoWire_peek");
arities(1, "digitalRead analogRead analogReadResolution analogWriteResolution delay delayMicroseconds noTone F ArduinoWire_beginTransmission");
arities(2, "pinMode digitalWrite analogWrite min max");
arities(3, "constrain");
arities(5, "map");
const API_ARITY_RANGES = { pulseIn:[2,3], tone:[2,3], analogWriteFrequency:[1,2], ArduinoSerial_begin:[1,2],
  ArduinoSerial_print:[1,2], ArduinoSerial_println:[0,2], ArduinoSerial_write:[1,2],
  ArduinoWire_write:[1,2], ArduinoWire_endTransmission:[0,1], ArduinoWire_requestFrom:[2,3] };
const readableApi = name => name.replace(/^Arduino(Serial|Wire)_/, "$1.");
const WIRE_BUFFER_LENGTH = 32;


const walk = (node, fn) => {
  if (!node || typeof node !== "object") return;
  if (node.kind) fn(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === "loc") continue;
    if (Array.isArray(value)) value.forEach(x => walk(x, fn));
    else if (value && typeof value === "object") walk(value, fn);
  }
};
function nearestAPI(name) {
  const distance = (a, b) => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) { let previous = row[0]; row[0] = i;
      for (let j = 1; j <= b.length; j++) { const old = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1)); previous = old; }
    }
    return row[b.length];
  };
  let best = null, score = 5;
  for (const a of API_NAMES) { const d = distance(name, a); if (d < score) { best = a; score = d; } }
  return best;
}
export function compileProject(files, entry = "main.c", options = {}) {
  const normalized = normalizeFiles(files), diagnostics = [];
  const names = Object.keys(normalized);
  if (!names.length) err("NO_FILES", "还没有可以运行的代码文件。", "项目为空。", "新建 main.c，或导入一个示例。", { file: entry });
  const entryName = names.find(n => n === entry) || names.find(n => basename(n) === entry);
  if (!entryName) err("MISSING_ENTRY_FILE", "项目里没有 " + entry + "。", "入口源码文件不存在。", "导入 main.c，或选择正确的入口文件名。", { file: entry });
  if (names.length > 80 || names.reduce((n, k) => n + normalized[k].length, 0) > 1500000)
    err("PROJECT_TOO_LARGE", "这个项目超出了浏览器教学解释器的规模。", "限制为 80 个文件、约 1.5 MB 源码。", "保留你的应用 .c/.h；标准库头文件由平台建模，不需要导入整个固件包。", { file: entryName });
  const units = names.filter(n => /\.(c|cpp|ino)$/i.test(n));
  if (!units.includes(entryName)) units.unshift(entryName);
  const program = { functions: {}, globals: [], structs: structuredClone(STRUCTS), aliases: {}, sources: normalized, entry: entryName, capabilities: ENGINE_CAPABILITIES };
  for (const name of units) {
    const tokens = preprocess(name, normalized, diagnostics, options.predefinedMacros);
    if (tokens.length > 150000) err("TOO_MANY_TOKENS", "源码太大，浏览器无法快速分析。", "单个翻译单元超过 150000 个词元。", "拆分或精简项目；保留学习中的应用代码。", { file: name });
    const parsed = new Parser(tokens, diagnostics).program();
    for (const [fname, f] of Object.entries(parsed.functions)) {
      if (program.functions[fname]) err("DUPLICATE_FUNCTION", "函数 " + fname + " 在多个文件里重复实现了。", "重复的全局函数定义。", "头文件中只保留声明；实现放在一个 .c 文件。", f.loc);
      program.functions[fname] = f;
    }
    program.globals.push(...parsed.globals);
    Object.assign(program.structs, parsed.structs); Object.assign(program.aliases, parsed.aliases);
  }
  if (!program.functions.main) err("MISSING_MAIN", "找不到程序开始运行的 main 函数。", "没有 main 函数定义。", "添加 int main(void) { ... }。", { file: entryName });
  const callErrors = [];
  walk({ functions: program.functions, globals: program.globals }, node => {
    if (node.kind !== "call") return;
    if (node.callee.kind === "member" && node.callee.object.kind === "id" && /^Serial[0-3]?$/.test(node.callee.object.name)) {
      node.serialPort = node.callee.object.name;
      node.callee = {kind:"id",name:"ArduinoSerial_" + node.callee.key,loc:node.callee.loc};
    } else if (node.callee.kind === "member" && node.callee.object.kind === "id" && node.callee.object.name === "Wire") {
      node.callee = {kind:"id",name:"ArduinoWire_" + node.callee.key,loc:node.callee.loc};
    }
    if (node.callee.kind !== "id") {
      callErrors.push(diag("FUNCTION_POINTER_UNSUPPORTED", "暂时不能通过函数指针调用函数。", "本解释器只支持按名称调用函数。", "直接写函数名(参数)。", node.loc)); return;
    }
    const name = node.callee.name;
    const displayName = readableApi(name);
    const expected = program.functions[name]?.params.length ?? API_ARITY[name];
    const range = API_ARITY_RANGES[name];
    if (range && (node.args.length < range[0] || node.args.length > range[1]))
      callErrors.push(diag("ARGUMENT_COUNT", displayName + " 的参数数量不对。", "需要 " + range[0] + "–" + range[1] + " 个参数。", "检查函数说明中的参数个数与逗号。", node.loc));
    if (expected !== undefined && node.args.length !== expected) {
      callErrors.push(diag("ARGUMENT_COUNT", displayName + " 的参数数量不对。", "需要 " + expected + " 个参数，实际写了 " + node.args.length + " 个。", "查看函数说明并补齐参数；多个参数之间使用英文逗号。", node.loc));
    } else if ((name === "printf" && node.args.length < 1) || (name === "sprintf" && node.args.length < 2)) {
      callErrors.push(diag("ARGUMENT_COUNT", name + " 缺少必要参数。", "格式化函数需要格式字符串，sprintf 还需要目标数组。", "例如 printf(\"value=%d\", value)。", node.loc));
    }
    if (!program.functions[name] && !API_SET.has(name)) {
      const suggestion = nearestAPI(name);
      callErrors.push(diag("UNSUPPORTED_API", "找不到或尚未模拟函数 " + displayName + "。", "函数没有用户实现，也不在已支持的外设 API 中。", suggestion ? "你是否想写 " + readableApi(suggestion) + "？若它是自己的函数，请一并导入实现文件。" : "若它是自己的函数，请导入对应 .c 文件；若是外设库函数，请查看能力范围，不会静默跳过。", node.loc));
    }
  });
  if (callErrors.length) throw new CompileError(callErrors);
  return { program, diagnostics };
}

/**
 * Compile user files using the selected board's declared interface model.
 * API presence/arity and syntax are checked here. Electrical configuration,
 * values, bounds and unsupported runtime paths are still checked at execution.
 */
export function compileForBoard(files, boardId = "bluepill") {
  const profile = getBoardProfile(boardId), source = normalizeFiles(files);
  const names = Object.keys(source);
  const isArduino = names.some(n => /\.ino$/i.test(n)) || Object.values(source).some(text => /\bvoid\s+(setup|loop)\s*\(/.test(text));
  if (!isArduino && !profile.dialects.includes("stm32-spl"))
    err("BOARD_DIALECT", profile.name + " 需要 setup()/loop() 风格的教学程序。", "该板不使用 STM32F1 标准外设库模型。", "选择该板的起始示例；本平台不把 F1 的 GPIO/RCC 库冒充其他芯片。", {file:names[0]||"sketch.ino",line:1});
  const main = names.find(n=>/\.ino$/i.test(n)) || names.find(n=>/main\.(c|cpp)$/i.test(n)) || names.find(n=>/\.(c|cpp)$/i.test(n)) || names[0];
  let defines = {STM32F10X_MD:1,USE_STDPERIPH_DRIVER:1};
  if(isArduino) {
    defines = {ARDUINO:10819,F_CPU:profile.coreClockHz};
    if(profile.family==="AVR") {defines.ARDUINO_ARCH_AVR=1;defines[profile.id==="uno-r3"?"ARDUINO_AVR_UNO":profile.id==="nano"?"ARDUINO_AVR_NANO":"ARDUINO_AVR_MEGA2560"]=1;}
    else if(profile.family.startsWith("STM32"))defines.ARDUINO_ARCH_STM32=1;
    else if(profile.family.startsWith("ESP32")) {defines.ARDUINO_ARCH_ESP32=1;defines.ESP32=1;if(profile.family==="ESP32-C3")defines.CONFIG_IDF_TARGET_ESP32C3=1;}
    else if(profile.id==="pico") {defines.ARDUINO_ARCH_MBED_RP2040=1;defines.ARDUINO_ARCH_RP2040=1;}
    Object.assign(defines,profile.arduinoDefines);
    if(Object.values(source).some(text=>/\b(class|template|namespace)\s+[A-Za-z_]/.test(text)))
      err("CPP_SUBSET", "这里使用了完整 C++ 的类、模板或命名空间功能。", "当前只解释 Arduino 风格函数与基础 C 控制流，不是完整 C++ 编译器。", "将复杂库保留给真实 Arduino/PlatformIO 工具链；在平台使用已列明的教学接口。", {file:main,line:1});
    if(Object.values(source).some(text=>/\b(?:int|void)\s+main\s*\(/.test(text)))
      err("ARDUINO_MAIN", "Arduino 示例由 setup 和 loop 启动，不需要另写 main。", "用户 main 与平台提供的启动包装冲突。", "把一次性初始化放在 setup，把重复工作放在 loop。", {file:main,line:1});
    source["__lab_arduino_entry.c"]="int main(void){setup();while(1){loop();}}";
  }
  const result = compileProject(source, main, {predefinedMacros:defines});
  const program=result.program;program.boardId=profile.id;program.dialect=isArduino?"arduino":"stm32-spl";
  const boardErrors=[];
  walk({functions:program.functions,globals:program.globals},node=>{
    if(node.kind==="call") {
      const name=node.callee.name;
      if(!isArduino && name.startsWith("ArduinoWire_"))
        boardErrors.push(diag("BOARD_API",readableApi(name)+" 属于 Arduino 源码接口。","当前程序采用 STM32 标准外设库。","在 Arduino 草图中使用 Wire。",node.loc));
      if(profile.family!=="STM32F1" && /^(GPIO_|RCC_|TIM_|ADC_|USART_|NVIC_|EXTI_)/.test(name))
        boardErrors.push(diag("BOARD_API", name + " 属于另一套芯片接口，不能用于 " + profile.name + "。", "没有将 F1 SPL 冒充当前芯片外设实现。", "使用 pinMode/digitalWrite 等该板支持的接口，或在真实工具链使用本芯片 SDK。", node.loc));
      if(node.serialPort&&!profile.serialPorts.includes(node.serialPort))
        boardErrors.push(diag("BOARD_SERIAL_PORT", profile.name+" 未提供这个串口模型："+node.serialPort, "串口实例不在当前板型支持表中。", "选择 "+profile.serialPorts.join("、")+"。", node.loc));
      const unsupportedAnalogInput = profile.capabilities.analogInput===false && ["analogRead","analogReadResolution"].includes(name);
      const unsupportedPwm = profile.capabilities.pwm===false && ["analogWrite","analogWriteResolution","analogWriteFrequency","tone","noTone"].includes(name);
      if(!Object.hasOwn(program.functions,name) && (unsupportedAnalogInput||unsupportedPwm))
        boardErrors.push(diag("BOARD_API",profile.name+" 的教学接口不支持 "+name+"。",unsupportedAnalogInput?"板型未提供 ADC 采样。":"板型未提供 PWM 输出。","使用数字 GPIO 实验，或查阅实际硬件的接口资料。",node.loc));
      else if(["analogReadResolution","analogWriteResolution","analogWriteFrequency"].includes(name) && (profile.family==="AVR"||profile.capabilities[name]===false))
        boardErrors.push(diag("BOARD_API", profile.name+" 的当前教学接口不支持 "+name+"。", "当前使用默认 "+profile.adcDefaultBits+" 位 ADC 和 "+profile.pwmBits+" 位 PWM。", "使用该板的默认数值范围，或查阅所用 Arduino core 的文档。", node.loc));
    }
  });
  if(boardErrors.length)throw new CompileError(boardErrors);
  if(isArduino) {
    program.syntheticFiles=["__lab_arduino_entry.c"];
    const loopLoc=program.functions.loop.loc;
    walk(program.functions.main.body,n=>{n.loc={...loopLoc};});
    program.functions.main.loc={...loopLoc};
    program.entry=main;
  }
  result.boardId=profile.id;
  result.diagnostics.push(diag("STATIC_CHECK_SCOPE","语法与已知函数接口检查通过。","静态检查不等于真实芯片编译；变量值、引脚能力、电气连接和执行分支仍会在运行时检查。","运行后查看具体行号的提示；真实工程还需在对应工具链编译与实板验证。",{file:main,line:1},"info"));
  return result;
}
export function createBoardRuntime(compiled, hooks = {}, boardId = null) {
  const program=compiled?.program||compiled, profile=getBoardProfile(boardId||compiled?.boardId||program?.boardId||"bluepill");
  if(program?.boardId&&program.boardId!==profile.id)throw new Error("程序编译板型与运行板型不一致，请重新检查当前板卡。");
  return createRuntime({...program,boardId:profile.id},hooks);
}

function calculate(op, a, b) {
  switch (op) {
    case "+": return a + b; case "-": return a - b; case "*": return a * b;
    case "/": return a / b; case "%": return a % b;
    case "<<": return a << b; case ">>": return a >> b; case "&": return a & b;
    case "|": return a | b; case "^": return a ^ b;
    case "==": return +(a === b); case "!=": return +(a !== b);
    case "<": return +(a < b); case ">": return +(a > b); case "<=": return +(a <= b); case ">=": return +(a >= b);
    case "&&": return +(!!a && !!b); case "||": return +(!!a || !!b);
    case ",": return b;
    default: throw new Error("Unknown operator: " + op);
  }
}
function typeBytes(type, pointer = 0) {
  if (pointer) return 4;
  if (/char|int8|\bu8\b|\bs8\b|bool|_Bool/.test(type)) return 1;
  if (/short|int16|\bu16\b|\bs16\b/.test(type)) return 2;
  if (/double|int64|long long/.test(type)) return 8;
  return 4;
}
const isRef = (v) => v && typeof v === "object" && v.__ref === true;
const deref = (v) => isRef(v) ? v.get() : v;
const asText = (v) => {
  v = deref(v);
  if (Array.isArray(v)) { const z = v.indexOf(0); return v.slice(0, z < 0 ? v.length : z).map(x => typeof x === "number" ? String.fromCharCode(x) : String(x)).join(""); }
  return v == null ? "" : String(v);
};
const simpleClone = (v, depth = 0, observe = false) => {
  if (depth > 5) return "[...]";
  if (isRef(v)) return { pointerTo: v.name || "变量", value: simpleClone(observe ? v.peek?.() : v.get(), depth + 1, observe) };
  if (Array.isArray(v)) return v.slice(0, 80).map(x => simpleClone(x, depth + 1, observe));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith("__")).map(([k, a]) => [k, simpleClone(a, depth + 1, observe)]));
  return v;
};
class Scope {
  constructor(parent = null) { this.parent = parent; this.values = new Map(); }
  find(name) { if (this.values.has(name)) return this.values.get(name); return this.parent?.find(name); }
  add(name, cell) { this.values.set(name, cell); }
}

export function createRuntime(programOrResult, hooks = {}) {
  const program = programOrResult?.program || programOrResult;
  const board = getBoardProfile(program?.boardId || hooks.boardId || "bluepill");
  const arduinoMode = program?.dialect === "arduino";
  const runtimeCapabilities = {...ENGINE_CAPABILITIES,target:board.name,boardId:board.id,dialect:program?.dialect||"stm32-spl",logicVoltage:board.logicVoltage,adcMax:board.adcMax};
  if (!program?.functions?.main) throw new Error("createRuntime 需要 compileProject 返回的 program。");
  let state, rootScope, activeScope, iterator, stack, warned, currentLoc, iterations, staticStorage, pendingDelay, wire;
  const faults = (code, plain, technical, fix, loc = currentLoc) => { throw new RuntimeFault(diag(code, plain, technical, fix, loc)); };
  function emit(type, data = {}, loc = currentLoc) {
    const event = { type, timeMs: state.timeMs, ...locOf(loc), ...data };
    state.events.push(event); if (state.events.length > 1200) state.events.splice(0, 300);
    try { hooks.onEvent?.(event); } catch (e) {
      const d = diag("HOOK_ERROR", "电路界面处理事件时出错了。", String(e?.message || e), "重置项目后重试；代码运行已暂停。", loc);
      throw new RuntimeFault(d);
    }
    return event;
  }
  function beginDelay(durationMs, loc, complete) {
    const fromMs = state.timeMs;
    if (durationMs > 0) {
      try { hooks.onBeforeDelay?.({ fromMs, durationMs }, readDelayState); }
      catch (error) { faults("HOOK_ERROR", "电路界面处理等待时出错了。", String(error?.message || error), "重置项目后重试；代码运行已暂停。", loc); }
    }
    pendingDelay = { fromMs, durationMs, toMs: fromMs + durationMs, loc, complete };
    return pendingDelay;
  }
  function progressDelay(deadlineMs) {
    const { fromMs, durationMs, toMs, loc, complete } = pendingDelay;
    state.timeMs = Math.min(toMs, deadlineMs);
    refreshPins();
    let event = null;
    if (state.timeMs === toMs) {
      pendingDelay = null;
      event = emit("delay", { durationMs, fromMs, toMs, plain: "虚拟时间前进 " + durationMs + " 毫秒" }, loc);
      state.lastEvent = event;
      complete?.(fromMs, toMs);
    }
    state.pc = locOf(loc);
    state.status = "waiting";
    return event;
  }
  function warn(code, plain, technical, fix, loc = currentLoc, key = "") {
    const id = code + ":" + (loc?.file || "") + ":" + (loc?.line || "") + ":" + key;
    if (warned.has(id)) return;
    warned.add(id); const d = diag(code, plain, technical, fix, loc, "warning");
    state.diagnostics.push(d); emit("diagnostic", { diagnostic: d }, loc);
  }
  function coerce(value, type, pointer = 0) {
    if (pointer || value && typeof value === "object" || typeof value === "string") return value;
    const t = program.aliases[type] || type;
    if (/float|double/.test(t)) return Number(value);
    if (t === "bool" || t === "_Bool" || t === "boolean") return +!!value;
    if (/uint8|\bu8\b|unsigned char|^byte$/.test(t)) return Number(value) & 0xff;
    if (/int8|\bs8\b|signed char/.test(t)) return (Number(value) << 24) >> 24;
    if (/uint16|\bu16\b|unsigned short|^word$/.test(t)) return Number(value) & 0xffff;
    if (/int16|\bs16\b|short/.test(t)) return (Number(value) << 16) >> 16;
    if (board.intBits === 16 && /^(unsigned|unsigned int)$/.test(t)) return Number(value) & 0xffff;
    if (board.intBits === 16 && /^(int|signed|signed int)$/.test(t)) return (Number(value) << 16) >> 16;
    if (/uint32|\bu32\b|unsigned/.test(t)) return Number(value) >>> 0;
    return Number(value) | 0;
  }
  function getCell(scope, name, loc) {
    const cell = scope.find(name);
    if (!cell) faults("UNKNOWN_VARIABLE", "还没有定义 " + name + "。", "找不到这个变量或常量。", "检查拼写；变量要先声明，宏要先定义，相关头文件要导入。", loc);
    return cell;
  }
  function cellRef(cell, name, loc) {
    return {
      __ref: true, name, type: cell.type, pointer: cell.pointer,
      peek: () => cell.value,
      get() {
        if (!cell.initialized) warn("UNINITIALIZED_READ", "变量 " + name + " 还没有赋值就被读取了。", "真实 C 程序中的局部变量值不确定；教学仿真暂以 0 显示。", "声明时赋初值，例如 int count = 0。", loc, name);
        return cell.value;
      },
      set(value) {
        if (cell.constant) faults("READ_ONLY_VARIABLE", name + " 是只读的，不能改写。", "尝试给 const 变量或库常量赋值。", "改写普通变量；不要改动 GPIO_Pin_0 等常量。", loc);
        cell.value = coerce(value, cell.type, cell.pointer); cell.initialized = true;
      }
    };
  }
  function periph(value, prefix, loc = currentLoc) {
    value = deref(value);
    if (!value?.__periph || prefix && !value.__periph.startsWith(prefix)) faults("BAD_PERIPHERAL", "这里没有传入正确的外设。", "需要 " + (prefix || "已建模外设") + " 对象。", "例如 GPIO_SetBits(GPIOA, GPIO_Pin_0)。", loc);
    return value.__periph;
  }
  function timer(name) {
    if (!state.timers[name]) state.timers[name] = { name, clock: false, enabled: false, prescaler: 0, period: 65535, counter: 0, startMs: state.timeMs, counterMode: 0, channels: {}, mainOutput: name !== "TIM1" };
    return state.timers[name];
  }
  function adc(name) {
    if (!state.adc[name]) state.adc[name] = { name, clock: false, enabled: false, channel: 0, continuous: false, started: false, eoc: false, value: 0, align: 0, sampleTime: 0 };
    return state.adc[name];
  }
  function uart(name) {
    if (!state.uarts[name]) state.uarts[name] = { name, clock: false, enabled: false, baudRate: 9600, mode: 12, wordLength: 8, stopBits: 1, parity: "none", rx: [], tx: "" };
    return state.uarts[name];
  }
  function enabledClock(name, loc = currentLoc) {
    if (state.clocks[name]) return true;
    const bus = Object.hasOwn(APB2, name) ? "APB2" : "APB1";
    warn("CLOCK_DISABLED", name + " 的时钟还没打开，这次操作没有生效。", "外设总线时钟被 RCC 门控。", "先调用 RCC_" + bus + "PeriphClockCmd(RCC_" + bus + "Periph_" + name + ", ENABLE)。", loc, name);
    return false;
  }
  function portPins(name, mask, loc = currentLoc) {
    const m = Number(mask) & 0xffff;
    if (!m) warn("EMPTY_PIN_MASK", "没有选中任何引脚。", "GPIO_Pin 位掩码等于 0。", "填写 GPIO_Pin_0 等常量，多个引脚使用 | 连接。", loc, name);
    return Array.from({ length: 16 }, (_, i) => state.pins["P" + name.slice(-1) + i]).filter(p => m & (1 << p.pin));
  }
  function refreshPins({ adc, uarts, pins, clocks, timers, timeMs, coreClockHz } = state) {
    for (const [name, a] of Object.entries(adc)) a.clock = !!clocks[name];
    for (const [name, u] of Object.entries(uarts)) u.clock = !!clocks[name];
    for (const pin of Object.values(pins)) {
      pin.clock = !!clocks[pin.port]; pin.pwm = null;
      if (pin.mode === "GPIO_Mode_Out_PP") pin.level = pin.output;
      else if (pin.mode === "GPIO_Mode_Out_OD") pin.level = pin.output ? null : 0;
      else if (pin.mode === "GPIO_Mode_IPU") pin.level = 1;
      else if (pin.mode === "GPIO_Mode_IPD") pin.level = 0;
      else pin.level = null;
    }
    for (const pin of Object.values(pins)) if (pin.arduinoPWM) {
      const pwm = pin.arduinoPWM;
      if (pwm.endMs != null && timeMs >= pwm.endMs) {
        pin.arduinoPWM = null; pin.mode = "GPIO_Mode_Out_PP"; pin.output = 0; pin.level = 0;
      } else {
        pin.pwm = {...pwm};
        const phase = ((((timeMs-(pwm.startMs||0))*pwm.frequencyHz/1000)%1)+1)%1;
        pin.level = +(phase < pwm.duty);
      }
    }
    for (const [name, tm] of Object.entries(timers)) {
      tm.clock = !!clocks[name]; tm.frequencyHz = coreClockHz / ((tm.prescaler + 1) * (tm.period + 1));
      if (!(tm.clock && tm.enabled && tm.mainOutput)) continue;
      for (const [channel, oc] of Object.entries(tm.channels)) {
        const pinName = PWM_PINS[name]?.[Number(channel) - 1], pin = pins[pinName];
        if (!pin || !["GPIO_Mode_AF_PP", "GPIO_Mode_AF_OD"].includes(pin.mode) || !oc.enabled) continue;
        let duty = Math.max(0, Math.min(1, oc.compare / (tm.period + 1)));
        if (oc.mode === CONSTANTS.TIM_OCMode_PWM2) duty = 1 - duty;
        if (oc.polarity === CONSTANTS.TIM_OCPolarity_Low) duty = 1 - duty;
        if (![CONSTANTS.TIM_OCMode_PWM1, CONSTANTS.TIM_OCMode_PWM2].includes(oc.mode)) continue;
        pin.pwm = { timer: name, channel: Number(channel), frequencyHz: tm.frequencyHz, duty, compare: oc.compare, period: tm.period, prescaler: tm.prescaler, startMs: tm.startMs };
        const elapsed = Math.max(0, timeMs - tm.startMs);
        const phase = ((elapsed * tm.frequencyHz / 1000) % 1 + 1) % 1;
        const level = +(phase < duty);
        pin.level = pin.mode === "GPIO_Mode_AF_OD" && level ? null : level;
      }
    }
  }
  function readDigital(pinName, loc = currentLoc) {
    refreshPins();
    const pin = state.pins[pinName];
    let external;
    try { external = hooks.readPin?.(pinName, state); }
    catch (e) { faults("CIRCUIT_READ_ERROR", "读取电路引脚时出错。", String(e?.message || e), "检查元件连接后重置。", loc); }
    if (external && typeof external === "object") external = external.level;
    if (external === 0 || external === 1 || typeof external === "boolean") return +!!external;
    if (pin.level != null) return +!!pin.level;
    warn("FLOATING_INPUT", pinName + " 没有明确的高低电平。", "输入悬空；真实设备的读值可能随噪声变化。教学仿真读取为 0。", "连接按键和上拉/下拉，或选择 GPIO_Mode_IPU / GPIO_Mode_IPD。", loc, pinName);
    return 0;
  }
  function writeOutput(name, mask, value, loc = currentLoc) {
    if (!enabledClock(name, loc)) return;
    for (const p of portPins(name, mask, loc)) {
      const old = p.output; p.output = +!!value;
      if (p.mode === "GPIO_Mode_IPU" || p.mode === "GPIO_Mode_IPD") { p.mode = p.output ? "GPIO_Mode_IPU" : "GPIO_Mode_IPD"; p.pull = p.output ? "up" : "down"; }
      if (!["GPIO_Mode_Out_PP", "GPIO_Mode_Out_OD", "GPIO_Mode_IPU", "GPIO_Mode_IPD"].includes(p.mode))
        warn("PIN_NOT_OUTPUT", p.name + " 尚未配置成普通输出，写入值不会直接驱动引脚。", "ODR 锁存值改变，但引脚仍处于输入/模拟/复用模式。", "先用 GPIO_Init 配置 GPIO_Mode_Out_PP；复用输出应由对应外设驱动。", loc, p.name);
      emit("gpio", { pin: p.name, value: p.output, previous: old, mode: p.mode, plain: p.name + " 的输出锁存值变为 " + p.output }, loc);
    }
    refreshPins();
  }
  function readRegister(name, key, loc) {
    if (name.startsWith("GPIO")) {
      if (key === "ODR") return portPins(name, 0xffff).reduce((v, p) => v | (p.output << p.pin), 0);
      if (key === "IDR") return portPins(name, 0xffff).reduce((v, p) => v | (readDigital(p.name, loc) << p.pin), 0);
      if (key === "BSRR" || key === "BRR") return 0;
      if (key === "CRL" || key === "CRH") {
        return portPins(name, 0xffff).filter(p => key === "CRL" ? p.pin < 8 : p.pin >= 8).reduce((v, p) => {
          const mode = CONSTANTS[p.mode] || 0, cnf = (mode & 0x0c) >> 2;
          const bits = mode & 0x10 ? cnf * 4 + p.speedCode : cnf * 4;
          return v | (bits << ((p.pin % 8) * 4));
        }, 0) >>> 0;
      }
    }
    if (name.startsWith("TIM")) {
      const tm = timer(name);
      if (key === "PSC") return tm.prescaler;
      if (key === "ARR") return tm.period;
      if (key === "CNT") return timerCounter(tm);
      if (/^CCR[1-4]$/.test(key)) return tm.channels[key.slice(-1)]?.compare || 0;
      if (key === "CR1") return +tm.enabled;
    }
    if (name.startsWith("USART")) {
      const u = uart(name);
      if (key === "DR") return u.rx.shift() || 0;
      if (key === "SR") return 0xc0 | (u.rx.length ? 0x20 : 0);
    }
    if (name.startsWith("ADC")) {
      if (key === "DR") return adc(name).value;
      if (key === "SR") return adc(name).eoc ? 2 : 0;
    }
    if (name === "RCC" && ["APB2ENR", "APB1ENR"].includes(key)) {
      const map = key === "APB2ENR" ? APB2 : APB1;
      return Object.entries(map).reduce((v, [n, bit]) => v | (state.clocks[n] ? bit : 0), 0);
    }
    faults("UNSUPPORTED_REGISTER", "寄存器 " + name + "->" + key + " 尚未建模。", "平台不会猜测或跳过这个寄存器读操作。", "改用已支持的标准库 API，或查看能力范围。", loc);
  }
  function writeRegister(name, key, value, loc) {
    if (name.startsWith("GPIO")) {
      if (key === "ODR") { writeOutput(name, value & 0xffff, 1, loc); writeOutput(name, (~value) & 0xffff, 0, loc); return; }
      if (key === "BSRR") { if (value & 0xffff) writeOutput(name, value & 0xffff, 1, loc); if ((value >>> 16) & 0xffff) writeOutput(name, (value >>> 16) & 0xffff, 0, loc); return; }
      if (key === "BRR") { writeOutput(name, value & 0xffff, 0, loc); return; }
      if (key === "CRL" || key === "CRH") {
        if (!enabledClock(name, loc)) return;
        for (const p of portPins(name, 0xffff).filter(p => key === "CRL" ? p.pin < 8 : p.pin >= 8)) {
          const nibble = (value >>> ((p.pin % 8) * 4)) & 0xf, speed = nibble & 3, cnf = nibble >> 2;
          p.configured = true; p.speedCode = speed; p.speedMHz = ({ 1: 10, 2: 2, 3: 50 })[speed] || 0;
          p.mode = speed ? ["GPIO_Mode_Out_PP", "GPIO_Mode_Out_OD", "GPIO_Mode_AF_PP", "GPIO_Mode_AF_OD"][cnf] : ["GPIO_Mode_AIN", "GPIO_Mode_IN_FLOATING", p.output ? "GPIO_Mode_IPU" : "GPIO_Mode_IPD", "GPIO_Mode_IN_FLOATING"][cnf];
        }
        refreshPins(); emit("gpio-config", { port: name, register: key, value }, loc); return;
      }
    }
    if (name.startsWith("TIM")) {
      if (!enabledClock(name, loc)) return;
      const tm = timer(name);
      if (key === "PSC") tm.prescaler = value & 0xffff;
      else if (key === "ARR") tm.period = value & 0xffff;
      else if (key === "CNT") { tm.counter = value & 0xffff; tm.startMs = state.timeMs; }
      else if (/^CCR[1-4]$/.test(key)) {
        const ch = key.slice(-1); if (!tm.channels[ch]) tm.channels[ch] = { mode: 0x60, enabled: false, polarity: 0, compare: 0 };
        tm.channels[ch].compare = value & 0xffff;
      } else if (key === "CR1") { tm.enabled = !!(value & 1); tm.startMs = state.timeMs; }
      else faults("UNSUPPORTED_REGISTER", name + "->" + key + " 的写入暂未建模。", "不支持的定时器寄存器。", "请用已支持的标准库初始化和 PWM 函数。", loc);
      refreshPins(); emit("pwm", { timer: name, register: key, value }, loc); return;
    }
    if (name.startsWith("USART") && key === "DR") { sendSerial(name, value, loc); return; }
    if (name === "RCC" && ["APB2ENR", "APB1ENR"].includes(key)) {
      const map = key === "APB2ENR" ? APB2 : APB1;
      for (const [n, bit] of Object.entries(map)) state.clocks[n] = !!(value & bit);
      refreshPins(); emit("clock", { register: key, value }, loc); return;
    }
    faults("UNSUPPORTED_REGISTER", "寄存器 " + name + "->" + key + " 的写入尚未建模。", "平台不会把未实现的寄存器操作当作成功。", "请使用已支持的标准库 API。", loc);
  }
  function* reference(node, scope) {
    if (node.kind === "id") return cellRef(getCell(scope, node.name, node.loc), node.name, node.loc);
    if (node.kind === "unary" && node.op === "*") {
      const ref = yield* expression(node.value, scope);
      if (!isRef(ref)) faults("INVALID_POINTER", "这个地址不能在教学仿真中读取。", "只支持通过 &变量 获得的引用，不支持任意内存地址。", "使用普通变量、数组或标准库 API。", node.loc);
      return ref;
    }
    if (node.kind === "member") {
      const object = deref(yield* expression(node.object, scope));
      if (!object || typeof object !== "object") faults("NOT_A_STRUCT", "点号左边不是结构体。", "成员访问需要结构体或外设对象。", "检查变量类型和 . / -> 前面的名字。", node.loc);
      if (object.__periph) return { __ref: true, name: object.__periph + "->" + node.key, type: "uint32_t",
        get: () => readRegister(object.__periph, node.key, node.loc), set: v => writeRegister(object.__periph, node.key, v, node.loc) };
      if (!Object.hasOwn(object, node.key)) faults("UNKNOWN_STRUCT_FIELD", "结构体里没有 " + node.key + " 这一项。", "未知的结构体成员。", "检查字段拼写，例如 GPIO_Pin、GPIO_Mode、GPIO_Speed。", node.loc);
      return { __ref: true, name: node.key, type: "uint32_t",
        peek: () => object[node.key],
        get() {
          if (object.__fieldsSet && !object.__fieldsSet.has(node.key)) warn("UNINITIALIZED_STRUCT_FIELD", node.key + " 还没有填写。", "该局部结构体成员尚未初始化，真实 C 中值不确定。", "在调用初始化函数前填写全部需要的字段，或先用对应 StructInit 函数。", node.loc, node.key);
          return object[node.key];
        }, set(v) { object[node.key] = v; object.__fieldsSet?.add(node.key); } };
    }
    if (node.kind === "index") {
      const object = deref(yield* expression(node.object, scope)), index = Number(yield* expression(node.index, scope));
      if (!Number.isInteger(index) || index < 0 || !Array.isArray(object) && typeof object !== "string" || index >= object.length)
        faults("ARRAY_BOUNDS", "数组下标 " + index + " 超出了可用范围。", "访问越界或对象不是数组。", "长度为 N 的数组，只能使用 0 到 N-1 的下标。", node.loc);
      const get = () => typeof object === "string" ? object.charCodeAt(index) : object[index];
      return { __ref: true, name: "[" + index + "]", type: object.__elementType || "int",
        get, peek: get,
        set(v) { if (typeof object === "string") faults("STRING_READ_ONLY", "不能改写字符串常量。", "字符串字面量只读。", "使用 char 数组保存可编辑的文字。", node.loc); object[index] = Array.isArray(v) ? v : coerce(v, object.__elementType || "int"); } };
    }
    faults("NOT_ASSIGNABLE", "等号左边不是一个能存东西的位置。", "表达式不是可修改的左值。", "左边应是变量、数组元素或结构体成员。", node.loc);
  }
  function floatExpression(n, scope) {
    if (!n) return false;
    if (n.kind === "cast") return /float|double/.test(n.type);
    if (n.kind === "literal") return typeof n.value === "number" && !Number.isInteger(n.value) || !!n.float;
    if (n.kind === "id") return /float|double/.test(scope.find(n.name)?.type || "");
    if (n.kind === "binary") return floatExpression(n.left, scope) || floatExpression(n.right, scope);
    if (n.kind === "call") return /float|double/.test(program.functions[n.callee.name]?.returnType || "") || ["sqrt", "sin", "cos", "pow", "fabs"].includes(n.callee.name);
    return false;
  }
  function* expression(node, scope) {
    currentLoc = node.loc || currentLoc;
    switch (node.kind) {
      case "literal": return node.value;
      case "id": return cellRef(getCell(scope, node.name, node.loc), node.name, node.loc).get();
      case "member": case "index": return (yield* reference(node, scope)).get();
      case "initlist": { const out = []; for (const n of node.values) out.push(yield* expression(n, scope)); return out; }
      case "cast": {
        const value = yield* expression(node.value, scope);
        if (node.pointer && !isRef(value) && value !== 0) faults("RAW_POINTER_UNSUPPORTED", "不能把这个数字当作内存地址访问。", "不支持真实 MCU 地址空间的任意指针转换。", "使用 GPIOA->ODR 等已建模寄存器或标准库接口。", node.loc);
        return coerce(value, node.type, node.pointer);
      }
      case "sizeof": {
        if (node.type) return program.structs[node.type] ? program.structs[node.type].length * 4 : typeBytes(node.type, node.pointer);
        if (node.value.kind === "id") {
          const c = getCell(scope, node.value.name, node.loc);
          return Array.isArray(c.value) ? c.value.length * typeBytes(c.type) : program.structs[c.type] ? program.structs[c.type].length * 4 : typeBytes(c.type, c.pointer);
        }
        return 4;
      }
      case "unary": {
        if (node.op === "&") return yield* reference(node.value, scope);
        if (node.op === "*") return (yield* reference(node, scope)).get();
        if (node.op === "++" || node.op === "--") {
          const r = yield* reference(node.value, scope); r.set(Number(r.get()) + (node.op === "++" ? 1 : -1)); return r.get();
        }
        const v = yield* expression(node.value, scope);
        if (node.op === "+") return Number(v);
        if (node.op === "-") return -v;
        if (node.op === "!") return +!v;
        if (node.op === "~") return ~v;
        break;
      }
      case "postfix": {
        const r = yield* reference(node.value, scope), v = r.get(); r.set(Number(v) + (node.op === "++" ? 1 : -1)); return v;
      }
      case "assign": {
        const r = yield* reference(node.left, scope), value = yield* expression(node.right, scope);
        let result = node.op === "=" ? value : calculate(node.op.slice(0, -1), r.get(), value);
        if ((node.op === "/=" || node.op === "%=") && !value) faults("DIVIDE_BY_ZERO", "这里除以了 0。", "除数为零。", "先判断除数是否为 0，或检查变量初值。", node.loc);
        r.set(result); return r.get();
      }
      case "binary": {
        const a = yield* expression(node.left, scope);
        if (node.op === "&&" && !a) return 0;
        if (node.op === "||" && a) return 1;
        const b = yield* expression(node.right, scope);
        if (["/", "%"].includes(node.op) && !b) faults("DIVIDE_BY_ZERO", "这里除以了 0。", "除数为零。", "先判断除数是否为 0。", node.loc);
        if ((a && typeof a === "object" || b && typeof b === "object") && !["==", "!=", ","].includes(node.op))
          faults("POINTER_ARITHMETIC_UNSUPPORTED", "暂时不能对地址做这种运算。", "本解释器不支持通用指针算术。", "改为数组下标访问，或使用普通数值变量。", node.loc);
        const value = calculate(node.op, a, b);
        return node.op === "/" && !floatExpression(node.left, scope) && !floatExpression(node.right, scope) ? Math.trunc(value) : value;
      }
      case "conditional": return (yield* expression(node.test, scope)) ? yield* expression(node.yes, scope) : yield* expression(node.no, scope);
      case "call": {
        const args = []; for (const arg of node.args) args.push(yield* expression(arg, scope));
        const name = node.callee.name; currentLoc = node.loc;
        if (program.functions[name]) return yield* callUser(program.functions[name], args, scope, node.loc);
        const argumentKinds = node.args.map(a => floatExpression(a,scope) ? "float" : a.character || (a.kind==="id" && /^(unsigned |signed )?char$/.test(scope.find(a.name)?.type||"")) ? "char" : "other");
        return yield* callBuiltin(name, args, node.loc, node.serialPort, argumentKinds);
      }
    }
    faults("EXPRESSION_UNSUPPORTED", "这段表达式暂时不能执行。", "未知 AST 节点 " + node.kind, "用已支持的表达式重写。", node.loc);
  }
  function defaultValue(type) {
    if (program.structs[type]) {
      const v = Object.fromEntries(program.structs[type].map(k => [k, 0]));
      Object.defineProperty(v, "__fieldsSet", { value: new Set(), enumerable: false });
      return v;
    }
    return 0;
  }
  function* declare(d, scope, global = false) {
    if (d.external && scope.find(d.name)) return;
    const staticKey = d.loc.file + ":" + d.loc.line + ":" + d.name;
    if (d.static && !global && staticStorage.has(staticKey)) { scope.add(d.name, staticStorage.get(staticKey)); return; }
    if (scope.values.has(d.name)) faults("DUPLICATE_VARIABLE", "变量 " + d.name + " 在这个范围里声明了两遍。", "重复变量声明。", "使用不同名字，或只声明一次。", d.loc);
    let value = defaultValue(d.type), bytes = typeBytes(d.type, d.pointer);
    const dimensions = [];
    for (const n of d.dimensions) dimensions.push(n ? Number(yield* expression(n, scope)) : null);
    let init;
    if (d.init) init = yield* expression(d.init, scope);
    function arrayValue(depth, input) {
      let len = dimensions[depth];
      if (len == null) len = typeof input === "string" ? input.length + 1 : Array.isArray(input) ? input.length : 0;
      if (!Number.isInteger(len) || len < 1 || len > 65536) faults("ARRAY_SIZE", "数组长度不在可模拟的范围。", "单维数组长度需要是 1–65536 的整数。", "检查数组长度常量，避免负数、0 或过大的数组。", d.loc);
      if (depth < dimensions.length - 1) return Array.from({ length: len }, (_, i) => arrayValue(depth + 1, input?.[i]));
      if (typeof input === "string") input = [...input].map(c => c.charCodeAt(0)).concat(0);
      const array = Array.from({ length: len }, (_, i) => coerce(Array.isArray(input) ? input[i] ?? 0 : 0, d.type));
      Object.defineProperty(array, "__elementType", { value: d.type, enumerable: false });
      return array;
    }
    if (dimensions.length) {
      const count = dimensions.reduce((a, b) => a * (b ?? (Array.isArray(init) ? init.length : String(init ?? "").length + 1)), 1);
      if (count > 65536) faults("ARRAY_TOO_LARGE", "这个数组会占用太多教学仿真内存。", "总元素数超过 65536。", "缩小数组；真实 F103C8 的 SRAM 也只有 20 KB。", d.loc);
      value = arrayValue(0, init); bytes *= count;
    } else if (program.structs[d.type]) {
      if (Array.isArray(init)) {
        program.structs[d.type].forEach((k, i) => { value[k] = init[i] ?? 0; value.__fieldsSet.add(k); });
      } else if (init && typeof init === "object") {
        for (const k of program.structs[d.type]) { value[k] = init[k] ?? 0; value.__fieldsSet.add(k); }
      } else if (global) program.structs[d.type].forEach(k => value.__fieldsSet.add(k));
      bytes = program.structs[d.type].length * 4;
    } else if (d.init) value = coerce(init, d.type, d.pointer);
    scope.add(d.name, { value, type: d.type, pointer: d.pointer, constant: d.constant,
      initialized: global || !!d.init || dimensions.length > 0 || !!program.structs[d.type], user: true, bytes });
    if (d.static && !global) staticStorage.set(staticKey, scope.values.get(d.name));
  }
  function* statement(node, scope) {
    activeScope = scope; currentLoc = node.loc; state.pc = locOf(node.loc);
    if (++iterations > 5000000) faults("EXECUTION_LIMIT", "程序执行了很多步骤仍未结束。", "已达到本轮仿真 500 万步上限。", "检查死循环或点击重置。持续运行的 while(1) 可以保留，但建议包含 Delay。", node.loc);
    switch (node.kind) {
      case "block": {
        const child = new Scope(scope);
        for (const n of node.statements) { const flow = yield* statement(n, child); if (flow) return flow; }
        activeScope = scope; return null;
      }
      case "decl":
        for (const d of node.declarations) yield* declare(d, scope);
        yield { type: "line", ...locOf(node.loc), timeMs: state.timeMs }; return null;
      case "expr":
        yield* expression(node.value, scope); currentLoc = node.loc; state.pc = locOf(node.loc); activeScope = scope;
        yield { type: "line", ...locOf(node.loc), timeMs: state.timeMs }; return null;
      case "empty": yield { type: "line", ...locOf(node.loc), timeMs: state.timeMs }; return null;
      case "if": {
        const result = !!(yield* expression(node.test, scope));
        yield { type: "condition", result, ...locOf(node.loc), timeMs: state.timeMs };
        return result ? yield* statement(node.yes, scope) : node.no ? yield* statement(node.no, scope) : null;
      }
      case "while": case "do": {
        let first = true;
        while (true) {
          currentLoc = node.loc; state.pc = locOf(node.loc); activeScope = scope;
          const result = node.kind === "do" && first || !!(yield* expression(node.test, scope)); first = false;
          yield { type: "condition", result, ...locOf(node.loc), timeMs: state.timeMs };
          if (!result) break;
          const flow = yield* statement(node.body, scope);
          if (flow?.kind === "break") break;
          if (flow?.kind === "return") return flow;
        }
        return null;
      }
      case "for": {
        const child = new Scope(scope);
        if (node.init) yield* statement(node.init, child);
        while (true) {
          currentLoc = node.loc; state.pc = locOf(node.loc); activeScope = child;
          const result = !node.test || !!(yield* expression(node.test, child));
          yield { type: "condition", result, ...locOf(node.loc), timeMs: state.timeMs };
          if (!result) break;
          const flow = yield* statement(node.body, child);
          if (flow?.kind === "break") break;
          if (flow?.kind === "return") return flow;
          if (node.update) yield* expression(node.update, child);
        }
        activeScope = scope; return null;
      }
      case "switch": {
        const value = yield* expression(node.test, scope), child = new Scope(scope); let start = -1, fallback = -1;
        for (let i = 0; i < node.cases.length; i++) {
          if (node.cases[i].value == null) fallback = i;
          else if ((yield* expression(node.cases[i].value, scope)) === value && start < 0) start = i;
        }
        if (start < 0) start = fallback;
        if (start >= 0) for (let i = start; i < node.cases.length; i++) for (const s of node.cases[i].statements) {
          const flow = yield* statement(s, child); if (flow?.kind === "break") return null; if (flow) return flow;
        }
        return null;
      }
      case "return": {
        const value = node.value ? yield* expression(node.value, scope) : 0;
        yield { type: "return", value, ...locOf(node.loc), timeMs: state.timeMs }; return { kind: "return", value };
      }
      case "break": case "continue": yield { type: node.kind, ...locOf(node.loc), timeMs: state.timeMs }; return { kind: node.kind };
    }
    return null;
  }
  function* callUser(fn, args, caller, loc) {
    if (stack.length > 32) faults("STACK_DEPTH", "函数调用绕了太多层。", "调用深度超过 32 层，可能存在无限递归。", "检查函数是否不停调用自己。", loc);
    if (args.length !== fn.params.length) faults("ARGUMENT_COUNT", fn.name + " 的参数数量不对。", "需要 " + fn.params.length + " 个，实际传入 " + args.length + " 个。", "核对函数定义和调用。", loc);
    const local = new Scope(rootScope);
    fn.params.forEach((p, i) => local.add(p.name, { value: coerce(args[i], p.type, p.pointer), type: p.type, pointer: p.pointer, initialized: true, user: true, bytes: typeBytes(p.type, p.pointer) }));
    stack.push({ function: fn.name, ...locOf(loc || fn.loc) }); activeScope = local;
    const flow = yield* statement(fn.body, local);
    stack.pop(); activeScope = caller;
    return coerce(flow?.value ?? 0, fn.returnType, fn.pointer);
  }
  function timerCounter(tm) {
    if (!(tm.enabled && state.clocks[tm.name])) return tm.counter;
    const ticks = Math.floor((state.timeMs - tm.startMs) * state.coreClockHz / ((tm.prescaler + 1) * 1000));
    return (tm.counter + ticks) % (tm.period + 1);
  }
  function config(value, fields, name, loc) {
    const object = deref(value);
    if (!object || typeof object !== "object" || Array.isArray(object)) faults("MISSING_CONFIG_STRUCT", name + " 需要一个填写好的配置表。", "配置参数必须是结构体地址。", "先声明结构体并填写字段，再传入 &结构体变量。", loc);
    for (const field of fields) {
      if (!Object.hasOwn(object, field)) faults("WRONG_CONFIG_STRUCT", "配置表里没有 " + field + "。", "传入了错误的结构体类型。", "检查函数需要的 InitTypeDef 类型。", loc);
      if (object.__fieldsSet && !object.__fieldsSet.has(field))
        warn("UNINITIALIZED_STRUCT_FIELD", field + " 还没有填写。", "局部配置结构体字段未初始化；本次仿真使用显示的默认 0，真实 C 中不确定。", "填写该字段，或先调用对应 StructInit。", loc, field);
    }
    return object;
  }
  function setStruct(value, defaults, loc) {
    const obj = deref(value);
    if (!obj || typeof obj !== "object") faults("MISSING_CONFIG_STRUCT", "这里需要传入结构体的地址。", "StructInit 参数不是结构体引用。", "写成 函数名(&配置变量)。", loc);
    for (const k of Object.keys(obj)) { obj[k] = defaults[k] ?? 0; obj.__fieldsSet?.add(k); }
  }
  function sampleADC(a, loc) {
    if (!a.enabled || !state.clocks[a.name]) { warn("ADC_DISABLED", "ADC 还没有启动，暂时读不到有效采样。", "ADC 时钟或使能未打开。", "按顺序打开 RCC 时钟，配置 ADC，然后 ADC_Cmd(..., ENABLE)。", loc, a.name); return 0; }
    const pin = state.pins[ADC_PINS[a.channel]];
    if (pin && pin.mode !== "GPIO_Mode_AIN") warn("ADC_PIN_MODE", pin.name + " 还没有配置成模拟输入。", "建议模拟通道 GPIO_Mode_AIN，关闭数字输入缓冲。", "把该引脚的 GPIO_Mode 设置为 GPIO_Mode_AIN。", loc, pin.name);
    let value = 0;
    try { value = hooks.readADC ? hooks.readADC(a.channel, state, a.name) : 0; }
    catch (e) { faults("ADC_HOOK_ERROR", "读取模拟电压时出错。", String(e?.message || e), "检查电位器和 ADC 引脚的连接。", loc); }
    if (value && typeof value === "object") value = value.raw ?? value.value ?? 0;
    value = Math.max(0, Math.min(4095, Math.round(Number(value) || 0)));
    a.value = a.align === CONSTANTS.ADC_DataAlign_Left ? value << 4 : value; a.eoc = true;
    emit("adc", { peripheral: a.name, channel: a.channel, pin: ADC_PINS[a.channel] || null, raw: value, value: a.value }, loc);
    return a.value;
  }
  function sendSerial(name, value, loc) {
    const u = uart(name);
    if (!enabledClock(name, loc)) return;
    if (!u.enabled || !(u.mode & CONSTANTS.USART_Mode_Tx)) {
      warn("UART_DISABLED", name + " 还没有开启发送功能。", "USART 未使能或 USART_Mode_Tx 未选中。", "配置 USART_Mode_Tx，再调用 USART_Cmd(..., ENABLE)。", loc, name); return;
    }
    const txPin = ({ USART1: "PA9", USART2: "PA2", USART3: "PB10" })[name];
    const configured = !txPin || state.pins[txPin]?.mode === "GPIO_Mode_AF_PP";
    if (!configured) warn("UART_TX_PIN_MODE", txPin + " 还没有配置为串口复用输出。", "USART 数据寄存器可以写入，但引脚未按默认映射输出。", "将 " + txPin + " 配置为 GPIO_Mode_AF_PP；终端记录的是外设发送事件。", loc, txPin);
    const byte = Number(value) & 0xff, text = String.fromCharCode(byte);
    u.tx += text; if (u.tx.length > 10000) u.tx = u.tx.slice(-8000);
    state.serial += text; if (state.serial.length > 10000) state.serial = state.serial.slice(-8000);
    emit("serial", { port: name, text, byte, txPin, outputPinConfigured: configured, baudRate: u.baudRate }, loc);
    hooks.onSerial?.(text, name);
  }
  function formatC(format, args) {
    let index = 0;
    return asText(format).replace(/%%|%([-+0 ]*)(\d*)(?:\.(\d+))?(?:l|ll|h)?([duixXocfs])/g, (match, flags, width, precision, spec) => {
      if (match === "%%") return "%";
      const value = args[index++]; let out;
      switch (spec) {
        case "s": out = asText(value); if (precision) out = out.slice(0, Number(precision)); break;
        case "c": out = String.fromCharCode(Number(value) || 0); break;
        case "f": out = Number(value || 0).toFixed(precision == null ? 6 : Number(precision)); break;
        case "x": case "X": out = (Number(value) >>> 0).toString(16); if (spec === "X") out = out.toUpperCase(); break;
        case "o": out = (Number(value) >>> 0).toString(8); break;
        case "u": out = String(Number(value) >>> 0); break;
        default: out = String(Number(value) | 0);
      }
      if (flags?.includes("+") && Number(value) >= 0 && !["s", "c"].includes(spec)) out = "+" + out;
      const pad = Math.max(0, Math.min(1000, Number(width) || 0) - out.length);
      return flags?.includes("-") ? out + " ".repeat(pad) : (flags?.includes("0") ? "0" : " ").repeat(pad) + out;
    });
  }
  function arduinoPin(value, loc, purpose="input") {
    const name=canonicalPin(value,board.id);
    if(board.reservedPins.includes(name))
      faults("BOARD_PIN_RESERVED",name+" 是这块板的内部保留脚。","当前板型把它用于Flash或板载专用连接。","选择资料中可用的普通GPIO；不要占用Flash引脚。",loc);
    if(!board.gpioPins.includes(name)||!state.pins[name])
      faults("BOARD_PIN_UNKNOWN","这块板没有可用的引脚 "+String(value)+"。","引脚名称或编号不在 "+board.name+" 的模型中。","对照当前板上的针脚标签；不要把其他板的D编号直接搬来。",loc);
    if(purpose==="output"&&(board.inputOnly.includes(name)||board.analogOnly.includes(name)))
      faults("BOARD_INPUT_ONLY",name+" 只能输入，不能输出。","该引脚的板型能力表不允许数字/PWM输出。","换一个支持输出的GPIO。",loc);
    if(purpose==="digital"&&board.analogOnly.includes(name))
      faults("BOARD_ANALOG_ONLY",name+" 仅支持模拟输入。","例如经典Nano的A6/A7没有普通数字GPIO能力。","使用analogRead，或换一个数字引脚。",loc);
    return state.pins[name];
  }
  function arduinoDrive(pin,value,loc) {
    pin.arduinoPWM=null;pin.pwm=null;
    const old=pin.output;
    if(pin.mode==="GPIO_Mode_IN_FLOATING"||pin.mode==="GPIO_Mode_IPU"||pin.mode==="GPIO_Mode_IPD") {
      // Arduino digitalWrite(HIGH) on an input enables its internal pull-up.
      if(value&&board.noInternalPull.includes(pin.name))
        faults("BOARD_NO_PULL",pin.name+" 没有内部上下拉电阻。","此输入脚不能靠digitalWrite(HIGH)获得内部上拉。","连接外部电阻到逻辑电源。",loc);
      pin.mode=value?"GPIO_Mode_IPU":"GPIO_Mode_IN_FLOATING";pin.pull=value?"up":null;
    }
    pin.output=+!!value;pin.configured=true;
    emit("gpio",{pin:pin.name,value:pin.output,previous:old,mode:pin.mode,plain:pin.name+" 写入 "+(pin.output?"HIGH":"LOW")},loc);
    refreshPins();
  }
  function arduinoSerial(port) {
    if(!board.serialPorts.includes(port))
      faults("BOARD_SERIAL_PORT",board.name+" 没有 "+port+" 这个串口模型。","串口实例不可用。","使用 "+board.serialPorts.join(" / ")+"。");
    return uart(port);
  }
  function writeArduinoSerial(port,text,loc) {
    const u=arduinoSerial(port);
    if(!u.enabled) {
      warn("UART_DISABLED",port+" 尚未启动，输出没有发送。","缺少Serial.begin或串口被end关闭。","在setup中调用 "+port+".begin(9600)。",loc,port);return 0;
    }
    u.tx+=text;u.tx=u.tx.slice(-10000);state.serial=(state.serial+text).slice(-10000);
    emit("serial",{port,text,baudRate:u.baudRate,byteModel:true,plain:"串口字节输出；未逐位模拟电气串行波形。"},loc);
    hooks.onSerial?.(text,port);return text.length;
  }
  function* readArduinoPulse(args, loc) {
    const pin = arduinoPin(args[0], loc, "digital").name;
    const level = args[1];
    const timeoutUs = args.length === 3 ? args[2] : 1000000;
    if (level !== 0 && level !== 1)
      faults("PULSE_LEVEL", "pulseIn 需要 HIGH 或 LOW。", "第二个参数指定待测脉冲的电平。", "例如 pulseIn(7, HIGH, 30000)。", loc);
    if (!Number.isInteger(timeoutUs) || timeoutUs < 0 || timeoutUs > 0xffffffff)
      faults("PULSE_TIMEOUT", "pulseIn 的超时须为非负整数微秒。", "超时的有效范围是 0–4294967295 µs，省略时为 1000000 µs。", "例如用 30000 表示等待最多 30 ms。", loc);
    let measured;
    try {
      if (timeoutUs > 0) measured = hooks.readPulse?.(pin, level, timeoutUs, readDelayState());
    } catch (error) {
      faults("CIRCUIT_READ_ERROR", "读取电路脉冲时出错。", String(error?.message || error), "检查接线后重置程序。", loc);
    }
    const valid = Number.isFinite(measured?.widthUs) && Number.isFinite(measured.elapsedUs)
      && measured.widthUs >= .5 && measured.widthUs <= measured.elapsedUs && measured.elapsedUs <= timeoutUs;
    const widthUs = valid ? Math.round(measured.widthUs) : 0;
    const elapsedUs = valid ? measured.elapsedUs : timeoutUs;
    yield beginDelay(elapsedUs / 1000, loc, (fromMs, toMs) => {
      emit("pulse", {
        pin, level, widthUs, elapsedUs, timeoutUs, timedOut: !valid, fromMs, toMs,
        plain: valid ? pin + " 脉宽 " + widthUs + " µs" : pin + " 等待脉冲超时"
      }, loc);
    });
    return widthUs;
  }
  function wireAddress(value, name, loc) {
    if (!Number.isInteger(value) || value < 0 || value > 0x7f)
      faults("I2C_ADDRESS", name + " 需要 7 位地址。", "地址必须在 0x00–0x7F 之间。", "例如用 0x3C，发送方向位由 Wire 处理。", loc);
    return value;
  }
  function wireStop(value, name, loc) {
    if (value === undefined) return true;
    if (value !== 0 && value !== 1)
      faults("I2C_STOP_ARGUMENT", name + " 的 STOP 参数需要 true 或 false。", "false 会保留总线，下一次传输使用重复起始。", "省略该参数或传入 true 可释放总线。", loc);
    return Boolean(value);
  }
  function* transferWire({ address, bytes = [], requestedBytes, stop, localError }, loc) {
    const reading = requestedBytes !== undefined;
    const direction = reading ? "read" : "write";
    const repeatedStart = wire.held && !localError;
    wire.held = false;
    const messages = [reading ? "读取已应答" : "写入已应答", "发送缓冲区溢出", "地址未应答", "数据未应答", "总线传输失败"];
    const defaultReasons = [null, "buffer-overflow", "address-nack", "data-nack", "bus-error"];
    function report(status, reason, deviceId, fromMs, toMs, received = []) {
      wire.held = status === 0 && !stop;
      if (reading) wire.received = received;
      emit("i2c", {
        direction, address, bytes: reading ? [...received] : bytes, ...(reading && { requestedBytes }),
        status, reason, deviceId, stop: !wire.held, repeatedStart, fromMs, toMs,
        plain: "I²C " + messages[status]
      }, loc);
      return reading ? received.length : status;
    }
    if (localError) return report(localError.status, localError.reason, null, state.timeMs, state.timeMs);
    let value;
    // One address and eight data bits plus ACK/NACK per byte. The duration
    // estimates the attempted frame at 100 kHz, including on a NACK.
    yield beginDelay((1 + (reading ? requestedBytes : bytes.length)) * .09, loc, (fromMs, toMs) => {
      let response;
      try {
        const hook = reading ? hooks.readI2c : hooks.writeI2c;
        response = hook ? hook.call(hooks, address, reading ? requestedBytes : [...bytes], readDelayState(), { stop, repeatedStart })
          : { status: 2, reason: "address-nack" };
      } catch {
        response = { status: 4, reason: "hook-error" };
      }
      let status = response?.status;
      let reason = response?.reason, received = [];
      if (!Number.isInteger(status) || status < 0 || status > 4) {
        status = 4; reason = "invalid-bus-result";
      } else if (reading && status === 0) {
        if (Array.isArray(response.bytes) && response.bytes.length <= requestedBytes &&
            Array.from(response.bytes).every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
          received = [...response.bytes];
          if (received.length < requestedBytes) reason ??= "short-read";
        } else {
          status = 4; reason = "invalid-bus-result";
        }
      }
      value = report(status, reason ?? defaultReasons[status], response?.deviceId ?? null, fromMs, toMs, received);
    });
    return value;
  }
  function* callWire(name, args, loc) {
    if (name === "ArduinoWire_begin") {
      wire = { ready: true, transaction: null, held: false, received: [] };
      return 0;
    }
    if (name === "ArduinoWire_available") return wire.received.length;
    if (name === "ArduinoWire_read") return wire.received.shift() ?? -1;
    if (name === "ArduinoWire_peek") return wire.received[0] ?? -1;
    if (name === "ArduinoWire_requestFrom") {
      wire.received = [];
      const address = wireAddress(args[0], "Wire.requestFrom", loc);
      const stop = wireStop(args[2], "Wire.requestFrom", loc);
      const quantity = args[1];
      if (!Number.isInteger(quantity) || quantity < 0)
        faults("I2C_REQUEST_COUNT", "Wire.requestFrom 需要非负整数长度。", "UNO 的接收缓冲区最多 32 字节。", "例如 Wire.requestFrom(0x18, 2)。", loc);
      const requestedBytes = Math.min(quantity, WIRE_BUFFER_LENGTH);
      if (!requestedBytes) return 0;
      const localError = wire.ready ? null : { status: 4, reason: "not-initialized" };
      return yield* transferWire({ address, requestedBytes, stop, localError }, loc);
    }
    if (name === "ArduinoWire_beginTransmission") {
      const address = wireAddress(args[0], "Wire.beginTransmission", loc);
      wire.transaction = { address, bytes: [], overflow: false };
      return 0;
    }
    if (name === "ArduinoWire_write") {
      const transaction = wire.transaction;
      if (!transaction) return 0;
      const value = deref(args[0]);
      const data = args.length === 1 ? [value] : value;
      const count = args.length === 1 ? 1 : args[1];
      if (!Array.isArray(data) || !Number.isInteger(count) || count < 0 || count > data.length)
        faults("I2C_WRITE_LENGTH", "Wire.write 的数组长度超出范围。", "需要可访问的数组和有效的字节数。", "例如 Wire.write(data, sizeof(data))。", loc);
      const accepted = Math.min(count, WIRE_BUFFER_LENGTH - transaction.bytes.length);
      const payload = data.slice(0, accepted);
      if (payload.some(byte => !Number.isInteger(byte)))
        faults("I2C_WRITE_BYTE", "Wire.write 需要整数字节。", "可写入一个整数，或给出整数字节数组及长度。", "例如 Wire.write(0x40)。", loc);
      transaction.bytes.push(...payload.map(byte => byte & 0xff));
      transaction.overflow ||= accepted < count;
      return accepted;
    }
    const stop = wireStop(args[0], "Wire.endTransmission", loc);
    const transaction = wire.transaction;
    wire.transaction = null;
    let localError = null;
    if (!wire.ready) localError = { status: 4, reason: "not-initialized" };
    else if (!transaction) localError = { status: 4, reason: "not-transmitting" };
    else if (transaction.overflow) localError = { status: 1, reason: "buffer-overflow" };
    return yield* transferWire({ address: transaction?.address ?? null, bytes: transaction?.bytes ?? [], stop, localError }, loc);
  }
  function* callArduino(name,args,loc,serialPort="Serial",argumentKinds=[]) {
    if(name.startsWith("ArduinoWire_"))return yield* callWire(name,args,loc);
    if(name==="pinMode") {
      const mode=Number(args[1]),out=mode===1||mode===4,pin=arduinoPin(args[0],loc,out?"output":"digital");
      if(![0,1,2,3,4].includes(mode))faults("PIN_MODE_INVALID","pinMode的模式不在支持范围。","支持INPUT、OUTPUT、INPUT_PULLUP，以及具备能力板型的INPUT_PULLDOWN/OUTPUT_OPEN_DRAIN。","使用已列明的模式常量。",loc);
      if(mode===3&&!board.hasPullDown)faults("BOARD_NO_PULLDOWN",board.name+" 没有这个内部下拉接口。","本板标准Arduino输入模式不包含INPUT_PULLDOWN。","使用INPUT_PULLUP，或添加外部下拉电阻。",loc);
      if([2,3].includes(mode)&&board.noInternalPull.includes(pin.name))faults("BOARD_NO_PULL",pin.name+" 没有内部上下拉。","该脚是输入专用且未集成上下拉电阻。","增加外部适当阻值的上下拉电阻。",loc);
      if(mode===4&&board.family.startsWith("AVR"))faults("BOARD_OPEN_DRAIN_API","AVR Arduino的pinMode不提供OUTPUT_OPEN_DRAIN。","不能把其他core的扩展模式当成通用Arduino接口。","使用输出低/输入释放的明确方案，或选择支持该模式的板。",loc);
      pin.mode=["GPIO_Mode_IN_FLOATING","GPIO_Mode_Out_PP","GPIO_Mode_IPU","GPIO_Mode_IPD","GPIO_Mode_Out_OD"][mode];
      pin.pull=mode===2?"up":mode===3?"down":null;pin.configured=true;pin.arduinoPWM=null;
      if(mode===2)pin.output=1;if(mode===3)pin.output=0;
      if(board.strappingPins.includes(pin.name))warn("BOOT_STRAPPING_PIN",pin.name+" 也承担上电启动配置功能。","当前只模拟运行中的GPIO，不模拟复位时采样启动电平。","实板接线请核对官方启动约束，避免外接元件改变启动模式。",loc,pin.name);
      emit("gpio-config",{pin:pin.name,mode:pin.mode,plain:"pinMode设置了"+pin.name+"的输入/输出职责。"},loc);refreshPins();return 0;
    }
    if(name==="digitalWrite") {
      const pin=arduinoPin(args[0],loc,"digital");
      if(board.inputOnly.includes(pin.name))faults("BOARD_INPUT_ONLY",pin.name+" 不能执行digitalWrite。","该脚只允许输入。","换用可输出引脚。",loc);
      arduinoDrive(pin,+!!args[1],loc);return 0;
    }
    if(name==="digitalRead")return readDigital(arduinoPin(args[0],loc,"digital").name,loc);
    if(name==="pulseIn")return yield* readArduinoPulse(args,loc);
    if(name==="delay"||name==="delayMicroseconds") {
      const duration=Number(args[0])/(name==="delayMicroseconds"?1000:1);
      if(!Number.isFinite(duration)||duration<0||duration>86400000)faults("INVALID_DELAY","等待时间必须是0到24小时之间的数值。","无效的delay参数。","delay按毫秒，delayMicroseconds按微秒。",loc);
      yield beginDelay(duration, loc);return 0;
    }
    if(name==="millis")return Math.floor(state.timeMs)>>>0;
    if(name==="micros")return Math.floor(state.timeMs*1000)>>>0;
    if(name==="analogReadResolution"||name==="analogWriteResolution") {
      const bits=Number(args[0]);
      if(board.family==="AVR")faults("BOARD_API",board.name+" 不提供分辨率设置API。","AVR core ADC固定10位，analogWrite固定8位。","使用该板支持的数值范围。",loc);
      if(!Number.isInteger(bits)||bits<1||bits>16)faults("ADC_RESOLUTION","分辨率需要是1–16位的整数。","这是API读写数值位宽，不会增加物理ADC精度。","例如analogReadResolution(12)。",loc);
      if(name==="analogReadResolution")state.analogReadBits=bits;else state.analogWriteBits=bits;
      return 0;
    }
    if(name==="analogRead") {
      const analogArgument=(board.family==="AVR"||board.analogChannelNumbers)&&Number.isInteger(args[0])&&args[0]>=0&&args[0]<board.analogPins.length?board.analogPins[args[0]]:args[0];
      const pin=arduinoPin(analogArgument,loc);
      if(!board.analogPins.includes(pin.name))faults("BOARD_NO_ADC",pin.name+" 不是当前板的模拟输入。","该板模拟通道映射不包含这个引脚。","选择 "+board.analogPins.join("、")+"。",loc);
      if(!["GPIO_Mode_Out_PP","GPIO_Mode_Out_OD","GPIO_Mode_AF_PP"].includes(pin.mode)) {
        pin.mode="GPIO_Mode_AIN";pin.pull=null;pin.configured=true;
      }else warn("ADC_OUTPUT_PIN","正在采样一个同时被程序驱动的输出脚。","analogRead不会自动移除已有输出驱动，读值受输出及外部电路共同影响。","若要测外部传感器，先让引脚处于INPUT状态。",loc,pin.name);
      state.clocks.ArduinoADC=true;
      const a=state.adc.ArduinoADC ||= {name:"ArduinoADC",enabled:true,clock:true};
      a.pin=pin.name;a.channel=board.analogPins.indexOf(pin.name);a.started=true;a.eoc=true;
      let value=hooks.readADC?.(pin.name,state,"ArduinoADC")??0;
      if(value&&typeof value==="object")value=value.raw??(value.voltage/board.logicVoltage*board.adcMax);
      const raw=Math.max(0,Math.min(board.adcMax,Math.round(Number(value)||0)));
      const difference=state.analogReadBits-board.nativeAdcBits;
      const result=difference>=0?raw*(2**difference):Math.floor(raw/(2**(-difference)));
      a.raw=raw;a.value=result;a.bits=state.analogReadBits;
      emit("adc",{peripheral:"ArduinoADC",pin:pin.name,channel:a.channel,raw,value:result,bits:state.analogReadBits},loc);
      return result;
    }
    if(name==="analogWriteFrequency") {
      if(board.family.startsWith("ESP32")) {
        if(args.length!==2)faults("ARGUMENT_COUNT","ESP32的analogWriteFrequency需要引脚和频率。","该core的签名是analogWriteFrequency(pin,frequency)。","补齐引脚参数。",loc);
        const pin=arduinoPin(args[0],loc,"output"),frequency=Number(args[1]);
        if(!(frequency>0&&frequency<=1000000))faults("PWM_FREQUENCY","PWM频率超出教学模型范围。","支持0–1MHz内的正频率，未检验实际时钟分频可达性。","选择较低的合理频率。",loc);
        state.pwmOverrides ||= {};state.pwmOverrides[pin.name]=frequency;
        if(pin.arduinoPWM)pin.arduinoPWM.frequencyHz=frequency;
      }else if(board.family.startsWith("STM32")) {
        if(args.length!==1)faults("ARGUMENT_COUNT","STM32 core的analogWriteFrequency需要一个频率参数。","这是全局PWM频率设置。","使用analogWriteFrequency(1000)。",loc);
        if(!(args[0]>0&&args[0]<=1000000))faults("PWM_FREQUENCY","PWM频率无效。","频率必须大于0且不超过1MHz。","使用合理的教学频率。",loc);
        state.arduinoPwmFrequency=Number(args[0]);
        for(const pin of Object.values(state.pins))if(pin.arduinoPWM)pin.arduinoPWM.frequencyHz=Number(args[0]);
      }else faults("BOARD_API","选定的Arduino core没有这个PWM频率接口。","Pico模型采用官方Arduino mbed风格；不同第三方core扩展不能混用。","使用该板默认analogWrite，或在真实工具链核对所用core文档。",loc);
      refreshPins();return 0;
    }
    if(name==="analogWrite"||name==="tone") {
      const canonical = canonicalPin(args[0],board.id);
      if(name==="analogWrite"&&board.dacPins?.includes(canonical))faults("DAC_UNSUPPORTED",canonical+" 的 DAC 暂未建模。","这个引脚的模拟输出不同于 PWM。","选择标有 PWM 的数字引脚观察占空比。",loc);
      const pin=arduinoPin(args[0],loc,"output");
      let frequency,duty,endMs=null;
      if(name==="analogWrite") {
        const max=2**state.analogWriteBits-1,raw=Number(args[1]),value=Math.max(0,Math.min(max,Math.round(raw)));
        if(raw!==value)warn("PWM_VALUE_RANGE","PWM数值超出范围，教学模型已限制到有效区间。","当前analogWrite位宽为"+state.analogWriteBits+"位，范围0–"+max+"。","修正数值或明确设置支持的analogWriteResolution。",loc,pin.name);
        if(!board.pwmPins.includes(pin.name)) {
          pin.mode="GPIO_Mode_Out_PP";arduinoDrive(pin,value>=((max+1)/2),loc);
          warn("PWM_PIN_FALLBACK",pin.name+" 没有当前板型的PWM输出能力。","本模型按Arduino AVR的非PWM降级规则显示HIGH/LOW，不把它画成连续PWM。","换用该板标有PWM能力的引脚。",loc,pin.name);return 0;
        }
        frequency=state.pwmOverrides?.[pin.name]||state.arduinoPwmFrequency||board.pwmFrequencies?.[pin.name]||board.pwmFrequency;
        duty=value/max;
      }else{
        frequency=Number(args[1]);if(!(frequency>0&&frequency<=1000000))faults("TONE_FREQUENCY","音调频率需要大于0。","超出教学方波频率范围。","例如tone(pin,1000)。",loc);
        duty=.5;if(args.length>2&&Number(args[2])>0)endMs=state.timeMs+Number(args[2]);
      }
      pin.mode="GPIO_Mode_AF_PP";pin.configured=true;pin.pull=null;
      pin.arduinoPWM={frequencyHz:frequency,duty,startMs:state.timeMs,endMs,source:name};
      emit("pwm",{pin:pin.name,frequencyHz:frequency,duty,plain:"方波高电平占比为"+Math.round(duty*100)+"%"},loc);
      refreshPins();return 0;
    }
    if(name==="noTone") {const pin=arduinoPin(args[0],loc,"output");pin.mode="GPIO_Mode_Out_PP";arduinoDrive(pin,0,loc);return 0;}
    if(name==="map") {
      if(args[2]===args[1])faults("DIVIDE_BY_ZERO","map的输入上下限相同，无法换算。","输入范围宽度为0。","让in_min与in_max不同。",loc);
      return Math.trunc((args[0]-args[1])*(args[4]-args[3])/(args[2]-args[1])+args[3]);
    }
    if(name==="constrain")return Math.max(args[1],Math.min(args[2],args[0]));
    if(name==="min")return Math.min(args[0],args[1]);
    if(name==="max")return Math.max(args[0],args[1]);
    if(name==="F")return args[0];
    if(name.startsWith("ArduinoSerial_")) {
      const port=serialPort||"Serial",u=arduinoSerial(port),operation=name.slice(14);
      if(operation==="begin") {
        if(!(args[0]>0))faults("UART_BAUD_INVALID","串口波特率需要大于0。","无效的Serial.begin参数。","例如Serial.begin(9600)。",loc);
        if(args.length>1&&args[1]!==6)faults("UART_FORMAT_UNSUPPORTED","当前串口教学模型仅支持8N1。","其他校验位和字长配置没有逐位实现。","使用默认Serial.begin(baud)。",loc);
        u.enabled=true;u.baudRate=Number(args[0]);u.mode=12;state.clocks[port]=true;
        emit("serial-config",{port,baudRate:u.baudRate,byteModel:true},loc);return 0;
      }
      if(operation==="end"){u.enabled=false;return 0;}
      if(operation==="available")return u.enabled?u.rx.length:0;
      if(operation==="read")return u.enabled&&u.rx.length?u.rx.shift():-1;
      if(operation==="peek")return u.enabled&&u.rx.length?u.rx[0]:-1;
      if(operation==="flush")return 0;
      if(operation==="write"){
        const value=deref(args[0]);let text="";
        if(Array.isArray(value))text=value.slice(0,args[1]??value.length).map(v=>String.fromCharCode(Number(v)&255)).join("");
        else if(typeof value==="string")text=args.length>1?value.slice(0,args[1]):value;
        else text=String.fromCharCode(Number(value)&255);
        return writeArduinoSerial(port,text,loc);
      }
      if(operation==="print"||operation==="println"){
        const value=deref(args[0]);let text="";
        if(args.length){
          if(typeof value==="number"){
            if(argumentKinds[0]==="char"&&args.length<2)text=String.fromCharCode(value&255);
            else if(argumentKinds[0]==="float")text=Number(value).toFixed(Math.max(0,Math.min(9,args[1]??2)));
            else {const base=args[1]??10;if(![2,8,10,16].includes(base))faults("SERIAL_NUMBER_BASE","这里的进制参数不是DEC/HEX/OCT/BIN。","整数输出支持2、8、10、16进制。","小数位数仅用于浮点数输出。",loc);text=base===10?String(value):((board.intBits===16?value&65535:value>>>0).toString(base)).toUpperCase();}
          }else text=asText(value);
        }
        if(operation==="println")text+="\r\n";
        return writeArduinoSerial(port,text,loc);
      }
    }
    faults("UNSUPPORTED_API","这个Arduino接口尚未实现。",name,"查看支持列表；复杂库请在真实工具链运行。",loc);
  }

  function* callBuiltin(name, args, loc, serialPort, argumentKinds = []) {
    currentLoc = loc; state.pc = locOf(loc);
    if (ARDUINO_APIS.includes(name)) return yield* callArduino(name, args, loc, serialPort, argumentKinds);
    if (/^Delay_(ms|us|s)$/.test(name) || name === "delay_ms" || name === "delay_us") {
      let duration = Number(args[0]);
      if (name.endsWith("_us")) duration /= 1000;
      if (name.endsWith("_s")) duration *= 1000;
      if (!Number.isFinite(duration) || duration < 0 || duration > 86400000)
        faults("INVALID_DELAY", "等待时间需要是合理的非负数。", "Delay 参数无效或超过 24 小时。", "例如 Delay_ms(500) 表示等待 500 毫秒。", loc);
      yield beginDelay(duration, loc); return 0;
    }
    if (name === "RCC_APB2PeriphClockCmd" || name === "RCC_APB1PeriphClockCmd") {
      const map = name.includes("APB2") ? APB2 : APB1, mask = Number(args[0]), enable = !!args[1], affected = [];
      for (const [n, bit] of Object.entries(map)) if (mask & bit) { state.clocks[n] = enable; affected.push(n); }
      if (!affected.length) warn("UNKNOWN_CLOCK_MASK", "没有选中已支持的外设时钟。", "RCC 掩码没有对应到已建模外设。", "使用 RCC_APB2Periph_GPIOA 等常量，检查 APB1/APB2 是否用对。", loc);
      refreshPins(); emit("clock", { peripherals: affected, enabled: enable }, loc); return 0;
    }
    if (name === "RCC_ADCCLKConfig") {
      state.adcClockDivider = ({ 0: 2, 16384: 4, 32768: 6, 49152: 8 })[args[0]] || 6;
      if (state.coreClockHz / state.adcClockDivider > 14000000) warn("ADC_CLOCK_TOO_FAST", "ADC 时钟高于 STM32F103 的 14 MHz 上限。", "当前估算为 " + state.coreClockHz / state.adcClockDivider / 1000000 + " MHz。", "72 MHz 下通常选 RCC_PCLK2_Div6 或 Div8。", loc);
      return 0;
    }
    if (name === "RCC_AHBPeriphClockCmd") {
      warn("AHB_NOT_MODELLED", "这条 AHB 时钟配置只被记录，还没有对应外设仿真。", "DMA 等 AHB 外设不在当前模型范围。", "当前示例请使用 GPIO、定时器 PWM、ADC 或 USART 轮询。", loc); return 0;
    }
    if (name === "GPIO_StructInit") { setStruct(args[0], { GPIO_Pin: 0xffff, GPIO_Mode: CONSTANTS.GPIO_Mode_IN_FLOATING, GPIO_Speed: 2 }, loc); return 0; }
    if (name === "GPIO_Init") {
      const p = periph(args[0], "GPIO", loc); if (!enabledClock(p, loc)) return 0;
      const cfg = config(args[1], ["GPIO_Pin", "GPIO_Mode", "GPIO_Speed"], name, loc), mode = MODE_NAMES[cfg.GPIO_Mode];
      if (!mode) faults("BAD_GPIO_MODE", "GPIO_Mode 的值不是已支持的模式。", "未知 GPIO 模式值 " + cfg.GPIO_Mode, "使用 GPIO_Mode_Out_PP、GPIO_Mode_IPU 等标准常量。", loc);
      for (const pin of portPins(p, cfg.GPIO_Pin, loc)) {
        pin.mode = mode; pin.configured = true; pin.speedCode = cfg.GPIO_Speed; pin.speedMHz = ({ 1: 10, 2: 2, 3: 50 })[cfg.GPIO_Speed] || 0;
        pin.pull = mode === "GPIO_Mode_IPU" ? "up" : mode === "GPIO_Mode_IPD" ? "down" : null;
        if (pin.pull) pin.output = +(pin.pull === "up");
        emit("gpio-config", { pin: pin.name, mode, speedMHz: pin.speedMHz, plain: pin.name + " 设置为 " + mode }, loc);
      }
      refreshPins(); return 0;
    }
    if (name === "GPIO_DeInit") {
      const p = periph(args[0], "GPIO", loc);
      for (const pin of portPins(p, 0xffff)) { pin.mode = "GPIO_Mode_IN_FLOATING"; pin.configured = false; pin.output = 0; pin.pull = null; }
      refreshPins(); return 0;
    }
    if (["GPIO_SetBits", "GPIO_ResetBits", "GPIO_WriteBit", "GPIO_Write"].includes(name)) {
      const p = periph(args[0], "GPIO", loc), mask = Number(args[1]) & 0xffff;
      if (name === "GPIO_Write") { if (mask) writeOutput(p, mask, 1, loc); if (mask !== 0xffff) writeOutput(p, (~mask) & 0xffff, 0, loc); }
      else writeOutput(p, mask, name === "GPIO_SetBits" ? 1 : name === "GPIO_ResetBits" ? 0 : args[2], loc);
      return 0;
    }
    if (name.startsWith("GPIO_Read")) {
      const p = periph(args[0], "GPIO", loc); if (!enabledClock(p, loc)) return 0;
      const output = name.includes("Output"), bit = name.endsWith("Bit");
      const selected = portPins(p, bit ? args[1] : 0xffff, loc);
      if (bit && selected.length !== 1) warn("GPIO_READ_ONE_PIN", "按位读取时应该只选一个引脚。", "GPIO_Read*DataBit 需要单个 GPIO_Pin_x。", "一次读一个引脚，或使用 GPIO_ReadInputData 读取整组。", loc);
      if (bit) return +(selected.some(pin => output ? pin.output : readDigital(pin.name, loc)));
      return selected.reduce((v, pin) => v | ((output ? pin.output : readDigital(pin.name, loc)) << pin.pin), 0);
    }
    if (name === "GPIO_PinRemapConfig") {
      if ([CONSTANTS.GPIO_Remap_SWJ_Disable, CONSTANTS.GPIO_Remap_SWJ_JTAGDisable, CONSTANTS.GPIO_Remap_SWJ_NoJTRST].includes(args[0])) {
        state.debugRemap = args[0]; warn("DEBUG_PORT_NOT_MODELLED", "调试接口重映射已经记录。", "SWD/JTAG 下载、锁定和调试时序没有模拟。", "真实接板时仍需保留必要的下载引脚。", loc); return 0;
      }
      faults("REMAP_NOT_SUPPORTED", "这个引脚重映射尚未实现。", "当前 PWM/USART 模型使用默认引脚映射。", "先使用默认引脚；平台不会把重映射当成已成功。", loc);
    }
    if (name === "TIM_TimeBaseStructInit") {
      setStruct(args[0], { TIM_Period: 65535, TIM_Prescaler: 0, TIM_CounterMode: 0, TIM_ClockDivision: 0, TIM_RepetitionCounter: 0 }, loc); return 0;
    }
    if (name === "TIM_OCStructInit") { setStruct(args[0], { TIM_OCMode: 0, TIM_OutputState: 0, TIM_Pulse: 0, TIM_OCPolarity: 0 }, loc); return 0; }
    if (name === "TIM_TimeBaseInit") {
      const n = periph(args[0], "TIM", loc); if (!enabledClock(n, loc)) return 0;
      const cfg = config(args[1], ["TIM_Prescaler", "TIM_Period", "TIM_CounterMode", "TIM_ClockDivision"], name, loc), tm = timer(n);
      if (cfg.TIM_CounterMode !== CONSTANTS.TIM_CounterMode_Up) faults("TIMER_MODE_UNSUPPORTED", "当前定时器模型只支持向上计数。", "向下和中央对齐模式尚未建模。", "使用 TIM_CounterMode_Up，或查看能力范围。", loc);
      tm.prescaler = Number(cfg.TIM_Prescaler) & 0xffff; tm.period = Number(cfg.TIM_Period) & 0xffff;
      tm.counterMode = cfg.TIM_CounterMode; tm.startMs = state.timeMs; refreshPins();
      emit("timer-config", { timer: n, prescaler: tm.prescaler, period: tm.period, frequencyHz: tm.frequencyHz }, loc); return 0;
    }
    const ocInit = name.match(/^TIM_OC([1-4])Init$/);
    if (ocInit) {
      const n = periph(args[0], "TIM", loc); if (!enabledClock(n, loc)) return 0;
      const cfg = config(args[1], ["TIM_OCMode", "TIM_OutputState", "TIM_Pulse", "TIM_OCPolarity"], name, loc), ch = ocInit[1];
      if (![CONSTANTS.TIM_OCMode_PWM1, CONSTANTS.TIM_OCMode_PWM2, CONSTANTS.TIM_OCMode_Timing].includes(cfg.TIM_OCMode))
        faults("OUTPUT_COMPARE_MODE_UNSUPPORTED", "这个定时器输出比较模式还没建模。", "目前支持 PWM1/PWM2，Timing 只记录配置。", "使用 PWM1/PWM2 进行 PWM 实验。", loc);
      timer(n).channels[ch] = { mode: cfg.TIM_OCMode, enabled: cfg.TIM_OutputState === CONSTANTS.TIM_OutputState_Enable, compare: Number(cfg.TIM_Pulse) & 0xffff, polarity: cfg.TIM_OCPolarity };
      refreshPins(); emit("pwm", { timer: n, channel: Number(ch), compare: Number(cfg.TIM_Pulse) }, loc); return 0;
    }
    const compare = name.match(/^TIM_SetCompare([1-4])$/), capture = name.match(/^TIM_GetCapture([1-4])$/);
    if (compare || capture) {
      const n = periph(args[0], "TIM", loc), tm = timer(n), ch = (compare || capture)[1];
      if (!enabledClock(n, loc)) return 0;
      if (!tm.channels[ch]) tm.channels[ch] = { mode: 0x60, enabled: false, polarity: 0, compare: 0 };
      if (capture) return tm.channels[ch].compare;
      tm.channels[ch].compare = Number(args[1]) & 0xffff;
      refreshPins(); emit("pwm", { timer: n, channel: Number(ch), compare: tm.channels[ch].compare }, loc); return 0;
    }
    if (name === "TIM_Cmd") {
      const n = periph(args[0], "TIM", loc); if (!enabledClock(n, loc)) return 0;
      const tm = timer(n); tm.counter = timerCounter(tm); tm.enabled = !!args[1]; tm.startMs = state.timeMs;
      refreshPins(); emit("timer-enable", { timer: n, enabled: tm.enabled }, loc); return 0;
    }
    if (name === "TIM_CtrlPWMOutputs") { timer(periph(args[0], "TIM", loc)).mainOutput = !!args[1]; refreshPins(); return 0; }
    if (name === "TIM_GetCounter") return timerCounter(timer(periph(args[0], "TIM", loc)));
    if (name === "TIM_SetCounter") { const tm = timer(periph(args[0], "TIM", loc)); tm.counter = Number(args[1]) & 0xffff; tm.startMs = state.timeMs; return 0; }
    if (name === "TIM_SetAutoreload") { timer(periph(args[0], "TIM", loc)).period = Number(args[1]) & 0xffff; refreshPins(); return 0; }
    if (name === "TIM_PrescalerConfig") { timer(periph(args[0], "TIM", loc)).prescaler = Number(args[1]) & 0xffff; refreshPins(); return 0; }
    if (name === "TIM_InternalClockConfig") { timer(periph(args[0], "TIM", loc)); return 0; }
    if (/^TIM_OC[1-4]PreloadConfig$/.test(name) || name === "TIM_ARRPreloadConfig") {
      warn("TIMER_PRELOAD_APPROXIMATION", "预装载配置已记录，数值在教学模型中立即生效。", "没有逐周期模拟影子寄存器和更新事件同步。", "观察占空比变化；边沿瞬态请用硬件示波器验证。", loc); return 0;
    }
    if (name === "TIM_GenerateEvent") { const tm = timer(periph(args[0], "TIM", loc)); tm.counter = 0; tm.startMs = state.timeMs; return 0; }
    if (name === "TIM_GetFlagStatus" || name === "TIM_GetITStatus") {
      const tm = timer(periph(args[0], "TIM", loc));
      return +(tm.enabled && (state.timeMs - tm.startMs) * state.coreClockHz / ((tm.prescaler + 1) * 1000) >= tm.period + 1);
    }
    if (name === "TIM_ClearFlag" || name === "TIM_ClearITPendingBit") { const tm = timer(periph(args[0], "TIM", loc)); tm.startMs = state.timeMs; return 0; }
    if (name === "ADC_StructInit") {
      setStruct(args[0], { ADC_Mode: 0, ADC_ScanConvMode: 0, ADC_ContinuousConvMode: 0, ADC_ExternalTrigConv: CONSTANTS.ADC_ExternalTrigConv_None, ADC_DataAlign: 0, ADC_NbrOfChannel: 1 }, loc); return 0;
    }
    if (name === "ADC_Init") {
      const n = periph(args[0], "ADC", loc); if (!enabledClock(n, loc)) return 0;
      const cfg = config(args[1], STRUCTS.ADC_InitTypeDef, name, loc), a = adc(n);
      if (cfg.ADC_ScanConvMode || cfg.ADC_NbrOfChannel !== 1 || cfg.ADC_Mode !== 0)
        faults("ADC_MODE_UNSUPPORTED", "这组 ADC 配置超出了单通道模型。", "不支持扫描序列、多 ADC 联动或 DMA。", "使用 Independent、ScanConvMode=DISABLE、NbrOfChannel=1。", loc);
      a.continuous = !!cfg.ADC_ContinuousConvMode; a.align = cfg.ADC_DataAlign;
      if (cfg.ADC_ExternalTrigConv !== CONSTANTS.ADC_ExternalTrigConv_None)
        faults("ADC_TRIGGER_UNSUPPORTED", "ADC 外部触发暂未模拟。", "目前支持软件启动单通道采样。", "用 ADC_ExternalTrigConv_None 和 ADC_SoftwareStartConvCmd。", loc);
      return 0;
    }
    if (name === "ADC_RegularChannelConfig") {
      const a = adc(periph(args[0], "ADC", loc)); a.channel = Number(args[1]); a.sampleTime = args[3];
      if (Number(args[2]) !== 1 || a.channel < 0 || a.channel > 15)
        faults("ADC_CHANNEL_UNSUPPORTED", "请选择单个外部 ADC 通道。", "只支持 rank=1 和外部通道 0–15；内部温度/Vref 未建模。", "例如 ADC_Channel_1、rank 1。", loc); return 0;
    }
    if (name === "ADC_Cmd") { const n = periph(args[0], "ADC", loc); if (!enabledClock(n, loc)) return 0; adc(n).enabled = !!args[1]; return 0; }
    if (["ADC_ResetCalibration", "ADC_StartCalibration"].includes(name)) {
      adc(periph(args[0], "ADC", loc));
      warn("ADC_IDEAL_CALIBRATION", "仿真中的 ADC 校准立即完成。", "没有模拟真实校准时间、偏置、噪声或参考电压误差。", "当前用于学习调用顺序；精度与耗时需在实物上测试。", loc); return 0;
    }
    if (["ADC_GetResetCalibrationStatus", "ADC_GetCalibrationStatus"].includes(name)) return 0;
    if (name === "ADC_SoftwareStartConvCmd") {
      const a = adc(periph(args[0], "ADC", loc)); a.started = !!args[1]; if (a.started) sampleADC(a, loc); return 0;
    }
    if (name === "ADC_GetFlagStatus") {
      const a = adc(periph(args[0], "ADC", loc));
      if (!a.enabled || !state.clocks[a.name]) warn("ADC_DISABLED", "ADC 尚未使能，等待转换完成可能一直不结束。", "ADC 时钟或 ADC_Cmd 未开启。", "打开时钟并调用 ADC_Cmd(..., ENABLE)，再启动转换。", loc, a.name);
      return args[1] === CONSTANTS.ADC_FLAG_EOC ? +a.eoc : 0;
    }
    if (name === "ADC_GetConversionValue") {
      const a = adc(periph(args[0], "ADC", loc)); if (a.continuous && a.started) sampleADC(a, loc);
      const value = a.value; a.eoc = a.continuous; return value;
    }
    if (name === "ADC_ClearFlag") { adc(periph(args[0], "ADC", loc)).eoc = false; return 0; }
    if (name === "ADC_ExternalTrigConvCmd") {
      if (args[1]) faults("ADC_TRIGGER_UNSUPPORTED", "外部触发 ADC 暂未模拟。", "需要外设事件时序模型。", "改用软件启动采样。", loc);
      return 0;
    }
    if (name === "USART_StructInit") {
      setStruct(args[0], { USART_BaudRate: 9600, USART_WordLength: 0, USART_StopBits: 0, USART_Parity: 0, USART_Mode: 12, USART_HardwareFlowControl: 0 }, loc); return 0;
    }
    if (name === "USART_Init") {
      const n = periph(args[0], "USART", loc); if (!enabledClock(n, loc)) return 0;
      const cfg = config(args[1], STRUCTS.USART_InitTypeDef, name, loc), u = uart(n);
      if (cfg.USART_WordLength !== 0 || cfg.USART_StopBits !== 0 || cfg.USART_Parity !== 0 || cfg.USART_HardwareFlowControl !== 0)
        faults("UART_FORMAT_UNSUPPORTED", "当前串口模型支持 8N1、无硬件流控。", "9 位字长、其他停止位、校验和 RTS/CTS 未实现。", "使用示例中的 8b、1 StopBit、Parity_No、HardwareFlowControl_None。", loc);
      if (!(cfg.USART_BaudRate > 0)) faults("UART_BAUD_INVALID", "波特率需要大于 0。", "无效 USART_BaudRate。", "例如 9600 或 115200。", loc);
      u.baudRate = cfg.USART_BaudRate; u.mode = cfg.USART_Mode; return 0;
    }
    if (name === "USART_Cmd") { const n = periph(args[0], "USART", loc); if (!enabledClock(n, loc)) return 0; uart(n).enabled = !!args[1]; return 0; }
    if (name === "USART_SendData") { sendSerial(periph(args[0], "USART", loc), args[1], loc); return 0; }
    if (name === "USART_ReceiveData") {
      const u = uart(periph(args[0], "USART", loc));
      if (!u.enabled || !(u.mode & 4)) return 0;
      return u.rx.shift() || 0;
    }
    if (name === "USART_GetFlagStatus" || name === "USART_GetITStatus") {
      const u = uart(periph(args[0], "USART", loc));
      if (!u.enabled || !state.clocks[u.name]) {
        warn("UART_DISABLED", u.name + " 尚未使能，等待状态位可能一直不结束。", "USART 时钟或 USART_Cmd 未打开。", "先打开外设时钟，完成 USART_Init，再调用 USART_Cmd(..., ENABLE)。", loc, u.name);
        return 0;
      }
      const flag = args[1];
      if (flag === CONSTANTS.USART_FLAG_RXNE || flag === CONSTANTS.USART_IT_RXNE) return +(u.rx.length > 0 && !!(u.mode & 4));
      if (flag === CONSTANTS.USART_FLAG_TXE || flag === CONSTANTS.USART_FLAG_TC) return 1;
      return 0;
    }
    if (name === "USART_ClearFlag" || name === "USART_ClearITPendingBit") return 0;
    if (["NVIC_Init", "NVIC_PriorityGroupConfig", "TIM_ITConfig", "USART_ITConfig", "EXTI_Init", "GPIO_EXTILineConfig", "__disable_irq", "__enable_irq"].includes(name)) {
      warn("INTERRUPTS_NOT_EXECUTED", "这条中断配置已记录，但平台不会自动进入中断函数。", "当前解释器没有 NVIC/EXTI 中断分发模型。", "用轮询方式完成此实验；真实中断程序请在实物或完整 MCU 仿真器验证。", loc); return 0;
    }
    if (name === "EXTI_StructInit") { setStruct(args[0], { EXTI_Line: 0, EXTI_Mode: 0, EXTI_Trigger: 0x10, EXTI_LineCmd: 0 }, loc); return 0; }
    if (name === "EXTI_GetITStatus" || name === "EXTI_ClearITPendingBit") {
      warn("INTERRUPTS_NOT_EXECUTED", "EXTI 中断状态尚未模拟。", "不会从按键边沿产生自动中断。", "请改用 GPIO_ReadInputDataBit 轮询。", loc); return 0;
    }
    if (name.startsWith("OLED_")) {
      if (name === "OLED_Init") { state.oled.enabled = true; state.oled.lines = Array(4).fill(" ".repeat(16)); }
      else if (name === "OLED_Clear") state.oled.lines = Array(4).fill(" ".repeat(16));
      else if (name === "OLED_Update") { /* Frame transfer is abstracted. */ }
      else {
        const row = Number(args[0]) - 1, col = Number(args[1]) - 1;
        if (row < 0 || row >= 4 || col < 0 || col >= 16) faults("OLED_POSITION", "OLED 文字位置超出范围。", "字符屏教学接口支持第 1–4 行、第 1–16 列。", "从 (1,1) 开始显示。", loc);
        let text = "";
        if (name === "OLED_ShowString") text = asText(args[2]);
        if (name === "OLED_ShowChar") text = typeof args[2] === "number" ? String.fromCharCode(args[2]) : asText(args[2]).slice(0, 1);
        if (name === "OLED_ShowNum") text = String(Number(args[2]) >>> 0).padStart(Math.min(16, args[3] || 1), "0");
        if (name === "OLED_ShowSignedNum") text = (args[2] < 0 ? "-" : "+") + String(Math.abs(Number(args[2]) | 0)).padStart(Math.min(15, args[3] || 1), "0");
        if (name === "OLED_ShowHexNum") text = (Number(args[2]) >>> 0).toString(16).toUpperCase().padStart(Math.min(16, args[3] || 1), "0");
        if (name === "OLED_ShowBinNum") text = (Number(args[2]) >>> 0).toString(2).padStart(Math.min(16, args[3] || 1), "0");
        const line = state.oled.lines[row]; state.oled.lines[row] = (line.slice(0, col) + text + line.slice(col + text.length)).slice(0, 16).padEnd(16, " ");
      }
      emit("oled", { lines: [...state.oled.lines], abstractedProtocol: true }, loc); return 0;
    }
    if (name === "printf" || name === "puts" || name === "putchar") {
      const text = name === "printf" ? formatC(args[0], args.slice(1)) : name === "puts" ? asText(args[0]) + "\n" : String.fromCharCode(Number(args[0]) & 0xff);
      state.console += text; emit("console", { text, plain: "调试控制台输出；不是自动重定向到硬件串口。" }, loc);
      hooks.onConsole?.(text); return text.length;
    }
    if (name === "sprintf") {
      const array = deref(args[0]), text = formatC(args[1], args.slice(2));
      if (!Array.isArray(array)) faults("SPRINTF_BUFFER", "sprintf 需要一个字符数组。", "输出目标不是可写数组。", "声明 char buffer[足够长度]，再传入 buffer。", loc);
      if (text.length + 1 > array.length) faults("BUFFER_OVERFLOW", "格式化的文字超过了数组容量。", "sprintf 将发生缓冲区越界。", "增大数组或缩短输出内容。", loc);
      [...text].forEach((c, i) => array[i] = c.charCodeAt(0)); array[text.length] = 0; return text.length;
    }
    if (name === "strlen") return asText(args[0]).length;
    if (name === "strcmp") { const a = asText(args[0]), b = asText(args[1]); return a === b ? 0 : a < b ? -1 : 1; }
    if (name === "strcpy") {
      const a = deref(args[0]), text = asText(args[1]);
      if (!Array.isArray(a) || text.length + 1 > a.length) faults("BUFFER_OVERFLOW", "复制的文字放不进目标数组。", "strcpy 目标不可写或容量不足。", "为字符串末尾的 \\0 也保留一个位置。", loc);
      [...text].forEach((c, i) => a[i] = c.charCodeAt(0)); a[text.length] = 0; return args[0];
    }
    if (name === "memset" || name === "memcpy") {
      const a = deref(args[0]), count = Number(args[2]);
      if (!Array.isArray(a) || !Number.isInteger(count) || count < 0 || count > a.length) faults("MEMORY_RANGE", "这次内存操作超过了数组范围。", "教学内存函数只支持字节数组，长度按字节检查。", "确保目标是 char/uint8_t 数组，长度不超出数组。", loc);
      if (name === "memset") for (let i = 0; i < count; i++) a[i] = Number(args[1]) & 0xff;
      else { const b = deref(args[1]); if (!Array.isArray(b) || count > b.length) faults("MEMORY_RANGE", "源数组没有这么长。", "memcpy 源数组越界。", "缩小复制长度。", loc); for (let i = 0; i < count; i++) a[i] = b[i]; }
      return args[0];
    }
    if (["abs", "labs", "fabs", "sqrt", "sin", "cos", "pow", "round", "floor", "ceil"].includes(name)) {
      const method = ["abs", "labs", "fabs"].includes(name) ? "abs" : name;
      return Math[method](...args);
    }
    if (name === "assert_param") { if (!args[0]) faults("ASSERT_FAILED", "代码里的参数检查没有通过。", "assert_param 条件为假。", "检查传给外设函数的参数是否在范围内。", loc); return 0; }
    if (name === "__NOP") { state.timeMs += 1 / 72000; return 0; }
    if (name === "SysTick_Config") {
      warn("SYSTICK_INTERRUPT_UNSUPPORTED", "SysTick 配置已记录，但不会产生中断回调。", "不支持系统滴答中断调度。", "当前可使用 Delay_ms/Delay_us 虚拟时间接口。", loc); return 0;
    }
    if (["SystemInit", "SystemCoreClockUpdate", "Delay_Init"].includes(name)) {
      emit("system", { function: name, coreClockHz: state.coreClockHz, plain: "使用已声明的 72 MHz 教学时钟配置。" }, loc); return 0;
    }
    faults("UNSUPPORTED_API", "函数 " + name + " 尚未实现。", "不会静默跳过未实现的 API。", "查看支持列表，或导入自定义函数实现。", loc);
  }

  function* runProgram() {
    for (const d of program.globals) {
      if (d.external && rootScope.find(d.name)) continue;
      yield* declare(d, rootScope, true);
    }
    return yield* callUser(program.functions.main, [], rootScope, program.functions.main.loc);
  }
  function reset() {
    state = {
      timeMs: 0, coreClockHz: board.coreClockHz, boardId: board.id, logicVoltage: board.logicVoltage, adcMax: board.adcMax, analogReadBits: board.adcDefaultBits, analogWriteBits: 8, pins: {}, clocks: {}, timers: {}, adc: {}, uarts: {},
      adcClockDivider: 6, pc: { file: program.entry, line: 1, column: 1 }, done: false,
      status: "ready", events: [], diagnostics: [], serial: "", console: "",
      oled: { enabled: false, lines: Array(4).fill(" ".repeat(16)) }, error: null, lastEvent: null,
      executedSteps: 0, returnValue: null, debugRemap: null
    };
    rootScope = new Scope(); activeScope = rootScope; stack = []; warned = new Set(); iterations = 0; staticStorage = new Map(); currentLoc = state.pc; pendingDelay = null;
    wire = { ready: false, transaction: null, held: false, received: [] };
    for (const [name, value] of Object.entries(CONSTANTS)) rootScope.add(name, { value, constant: name !== "SystemCoreClock", initialized: true, user: false, type: "uint32_t", bytes: 0 });
    for (let p = 0; p < 7; p++) {
      const letter = String.fromCharCode(65 + p), port = "GPIO" + letter;
      rootScope.add(port, { value: { __periph: port }, constant: true, initialized: true, user: false, type: "GPIO_TypeDef*", bytes: 0 });
      for (let n = 0; n < 16; n++) {
        const name = "P" + letter + n;
        state.pins[name] = { name, port, pin: n, mode: "GPIO_Mode_IN_FLOATING", configured: false, level: null, output: 0, clock: false, speedMHz: 0, speedCode: 0, pull: null, pwm: null };
      }
    }
    for (const name of ["RCC", "TIM1", "TIM2", "TIM3", "TIM4", "TIM5", "TIM6", "TIM7", "ADC1", "ADC2", "ADC3", "USART1", "USART2", "USART3"])
      rootScope.add(name, { value: { __periph: name }, constant: true, initialized: true, user: false, type: "peripheral", bytes: 0 });
    if (arduinoMode || board.family !== "STM32F1") {
      if (!board.family.startsWith("STM32")) state.pins = {};
      for (const name of board.gpioPins) {
        if (!state.pins[name]) state.pins[name] = {name,port:"ARDUINO",pin:boardPinNumber(name,board.id),mode:"GPIO_Mode_IN_FLOATING",configured:false,level:null,output:0,clock:true,pull:null,pwm:null};
        state.pins[name].port="ARDUINO"; state.pins[name].clock=true;
      }
      state.clocks.ARDUINO = true;
      const constants = {HIGH:1,LOW:0,INPUT:0,OUTPUT:1,INPUT_PULLUP:2,INPUT_PULLDOWN:3,OUTPUT_OPEN_DRAIN:4,
        DEC:10,HEX:16,OCT:8,BIN:2,LSBFIRST:0,MSBFIRST:1,SERIAL_8N1:6};
      for(const [name,value] of Object.entries(constants)) rootScope.add(name,{value,type:"int",constant:true,initialized:true,user:false,bytes:0});
      for(const [alias,canonical] of Object.entries(board.pinAliases)) {
        if(!/^[A-Za-z_]\w*$/.test(alias)||!board.gpioPins.includes(canonical))continue;
        rootScope.add(alias,{value:boardPinNumber(canonical,board.id),type:"int",constant:true,initialized:true,user:false,bytes:0});
      }
      board.analogPins.forEach((name,i)=>rootScope.add("A"+i,{value:boardPinNumber(name,board.id),type:"int",constant:true,initialized:true,user:false,bytes:0}));
      if(board.ledPin)rootScope.add("LED_BUILTIN",{value:boardPinNumber(board.ledPin,board.id),type:"int",constant:true,initialized:true,user:false,bytes:0});
      for(const name of board.serialPorts)rootScope.add(name,{value:{__serial:name},type:"serial",constant:true,initialized:true,user:false,bytes:0});
    }
    rootScope.find("SystemCoreClock").value = board.coreClockHz;
    iterator = runProgram(); return getState();
  }
  function variables(observe) {
    const chain = []; for (let scope = activeScope || rootScope; scope; scope = scope.parent) chain.unshift(scope);
    const vars = {}; let estimatedBytes = 0;
    for (const scope of chain) for (const [name, cell] of scope.values) if (cell.user) {
      vars[name] = simpleClone(cell.value, 0, observe); estimatedBytes += cell.bytes || 0;
    }
    return { variables: vars, estimatedUserDataBytes: estimatedBytes };
  }
  function snapshotState(observe = false) {
    if (!observe) refreshPins();
    const vars = variables(observe);
    const pins = Object.fromEntries(Object.entries(state.pins).map(([k, v]) => [k, { ...v, pwm: v.pwm ? { ...v.pwm } : null }]));
    const clocks = { ...state.clocks }, timers = structuredClone(state.timers), adc = structuredClone(state.adc), uarts = structuredClone(state.uarts);
    if (observe) {
      // Compute the current electrical levels on the copy. A sampling hook
      // cannot advance a timer or turn a pointer preview into a peripheral read.
      for (const pin of Object.values(pins)) if (pin.arduinoPWM) pin.arduinoPWM = { ...pin.arduinoPWM };
      refreshPins({ pins, clocks, timers, adc, uarts, timeMs: state.timeMs, coreClockHz: state.coreClockHz });
    }
    return {
      timeMs: state.timeMs, coreClockHz: state.coreClockHz, boardId:board.id, logicVoltage:board.logicVoltage, adcMax:board.adcMax, analogReadBits:state.analogReadBits,
      pins, clocks, timers, adc, uarts, pc: { ...state.pc }, stack: stack.map(x => ({ ...x })),
      done: state.done, status: state.status, error: state.error ? { ...state.error } : null,
      events: state.events.slice(-200), diagnostics: [...state.diagnostics],
      serial: state.serial, console: state.console, oled: { ...state.oled, lines: [...state.oled.lines] },
      lastEvent: state.lastEvent, executedSteps: state.executedSteps, returnValue: state.returnValue,
      ...(pendingDelay && { pendingDelay: { fromMs: pendingDelay.fromMs, durationMs: pendingDelay.durationMs,
        toMs: pendingDelay.toMs, remainingMs: pendingDelay.toMs - state.timeMs } }),
      ...vars, memoryEstimateNote: "仅统计已声明用户数据；不是实际 ARM 固件的 SRAM/栈占用。",
      capabilities: runtimeCapabilities
    };
  }
  function getState() { return snapshotState(); }
  function readDelayState() { return snapshotState(true); }
  function runtimeError(error) {
    const d = error instanceof RuntimeFault ? error.diagnostic : diag("ENGINE_ERROR", "程序运行遇到了无法处理的情况。", String(error?.message || error), "检查当前行；可把这个项目作为错误案例导出。", currentLoc);
    pendingDelay = null;
    state.diagnostics.push(d); state.error = d; state.done = true; state.status = "error"; state.pc = locOf(d);
    // Record without calling the failed external hook a second time.
    const event = { type: "error", diagnostic: d, timeMs: state.timeMs, ...locOf(d) };
    state.events.push(event); state.lastEvent = event; return event;
  }
  function next(deadlineMs = Infinity) {
    if (state.done) return null;
    state.status = "running";
    try {
      // The generator remains suspended at the same call until this wait ends.
      if (pendingDelay) return progressDelay(deadlineMs);
      const result = iterator.next();
      if (pendingDelay) {
        const event = progressDelay(Math.max(state.timeMs, deadlineMs));
        state.executedSteps++;
        return event;
      }
      state.executedSteps++;
      if (result.done) {
        state.done = true; state.status = "completed"; state.returnValue = result.value ?? 0;
        state.lastEvent = emit("complete", { returnValue: state.returnValue });
        return state.lastEvent;
      }
      state.lastEvent = result.value || { type: "line", timeMs: state.timeMs, ...state.pc };
      if (state.lastEvent.file) state.pc = locOf(state.lastEvent);
      return state.lastEvent;
    } catch (error) {
      return runtimeError(error);
    }
  }
  function step(maxInstructions = 1, options) {
    const deferDelay = options?.deferDelay === true;
    const budget = Math.max(1, Math.min(20000, Math.floor(Number(maxInstructions) || 1)));
    let count = 0;
    while (count < budget && !state.done) {
      const wasWaiting = Boolean(pendingDelay);
      next(deferDelay && !wasWaiting ? state.timeMs : Infinity); count++;
      if (deferDelay && (wasWaiting || pendingDelay)) break;
    }
    return { ...getState(), steps: count };
  }
  function runUntilDelay(maxInstructions = 5000) {
    return runToDelay(Infinity, maxInstructions);
  }
  function runSlice(maxMs, maxInstructions = 5000) {
    const amount = Number(maxMs);
    if (!Number.isFinite(amount) || amount < 0 || amount > 86400000) throw new RangeError("runSlice 需要 0–86400000 的毫秒数。");
    return runToDelay(state.timeMs + amount, maxInstructions);
  }
  function runToDelay(deadlineMs, maxInstructions) {
    const budget = Math.max(1, Math.min(20000, Math.floor(Number(maxInstructions) || 5000)));
    const startedAt = state.timeMs;
    let count = 0, event, reachedBoundary = false;
    while (count < budget && !state.done) {
      event = next(deadlineMs); count++;
      reachedBoundary = Boolean(pendingDelay || event?.type === "delay" || (state.timeMs > startedAt && state.timeMs >= deadlineMs));
      if (reachedBoundary) break;
    }
    const budgetReached = count === budget && !state.done && !reachedBoundary;
    if (budgetReached) {
      warn("NO_VIRTUAL_TIME_PROGRESS", "这一轮执行了很多语句，但仿真时间没有等待点。", "已达到本帧步数预算；浏览器保持响应，程序下帧可继续。", "检查是否卡在等待条件；需要闪烁或连续采样时加合适的 Delay。", currentLoc);
    }
    return { ...getState(), steps: count, budgetReached };
  }
  function injectSerial(text, port = null) {
    port ||= arduinoMode ? "Serial" : "USART1";
    const u = uart(port);
    const bytes = typeof text === "string" ? [...text].map(c => c.charCodeAt(0) & 0xff) : Array.from(text || []).map(x => Number(x) & 0xff);
    u.rx.push(...bytes); if (u.rx.length > 1024) {
      u.rx = u.rx.slice(-1024); warn("UART_RX_QUEUE_OVERFLOW", "串口接收队列满了，较早的数据被丢弃。", "教学队列最多保存 1024 字节。", "让代码及时调用 USART_ReceiveData。", state.pc, port);
    }
    return getState();
  }
  function advanceTime(ms) {
    const amount = Number(ms);
    if (!Number.isFinite(amount) || amount < 0 || amount > 86400000) throw new RangeError("advanceTime 需要 0–86400000 的毫秒数。");
    const deadlineMs = state.timeMs + amount;
    if (pendingDelay) {
      try { progressDelay(deadlineMs); }
      catch (error) { runtimeError(error); return getState(); }
    }
    state.timeMs = deadlineMs; refreshPins();
    return getState();
  }
  reset();
  return { step, runUntilDelay, runSlice, advanceTime, reset, getState, injectSerial, capabilities: runtimeCapabilities };
}
