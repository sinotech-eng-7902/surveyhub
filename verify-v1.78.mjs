import fs from 'node:fs';
import vm from 'node:vm';

const failures=[];
const check=(condition,message)=>{if(!condition)failures.push(message)};
const read=file=>fs.readFileSync(file,'utf8');
const html=read('index.html');
const app=read('js/app.js');
const guards=read('js/app-guards.js');
const css=read('css/app.css');

check(html.includes('<title>公司通用問卷調查系統 v1.78</title>'),'HTML 標題不是 v1.78');
check(html.includes('css/app.css?v=1.78'),'CSS 快取版次不是 v1.78');
check(html.includes('js/app.js?v=1.78')&&html.includes('js/app-guards.js?v=1.78'),'JavaScript 快取版次不是 v1.78');
check(!/v=1\.77/.test(html),'HTML 仍含 v1.77 快取版次');
check(app.includes('async function loadResponses(requestedFormId=activeFormId)'),'回覆讀取未鎖定指定問卷');
check(app.includes('requestId!==responseLoadRequestV178||activeFormId!==formId'),'回覆查詢缺少過期結果防護');
check(app.includes("if($('progressPanel')?.classList.contains('active'))renderProgressPanelV171()"),'管理畫面更新時未同步重繪填寫追蹤');
check(app.includes("if(filter)filter.value=''"),'切換問卷時未重設部門篩選');
check(app.includes('async function switchActiveFormV178(id)'),'缺少 v1.78 問卷安全切換入口');
check(app.includes('selectionId!==formSelectionRequestV178||activeFormId!==formId'),'問卷切換缺少競態防護');
check(guards.includes('await switchActiveFormV178(id);'),'未儲存保護層未使用 v1.78 安全切換入口');
check(!guards.includes('await loadResponses();\n    renderAdmin();'),'保護層仍直接執行舊切換流程');
check((html.match(/\bid=["'][^"']+["']/g)||[]).length===new Set((html.match(/\bid=["']([^"']+)["']/g)||[]).map(item=>item.replace(/^.*?["']|["']$/g,''))).size,'HTML 存在重複 ID');
check((css.match(/{/g)||[]).length===(css.match(/}/g)||[]).length,'CSS 大括號數量不一致');

function functionSource(name){
  const signatures=[`async function ${name}(`,`function ${name}(`];
  const start=signatures.map(signature=>app.indexOf(signature)).find(index=>index>=0);
  if(start===undefined)throw new Error(`找不到函式：${name}`);
  const brace=app.indexOf('{',start);
  let depth=0;
  for(let index=brace;index<app.length;index++){
    if(app[index]==='{')depth++;
    if(app[index]==='}'&&--depth===0)return app.slice(start,index+1);
  }
  throw new Error(`函式未閉合：${name}`);
}
const exactLoad=functionSource('loadResponses');
const exactSwitch=functionSource('switchActiveFormV178');
const context={
  console,
  setTimeout,
  clearTimeout,
  Promise,
  String,
  encodeURIComponent
};
vm.createContext(context);
vm.runInContext(`
let activeFormId='',responses=[],responseLoadRequestV178=0,formSelectionRequestV178=0,isAdmin=true;
const datasets={A:['A-1','A-2'],B:['B-1','B-2','B-3']};
const delays={A:35,B:5};
const canViewForm=()=>true;
const col=()=>({where:(field,operator,formId)=>({get:()=>new Promise(resolve=>setTimeout(()=>resolve({docs:datasets[formId].map((value,index)=>({id:value,data:()=>({formId,value,submittedAt:{seconds:index}})}))}),delays[formId]))})});
const history={replaceState(){}};
const activeFormSelect={setAttribute(){},removeAttribute(){}};
let resets=0,renders=0;
const resetProgressViewV178=()=>{resets++};
const renderAdmin=()=>{renders++};
${exactLoad}
${exactSwitch}
globalThis.runRapidSwitch=async()=>{
  const first=switchActiveFormV178('A');
  await new Promise(resolve=>setTimeout(resolve,1));
  const second=switchActiveFormV178('B');
  await Promise.all([first,second]);
  return {activeFormId,responses:responses.map(item=>item.id),resets,renders};
};
`,context);
const rapidState=await context.runRapidSwitch();
check(rapidState.activeFormId==='B','快速切換後選定問卷不是最後的 B');
check(rapidState.responses.length===3&&rapidState.responses.every(id=>id.startsWith('B-')),'快速切換後仍被 A 問卷資料覆蓋');
check(rapidState.resets===2,'每次問卷切換未清除上一份填寫追蹤資料');
check(rapidState.renders===1,'過期查詢仍觸發畫面重新渲染');

if(failures.length){
  console.error(JSON.stringify({version:'v1.78',result:'FAIL',failures},null,2));
  process.exit(1);
}
console.log(JSON.stringify({
  version:'v1.78',
  result:'PASS',
  contracts:9,
  rapidSwitch:'A → B，最終資料為 B',
  duplicateIds:0,
  cssBraces:'balanced'
},null,2));
