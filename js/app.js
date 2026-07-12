let app,auth,db,currentUser=null,isAdmin=false,isSystemAdmin=false,formAssignments=[],formManagers=[],forms=[],responses=[],departments=[],members=[],memberAccounts=[],activeFormId='',editMode='new',editingId='',draftQuestions=[],editingResponseId='',memberEditMode='view',editingMemberId='',submissionLocksPrepared=false,loginPurpose='admin',formDirty=false,activeFormSection='mine';
const $=id=>document.getElementById(id);
const front=$('front'),frontMain=$('frontMain'),formStatus=$('formStatus'),admin=$('admin'),loginMask=$('loginMask'),loginBtn=$('loginBtn'),loginMsg=$('loginMsg'),adminUser=$('adminUser'),activeFormSelect=$('activeFormSelect'),activeFormLabel=$('activeFormLabel'),formsTable=$('formsTable'),resultsTable=$('resultsTable'),questionEditor=$('questionEditor');

function col(name){return db.collection(name)}
function doc(name,id){return col(name).doc(id)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function attr(v){return esc(v)}
function normalizeEmail(value){return String(value||'').trim().toLowerCase()}
function memberDisplayName(member){return [member?.department||member?.departmentName||'',member?.name||''].filter(Boolean).join(' ')||member?.name||''}
function memberGoogleEmail(member){let account=memberAccounts.find(a=>a.memberId===member?.id||a.id===member?.id);return normalizeEmail(account?.email||member?.googleEmail||member?.googleAccount||member?.email||member?.gmail||'')}
function findMemberByGoogleEmail(email){let target=normalizeEmail(email);return target?members.find(m=>memberGoogleEmail(m)===target)||null:null}
function toast(message,type='info'){let t=$('toast');t.textContent=message;t.className='toast '+type;t.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.style.display='none',2600)}
function notify(message,type='warn'){toast(message,type);return false}
let dialogResolve=null,dialogOptions={};
function openDialog({title='確認操作',message='',messageHtml='',confirmText='確定',cancelText='取消',danger=false,inputLabel='',requiredText='',inputValue='',inputPlaceholder='',deleteConfirm=false}){let mask=$('dialogMask'),inputWrap=$('dialogInputWrap'),input=$('dialogInput'),confirm=$('dialogConfirm'),messageBox=$('dialogMessage');$('dialogTitle').textContent=title;if(messageHtml){messageBox.innerHTML=messageHtml}else{messageBox.innerHTML=esc(message).replace(/\n/g,'<br>')}$('dialogCancel').textContent=cancelText;confirm.textContent=confirmText;confirm.className='btn '+(danger?'danger':'primary');dialogOptions={requiredText};inputWrap.style.display=inputLabel?'flex':'none';inputWrap.classList.toggle('deleteConfirmInput',!!deleteConfirm);inputWrap.firstChild.textContent=inputLabel||'確認文字';input.value=inputValue||'';input.placeholder=inputPlaceholder||'';mask.style.display='grid';if(inputLabel)setTimeout(()=>input.focus(),60);return new Promise(resolve=>{dialogResolve=resolve})}
function closeDialog(ok){let mask=$('dialogMask'),input=$('dialogInput'),required=dialogOptions.requiredText||'';if(ok&&required&&input.value!==required){toast('輸入內容不一致，請重新確認。','warn');input.focus();return}mask.style.display='none';let resolve=dialogResolve;dialogResolve=null;if(resolve)resolve(ok?{ok:true,value:input.value}:{ok:false,value:''})}
async function confirmDialog(message,title='確認操作',danger=false){let result=await openDialog({title,message,danger,confirmText:danger?'確認':'確定'});return !!result.ok}
async function inputConfirmDialog({title='確認操作',message='',messageHtml='',requiredText='',danger=false,inputLabel='請輸入確認文字',inputPlaceholder='',confirmText='',deleteConfirm=false}){let result=await openDialog({title,message,messageHtml,danger,inputLabel,requiredText,inputPlaceholder,confirmText:confirmText||(danger?'確認刪除':'確定'),deleteConfirm});return result.ok?result.value:null}
async function showCopyDialog(title,value){await openDialog({title,message:'瀏覽器不允許自動複製，請從下方欄位複製。',inputLabel:'連結',inputValue:value,confirmText:'關閉',cancelText:'取消'});return value}
function setPageLoading(visible,text='處理中…'){let box=$('pageLoading');if(!box)return;box.hidden=!visible;let inner=box.querySelector('div');if(inner)inner.textContent=text}
function formatDeadline(value){if(!value)return '';let d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleString('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
function formatAnyDate(value){if(!value)return '';let raw=value?.toDate?value.toDate():value;let d=raw instanceof Date?raw:new Date(raw);return Number.isNaN(d.getTime())?String(value||''):d.toLocaleString('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
function formStartLabel(f){return formatAnyDate(f?.startAt||f?.openAt||f?.createdAt)||'未紀錄'}
function deadlinePassed(value){if(!value)return false;let d=new Date(value);return !Number.isNaN(d.getTime())&&d<new Date()}
function driveFileId(value){let v=String(value||'').trim();if(!v)return '';try{let u=new URL(v);if(!/(^|\.)drive\.google\.com$/i.test(u.hostname))return '';let pathMatch=u.pathname.match(/\/file\/d\/([^/]+)/i)||u.pathname.match(/\/d\/([^/]+)/i);return pathMatch?.[1]||u.searchParams.get('id')||''}catch(e){return''}}
function imageUrl(value){let v=String(value||'').trim();if(!v)return '';if(/^assets\/[\w./-]+$/i.test(v))return v;let driveId=driveFileId(v);if(driveId)return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1600`;try{let u=new URL(v,location.href);return /^https?:$/.test(u.protocol)?u.href:''}catch(e){return''}}
function imagePreviewHtml(value,alt='圖片預覽'){let url=imageUrl(value);return url?`<img src="${attr(url)}" alt="${attr(alt)}" onerror="this.parentElement.innerHTML='<div class=&quot;imagePreviewError&quot;>圖片無法顯示，請確認 Google Drive 分享權限。</div>'">`:''}
function previewHeaderImage(){$('headerImagePreview').innerHTML=imagePreviewHtml($('formImageUrl').value,'頁首圖片預覽')}
function updateQuestionImage(i,value){draftQuestions[i].imageUrl=value;let preview=$('questionImagePreview_'+i);if(preview)preview.innerHTML=imagePreviewHtml(value,draftQuestions[i].title||'參考圖片預覽')}
function formRouteId(){let m=location.hash.match(/^#form\/([^/?#]+)/);return m?decodeURIComponent(m[1]):''}

async function init(){
  if(!window.firebase||typeof firebaseConfig==='undefined'||!firebaseConfig.apiKey){frontMain.innerHTML='<div class="successCard"><h2>尚未設定 Firebase</h2><p>請確認 js/config.js 已正確上傳。</p></div>';return}
  app=firebase.initializeApp(firebaseConfig);auth=firebase.auth();db=firebase.firestore();
  window.addEventListener('hashchange',applyRoute);
  window.addEventListener('beforeunload',e=>{if(formDirty){e.preventDefault();e.returnValue=''}});
  document.addEventListener('input',e=>{if($('editorPanel')?.contains(e.target))formDirty=true});
  document.addEventListener('change',e=>{if($('editorPanel')?.contains(e.target))formDirty=true});
  document.addEventListener('click',e=>{if(!e.target.closest('.adminMoreMenu')){let more=$('adminMoreMenu');if(more)more.open=false}if(!e.target.closest('.topNavGroup'))closeTopNavGroups()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){let more=$('adminMoreMenu');if(more)more.open=false;closeTopNavGroups()}});
  document.querySelectorAll('.topNavGroup').forEach(group=>{group.addEventListener('mouseenter',()=>{clearTimeout(window.__topNavCloseTimer)});group.addEventListener('mouseleave',()=>{clearTimeout(window.__topNavCloseTimer);window.__topNavCloseTimer=setTimeout(()=>group.removeAttribute('open'),280)});group.querySelectorAll('.nav').forEach(item=>item.addEventListener('click',()=>closeTopNavGroups()))});
  auth.onAuthStateChanged(async user=>{currentUser=user;isAdmin=false;isSystemAdmin=false;formAssignments=[];if(user){try{await loadMemberAccounts();isSystemAdmin=await checkAdmin(user);formAssignments=await loadCurrentAssignments(user);let member=findMemberByGoogleEmail(user.email),hasMemberAccount=!!member;isAdmin=isSystemAdmin||hasMemberAccount||formAssignments.some(x=>x.enabled!==false);if(isAdmin){let name=memberDisplayName(member)||user.displayName||'後台使用者';if($('adminUserName'))$('adminUserName').textContent=name;adminUser.textContent=(user.email||'')+(isSystemAdmin?'・系統管理員':'');loginMask.style.display='none';await loadAdminData()}else if(loginPurpose==='response'){loginMask.style.display='none'}else loginMsg.textContent='此 Google 帳號尚未建立於人員管理或問卷權限中，請聯絡系統管理員。'}catch(e){console.error('admin auth failed',e);loginMsg.textContent='後台登入檢查失敗，請確認 Firestore 規則與人員 Google 帳號設定。'}}else{memberAccounts=[]}applyRoute()});
  await loadPublicData();applyRoute();
}

async function checkAdmin(user){let direct=await doc('users',user.uid).get();if(direct.exists){let u=direct.data();if(u.enabled!==false&&String(u.role||'').toLowerCase()==='admin')return true}let q=await col('users').where('email','==',user.email).limit(1).get();if(q.empty)return false;let u=q.docs[0].data();return u.enabled!==false&&String(u.role||'').toLowerCase()==='admin'}
async function loadMemberAccounts(){if(!currentUser){memberAccounts=[];return}try{let snap=await col('memberAccounts').get();memberAccounts=snap.docs.map(x=>({id:x.id,...x.data()}))}catch(e){console.warn('讀取 Google 帳號對應失敗，請確認 v1.27 Firestore 規則已部署',e);memberAccounts=[]}}
async function normalizeExistingResponseIds(items){let changed=false,ids=new Set(items.map(x=>x.id));for(let r of items){if(!r.memberId)continue;let target=`${r.formId}__${r.memberId}`;if(ids.has(target))continue;let {id,...data}=r;try{await doc('universalResponses',target).set(data);await doc('universalResponses',id).delete();ids.add(target);changed=true}catch(e){console.warn('既有回覆防重複轉換失敗',e)}}return changed}
async function prepareSubmissionLocks(){try{let [responseSnap,lockSnap]=await Promise.all([col('universalResponses').get(),col('universalResponseLocks').get()]),items=responseSnap.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(b.submittedAt?.seconds||0)-(a.submittedAt?.seconds||0)),responseIds=new Set(items.map(x=>x.id)),lockIds=new Set(lockSnap.docs.map(x=>x.id)),handled=new Set();for(let r of items){if(!r.formId||!r.memberId)continue;let key=`${r.formId}__${r.memberId}`;if(handled.has(key))continue;handled.add(key);if(!responseIds.has(key)){let {id,...data}=r;await doc('universalResponses',key).set(data);await doc('universalResponses',id).delete();responseIds.add(key)}if(!lockIds.has(key)){await doc('universalResponseLocks',key).set({formId:r.formId,memberId:r.memberId,createdAt:firebase.firestore.FieldValue.serverTimestamp()});lockIds.add(key)}}}catch(e){console.warn('建立既有回覆鎖定紀錄失敗，請確認 v1.10 Firestore 規則',e)}finally{submissionLocksPrepared=true}}

function openAdmin(){loginPurpose='admin';history.pushState(null,'','#admin');applyRoute()}
function closeLogin(){loginMask.style.display='none';history.replaceState(null,'','#form/'+encodeURIComponent(activeFormId||''));applyRoute()}
async function loginGoogle(){if(!auth){loginMsg.textContent='登入服務尚未完成初始化，請重新整理頁面後再試一次。';return}loginBtn.disabled=true;loginBtn.textContent='登入處理中…';loginMsg.textContent='';try{let p=new firebase.auth.GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});await auth.signInWithPopup(p);if(loginPurpose==='admin'&&!isAdmin)loginMsg.textContent='正在確認管理員權限…'}catch(e){loginMsg.textContent=e.code==='auth/popup-closed-by-user'?'已取消登入。':(e.message||'登入失敗')}finally{loginBtn.disabled=false;loginBtn.textContent='使用 Google 登入'}}
async function logout(){await auth.signOut();history.replaceState(null,'','#form/'+encodeURIComponent(activeFormId||''));applyRoute()}
function showFront(){history.pushState(null,'','#form/'+encodeURIComponent(activeFormId||''));applyRoute()}

function activeForm(){return forms.find(f=>f.id===activeFormId)||null}

function allowedDepartmentNames(f){let selected=Array.isArray(f.targetDepartments)?f.targetDepartments:[];let all=departments.map(d=>d.name||d.departmentName||d.department||'').filter(Boolean);return selected.length?all.filter(x=>selected.includes(x)):all}
function renderIdentityBlock(f){let deps=allowedDepartmentNames(f);return `<section class="questionCard identityCard"><label class="title">填寫者資料 <span class="required">*</span></label><div class="identityGrid"><label>部門<select id="identityDepartment" required onchange="updateIdentityMembers(this.value)"><option value="">請選擇部門</option>${deps.map(d=>`<option value="${attr(d)}">${esc(d)}</option>`).join('')}</select></label><label>姓名<select id="identityMember" required disabled><option value="">請先選擇部門</option></select></label></div></section>`}
function updateIdentityMembers(department){let select=$('identityMember'),list=members.filter(m=>m.active!==false&&(m.department||m.departmentName||'')===department);select.innerHTML='<option value="">請選擇姓名</option>'+list.map(m=>`<option value="${attr(m.id)}">${esc(m.name)}</option>`).join('');select.disabled=!department}

function renderPublicQuestion(q){let required=q.required?'<span class="required"> *</span>':'';let title=`${esc(q.title||'未命名題目')}${required}`;let help=q.help?`<div class="questionHelp">${esc(q.help)}</div>`:'';let img=imageUrl(q.imageUrl),image=img?`<img class="questionImage" src="${attr(img)}" alt="${attr(q.title||'參考圖片')}">`:'';if(q.type==='image')return `<section class="questionCard"><label class="title">${title}</label>${help}${image}</section>`;let name='q_'+q.id,req=q.required?'required':'';let input='';if(q.type==='long')input=`<textarea name="${attr(name)}" ${req}></textarea>`;else if(q.type==='single'||q.type==='multiple'){let t=q.type==='multiple'?'checkbox':'radio',choiceRequired=q.type==='single'?req:'';input=`<div class="choiceList">${(q.options||[]).map(o=>`<label class="choice"><input type="${t}" name="${attr(name)}" value="${attr(o)}" ${choiceRequired}>${esc(o)}</label>`).join('')}</div>`}else if(q.type==='dropdown'||q.type==='department'){let opts=q.type==='department'?departments.map(d=>d.name||d.departmentName||'').filter(Boolean):(q.options||[]);input=`<select name="${attr(name)}" ${req}><option value="">請選擇</option>${opts.map(o=>`<option value="${attr(o)}">${esc(o)}</option>`).join('')}</select>`}else input=`<input type="text" name="${attr(name)}" ${req}>`;return `<section class="questionCard"><label class="title">${title}</label>${help}${image}${input}</section>`}


function closeTopNavGroups(){document.querySelectorAll('.topNavGroup[open]').forEach(d=>d.removeAttribute('open'))}
async function showPanel(id,button){let active=document.querySelector('.panel.active');if(active?.id==='editorPanel'&&id!=='editorPanel'&&formDirty&&!await confirmDialog('問卷內容尚未儲存，確定要離開編輯頁面？','尚未儲存'))return;document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));$(id).classList.add('active');document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active'));if(button)button.classList.add('active');else{let nav=[...document.querySelectorAll('.nav')].find(n=>(n.getAttribute('onclick')||'').includes("'"+id+"'"));if(nav)nav.classList.add('active')}$('panelTitle').textContent=({dashboardPanel:'儀表板',formsPanel:'問卷管理',editorPanel:'問卷編輯',membersPanel:'人員管理',trashPanel:'垃圾桶',permissionsPanel:'權限管理',resultsPanel:'填寫結果'})[id]||'通用問卷後台';if(id==='dashboardPanel')renderDashboard();if(id==='resultsPanel')renderResults();if(id==='membersPanel')renderMemberPanel();if(id==='trashPanel')renderTrash();if(id==='permissionsPanel')loadFormManagers();closeTopNavGroups()}
function emptyState(title='尚無資料',desc='目前沒有可顯示的資料。',action=''){return `<div class="emptyState"><span>i</span><b>${esc(title)}</b><p>${esc(desc)}</p>${action}</div>`}
function table(headers,rows,emptyHtml=''){return `<div class="tableWrap dataTable"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td class="emptyCell" colspan="${headers.length}">${emptyHtml||emptyState()}</td></tr>`}</tbody></table></div>`}
function effectiveState(form){if(!form?.deleted&&form?.state==='open'&&deadlinePassed(form.deadline))return'expired';return form?.deleted?'deleted':form?.state||'draft'}
function stateLabel(v){return({draft:'草稿',open:'開放填寫',closed:'已關閉',deleted:'已移至垃圾桶',expired:'已截止',pending:'尚未開始'})[v]||v}
function statePillHtml(state){return `<span class="statePill state-${attr(state||'draft')}">${esc(stateLabel(state))}</span>`}
function countPillHtml(count){return `<span class="countPill">${Number(count)||0}</span>`}
function roleBadgeHtml(role,canManage=false){let cls=canManage?'manager':'viewer';return `<span class="roleBadge ${cls}">${esc(role)}</span>`}
function actionButton(label,handler,variant=''){return `<button class="btn ${variant}" onclick="${attr(handler)}">${esc(label)}</button>`}
function actionGroup(buttons){return `<div class="buttonRow tableActions">${buttons.filter(Boolean).join('')}</div>`}
function moreActions(buttons){let html=buttons.filter(Boolean).join('');return html?`<details class="moreMenu"><summary class="btn">更多</summary><div>${html}</div></details>`:''}

function renderTargetDepartments(selected=null){if(selected===null)selected=[...document.querySelectorAll('.targetDepartment:checked')].map(x=>x.value);let enabled=$('identityMode').value==='member',box=$('targetDepartmentBox');box.innerHTML=departments.map(d=>{let n=d.name||d.departmentName||d.department||'';return `<label class="departmentChoice"><input type="checkbox" class="targetDepartment" value="${attr(n)}" ${selected.includes(n)?'checked':''}>${esc(n)}</label>`}).join('')||'<span class="questionHelp">尚無部門資料</span>';document.querySelector('.identitySettings')?.classList.toggle('disabled',!enabled);box.querySelectorAll('input').forEach(x=>x.disabled=!enabled)}
function addQuestion(type='short'){draftQuestions.push({id:'q_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),type,title:'',required:false,options:[],imageUrl:'',help:''});renderQuestionEditor()}
function updateQuestion(i,key,value){if(key==='options')draftQuestions[i][key]=value.split('\n').map(x=>x.trim()).filter(Boolean);else draftQuestions[i][key]=value}
function moveQuestion(i,delta){let j=i+delta;if(j<0||j>=draftQuestions.length)return;[draftQuestions[i],draftQuestions[j]]=[draftQuestions[j],draftQuestions[i]];renderQuestionEditor()}
async function removeQuestion(i){if(await confirmDialog('確定移除此題？','移除題目',true)){draftQuestions.splice(i,1);renderQuestionEditor()}}
function renderQuestionEditor(){questionEditor.innerHTML=draftQuestions.map((q,i)=>`<div class="questionEdit"><div class="questionGrid"><label>題目名稱<input value="${attr(q.title)}" oninput="updateQuestion(${i},'title',this.value)"></label><label>題型<select onchange="updateQuestion(${i},'type',this.value);renderQuestionEditor()">${[['short','簡答'],['long','長文'],['single','單選'],['multiple','複選'],['dropdown','下拉選單'],['department','部門選單'],['image','圖片／說明']].map(x=>`<option value="${x[0]}" ${q.type===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></label><label>必填<select onchange="updateQuestion(${i},'required',this.value==='true')"><option value="false" ${!q.required?'selected':''}>否</option><option value="true" ${q.required?'selected':''}>是</option></select></label></div>${['single','multiple','dropdown'].includes(q.type)?`<label class="optionsField">選項（每行一個）<textarea oninput="updateQuestion(${i},'options',this.value)">${esc((q.options||[]).join('\n'))}</textarea></label>`:''}<div class="questionGrid"><label>說明文字<input value="${attr(q.help||'')}" oninput="updateQuestion(${i},'help',this.value)"></label><div class="questionImageField"><label>參考圖片網址<input value="${attr(q.imageUrl||'')}" placeholder="可貼 Google Drive 分享網址" oninput="updateQuestionImage(${i},this.value)"></label><p>Drive 圖片需開啟「知道連結的使用者皆可查看」。</p><div id="questionImagePreview_${i}" class="imagePreview">${imagePreviewHtml(q.imageUrl,q.title||'參考圖片預覽')}</div></div></div><div class="miniActions"><button class="btn" onclick="moveQuestion(${i},-1)">上移</button><button class="btn" onclick="moveQuestion(${i},1)">下移</button><button class="btn danger" onclick="removeQuestion(${i})">移除</button></div></div>`).join('')||'<div class="questionHelp">尚未建立題目，請按「新增題目」。</div>'}

async function saveForm(){let title=$('formTitle').value.trim();if(!title)return notify('請輸入問卷標題');if(!draftQuestions.length)return notify('請至少建立一個題目');if(draftQuestions.some(q=>!q.title.trim()))return notify('每一題都需要題目名稱');if(draftQuestions.some(q=>['single','multiple','dropdown'].includes(q.type)&&!(q.options||[]).length))return notify('選擇題至少需要一個選項');let identityMode=$('identityMode').value,targetDepartments=identityMode==='member'?[...document.querySelectorAll('.targetDepartment:checked')].map(x=>x.value):[];if(identityMode==='member'&&!targetDepartments.length)return notify('請至少選擇一個開放填寫部門');let id=editMode==='edit'?editingId:'form_'+Date.now(),data={title,description:$('formDescription').value.trim(),deadline:$('formDeadline').value,state:$('formState').value,imageUrl:$('formImageUrl').value.trim(),identityMode,targetDepartments,questions:draftQuestions,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedByEmail:normalizeEmail(currentUser?.email||'')};if(editMode==='new'){data.createdAt=firebase.firestore.FieldValue.serverTimestamp();data.createdByEmail=normalizeEmail(currentUser?.email||'');data.createdByName=currentUser?.displayName||currentUser?.email||''}let btn=$('saveFormBtn');btn.disabled=true;btn.textContent='儲存中…';setPageLoading(true,'正在儲存問卷…');try{await doc('universalForms',id).set(data,{merge:true});formDirty=false;activeFormId=id;await loadAdminData();showPanel('formsPanel');toast(editMode==='edit'?'問卷變更已儲存':'問卷已建立','success')}catch(e){console.error(e);notify('問卷儲存失敗，請確認權限或網路狀態','error')}finally{setPageLoading(false);btn.disabled=false;btn.textContent=editMode==='edit'?'儲存變更':'建立問卷'}}
async function createUniformTemplate(){if(forms.some(f=>f.templateKey==='uniform-jacket')&&!await confirmDialog('已經有外套尺寸範本，仍要再建立一份嗎？','建立範本'))return;let id='uniform_'+Date.now(),questions=[{id:'size',type:'dropdown',title:'選擇您的外套尺寸',required:true,options:['XS','S','M','L','XL','2XL','3XL','4XL'],help:'請參考下方尺寸資訊選擇'},{id:'reference',type:'image',title:'外套款式、尺寸表與丈量位置參考',required:false,options:[],imageUrl:'assets/uniform-survey-reference.jpg',help:'目前使用原 Google 問卷截圖；取得原始圖片後可在後台替換。'}],data={title:'【環興科技】立領撞色外套尺寸調查表',description:'為統計同仁外套尺寸，請依照尺寸表與丈量方式選擇合適尺寸。\n請於期限內完成填寫，如有疑問請洽承辦人。',deadline:'',state:'draft',imageUrl:'',identityMode:'member',targetDepartments:[],questions,templateKey:'uniform-jacket',createdByEmail:normalizeEmail(currentUser?.email||''),createdByName:currentUser?.displayName||currentUser?.email||'',createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};setPageLoading(true,'正在建立範本…');try{await doc('universalForms',id).set(data);activeFormId=id;await loadAdminData();editForm(id);toast('已建立外套尺寸調查範本，請選擇開放部門並設定截止時間','success')}catch(e){console.error(e);notify('建立範本失敗，請確認權限或網路狀態','error')}finally{setPageLoading(false)}}
async function copyFormLink(id=activeFormId){if(!id)return notify('請先選擇問卷');let url=location.href.split('#')[0]+'#form/'+encodeURIComponent(id);if(navigator.clipboard?.writeText)try{await navigator.clipboard.writeText(url);toast('問卷網址已複製','success');return}catch(e){}await showCopyDialog('複製問卷網址',url)}
function formRoleLabel(f){if(isSystemAdmin)return isCreatedByCurrentUser(f)?'發起人':'系統管理員';if(isCreatedByCurrentUser(f))return'發起人';let a=assignmentFor(f.id);return a?.role==='manager'?'問卷管理者':'檢視者'}
function responseCountForForm(formId){return formId===activeFormId?responses.length:(forms.find(f=>f.id===formId)?.responseCount||0)}
function formsBySection(){let list=accessibleForms(),open=list.filter(f=>f.deleted!==true&&effectiveState(f)!=='closed'&&effectiveState(f)!=='expired'),mine=open.filter(isCreatedByCurrentUser),shared=open.filter(f=>!isCreatedByCurrentUser(f)&&!!assignmentFor(f.id)),closed=list.filter(f=>f.deleted!==true&&(effectiveState(f)==='closed'||effectiveState(f)==='expired')),all=isSystemAdmin?forms.filter(f=>f.deleted!==true):[];return[{key:'mine',title:'我建立的問卷',hint:'由目前登入帳號建立，可直接管理內容與填寫結果。',items:mine},{key:'shared',title:'被分享的問卷',hint:'由其他管理者分享給您的問卷，依指派權限可管理或檢視。',items:shared},{key:'closed',title:'已關閉的問卷',hint:'已關閉或已截止的問卷集中在此，方便查詢歷史資料。',items:closed},...(isSystemAdmin?[{key:'all',title:'系統內所有問卷',hint:'系統管理員可查看所有未刪除問卷與建立者紀錄。',items:all}]:[])]}
function adminRouteId(){let m=location.hash.match(/^#admin\/([^/?#]+)/);return m?decodeURIComponent(m[1]):''}


/* Stable functional blocks retained for v1.25 final consolidation. */
function answerText(q,r){let v=r.answers?.[q.id];return Array.isArray(v)?v.join('、'):String(v??'')}
const chartColors=['#287c78','#e89a5b','#5478c7','#a56cc1','#d8606f','#76a85e','#d3a72f','#4f9eaa','#8c7a6b','#6a86a3'];

function optionCounts(q){let map=new Map((q.options||[]).map(o=>[String(o),0]));for(let r of responses){let value=r.answers?.[q.id],values=Array.isArray(value)?value:[value];for(let item of values){let key=String(item??'').trim();if(key)map.set(key,(map.get(key)||0)+1)}}return [...map.entries()].map(([label,count])=>({label,count}))}

function pieHtml(title,items,denominator=responses.length){let shown=items.filter(x=>x.count>0),sum=shown.reduce((n,x)=>n+x.count,0),cursor=0,segments=shown.map((x,i)=>{let start=cursor,end=cursor+(sum?x.count/sum*100:0);cursor=end;return `${chartColors[i%chartColors.length]} ${start}% ${end}%`}).join(','),background=sum?`conic-gradient(${segments})`:'#e8eef0';return `<div class="analysisCard"><h3>${esc(title)}</h3><div class="pieLayout"><div class="pieChart" style="background:${attr(background)}" role="img" aria-label="${attr(title)}圓餅圖"></div><div class="chartLegend">${items.map((x,i)=>`<div class="legendRow"><span class="legendDot" style="background:${chartColors[i%chartColors.length]}"></span><span>${esc(x.label)}</span><strong>${x.count} 人・${percentage(x.count,denominator)}%</strong></div>`).join('')||'<span class="questionHelp">尚無資料</span>'}</div></div></div>`}

function multipleAnalysisHtml(q){let items=optionCounts(q),total=responses.length;return `<div class="analysisCard"><h3>${esc(q.title)}</h3><div class="barList">${items.map(x=>{let p=percentage(x.count,total);return `<div><div class="barRowHead"><span>${esc(x.label)}</span><strong>${x.count} 人・${p}%</strong></div><div class="barTrack"><div class="barFill" style="width:${p}%"></div></div></div>`}).join('')||'<span class="questionHelp">尚無資料</span>'}</div></div>`}

function textAnalysisHtml(q){let items=responses.map(r=>({who:r.memberName||r.employeeNo||'未具名',text:String(r.answers?.[q.id]??'').trim()})).filter(x=>x.text);return `<div class="analysisCard"><h3>${esc(q.title)} <small>（${items.length} 則）</small></h3><div class="textAnswerList">${items.map(x=>`<div class="textAnswer"><b>${esc(x.who)}</b><p>${esc(x.text)}</p></div>`).join('')||'<span class="questionHelp">尚無文字回覆</span>'}</div></div>`}

function renderAnalysis(f){let total=responses.length,departmentsUsed=new Set(responses.map(r=>r.departmentName).filter(Boolean)),latest=responses[0]?.submittedAtText||'—',depMap=new Map();responses.forEach(r=>{let d=r.departmentName||'未填部門';depMap.set(d,(depMap.get(d)||0)+1)});let cards=[];if(f.identityMode==='member')cards.push(pieHtml('部門分布',[...depMap].map(([label,count])=>({label,count})),total));for(let q of(f.questions||[])){if(q.type==='image')continue;if(['single','dropdown','department'].includes(q.type))cards.push(pieHtml(q.title,optionCounts(q),total));else if(q.type==='multiple')cards.push(multipleAnalysisHtml(q));else if(['short','long'].includes(q.type))cards.push(textAnalysisHtml(q))}return `<div class="analysisSummary"><div class="analysisMetric"><span>總填寫人數</span><b>${total}</b></div><div class="analysisMetric"><span>填寫部門數</span><b>${departmentsUsed.size}</b></div><div class="analysisMetric"><span>最近填寫時間</span><b style="font-size:15px">${esc(latest)}</b></div></div>${total?`<div class="analysisGrid">${cards.join('')}</div>`:'<div class="emptyAnalysis">目前尚無填寫資料，收到回覆後會自動產生統計。</div>'}`}

function memberDepartmentName(member){return String(member?.department||member?.departmentName||'').trim()}

function memberEmployeeNo(member){return String(member?.employeeNo||member?.empNo||'').trim()}

function targetMembersForForm(form){
  if(!form||form.identityMode!=='member')return[];
  let allowed=new Set(allowedDepartmentNames(form));
  return members.filter(member=>member.active!==false&&allowed.has(memberDepartmentName(member)));
}

function responseBelongsToMember(response,member){
  if(response.memberId&&response.memberId===member.id)return true;
  let employeeNo=memberEmployeeNo(member);
  return !!employeeNo&&String(response.employeeNo||'').trim()===employeeNo;
}

function completionData(form){
  let expected=targetMembersForForm(form),filled=expected.filter(member=>responses.some(response=>responseBelongsToMember(response,member))),filledIds=new Set(filled.map(member=>member.id)),missing=expected.filter(member=>!filledIds.has(member.id));
  return{expected,filled,missing};
}

function ensureMissingPanel(){
  let panel=$('missingResponsesPanel');if(panel)return panel;
  let detailHead=document.querySelector('#resultsPanel .resultDetailHead');if(!detailHead)return null;
  detailHead.insertAdjacentHTML('beforebegin','<section id="missingResponsesPanel" class="missingPanel"><div class="missingPanelHead"><div><h3>未填寫人員名單</h3><p id="missingCaption">依本問卷指定部門與啟用人員計算。</p></div><div class="missingTools"><label>部門篩選<select id="missingDepartmentFilter" onchange="renderMissingMembers(activeForm())"><option value="">全部部門</option></select></label><button class="btn success" type="button" onclick="exportMissingMembers()">匯出未填名單</button></div></div><div id="completionStats" class="completionStats"></div><div id="missingMembersTable"></div></section>');
  return $('missingResponsesPanel');
}

function renderMissingMembers(form){
  let panel=ensureMissingPanel();if(!panel)return;
  if(!form||form.identityMode!=='member'){panel.style.display='none';return}
  panel.style.display='block';
  let data=completionData(form),filter=$('missingDepartmentFilter'),previous=filter.value,deps=[...new Set(data.expected.map(memberDepartmentName).filter(Boolean))];
  filter.innerHTML='<option value="">全部部門</option>'+deps.map(dep=>'<option value="'+attr(dep)+'">'+esc(dep)+'</option>').join('');
  if(previous&&deps.includes(previous))filter.value=previous;
  let selected=filter.value,list=selected?data.missing.filter(member=>memberDepartmentName(member)===selected):data.missing;
  $('missingCaption').textContent=(selected?selected+'：':'全部部門：')+'顯示 '+list.length+' 位未填寫人員';
  $('completionStats').innerHTML='<div class="completionStat"><span>應填人數</span><strong>'+data.expected.length+'</strong></div><div class="completionStat"><span>已填人數</span><strong>'+data.filled.length+'</strong></div><div class="completionStat"><span>未填人數</span><strong>'+data.missing.length+'</strong></div>';
  $('missingMembersTable').innerHTML=list.length?table(['部門','姓名','員工編號'],list.map(member=>'<tr><td>'+esc(memberDepartmentName(member))+'</td><td><b>'+esc(member.name||'')+'</b></td><td>'+esc(memberEmployeeNo(member))+'</td></tr>')):emptyState(selected?'此部門目前沒有未填寫人員':'所有應填人員皆已完成','目前篩選條件下沒有未填寫人員。');
}

function completionRows(form){
  let data=completionData(form),deps=[...new Set(data.expected.map(memberDepartmentName).filter(Boolean))];
  return deps.map(dep=>{let expected=data.expected.filter(member=>memberDepartmentName(member)===dep),filled=expected.filter(member=>data.filled.some(item=>item.id===member.id)),missing=expected.length-filled.length;return{'部門':dep,'應填人數':expected.length,'已填人數':filled.length,'未填人數':missing,'完成率':expected.length?Math.round(filled.length/expected.length*100)+'%':'0%'}}).concat([{'部門':'總計','應填人數':data.expected.length,'已填人數':data.filled.length,'未填人數':data.missing.length,'完成率':data.expected.length?Math.round(data.filled.length/data.expected.length*100)+'%':'0%'}]);
}

function completionProgressSheet(form){
  let sheet=XLSX.utils.json_to_sheet(completionRows(form));sheet['!cols']=[{wch:16},{wch:12},{wch:12},{wch:12},{wch:12}];return sheet;
}

function missingMemberRows(form,department=''){
  return completionData(form).missing.filter(member=>!department||memberDepartmentName(member)===department).map(member=>({'部門':memberDepartmentName(member),'姓名':member.name||'','員工編號':memberEmployeeNo(member),'填寫狀態':'未填寫'}));
}

function missingMembersSheet(form,department=''){
  let rows=missingMemberRows(form,department),sheet=rows.length?XLSX.utils.json_to_sheet(rows):XLSX.utils.aoa_to_sheet([['目前沒有未填寫人員']]);sheet['!cols']=[{wch:16},{wch:14},{wch:14},{wch:12}];return sheet;
}

function exportMissingMembers(){let form=activeForm();if(!form||form.identityMode!=='member')return notify('目前問卷未使用公司人員名單');let department=$('missingDepartmentFilter')?.value||'',wb=XLSX.utils.book_new();setPageLoading(true,'正在匯出未填寫名單…');try{XLSX.utils.book_append_sheet(wb,missingMembersSheet(form,department),'未填寫名單');XLSX.writeFile(wb,(form.title||'問卷')+(department?'_'+department:'')+'_未填寫名單.xlsx');toast('未填寫名單已匯出','success')}catch(e){console.error(e);notify('未填寫名單匯出失敗','error')}finally{setPageLoading(false)}}

function editMemberOptions(department,selected=''){return members.filter(m=>(m.department||m.departmentName||'')===department&&(m.active!==false||m.id===selected)).map(m=>`<option value="${attr(m.id)}" ${m.id===selected?'selected':''}>${esc(m.name||'')}（${esc(m.employeeNo||m.empNo||'')}）</option>`).join('')}

function memberDepartmentOptions(selected=''){return departments.map(d=>d.name||d.departmentName||d.department||'').filter(Boolean).map(d=>`<option value="${attr(d)}" ${d===selected?'selected':''}>${esc(d)}</option>`).join('')}

function renderMemberPanel(){let target=$('membersTable');if(!target)return;let keyword=String($('memberSearch')?.value||'').trim().toLowerCase(),list=members.filter(m=>!keyword||`${m.department||m.departmentName||''} ${m.name||''} ${m.employeeNo||m.empNo||''} ${memberGoogleEmail(m)}`.toLowerCase().includes(keyword));$('memberCountLabel').textContent=`顯示 ${list.length}／${members.length} 人`;target.innerHTML=table(['部門','姓名','員工編號','Google 帳號','狀態','操作'],list.map(m=>{let active=m.active!==false;return `<tr><td>${esc(m.department||m.departmentName||'')}</td><td><b>${esc(m.name||'')}</b></td><td>${esc(m.employeeNo||m.empNo||'')}</td><td>${memberGoogleEmail(m)?esc(memberGoogleEmail(m)):'<span class="questionHelp">未設定</span>'}</td><td><span class="statusBadge ${active?'active':'inactive'}">${active?'啟用':'停用'}</span></td><td><div class="buttonRow"><button class="btn" onclick="editMember('${attr(m.id)}')">編輯</button><button class="btn" onclick="toggleMember('${attr(m.id)}',${active?'false':'true'})">${active?'停用':'啟用'}</button><button class="btn danger" onclick="deleteMember('${attr(m.id)}')">刪除</button></div></td></tr>`}))}

function fillMemberEditor(m=null){$('memberDepartment').innerHTML='<option value="">請選擇部門</option>'+memberDepartmentOptions(m?.department||m?.departmentName||'');$('memberName').value=m?.name||'';$('memberEmployeeNo').value=m?.employeeNo||m?.empNo||'';$('memberGoogleEmail').value=m?memberGoogleEmail(m):'';$('memberActive').value=String(m?.active!==false)}

function startNewMember(){memberEditMode='new';editingMemberId='';$('memberEditorHeading').textContent='新增人員';$('memberEditorMode').textContent='新增模式';$('saveMemberBtn').textContent='新增人員';fillMemberEditor();$('memberEditor').style.display='block';$('memberName').focus()}

function editMember(id){let m=members.find(x=>x.id===id);if(!m)return;memberEditMode='edit';editingMemberId=id;$('memberEditorHeading').textContent='編輯人員：'+(m.name||'');$('memberEditorMode').textContent='編輯模式';$('saveMemberBtn').textContent='儲存變更';fillMemberEditor(m);$('memberEditor').style.display='block';$('memberEditor').scrollIntoView({behavior:'smooth',block:'start'})}

function cancelMemberEdit(){memberEditMode='view';editingMemberId='';$('memberEditor').style.display='none'}

async function deleteMember(id){let m=members.find(x=>x.id===id);if(!m)return;let ok=await confirmDialog(`確定刪除 ${m.name||'這位人員'}（${m.employeeNo||m.empNo||''}）？\n建議優先使用「停用」，以保留歷史資料關聯。`,'刪除人員',true);if(!ok)return;ok=await confirmDialog('再次確認永久刪除這筆共用人員資料？兩套系統都會同步消失。','永久刪除人員',true);if(!ok)return;setPageLoading(true,'正在刪除人員資料…');try{await doc('members',id).delete();let account=await doc('memberAccounts',id).get();if(account.exists)await doc('memberAccounts',id).delete();await loadAdminData();showPanel('membersPanel');toast('共用人員資料已刪除','success')}catch(e){console.error(e);notify('人員資料刪除失敗，請確認權限或網路狀態','error')}finally{setPageLoading(false)}}
function chooseMemberImport(){$('memberImportInput').click()}

function memberWorkbook(rows,sheetName='人員名單'){let wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(rows,{header:['部門','姓名','員工編號','Google帳號','狀態']});ws['!cols']=[{wch:16},{wch:14},{wch:14},{wch:28},{wch:10}];XLSX.utils.book_append_sheet(wb,ws,sheetName);return wb}

function downloadMemberTemplate(){XLSX.writeFile(memberWorkbook([{'部門':'行政部','姓名':'王小明','員工編號':'7901','Google帳號':'example@gmail.com','狀態':'啟用'}],'匯入範本'),'人員匯入標準範本.xlsx')}

function exportMembers(){let rows=members.map(m=>({'部門':m.department||m.departmentName||'','姓名':m.name||'','員工編號':m.employeeNo||m.empNo||'','Google帳號':memberGoogleEmail(m),'狀態':m.active===false?'停用':'啟用'}));XLSX.writeFile(memberWorkbook(rows),'共用人員名單.xlsx')}

function memberCell(row,names){let keys=Object.keys(row);for(let name of names){let key=keys.find(k=>String(k).replace(/^\uFEFF/,'').trim()===name);if(key!==undefined)return row[key]}return''}

async function importMembers(file){if(!file)return;let result=$('memberImportResult');result.className='memberImportResult';result.style.display='block';result.textContent=`正在讀取 ${file.name}…`;setPageLoading(true,'正在讀取匯入檔…');try{let data=await file.arrayBuffer(),wb=XLSX.read(data,{type:'array'}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});if(!rows.length)throw new Error('檔案內沒有可匯入的資料');let validDepartments=new Set(departments.map(d=>d.name||d.departmentName||d.department||'').filter(Boolean)),existingByNo=new Map(members.map(m=>[String(m.employeeNo||m.empNo||'').trim(),m]).filter(x=>x[0])),seen=new Set(),seenEmails=new Set(),errors=[],items=[];rows.forEach((row,index)=>{let line=index+2,department=String(memberCell(row,['部門'])).trim(),name=String(memberCell(row,['姓名'])).trim(),employeeNo=String(memberCell(row,['員工編號','員編'])).trim(),googleEmail=normalizeEmail(memberCell(row,['Google帳號','Google 帳號','Google Email','Email','電子郵件'])),status=String(memberCell(row,['狀態'])).trim();if(!department||!name||!employeeNo){errors.push(`第 ${line} 列：部門、姓名與員工編號為必填`);return}if(!validDepartments.has(department)){errors.push(`第 ${line} 列：找不到部門「${department}」`);return}if(seen.has(employeeNo)){errors.push(`第 ${line} 列：員工編號 ${employeeNo} 在檔案中重複`);return}seen.add(employeeNo);if(googleEmail&&!/^\S+@\S+\.\S+$/.test(googleEmail)){errors.push(`第 ${line} 列：Google 帳號格式不正確`);return}if(googleEmail&&seenEmails.has(googleEmail)){errors.push(`第 ${line} 列：Google 帳號 ${googleEmail} 在檔案中重複`);return}if(googleEmail)seenEmails.add(googleEmail);let existing=existingByNo.get(employeeNo)||null,owner=members.find(m=>memberGoogleEmail(m)===googleEmail&&m.id!==existing?.id);if(googleEmail&&owner){errors.push(`第 ${line} 列：Google 帳號已由 ${owner.name||'其他人員'} 使用`);return}let active=!['停用','否','false','0','no'].includes(status.toLowerCase());items.push({existing,googleEmail,data:{department,name,employeeNo,active,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}})});let addCount=items.filter(x=>!x.existing).length,updateCount=items.length-addCount,summary=`可匯入 ${items.length} 筆（新增 ${addCount}、更新 ${updateCount}）`+(errors.length?`\n另有 ${errors.length} 筆錯誤將略過：\n${errors.slice(0,8).join('\n')}${errors.length>8?'\n…':''}`:'');result.textContent=summary;if(!items.length){result.className='memberImportResult error';notify(summary,'warn');return}if(!await confirmDialog(summary+'\n\n確定寫入共用人員名單嗎？兩套系統會同步使用。','確認匯入人員')){result.textContent='已取消匯入';return}setPageLoading(true,'正在寫入人員名單…');for(let item of items){let memberId;if(item.existing){memberId=item.existing.id;await doc('members',memberId).set(item.data,{merge:true})}else{item.data.createdAt=firebase.firestore.FieldValue.serverTimestamp();memberId=(await col('members').add(item.data)).id}if(item.googleEmail)await doc('memberAccounts',memberId).set({memberId,email:item.googleEmail,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});else{let account=await doc('memberAccounts',memberId).get();if(account.exists)await doc('memberAccounts',memberId).delete()}}await loadAdminData();showPanel('membersPanel');result=$('memberImportResult');result.className='memberImportResult success';result.textContent=`匯入完成：新增 ${addCount} 筆、更新 ${updateCount} 筆${errors.length?'，略過 '+errors.length+' 筆錯誤':''}`;toast('共用人員名單匯入完成','success')}catch(e){console.error(e);result.className='memberImportResult error';result.textContent='匯入失敗：'+(e.message||e);notify('人員名單匯入失敗','error')}finally{setPageLoading(false)}}

function openResponseEditor(id){let f=activeForm(),r=responses.find(x=>x.id===id);if(!f||!r)return;editingResponseId=id;$('responseEditCaption').textContent=`${r.memberName||'未具名'} ${r.employeeNo?`（${r.employeeNo}）`:''}`;let identity='';if(f.identityMode==='member'){let deps=departments.map(d=>d.name||d.departmentName||d.department||'').filter(Boolean);identity=`<div class="editIdentityGrid"><label>部門<select id="editDepartment" onchange="refreshEditMemberOptions(this.value)"><option value="">請選擇部門</option>${deps.map(d=>`<option value="${attr(d)}" ${d===r.departmentName?'selected':''}>${esc(d)}</option>`).join('')}</select></label><label>姓名<select id="editMember" onchange="refreshEditEmployee()"><option value="">請選擇姓名</option>${editMemberOptions(r.departmentName||'',r.memberId||'')}</select></label><label>員工編號<input id="editEmployeeNo" value="${attr(r.employeeNo||'')}" readonly></label></div>`}let questions=(f.questions||[]).filter(q=>q.type!=='image').map(q=>editQuestionHtml(q,r.answers?.[q.id])).join('');$('responseEditBody').innerHTML=identity+questions;$('responseEditMask').style.display='grid'}

function editQuestionHtml(q,value){let name='edit_q_'+q.id,label=`<label>${esc(q.title)}</label>`;if(q.type==='multiple'){let selected=Array.isArray(value)?value:[];return `<div class="editQuestion">${label}<div class="editChoices">${(q.options||[]).map(o=>`<label><input type="checkbox" name="${attr(name)}" value="${attr(o)}" ${selected.includes(o)?'checked':''}>${esc(o)}</label>`).join('')}</div></div>`}if(['single','dropdown','department'].includes(q.type)){let opts=q.type==='department'?departments.map(d=>d.name||d.departmentName||'').filter(Boolean):(q.options||[]);return `<div class="editQuestion">${label}<select name="${attr(name)}"><option value="">未選擇</option>${opts.map(o=>`<option value="${attr(o)}" ${String(value??'')===String(o)?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`}if(q.type==='long')return `<div class="editQuestion">${label}<textarea name="${attr(name)}">${esc(value??'')}</textarea></div>`;return `<div class="editQuestion">${label}<input type="text" name="${attr(name)}" value="${attr(value??'')}"></div>`}

function refreshEditMemberOptions(department){let select=$('editMember');select.innerHTML='<option value="">請選擇姓名</option>'+editMemberOptions(department);$('editEmployeeNo').value=''}

function refreshEditEmployee(){let m=members.find(x=>x.id===$('editMember').value);$('editEmployeeNo').value=m?.employeeNo||m?.empNo||''}

function closeResponseEditor(){$('responseEditMask').style.display='none';editingResponseId='';$('responseEditBody').innerHTML=''}

async function saveEditedResponse(event){event.preventDefault();let f=activeForm(),r=responses.find(x=>x.id===editingResponseId);if(!f||!r)return;let fd=new FormData(event.target),answers={};for(let q of(f.questions||[])){if(q.type==='image')continue;let name='edit_q_'+q.id;answers[q.id]=q.type==='multiple'?fd.getAll(name):String(fd.get(name)||'').trim()}let update={answers,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:currentUser?.email||''};if(f.identityMode==='member'){let memberId=$('editMember').value,m=members.find(x=>x.id===memberId),departmentName=$('editDepartment').value;if(!m||!departmentName)return notify('請選擇部門與姓名');update={...update,departmentName,memberId,memberName:m.name||'',employeeNo:m.employeeNo||m.empNo||''}}let btn=$('saveResponseBtn');btn.disabled=true;btn.textContent='儲存中…';setPageLoading(true,'正在儲存填寫結果…');try{if(f.identityMode==='member'){let newId=`${f.id}__${update.memberId}`,newLock=doc('universalResponseLocks',newId),oldLockId=r.memberId?`${f.id}__${r.memberId}`:'';if(newId!==r.id){let [existing,locked]=await Promise.all([doc('universalResponses',newId).get(),newLock.get()]);if(existing.exists||locked.exists)throw new Error('所選同仁已有這份問卷的填寫資料');let {id,...oldData}=r,batch=db.batch();batch.set(doc('universalResponses',newId),{...oldData,...update});batch.delete(doc('universalResponses',r.id));if(oldLockId&&oldLockId!==newId)batch.delete(doc('universalResponseLocks',oldLockId));batch.set(newLock,{formId:f.id,memberId:update.memberId,createdAt:firebase.firestore.FieldValue.serverTimestamp()});await batch.commit()}else{let batch=db.batch();batch.update(doc('universalResponses',r.id),update);batch.set(newLock,{formId:f.id,memberId:update.memberId,createdAt:firebase.firestore.FieldValue.serverTimestamp()});await batch.commit()}}else await doc('universalResponses',r.id).update(update);closeResponseEditor();await loadResponses();renderAdmin();showPanel('resultsPanel');toast('填寫結果已更新','success')}catch(e){console.error(e);notify('更新失敗：'+(e.message||'請確認 Firestore 規則'),'error')}finally{setPageLoading(false);btn.disabled=false;btn.textContent='儲存變更'}}

async function deleteResponse(id){let r=responses.find(x=>x.id===id);if(!r)return;let who=[r.memberName,r.employeeNo].filter(Boolean).join('／')||'這筆未具名回覆';let ok=await confirmDialog(`確定要刪除「${who}」的填寫結果嗎？\n刪除後同仁可以重新填寫。`,'刪除填寫結果',true);if(!ok)return;ok=await confirmDialog(`再次確認：即將永久刪除「${who}」的資料，此動作無法復原。`,'永久刪除填寫結果',true);if(!ok)return;setPageLoading(true,'正在刪除填寫結果…');try{let batch=db.batch();batch.delete(doc('universalResponses',id));if(r.formId&&r.memberId)batch.delete(doc('universalResponseLocks',`${r.formId}__${r.memberId}`));await batch.commit();await loadResponses();renderAdmin();showPanel('resultsPanel');toast('填寫結果與填寫鎖定已刪除，同仁可重新填寫','success')}catch(e){console.error(e);notify('刪除失敗，請確認管理員權限與 Firestore 規則','error')}finally{setPageLoading(false)}}

function selectionQuestions(f){return(f.questions||[]).filter(q=>['single','dropdown','department','multiple'].includes(q.type))}

function questionOptionLabels(q){return optionCounts(q).map(x=>x.label)}

function responseHasOption(r,q,option){let value=r.answers?.[q.id];return Array.isArray(value)?value.map(String).includes(String(option)):String(value??'')===String(option)}

function cleanSummarySheet(f){let total=responses.length,questions=selectionQuestions(f),maxCols=Math.max(4,...questions.map(q=>questionOptionLabels(q).length+2)),rows=[['問卷選項統計總表'],['問卷名稱',f.title],['總填寫份數',total],['匯出時間',new Date().toLocaleString('zh-TW')],[]],merges=[{s:{r:0,c:0},e:{r:0,c:maxCols-1}}];if(!questions.length){rows.push(['目前沒有可統計的選項題目']);merges.push({s:{r:5,c:0},e:{r:5,c:maxCols-1}})}for(let q of questions){let items=optionCounts(q),isMultiple=q.type==='multiple',titleRow=rows.length;rows.push([`${q.title}${isMultiple?'（複選）':''}`]);merges.push({s:{r:titleRow,c:0},e:{r:titleRow,c:Math.max(1,items.length+1)}});rows.push(['選項',...items.map(x=>x.label),'合計']);let sum=items.reduce((n,x)=>n+x.count,0);rows.push(['數量',...items.map(x=>x.count),sum]);rows.push(['占填寫人數',...items.map(x=>percentage(x.count,total)+'%'),isMultiple?'—':percentage(sum,total)+'%']);rows.push([])}let sheet=XLSX.utils.aoa_to_sheet(rows);sheet['!merges']=merges;sheet['!cols']=[{wch:18},...Array.from({length:maxCols-1},()=>({wch:13}))];return sheet}

function departmentCrossSheet(f){let questions=selectionQuestions(f),configured=departments.map(d=>d.name||d.departmentName||d.department||'').filter(Boolean),used=[...new Set(responses.map(r=>r.departmentName||'未填部門'))],depNames=[...configured.filter(d=>used.includes(d)),...used.filter(d=>!configured.includes(d))],maxCols=Math.max(4,...questions.map(q=>questionOptionLabels(q).length+2)),rows=[['部門 × 選項交叉統計'],['問卷名稱',f.title],['總填寫份數',responses.length],[]],merges=[{s:{r:0,c:0},e:{r:0,c:maxCols-1}}];if(f.identityMode!=='member'){rows.push(['此問卷未使用公司人員資料，因此沒有部門交叉統計。']);merges.push({s:{r:4,c:0},e:{r:4,c:maxCols-1}})}else if(!questions.length){rows.push(['目前沒有可統計的選項題目。']);merges.push({s:{r:4,c:0},e:{r:4,c:maxCols-1}})}else for(let q of questions){let options=questionOptionLabels(q),titleRow=rows.length;rows.push([q.title]);merges.push({s:{r:titleRow,c:0},e:{r:titleRow,c:Math.max(1,options.length+1)}});rows.push(['部門',...options,'合計']);for(let dep of depNames){let depResponses=responses.filter(r=>(r.departmentName||'未填部門')===dep),counts=options.map(o=>depResponses.filter(r=>responseHasOption(r,q,o)).length);rows.push([dep,...counts,counts.reduce((n,x)=>n+x,0)])}let totals=options.map(o=>responses.filter(r=>responseHasOption(r,q,o)).length);rows.push(['總計',...totals,totals.reduce((n,x)=>n+x,0)]);rows.push([])}let sheet=XLSX.utils.aoa_to_sheet(rows);sheet['!merges']=merges;sheet['!cols']=[{wch:18},...Array.from({length:maxCols-1},()=>({wch:13}))];return sheet}


async function loadCurrentAssignments(user){if(!user?.email)return[];try{let q=await col('universalFormManagers').where('email','==',normalizeEmail(user.email)).get();return q.docs.map(x=>({id:x.id,...x.data()}))}catch(e){console.warn('讀取問卷指派失敗，請發布 v1.13 Firestore 規則',e);return[]}}

function assignmentFor(formId){return formAssignments.find(x=>x.formId===formId&&x.enabled!==false)||null}

function canViewForm(formId){let f=forms.find(x=>x.id===formId);return isSystemAdmin||isCreatedByCurrentUser(f)||!!assignmentFor(formId)}

function canManageForm(formId){let f=forms.find(x=>x.id===formId),a=assignmentFor(formId);return isSystemAdmin||isCreatedByCurrentUser(f)||!!(a&&a.role==='manager')}

function accessibleForms(includeDeleted=false){return forms.filter(f=>(includeDeleted||f.deleted!==true)&&canViewForm(f.id))}

function formCreatedByEmail(f){return normalizeEmail(f?.createdByEmail||f?.creatorEmail||f?.ownerEmail||'')}

function isCreatedByCurrentUser(f){let email=normalizeEmail(currentUser?.email||'');return !!email&&formCreatedByEmail(f)===email}
function canDeleteFormDirectly(formOrId){let f=typeof formOrId==='string'?forms.find(x=>x.id===formOrId):formOrId;return !!f&&(isSystemAdmin||isCreatedByCurrentUser(f))}

function formCreatorLabel(f){let email=formCreatedByEmail(f),member=findMemberByGoogleEmail(email);return memberDisplayName(member)||f?.createdByName||email||'未紀錄'}

function creatorSelectOptions(currentEmail=''){let current=normalizeEmail(currentEmail);return members.filter(m=>m.active!==false&&memberGoogleEmail(m)).map(m=>{let email=memberGoogleEmail(m);return `<option value="${attr(email)}" ${email===current?'selected':''}>${esc(memberDisplayName(m)||m.name||'未命名人員')}</option>`}).join('')}

function creatorCellHtml(f){let label=esc(formCreatorLabel(f));if(!isSystemAdmin)return label;return `<div class="creatorCell"><span>${label}</span><button class="btn miniBtn" type="button" onclick="changeFormCreator('${attr(f.id)}')">${formCreatedByEmail(f)?'變更':'補登'}</button></div>`}

function percentage(count,total){return total?Math.round(count*1000/total)/10:0}
async function saveMember(){let department=$('memberDepartment').value,name=$('memberName').value.trim(),employeeNo=$('memberEmployeeNo').value.trim(),googleEmail=normalizeEmail($('memberGoogleEmail')?.value||'');if(!department||!name||!employeeNo)return notify('請完整填寫部門、姓名與員工編號');if(googleEmail&&!/^\S+@\S+\.\S+$/.test(googleEmail))return notify('請輸入有效的 Google 帳號');let duplicate=members.find(m=>String(m.employeeNo||m.empNo||'').trim()===employeeNo&&m.id!==editingMemberId);if(duplicate)return notify(`員工編號 ${employeeNo} 已由 ${duplicate.name||'其他人員'} 使用`);let duplicateGoogle=members.find(m=>memberGoogleEmail(m)===googleEmail&&m.id!==editingMemberId);if(googleEmail&&duplicateGoogle)return notify(`Google 帳號已由 ${duplicateGoogle.name||'其他人員'} 使用`);let data={department,name,employeeNo,active:$('memberActive').value==='true',updatedAt:firebase.firestore.FieldValue.serverTimestamp()},btn=$('saveMemberBtn');btn.disabled=true;btn.textContent='儲存中…';setPageLoading(true,'正在儲存人員資料…');try{let memberId=editingMemberId;if(memberEditMode==='new'){data.createdAt=firebase.firestore.FieldValue.serverTimestamp();memberId=(await col('members').add(data)).id}else await doc('members',memberId).set(data,{merge:true});if(googleEmail)await doc('memberAccounts',memberId).set({memberId,email:googleEmail,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});else{let account=await doc('memberAccounts',memberId).get();if(account.exists)await doc('memberAccounts',memberId).delete()}let wasNew=memberEditMode==='new';cancelMemberEdit();await loadAdminData();showPanel('membersPanel');toast(wasNew?'人員已新增，兩套系統將同步使用':'人員資料已更新','success')}catch(e){console.error(e);notify('人員資料儲存失敗，請確認權限或網路狀態','error')}finally{setPageLoading(false);btn.disabled=false;btn.textContent=memberEditMode==='edit'?'儲存變更':'新增人員'}}
async function toggleMember(id,active){let m=members.find(x=>x.id===id);if(!m)return;if(!active&&!await confirmDialog(`確定停用 ${m.name||'這位人員'}？停用後兩套調查系統的前台都不會顯示。`,'停用人員',true))return;setPageLoading(true,'正在更新人員狀態…');try{await doc('members',id).set({active,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});await loadAdminData();showPanel('membersPanel');toast(active?'人員已啟用':'人員已停用','success')}catch(e){console.error(e);notify('人員狀態更新失敗','error')}finally{setPageLoading(false)}}
async function loadPublicData(){let[fs,ds,ms]=await Promise.all([col('universalForms').get(),col('departments').get(),col('members').get()]);forms=fs.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));departments=ds.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(a.sortOrder??999)-(b.sortOrder??999));let depOrder=new Map(departments.map((d,i)=>[d.name||d.departmentName||d.department||'',i]));members=ms.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>{let ad=a.department||a.departmentName||'',bd=b.department||b.departmentName||'',diff=(depOrder.get(ad)??9999)-(depOrder.get(bd)??9999);if(diff)return diff;return String(a.employeeNo||a.empNo||'').localeCompare(String(b.employeeNo||b.empNo||''),'zh-Hant',{numeric:true})||String(a.name||'').localeCompare(String(b.name||''),'zh-Hant')});let publicForms=forms.filter(f=>f.deleted!==true),route=formRouteId(),adminId=adminRouteId(),allowed=isAdmin?accessibleForms():[];if(adminId&&allowed.some(f=>f.id===adminId))activeFormId=adminId;else if(route&&publicForms.some(f=>f.id===route))activeFormId=route;else if(isAdmin&&allowed.length&&!allowed.some(f=>f.id===activeFormId))activeFormId=allowed[0].id;else if(!isAdmin)activeFormId=''}
async function loadAdminData(){await loadPublicData();await loadMemberAccounts();if(isSystemAdmin&&!submissionLocksPrepared)await prepareSubmissionLocks();await loadResponses();renderAdmin()}
async function refreshAdminView(){let btn=$('refreshAdminBtn');if(btn)btn.disabled=true;setPageLoading(true,'正在重新整理資料…');try{await loadAdminData();toast('資料已重新整理','success')}catch(e){console.error(e);notify('重新整理失敗，請稍後再試','error')}finally{setPageLoading(false);if(btn)btn.disabled=false}}
async function loadResponses(){if(!isAdmin||!activeFormId||!canViewForm(activeFormId)){responses=[];return}try{let q=await col('universalResponses').where('formId','==',activeFormId).get();responses=q.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(b.submittedAt?.seconds||0)-(a.submittedAt?.seconds||0))}catch(e){console.warn(e);responses=[]}}
function applyRoute(){let wantsAdmin=location.hash==='#admin'||location.hash.startsWith('#admin/');if(wantsAdmin&&isAdmin){front.style.display='none';admin.style.display='block';loginMask.style.display='none';let routeId=adminRouteId();if(routeId&&canViewForm(routeId)&&routeId!==activeFormId){activeFormId=routeId;loadResponses().then(renderAdmin);return}renderAdmin();return}admin.style.display='none';front.style.display='block';loginMask.style.display=wantsAdmin&&!isAdmin?'grid':'none';renderFront();if(loginPurpose==='response'&&currentUser)setTimeout(showMyResponse,0)}
function myResponseButton(f){return f?.identityMode==='member'?'<button class="ghostBtn" type="button" onclick="startMyResponseView()">查看我的填寫結果</button>':''}
function frontPreviewBannerHtml(){if(!isAdmin)return'';let label=adminDisplayName()||currentUser?.email||'管理員';return `<div class="frontPreviewBanner"><div><b>管理員預覽模式</b><span>${esc(label)}</span></div><div class="frontPreviewActions"><button class="btn primary" type="button" onclick="openAdmin()">返回管理後台</button><button class="btn" type="button" onclick="logout()">登出</button></div></div>`}
function frontTopHtml(f,closed){let statusLabel=f?(closed?'問卷已關閉':'問卷開放中'):'請使用完整網址';return `<header class="frontHeader"><img src="assets/company-logo.png" alt="環興科技股份有限公司"><div class="frontActions"><span id="formStatus" class="statusPill">${statusLabel}</span>${myResponseButton(f)}${isAdmin?'':'<button class="ghostBtn" onclick="openAdmin()">管理登入</button>'}</div></header>`}

async function startMyResponseView(){loginPurpose='response';loginMsg.textContent='';if(!currentUser){loginMask.style.display='grid';return}await loadMemberAccounts();await showMyResponse()}
async function showMyResponse(){let box=$('myResponseBox'),f=activeForm();if(!box||!f)return;let member=findMemberByGoogleEmail(currentUser?.email||'');if(!member){box.innerHTML='<div class="notice myResponseCard">找不到此 Google 帳號對應的人員資料，請確認是否使用公司行事曆同一組帳號。</div>';return}box.innerHTML='<div class="notice myResponseCard">正在讀取您的填寫內容…</div>';try{let snap=await doc('universalResponses',`${f.id}__${member.id}`).get();if(!snap.exists){box.innerHTML='<div class="notice myResponseCard">目前查無您的填寫紀錄。</div>';return}let r={id:snap.id,...snap.data()},questions=(f.questions||[]).filter(q=>q.type!=='image'),answers=questions.map(q=>`<div class="myAnswerItem"><b>${esc(q.title||'未命名題目')}</b><p>${esc(answerText(q,r)||'未填')}</p></div>`).join('');box.innerHTML=`<section class="notice myResponseCard"><h2>我的填寫結果</h2><p class="myResponseMeta"><span>${esc(r.departmentName||member.department||'')}</span><span>${esc(r.memberName||member.name||'')}</span><span>${esc(r.employeeNo||member.employeeNo||member.empNo||'')}</span><span>${esc(r.submittedAtText||'')}</span></p><div class="myAnswerList">${answers||'<div class="myAnswerItem"><p>此問卷沒有可顯示的題目。</p></div>'}</div></section>`}catch(e){console.error(e);box.innerHTML='<div class="notice myResponseCard">讀取失敗，請確認 Firestore 規則已部署 v1.27 完整合併版。</div>'}}

function renderShareMemberOptions(){let select=$('managerEmail');if(!select)return;let current=select.value,creatorEmail=formCreatedByEmail(activeForm()),options=members.filter(m=>m.active!==false&&memberGoogleEmail(m)&&memberGoogleEmail(m)!==creatorEmail).map(m=>({email:memberGoogleEmail(m),label:memberDisplayName(m)||m.name||m.id}));select.innerHTML='<option value="">請選擇成員</option>'+options.map(x=>`<option value="${attr(x.email)}">${esc(x.label)}</option>`).join('');select.value=options.some(x=>x.email===current)?current:''}
function managerPersonLabel(email){let member=findMemberByGoogleEmail(email),label=memberDisplayName(member);return label||'未對應人員'}
function adminDisplayName(){let member=findMemberByGoogleEmail(currentUser?.email||'');return memberDisplayName(member)||currentUser?.displayName||currentUser?.email||''}
function ensureAdminExtensions(){if(!$('permissionsPanel')){$('resultsPanel')?.insertAdjacentHTML('beforebegin',`<section id="permissionsPanel" class="panel"><div class="card"><div class="sectionHead"><div><h2>問卷權限管理</h2><p>針對目前選取的問卷分享管理或檢視權限。問卷管理者可編輯問卷與回覆，檢視者只能查看結果與匯出。</p></div></div><div class="permissionForm flatPermissionForm"><label>分享成員<select id="managerEmail"><option value="">請選擇成員</option></select></label><label>權限<select id="managerRole"><option value="manager">問卷管理者</option><option value="viewer">結果檢視者</option></select></label><button class="btn primary" onclick="saveFormManager()">新增／更新權限</button><p class="questionHelp permissionHelp">Google 帳號係同仁部門行事曆使用之帳號；如帳號異動，請洽系統管理員修正後方可登入。</p></div><div id="formManagersTable"></div></div></section>`)}renderShareMemberOptions()}
function updateRoleUi(){ensureAdminExtensions();let navs=[...document.querySelectorAll('.sidebar .nav')];navs.forEach(n=>{let t=n.textContent.trim();if(t==='人員管理'||t==='垃圾桶')n.style.display=isSystemAdmin?'':'none'});$('permissionsNav').style.display=activeFormId&&canManageForm(activeFormId)?'':'none';let groups=document.querySelectorAll('.navGroup');if(groups[1])groups[1].style.display=(isSystemAdmin||(activeFormId&&canManageForm(activeFormId)))?'':'none';[...document.querySelectorAll('#formsPanel button')].filter(b=>/外套尺寸範本/.test(b.textContent)).forEach(b=>b.style.display=isSystemAdmin?'':'none');if(!isSystemAdmin&&($('membersPanel')?.classList.contains('active')||$('trashPanel')?.classList.contains('active')))showPanel('dashboardPanel');if(activeFormId&&!canManageForm(activeFormId)&&($('editorPanel')?.classList.contains('active')||$('permissionsPanel')?.classList.contains('active')))showPanel('resultsPanel')}
function renderAdmin(){ensureAdminExtensions();let list=accessibleForms();if(list.length&&!list.some(f=>f.id===activeFormId))activeFormId=list[0].id;activeFormSelect.innerHTML='<option value="">請選擇問卷</option>'+list.map(f=>`<option value="${attr(f.id)}" ${f.id===activeFormId?'selected':''}>${esc(f.title)}</option>`).join('');let f=activeForm();activeFormLabel.textContent=f?f.title:'尚未選擇問卷';if($('formCount'))$('formCount').textContent=list.length;if($('currentFormName'))$('currentFormName').textContent=f?.title||'—';if($('responseCount'))$('responseCount').textContent=responses.length;renderDashboard();renderFormsTable();if(isSystemAdmin){renderMemberPanel();renderTrash();if($('permissionsPanel')?.classList.contains('active'))loadFormManagers()}renderResults();updateRoleUi()}
function formRowHtml(f){let manage=canManageForm(f.id),canDelete=canDeleteFormDirectly(f),id=attr(f.id),role=formRoleLabel(f);let buttons=[manage?actionButton('編輯',`editForm('${id}')`):'',actionButton('結果',`openResults('${id}')`),manage?actionButton('複製',`duplicateForm('${id}')`):'',canDelete?actionButton('刪除',`deleteForm('${id}')`,'danger'):''];return `<tr><td><b>${esc(f.title)}</b><br><small>${(f.questions||[]).length} 題・${esc(f.id)}</small></td><td>${statePillHtml(effectiveState(f))}</td><td>${esc(role)}</td><td>${creatorCellHtml(f)}</td><td>${esc(formatDeadline(f.deadline)||'未設定')}</td><td>${countPillHtml(responseCountForForm(f.id))}</td><td>${actionGroup(buttons)}</td></tr>`}
function setFormSection(key){activeFormSection=key;renderFormsTable()}
function renderFormsTable(){let sections=formsBySection();if(!sections.some(x=>x.key===activeFormSection))activeFormSection=sections[0]?.key||'mine';let current=sections.find(x=>x.key===activeFormSection)||sections[0];formsTable.innerHTML=`<div class="surveyTabs">${sections.map(section=>`<button class="${section.key===activeFormSection?'active':''}" onclick="setFormSection('${attr(section.key)}')">${esc(section.title)} <span>${section.items.length}</span></button>`).join('')}</div><p class="surveyTabHint">${esc(current?.hint||'')}</p>${table(['問卷','狀態','我的角色','建立者','問卷期間','填寫','操作'],(current?.items||[]).map(formRowHtml),'尚無資料')}`}
async function selectForm(id){if(!id||!canViewForm(id))return;activeFormId=id;history.replaceState(null,'','#admin/'+encodeURIComponent(id));await loadResponses();renderAdmin()}
async function openResults(id){await selectForm(id);showPanel('resultsPanel')}
async function openPermissions(id){await selectForm(id);showPanel('permissionsPanel');await loadFormManagers()}
function closeCreatorDialog(value=''){let mask=$('creatorDialogMask');if(!mask)return;let resolver=mask._resolve;mask.remove();if(resolver)resolver(value)}
function creatorDialog(f){return new Promise(resolve=>{let current=formCreatedByEmail(f);document.body.insertAdjacentHTML('beforeend',`<div id="creatorDialogMask" class="modalMask creatorDialogMask" style="display:grid"><div class="dialogCard" role="dialog" aria-modal="true"><div class="modalHeader"><h3>變更問卷建立者</h3><button class="modalClose" type="button" onclick="closeCreatorDialog('')">×</button></div><p class="dialogMessage">問卷：${esc(f.title||'未命名問卷')}</p><label class="dialogInputWrap">建立者<select id="creatorEmailSelect"><option value="">請選擇建立者</option>${creatorSelectOptions(current)}</select></label><div class="modalActions"><button class="btn" type="button" onclick="closeCreatorDialog('')">取消</button><button class="btn primary" type="button" onclick="closeCreatorDialog(document.getElementById('creatorEmailSelect').value)">儲存</button></div></div></div>`);$('creatorDialogMask')._resolve=resolve})}
async function changeFormCreator(id){if(!isSystemAdmin)return toast('只有系統管理員可以變更建立者','error');let f=forms.find(x=>x.id===id);if(!f)return;let email=normalizeEmail(await creatorDialog(f));if(!email)return;let member=findMemberByGoogleEmail(email);if(!member)return toast('請從人員名單選擇建立者','warn');setPageLoading(true,'正在更新問卷建立者…');try{await doc('universalForms',id).set({createdByEmail:email,createdByName:memberDisplayName(member),creatorEmail:firebase.firestore.FieldValue.delete(),ownerEmail:firebase.firestore.FieldValue.delete(),updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedByEmail:normalizeEmail(currentUser?.email||'')},{merge:true});let managerId=managerDocumentId(id,email),managerDoc=await doc('universalFormManagers',managerId).get();if(managerDoc.exists)await doc('universalFormManagers',managerId).delete();await loadAdminData();toast('問卷建立者已更新','success')}catch(e){console.error(e);notify('建立者更新失敗，請確認權限或網路狀態','error')}finally{setPageLoading(false)}}
function openMissingList(){showPanel('resultsPanel');let panel=ensureMissingPanel();if(panel)panel.scrollIntoView({behavior:'smooth',block:'start'})}
async function copyAdminLink(id=activeFormId){if(!id)return notify('請先選擇問卷');let url=location.href.split('#')[0]+'#admin/'+encodeURIComponent(id);if(navigator.clipboard?.writeText)try{await navigator.clipboard.writeText(url);toast('專屬後台網址已複製','success');return}catch(e){}await showCopyDialog('複製專屬後台網址',url)}


function confirmDeleteFormModalV136(f){return new Promise(resolve=>{document.querySelectorAll('.deleteFormModalV136').forEach(el=>el.remove());let overlay=document.createElement('div');overlay.className='deleteFormModalV136';overlay.innerHTML=`<div class="deleteFormDialogV136" role="dialog" aria-modal="true" aria-label="永久刪除問卷"><button type="button" class="deleteFormCloseV136" aria-label="關閉">×</button><h3>永久刪除問卷</h3><p class="muted">這會刪除「${esc(f.title||f.id||'未命名問卷')}」及本問卷的填寫資料。此操作無法復原。</p><div class="deleteFormScopeV136"><b>會一起刪除</b><ul><li>問卷基本資料、題目設定與參考圖片設定</li><li>填寫結果、填寫鎖定與協助填寫紀錄</li><li>本問卷的分享成員與權限設定</li></ul><b>會保留</b><ul><li>人員主檔、部門資料</li><li>其他問卷與其他問卷的填寫資料</li></ul></div><label class="deleteFormConfirmFieldV136">請輸入 DELETE 確認刪除<input class="deleteFormConfirmInputV136" autocomplete="off" placeholder="DELETE"></label><div class="deleteFormActionsV136"><button type="button" class="btn deleteFormCancelV136">取消</button><button type="button" class="btn danger deleteFormConfirmBtnV136" disabled>永久刪除</button></div></div>`;document.body.appendChild(overlay);let input=overlay.querySelector('.deleteFormConfirmInputV136'),confirmBtn=overlay.querySelector('.deleteFormConfirmBtnV136');let close=ok=>{overlay.remove();resolve(!!ok)};overlay.querySelector('.deleteFormCloseV136').onclick=()=>close(false);overlay.querySelector('.deleteFormCancelV136').onclick=()=>close(false);input.addEventListener('input',()=>{confirmBtn.disabled=input.value.trim()!=='DELETE'});confirmBtn.onclick=()=>{if(input.value.trim()==='DELETE')close(true)};setTimeout(()=>input.focus(),50)})}
function renderTrash(){let deleted=forms.filter(f=>f.deleted===true);$('trashTable').innerHTML=table(['問卷名稱','刪除時間','刪除者','原建立者','回覆數','操作'],deleted.map(f=>{let id=attr(f.id);return `<tr><td><b>${esc(f.title)}</b><br><small>${esc(f.id)}</small></td><td>${esc(f.deletedAt?.toDate?f.deletedAt.toDate().toLocaleString('zh-TW'):'未紀錄')}</td><td>${esc(f.deletedBy||'未紀錄')}</td><td>${esc(formCreatorLabel(f))}</td><td>${countPillHtml(responseCountForForm(f.id))}</td><td>${actionGroup([actionButton('復原',`restoreForm('${id}')`),actionButton('永久刪除',`permanentlyDeleteForm('${id}')`,'danger')])}</td></tr>`}),emptyState('垃圾桶是空的','目前沒有移至垃圾桶的問卷。'))}
async function restoreForm(id){if(!isSystemAdmin)return;await doc('universalForms',id).update({deleted:false,deletedAt:firebase.firestore.FieldValue.delete(),deletedBy:firebase.firestore.FieldValue.delete()});await loadAdminData();toast('問卷已復原')}
async function deleteSnapshotInChunks(snapshot){let docs=snapshot.docs;for(let i=0;i<docs.length;i+=400){let batch=db.batch();docs.slice(i,i+400).forEach(x=>batch.delete(x.ref));await batch.commit()}}
async function permanentlyDeleteForm(id){if(!isSystemAdmin)return notify('只有系統管理員可以永久刪除問卷','error');let f=forms.find(x=>x.id===id);if(!f)return;setPageLoading(true,'正在讀取關聯資料…');let responseSnap;try{responseSnap=await col('universalResponses').where('formId','==',id).get()}finally{setPageLoading(false)}let typed=await inputConfirmDialog({title:'永久刪除問卷',message:`永久刪除後無法復原。\n問卷：${f.title}\n回覆：${responseSnap.size} 份`,requiredText:f.title,danger:true});if(typed===null)return;setPageLoading(true,'正在永久刪除問卷與關聯資料…');try{let[lockSnap,managerSnap]=await Promise.all([col('universalResponseLocks').where('formId','==',id).get(),col('universalFormManagers').where('formId','==',id).get()]);await deleteSnapshotInChunks(responseSnap);await deleteSnapshotInChunks(lockSnap);await deleteSnapshotInChunks(managerSnap);await doc('universalForms',id).delete();await loadAdminData();toast('問卷及其回覆已永久刪除','success')}catch(e){console.error(e);notify('永久刪除失敗，請確認權限或網路狀態','error')}finally{setPageLoading(false)}}


async function loadFormManagers(){if(!activeFormId||!canManageForm(activeFormId))return;$('formManagersTable').innerHTML='<p class="questionHelp loadingBox">讀取中…</p>';try{let q=await col('universalFormManagers').where('formId','==',activeFormId).get();let creatorEmail=formCreatedByEmail(activeForm());formManagers=q.docs.map(x=>({id:x.id,...x.data()})).filter(x=>normalizeEmail(x.email)!==creatorEmail).sort((a,b)=>String(a.email).localeCompare(String(b.email)));renderShareMemberOptions();renderFormManagers()}catch(e){console.error(e);$('formManagersTable').innerHTML='<p class="errorText">無法讀取權限資料，請確認已發布 v1.27 Firestore 規則。</p>'}}
function renderFormManagers(){$('formManagersTable').innerHTML=table(['分享成員','權限','狀態','操作'],formManagers.map(m=>{let id=attr(m.id),enabled=m.enabled!==false;return `<tr><td><b>${esc(managerPersonLabel(m.email))}</b></td><td>${esc(m.role==='manager'?'問卷管理者':'結果檢視者')}</td><td><span class="statePill ${enabled?'state-open':'state-closed'}">${enabled?'啟用':'停用'}</span></td><td>${actionGroup([actionButton('移除',`removeFormManager('${id}')`,'danger')])}</td></tr>`}),'尚無資料')}
function managerDocumentId(formId,email){return formId+'__'+String(email).trim().toLowerCase()}
async function saveFormManager(){if(!activeFormId||!canManageForm(activeFormId))return toast('您沒有管理此問卷權限','error');let email=normalizeEmail($('managerEmail').value),role=$('managerRole').value;if(!/^\S+@\S+\.\S+$/.test(email))return toast('請選擇分享成員','warn');if(email&&email===formCreatedByEmail(activeForm()))return toast('建立者已有問卷管理權限，不需要加入分享成員','warn');let member=findMemberByGoogleEmail(email);if(!member)return toast('請從分享成員清單選擇人員','warn');let id=managerDocumentId(activeFormId,email),existing=formManagers.find(x=>x.id===id),data={formId:activeFormId,email,role,enabled:true,memberId:member.id||'',displayName:memberDisplayName(member),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};if(!existing)data.createdAt=firebase.firestore.FieldValue.serverTimestamp();await doc('universalFormManagers',id).set(data,{merge:true});$('managerEmail').value='';await loadFormManagers();toast(existing?'權限已更新':'已新增問卷權限','success')}
async function toggleFormManager(id,enabled){if(!activeFormId||!canManageForm(activeFormId))return;await doc('universalFormManagers',id).set({enabled,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});await loadFormManagers();toast(enabled?'權限已啟用':'權限已停用','success')}
async function removeFormManager(id){if(!activeFormId||!canManageForm(activeFormId))return;let m=formManagers.find(x=>x.id===id),label=(m?.displayName||managerPersonLabel(m?.email)||'此成員').replace(/<[^>]*>/g,'');if(!await confirmDialog(`確定移除 ${label} 的問卷權限？`,'移除權限',true))return;setPageLoading(true,'正在移除權限…');try{await doc('universalFormManagers',id).delete();await loadFormManagers();toast('問卷權限已移除','success')}catch(e){console.error(e);notify('移除權限失敗，請確認權限或網路狀態','error')}finally{setPageLoading(false)}}


window.startUniversalApp=function(){return init().catch(e=>{console.error(e);frontMain.innerHTML='<div class="successCard"><h2>系統載入失敗</h2><p>'+esc(e.message||e)+'</p></div>'})};






















/* === v1.32-v1.46 merged enhancements === */
/* v1.32 主題、代填與題型擴充 */
var assistedTargetMemberId='';
var FORM_THEMES_V132=[
  {id:'appleWhite',label:'行政風格／極簡白',a:'#ffffff',b:'#f7f9fb',accent:'#287c78'},
  {id:'sinotechRed',label:'環興紅',a:'#9f1717',b:'#ef4444',accent:'#b91c1c'},
  {id:'sakura',label:'少女粉',a:'#b95778',b:'#e59aaa',accent:'#a94d6b'}
];
var QUESTION_TYPES_V132=[['short','簡答'],['long','長文'],['single','單選'],['multiple','複選'],['dropdown','下拉選單'],['department','部門選單'],['linearScale','線性刻度'],['rating','星等評分'],['time','時間'],['datetime','日期與時間'],['matrixSingle','單選矩陣'],['matrixMultiple','複選矩陣'],['image','圖片／說明']];
var MATRIX_TYPES_V132=['matrixSingle','matrixMultiple'];
function formTheme(f){var v=(f&&f.theme)||'appleWhite';return FORM_THEMES_V132.some(function(t){return t.id===v})?v:'appleWhite'}
function questionDescription(q){return String((q&&q.description)!==undefined?q.description:((q&&q.help)||''))}
function splitLines(value){return String(value||'').split(/\r?\n/).map(function(x){return x.trim()}).filter(Boolean)}
function uniqueLines(value){var seen={},dupes=[],items=[];splitLines(value).forEach(function(x){var k=x.toLowerCase();if(seen[k])dupes.push(x);else{seen[k]=true;items.push(x)}});if(dupes.length)toast('已略過重複項目：'+dupes.join('、'),'warn');return items}
function normalizeQuestion(q){q=q||{};var next={id:q.id||('q_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)),type:q.type||'short',title:q.title||'',description:questionDescription(q),help:questionDescription(q),required:!!q.required,options:Array.isArray(q.options)?q.options:[],rows:Array.isArray(q.rows)?q.rows:[],columns:Array.isArray(q.columns)?q.columns:[],imageUrl:q.imageUrl||'',settings:Object.assign({},q.settings||{}),validation:Object.assign({},q.validation||{})};if(next.type==='linearScale')next.settings={min:Number(next.settings.min!=null?next.settings.min:1),max:Number(next.settings.max!=null?next.settings.max:5),minLabel:next.settings.minLabel||'',maxLabel:next.settings.maxLabel||''};if(next.type==='rating')next.settings={max:Number(next.settings.max||5),minLabel:next.settings.minLabel||'',maxLabel:next.settings.maxLabel||''};if(MATRIX_TYPES_V132.includes(next.type)){if(!next.rows.length)next.rows=['項目一'];if(!next.columns.length)next.columns=['選項一']}return next}
function normalizeQuestions(list){return (Array.isArray(list)?list:[]).map(normalizeQuestion)}
function newQuestion(type){type=type||'short';var q=normalizeQuestion({type:type,title:'',required:false,description:'',imageUrl:''});if(['single','multiple','dropdown'].includes(type))q.options=['選項一'];if(type==='linearScale')q.settings={min:1,max:5,minLabel:'非常不滿意',maxLabel:'非常滿意'};if(type==='rating')q.settings={max:5,minLabel:'',maxLabel:''};if(MATRIX_TYPES_V132.includes(type)){q.rows=['項目一','項目二'];q.columns=['非常不滿意','不滿意','普通','滿意','非常滿意']}return q}
function answerEmpty(value){return Array.isArray(value)?!value.length:(value&&typeof value==='object'?!Object.keys(value).length:!String(value==null?'':value).trim())}
function answerText(q,r){q=normalizeQuestion(q);var v=r.answers&&r.answers[q.id];if(Array.isArray(v))return v.join('、');if(v&&typeof v==='object')return Object.keys(v).map(function(k){var val=v[k];return k+'：'+(Array.isArray(val)?val.join('、'):val)}).join('；');return String(v==null?'':v)}
function submissionMethodLabel(r){return r.submissionMethod==='assisted'?'管理員協助填寫':'本人填寫'}
function submitterLabel(r){return r.submissionMethod==='assisted'?(r.submittedByName||r.submittedByEmail||'管理員'):(r.memberName||r.respondentName||'本人')}
function renderThemeChoices(selected){var target=$('themeChoices'),hidden=$('formTheme');if(!target||!hidden)return;hidden.value=formTheme({theme:selected});target.innerHTML=FORM_THEMES_V132.map(function(t){return '<button type="button" class="themeCard '+(hidden.value===t.id?'active':'')+'" onclick="selectTheme(\''+attr(t.id)+'\')"><span class="themeSwatch" style="--a:'+attr(t.a)+';--b:'+attr(t.b)+';--accent:'+attr(t.accent)+'"></span><b>'+esc(t.label)+'</b></button>'}).join('')}
function selectTheme(id){var hidden=$('formTheme');if(hidden)hidden.value=formTheme({theme:id});renderThemeChoices(id);formDirty=true}
function setQuestionSettings(i,key,value){draftQuestions[i]=normalizeQuestion(draftQuestions[i]);draftQuestions[i].settings[key]=value}
function setQuestionValidation(i,key,value){draftQuestions[i]=normalizeQuestion(draftQuestions[i]);draftQuestions[i].validation[key]=value}
function updateQuestion(i,key,value){draftQuestions[i]=normalizeQuestion(draftQuestions[i]);if(['options','rows','columns'].includes(key))draftQuestions[i][key]=splitLines(value);else if(key==='description'||key==='help'){draftQuestions[i].description=value;draftQuestions[i].help=value}else draftQuestions[i][key]=value}
function applyBulkOptions(i,target){target=target||'options';var items=uniqueLines(($('bulk_'+target+'_'+i)||{}).value||'');if(!items.length)return toast('請先貼上項目內容','warn');draftQuestions[i]=normalizeQuestion(draftQuestions[i]);draftQuestions[i][target]=items;renderQuestionEditor();toast('已批次建立 '+items.length+' 個項目','success')}
function startNewForm(){formDirty=false;editMode='new';editingId='';draftQuestions=[];$('editorHeading').textContent='新增問卷';$('editorMode').textContent='新增模式';$('saveFormBtn').textContent='建立問卷';$('formTitle').value='';$('formDescription').value='';$('formDeadline').value='';$('formState').value='draft';$('formImageUrl').value='';previewHeaderImage();$('identityMode').value='member';renderThemeChoices('appleWhite');renderTargetDepartments([]);renderQuestionEditor()}
function editForm(id){var f=forms.find(function(x){return x.id===id});if(!f)return;formDirty=false;editMode='edit';editingId=id;draftQuestions=normalizeQuestions(JSON.parse(JSON.stringify(f.questions||[])));$('editorHeading').textContent='編輯問卷：'+f.title;$('editorMode').textContent='編輯模式';$('saveFormBtn').textContent='儲存變更';$('formTitle').value=f.title||'';$('formDescription').value=f.description||'';$('formDeadline').value=(f.deadline||'').slice(0,16);$('formState').value=f.state||'draft';$('formImageUrl').value=f.imageUrl||'';previewHeaderImage();$('identityMode').value=f.identityMode||'none';renderThemeChoices(formTheme(f));renderTargetDepartments(f.targetDepartments||[]);renderQuestionEditor();showPanel('editorPanel')}
function formQuestionsValid(){for(var q of normalizeQuestions(draftQuestions)){if(!q.title.trim())return'每一題都需要題目名稱';if(['single','multiple','dropdown'].includes(q.type)&&!(q.options||[]).length)return'選擇題至少需要一個選項';if(MATRIX_TYPES_V132.includes(q.type)&&(!(q.rows||[]).length||!(q.columns||[]).length))return'矩陣題至少需要列項目與欄選項';if(q.type==='linearScale'&&Number(q.settings.max)<=Number(q.settings.min))return'線性刻度的結束數字必須大於起始數字'}return''}
function validateTextAnswer(q,value){var v=String(value==null?'':value),rule=q.validation||{},type=rule.type||'';if(!type)return'';var n=Number(v),min=Number(rule.min),max=Number(rule.max),msg=rule.message||'回答格式不符合規則';if(type==='number'&&v&&Number.isNaN(n))return msg;if(type==='integer'&&v&&!Number.isInteger(n))return msg;if(type==='email'&&v&&!/^\S+@\S+\.\S+$/.test(v))return msg;if(type==='phone'&&v&&!/^[0-9+\-#()\s]{6,20}$/.test(v))return msg;if(type==='minLength'&&v.length<min)return msg;if(type==='maxLength'&&v.length>max)return msg;if(type==='gt'&&!(n>min))return msg;if(type==='lt'&&!(n<max))return msg;if(type==='range'&&(Number.isNaN(n)||n<min||n>max))return msg;if(type==='regex'&&rule.pattern){try{if(!new RegExp(rule.pattern).test(v))return msg}catch(e){return'自訂正規表示式格式錯誤'}}return''}
function collectAnswers(formEl,f,prefix){prefix=prefix||'q_';var fd=new FormData(formEl),answers={};for(var q of normalizeQuestions(f.questions||[])){if(q.type==='image')continue;var name=prefix+q.id;if(q.type==='multiple')answers[q.id]=fd.getAll(name);else if(q.type==='matrixSingle'){var out={};(q.rows||[]).forEach(function(row){var value=String(fd.get(name+'__'+row)||'').trim();if(value)out[row]=value});answers[q.id]=out}else if(q.type==='matrixMultiple'){var out2={};(q.rows||[]).forEach(function(row){var values=fd.getAll(name+'__'+row);if(values.length)out2[row]=values});answers[q.id]=out2}else answers[q.id]=String(fd.get(name)||'').trim();if(q.required){if(MATRIX_TYPES_V132.includes(q.type)){var obj=answers[q.id]||{};if((q.rows||[]).some(function(row){return answerEmpty(obj[row])}))throw new Error('請完成必填題目：'+q.title)}else if(answerEmpty(answers[q.id]))throw new Error('請完成必填題目：'+q.title)}if(['short','long'].includes(q.type)){var message=validateTextAnswer(q,answers[q.id]);if(message)throw new Error(q.title+'：'+message)}}return answers}
async function writeResponseWithLock(f,responseKey,payload,lockPayload){if(!responseKey){await col('universalResponses').add(payload);return}var responseRef=doc('universalResponses',responseKey),lockRef=doc('universalResponseLocks',responseKey);await db.runTransaction(async function(tx){var lock=await tx.get(lockRef);if(lock.exists)throw new Error('duplicate-response');tx.set(responseRef,payload);tx.set(lockRef,lockPayload)})}
function renderAssistedFillForm(f,member){return '<div class="assistNotice"><b>目前正在協助填寫：'+esc(memberDisplayName(member))+'（員工編號 '+esc(memberEmployeeNo(member))+'）</b><span>實際填寫管理者：'+esc(adminDisplayName())+'</span></div><form id="assistedForm" class="questionList" onsubmit="submitAssistedResponse(event)">'+normalizeQuestions(f.questions||[]).map(function(q){return renderPublicQuestion(q,'assist_q_')}).join('')+'<div class="submitArea"><button id="assistSubmitBtn" class="btn primary" type="submit">協助送出</button><span id="assistSubmitNote" class="questionHelp"></span></div></form>'}
function openAssistedFill(memberId){var f=activeForm(),member=members.find(function(m){return m.id===memberId});if(!f||!member||!canManageForm(f.id))return notify('您沒有協助填寫權限','error');if(responses.some(function(r){return responseBelongsToMember(r,member)}))return notify('此同仁已填寫，無法重複協助填寫','warn');assistedTargetMemberId=memberId;$('assistedFillTitle').textContent='協助填寫問卷';$('assistedFillBody').innerHTML=renderAssistedFillForm(f,member);$('assistedFillMask').style.display='grid'}
function closeAssistedFill(){$('assistedFillMask').style.display='none';$('assistedFillBody').innerHTML='';assistedTargetMemberId=''}
async function submitAssistedResponse(event){event.preventDefault();var f=activeForm(),member=members.find(function(m){return m.id===assistedTargetMemberId});if(!f||!member||!canManageForm(f.id))return notify('您沒有協助填寫權限','error');var answers;try{answers=collectAnswers(event.target,f,'assist_q_')}catch(e){return notify(e.message||'請確認填寫內容','warn')}if(!await confirmDialog('確定要代替'+memberDisplayName(member)+'送出本問卷嗎？','確認協助填寫'))return;var departmentName=memberDepartmentName(member),responseKey=f.id+'__'+member.id,payload={formId:f.id,formTitle:f.title,departmentName:departmentName,memberId:member.id,memberName:member.name||'',employeeNo:memberEmployeeNo(member),respondentMemberId:member.id,respondentEmployeeId:memberEmployeeNo(member),respondentName:member.name||'',respondentDepartment:departmentName,answers:answers,submissionMethod:'assisted',submittedByUid:(currentUser&&currentUser.uid)||'',submittedByEmail:normalizeEmail((currentUser&&currentUser.email)||''),submittedByName:adminDisplayName(),submittedAt:firebase.firestore.FieldValue.serverTimestamp(),submittedAtText:new Date().toLocaleString('zh-TW')},btn=$('assistSubmitBtn');btn.disabled=true;btn.textContent='送出中';setPageLoading(true,'正在協助送出問卷');try{await writeResponseWithLock(f,responseKey,payload,{formId:f.id,memberId:member.id,submissionMethod:'assisted',submittedByUid:(currentUser&&currentUser.uid)||'',createdAt:firebase.firestore.FieldValue.serverTimestamp()});closeAssistedFill();await loadResponses();renderAdmin();showPanel('resultsPanel');var panel=ensureMissingPanel();if(panel)panel.scrollIntoView({behavior:'smooth',block:'start'});toast('已完成協助填寫','success')}catch(e){console.error(e);notify(e.message==='duplicate-response'?'此同仁已填寫，無法重複協助填寫':'協助填寫失敗，請確認權限或網路狀態','error')}finally{setPageLoading(false);if(btn){btn.disabled=false;btn.textContent='協助送出'}}}
function selectionQuestions(f){return normalizeQuestions(f.questions||[]).filter(function(q){return ['single','dropdown','department','multiple','linearScale','rating','matrixSingle','matrixMultiple'].includes(q.type)})}
function scaleItems(q){var min=Number(q.settings&&q.settings.min!=null?q.settings.min:1),max=Number(q.settings&&q.settings.max||5);if(q.type==='rating'){min=1;max=Number(q.settings&&q.settings.max||5)}return Array.from({length:max-min+1},function(_,i){return String(min+i)})}
function questionOptionLabels(q){q=normalizeQuestion(q);if(q.type==='department')return departments.map(function(d){return d.name||d.departmentName||''}).filter(Boolean);if(['linearScale','rating'].includes(q.type))return scaleItems(q);return optionCounts(q).map(function(x){return x.label})}
function responseHasOption(r,q,option){var value=r.answers&&r.answers[q.id];if(value&&typeof value==='object'&&!Array.isArray(value))return Object.values(value).some(function(v){return Array.isArray(v)?v.map(String).includes(String(option)):String(v)===String(option)});return Array.isArray(value)?value.map(String).includes(String(option)):String(value==null?'':value)===String(option)}
function scaleAnalysisHtml(q){var items=scaleItems(q).map(function(label){return {label:label,count:responses.filter(function(r){return String((r.answers||{})[q.id]||'')===label}).length}}),answered=responses.map(function(r){return Number((r.answers||{})[q.id])}).filter(function(n){return !Number.isNaN(n)}),avg=answered.length?Math.round(answered.reduce(function(a,b){return a+b},0)*10/answered.length)/10:'';return '<div class="analysisCard"><h3>'+esc(q.title)+' <small>平均 '+avg+'</small></h3><div class="barList">'+items.map(function(x){var p=percentage(x.count,answered.length||responses.length);return '<div><div class="barRowHead"><span>'+esc(x.label)+'</span><strong>'+x.count+' 人'+p+'%</strong></div><div class="barTrack"><div class="barFill" style="width:'+p+'%"></div></div></div>'}).join('')+'</div></div>'}
function matrixAnalysisHtml(q){var rows=q.rows||[],cols=q.columns||[];return '<div class="analysisCard wideAnalysis"><h3>'+esc(q.title)+'</h3><div class="matrixScroll"><table class="matrixTable"><thead><tr><th>列項目</th>'+cols.map(function(c){return '<th>'+esc(c)+'</th>'}).join('')+'</tr></thead><tbody>'+rows.map(function(row){return '<tr><th>'+esc(row)+'</th>'+cols.map(function(col){var count=responses.filter(function(r){var v=r.answers&&r.answers[q.id]&&r.answers[q.id][row];return Array.isArray(v)?v.includes(col):v===col}).length;return '<td>'+count+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div></div>'}
function editQuestionHtml(q,value){return '<div class="editQuestion">'+renderPublicQuestion(q,'edit_q_',value).replace(/^<section class="questionCard">/,'').replace(/<\/section>$/,'')+'</div>'}
async function saveEditedResponse(event){event.preventDefault();var f=activeForm(),r=responses.find(function(x){return x.id===editingResponseId});if(!f||!r)return;var answers;try{answers=collectAnswers(event.target,f,'edit_q_')}catch(e){return notify(e.message||'請確認填寫內容','warn')}var update={answers:answers,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:(currentUser&&currentUser.email)||'',updatedByName:adminDisplayName()};if(f.identityMode==='member'){var memberId=$('editMember').value,m=members.find(function(x){return x.id===memberId}),departmentName=$('editDepartment').value;if(!m||!departmentName)return notify('請選擇部門與姓名');Object.assign(update,{departmentName:departmentName,memberId:memberId,memberName:m.name||'',employeeNo:memberEmployeeNo(m),respondentMemberId:m.id,respondentEmployeeId:memberEmployeeNo(m),respondentName:m.name||'',respondentDepartment:departmentName})}var btn=$('saveResponseBtn');btn.disabled=true;btn.textContent='儲存中';setPageLoading(true,'正在儲存填寫結果');try{if(f.identityMode==='member'){var newId=f.id+'__'+update.memberId,newLock=doc('universalResponseLocks',newId),oldLockId=r.memberId?f.id+'__'+r.memberId:'';if(newId!==r.id){var existing=await doc('universalResponses',newId).get(),locked=await newLock.get();if(existing.exists||locked.exists)throw new Error('所選同仁已有這份問卷的填寫資料');var oldData=Object.assign({},r);delete oldData.id;var batch=db.batch();batch.set(doc('universalResponses',newId),Object.assign(oldData,update));batch.delete(doc('universalResponses',r.id));if(oldLockId&&oldLockId!==newId)batch.delete(doc('universalResponseLocks',oldLockId));batch.set(newLock,{formId:f.id,memberId:update.memberId,submissionMethod:r.submissionMethod||'self',createdAt:firebase.firestore.FieldValue.serverTimestamp()});await batch.commit()}else{var sameBatch=db.batch();sameBatch.update(doc('universalResponses',r.id),update);sameBatch.set(newLock,{formId:f.id,memberId:update.memberId,submissionMethod:r.submissionMethod||'self',createdAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});await sameBatch.commit()}}else await doc('universalResponses',r.id).update(update);closeResponseEditor();await loadResponses();renderAdmin();showPanel('resultsPanel');toast('填寫結果已更新','success')}catch(e){console.error(e);notify('更新失敗：'+(e.message||'請確認 Firestore 規則'),'error')}finally{setPageLoading(false);btn.disabled=false;btn.textContent='儲存變更'}}
function applyFormTheme(f){var theme=formTheme(f);document.body.setAttribute('data-front-theme',theme);if(front)front.setAttribute('data-front-theme',theme)}

/* v1.32 usability correction: Google-Forms-like question editor and real controls */
var questionUiState={description:{},validation:{}};
var dragQuestionIndex=null;
function questionSettingOpen(kind,i,q){var bucket=questionUiState[kind]||{};if(bucket[i]!==undefined)return bucket[i];if(kind==='description')return !!questionDescription(q);if(kind==='validation')return !!((q.validation||{}).type);return false}
function toggleQuestionSetting(kind,i){questionUiState[kind]=questionUiState[kind]||{};questionUiState[kind][i]=!questionUiState[kind][i];renderQuestionEditor();setTimeout(function(){var el=document.querySelector('[data-question-index="'+i+'"]');if(el)el.scrollIntoView({block:'nearest'})},0)}
function starPreviewHtml(q){var max=Number((q.settings&&q.settings.max)||5);return '<div class="ratingPreview" aria-hidden="true">'+Array.from({length:max},function(){return '<span class="ratingStar isFilled">★</span>'}).join('')+'</div>'}
function settingStatusLabel(text,on){return '<span class="modeBadge '+(on?'':'mutedModeBadge')+'">'+esc(text)+'</span>'}
function applyOptionsFromTextarea(i,target){var q=normalizeQuestion(draftQuestions[i]);var value=(q[target]||[]).join('\n');var items=uniqueLines(value);var raw=splitLines(value);if(new Set(raw).size!==raw.length)toast('已偵測到重複項目，請確認是否需要保留','warn');draftQuestions[i][target]=items;renderQuestionEditor();toast('已整理 '+items.length+' 個項目','success')}
function optionEditorHtml(q,i){
  q=normalizeQuestion(q);
  if(['single','multiple','dropdown'].includes(q.type))return '<label class="optionsField optionEditorUnified">選項（每行一個）<textarea oninput="updateQuestion('+i+',\'options\',this.value)">'+esc((q.options||[]).join('\n'))+'</textarea><small class="questionHelp">可一次貼上多個選項，每行一個；系統會在儲存時排除空白行。</small></label><div class="optionTools"><button class="btn" type="button" onclick="applyOptionsFromTextarea('+i+',\'options\')">整理選項</button></div>';
  if(q.type==='linearScale')return '<div class="questionGrid"><label>起始數字<select onchange="setQuestionSettings('+i+',\'min\',Number(this.value));renderQuestionEditor()"><option value="0" '+(q.settings.min===0?'selected':'')+'>0</option><option value="1" '+(q.settings.min!==0?'selected':'')+'>1</option></select></label><label>結束數字<input type="number" min="2" max="10" value="'+attr(q.settings.max||5)+'" oninput="setQuestionSettings('+i+',\'max\',Number(this.value));renderQuestionEditor()"></label><label>起始文字<input value="'+attr(q.settings.minLabel||'')+'" oninput="setQuestionSettings('+i+',\'minLabel\',this.value)"></label><label>結束文字<input value="'+attr(q.settings.maxLabel||'')+'" oninput="setQuestionSettings('+i+',\'maxLabel\',this.value)"></label></div>';
  if(q.type==='rating')return '<div class="questionGrid"><label>最高星數<select onchange="setQuestionSettings('+i+',\'max\',Number(this.value));renderQuestionEditor()">'+[3,5,7,10].map(function(n){return '<option value="'+n+'" '+(Number(q.settings.max||5)===n?'selected':'')+'>'+n+' 星</option>'}).join('')+'</select></label><label>起始說明<input value="'+attr(q.settings.minLabel||'')+'" oninput="setQuestionSettings('+i+',\'minLabel\',this.value)"></label><label>結束說明<input value="'+attr(q.settings.maxLabel||'')+'" oninput="setQuestionSettings('+i+',\'maxLabel\',this.value)"></label></div>'+starPreviewHtml(q);
  if(MATRIX_TYPES_V132.includes(q.type))return '<div class="questionGrid"><label>列項目（每行一個）<textarea oninput="updateQuestion('+i+',\'rows\',this.value)">'+esc((q.rows||[]).join('\n'))+'</textarea></label><label>欄選項（每行一個）<textarea oninput="updateQuestion('+i+',\'columns\',this.value)">'+esc((q.columns||[]).join('\n'))+'</textarea></label></div><div class="optionTools"><button class="btn" type="button" onclick="applyOptionsFromTextarea('+i+',\'rows\')">整理列項目</button><button class="btn" type="button" onclick="applyOptionsFromTextarea('+i+',\'columns\')">整理欄選項</button></div>';
  return ''
}
function validationEditorHtml(q,i){if(!['short','long'].includes(q.type))return'';var v=q.validation||{},types=[['','不驗證'],['number','數字'],['integer','整數'],['email','Email'],['phone','電話號碼'],['minLength','最小字數'],['maxLength','最大字數'],['gt','數值大於'],['lt','數值小於'],['range','數值介於範圍'],['regex','自訂正規表示式']];return '<div class="validationBox"><b>回答驗證</b><div class="questionGrid"><label>驗證規則<select onchange="setQuestionValidation('+i+',\'type\',this.value);renderQuestionEditor()">'+types.map(function(x){return '<option value="'+x[0]+'" '+(v.type===x[0]?'selected':'')+'>'+x[1]+'</option>'}).join('')+'</select></label><label>最小值／字數<input value="'+attr(v.min==null?'':v.min)+'" oninput="setQuestionValidation('+i+',\'min\',this.value)"></label><label>最大值／字數<input value="'+attr(v.max==null?'':v.max)+'" oninput="setQuestionValidation('+i+',\'max\',this.value)"></label></div><div class="questionGrid"><label>正規表示式<input value="'+attr(v.pattern||'')+'" oninput="setQuestionValidation('+i+',\'pattern\',this.value)"></label><label>錯誤訊息<input value="'+attr(v.message||'')+'" placeholder="請輸入正確格式" oninput="setQuestionValidation('+i+',\'message\',this.value)"></label></div></div>'}
function questionMoreBar(q,i){var descOpen=questionSettingOpen('description',i,q),validOpen=questionSettingOpen('validation',i,q),hasDesc=!!questionDescription(q),hasValid=!!((q.validation||{}).type);return '<div class="questionMoreBar"><button class="settingToggle '+(descOpen?'active':'')+'" type="button" onclick="toggleQuestionSetting(\'description\','+i+')">'+(descOpen?'收合題目說明':'＋ 題目說明')+'</button><button class="settingToggle '+(validOpen?'active':'')+'" type="button" onclick="toggleQuestionSetting(\'validation\','+i+')">'+(validOpen?'收合回答驗證':'＋ 回答驗證')+'</button>'+(hasDesc?settingStatusLabel('已設定說明',true):'')+(hasValid?settingStatusLabel('已設定驗證',true):'')+'</div>'}
function questionExtraSettingsHtml(q,i){var descOpen=questionSettingOpen('description',i,q),validOpen=questionSettingOpen('validation',i,q);return '<div class="collapsibleSetting '+(descOpen?'open':'')+'"><label>題目說明<input value="'+attr(questionDescription(q))+'" oninput="updateQuestion('+i+',\'description\',this.value)"></label></div><div class="collapsibleSetting '+(validOpen?'open':'')+'">'+validationEditorHtml(q,i)+'</div>'}
function questionImageEditorHtml(q,i){return '<div class="questionImageField"><label>參考圖片網址<input value="'+attr(q.imageUrl||'')+'" placeholder="可貼 Google Drive 分享網址" oninput="updateQuestionImage('+i+',this.value)"></label><p>Drive 圖片需開啟「知道連結的使用者皆可查看」。</p><div id="questionImagePreview_'+i+'" class="imagePreview">'+imagePreviewHtml(q.imageUrl,q.title||'參考圖片預覽')+'</div></div>'}
function addQuestion(type){draftQuestions.push(newQuestion(type||'short'));window.__scrollToQuestionIndex=draftQuestions.length-1;renderQuestionEditor()}
function copyQuestion(i){var copy=JSON.parse(JSON.stringify(normalizeQuestion(draftQuestions[i])));copy.id='q_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);copy.title=(copy.title||'未命名題目')+'（複製）';draftQuestions.splice(i+1,0,copy);window.__scrollToQuestionIndex=i+1;renderQuestionEditor();toast('題目已複製','success')}
function onQuestionDragStart(event,i){dragQuestionIndex=i;event.currentTarget.classList.add('dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(i))}
function onQuestionDragOver(event,i){event.preventDefault();event.currentTarget.classList.add('dragOver');event.dataTransfer.dropEffect='move'}
function onQuestionDragLeave(event){event.currentTarget.classList.remove('dragOver')}
function onQuestionDrop(event,i){event.preventDefault();event.currentTarget.classList.remove('dragOver');var from=dragQuestionIndex;if(from==null||from===i)return;var item=draftQuestions.splice(from,1)[0];draftQuestions.splice(i,0,item);window.__scrollToQuestionIndex=i;dragQuestionIndex=null;renderQuestionEditor();toast('題目順序已更新','success')}
function onQuestionDragEnd(event){event.currentTarget.classList.remove('dragging');document.querySelectorAll('.dragOver').forEach(function(el){el.classList.remove('dragOver')});dragQuestionIndex=null}
function renderPublicQuestion(q,prefix,value){q=normalizeQuestion(q);prefix=prefix||'q_';var required=q.required?'<span class="required"> *</span>':'',title=esc(q.title||'未命名題目')+required,help=questionDescription(q)?'<div class="questionHelp">'+esc(questionDescription(q))+'</div>':'',img=imageUrl(q.imageUrl),image=img?'<img class="questionImage" src="'+attr(img)+'" alt="'+attr(q.title||'參考圖片')+'">':'';if(q.type==='image')return '<section class="questionCard"><label class="title">'+title+'</label>'+help+image+'</section>';var name=prefix+q.id,req=q.required?'required':'',input='',current=value==null?null:value;if(q.type==='long')input='<textarea name="'+attr(name)+'" '+req+'>'+esc(current==null?'':current)+'</textarea>';else if(q.type==='single'||q.type==='multiple'){var t=q.type==='multiple'?'checkbox':'radio',selected=Array.isArray(current)?current:[current];input='<div class="choiceList">'+(q.options||[]).map(function(o){return '<label class="choice"><input type="'+t+'" name="'+attr(name)+'" value="'+attr(o)+'" '+(selected.map(String).includes(String(o))?'checked':'')+' '+(q.type==='single'?req:'')+'>'+esc(o)+'</label>'}).join('')+'</div>'}else if(q.type==='dropdown'||q.type==='department'){var opts=q.type==='department'?departments.map(function(d){return d.name||d.departmentName||''}).filter(Boolean):(q.options||[]);input='<select name="'+attr(name)+'" '+req+'><option value="">請選擇</option>'+opts.map(function(o){return '<option value="'+attr(o)+'" '+(String(current==null?'':current)===String(o)?'selected':'')+'>'+esc(o)+'</option>'}).join('')+'</select>'}else if(q.type==='linearScale'){var min=Number(q.settings.min==null?1:q.settings.min),max=Number(q.settings.max||5);max=Math.max(min+1,Math.min(10,max));var nums=Array.from({length:max-min+1},function(_,k){return min+k});input='<div class="scaleQuestion"><span class="scaleLabel">'+esc(q.settings.minLabel||'')+'</span><div class="scaleOptions">'+nums.map(function(n){var checked=String(current==null?'':current)===String(n);return '<label class="scaleOption '+(checked?'isSelected':'')+'"><input type="radio" name="'+attr(name)+'" value="'+n+'" '+(checked?'checked':'')+' '+req+'><span>'+n+'</span></label>'}).join('')+'</div><span class="scaleLabel">'+esc(q.settings.maxLabel||'')+'</span></div>'}else if(q.type==='rating'){var maxStar=Number(q.settings.max||5);maxStar=[3,5,7,10].includes(maxStar)?maxStar:5;var selectedRating=Number(current||0);input='<div class="ratingQuestion" role="radiogroup" aria-label="'+attr(q.title||'星等評分')+'">'+(q.settings.minLabel?'<span class="scaleLabel">'+esc(q.settings.minLabel)+'</span>':'')+Array.from({length:maxStar},function(_,k){var n=k+1,filled=selectedRating>=n;return '<label class="ratingStar '+(filled?'isFilled':'')+'" title="'+n+' 星"><input type="radio" name="'+attr(name)+'" value="'+n+'" '+(selectedRating===n?'checked':'')+' '+req+' aria-label="'+attr(n+' 星')+'">★</label>'}).join('')+(q.settings.maxLabel?'<span class="scaleLabel">'+esc(q.settings.maxLabel)+'</span>':'')+'</div>'}else if(q.type==='time')input='<input type="time" name="'+attr(name)+'" value="'+attr(current==null?'':current)+'" '+req+'>';else if(q.type==='datetime')input='<input type="datetime-local" name="'+attr(name)+'" value="'+attr(current==null?'':current)+'" '+req+'>';else if(MATRIX_TYPES_V132.includes(q.type)){var multi=q.type==='matrixMultiple',currentObj=current&&typeof current==='object'?current:{};input='<div class="matrixScroll"><table class="matrixTable"><thead><tr><th></th>'+(q.columns||[]).map(function(c){return '<th>'+esc(c)+'</th>'}).join('')+'</tr></thead><tbody>'+(q.rows||[]).map(function(row){return '<tr><th>'+esc(row)+'</th>'+(q.columns||[]).map(function(col){var checked=multi?(Array.isArray(currentObj[row])&&currentObj[row].includes(col)):currentObj[row]===col;return '<td><label class="matrixChoice"><input type="'+(multi?'checkbox':'radio')+'" name="'+attr(name+'__'+row)+'" value="'+attr(col)+'" '+(checked?'checked':'')+' aria-label="'+attr(row+'－'+col)+'"><span class="matrixChoiceText">'+esc(row+'－'+col)+'</span></label></td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>'}else input='<input type="text" name="'+attr(name)+'" value="'+attr(current==null?'':current)+'" '+req+'>';return '<section class="questionCard"><label class="title">'+title+'</label>'+help+image+input+'</section>'}

/* v1.32 deletion policy correction: no trash, creator/admin delete directly */
function canDeleteFormDirectly(form){if(typeof form==='string')form=forms.find(function(x){return x.id===form});return !!form&&(isSystemAdmin||isCreatedByCurrentUser(form))}
function updateRoleUi(){ensureAdminExtensions();var navs=[].slice.call(document.querySelectorAll('.sidebar .nav'));navs.forEach(function(n){var t=n.textContent.trim();if(t==='人員管理')n.style.display=isSystemAdmin?'':'none'});if($('permissionsNav'))$('permissionsNav').style.display=activeFormId&&canManageForm(activeFormId)?'':'none';var groups=document.querySelectorAll('.navGroup');if(groups[1])groups[1].style.display=(isSystemAdmin||(activeFormId&&canManageForm(activeFormId)))?'':'none';[].slice.call(document.querySelectorAll('#formsPanel button')).filter(function(b){return /外套尺寸範本/.test(b.textContent)}).forEach(function(b){b.style.display=isSystemAdmin?'':'none'});if(!isSystemAdmin&&$('membersPanel')&&$('membersPanel').classList.contains('active'))showPanel('dashboardPanel');if(activeFormId&&!canManageForm(activeFormId)&&(($('editorPanel')&&$('editorPanel').classList.contains('active'))||($('permissionsPanel')&&$('permissionsPanel').classList.contains('active'))))showPanel('resultsPanel')}
function renderTrash(){return}

/* v1.33 填寫管理與介面修正版 */
var resultDetailState={search:'',department:'',sort:'department'};
function cleanUiText(value){return String(value==null?'':value).replace(/\\r\\n|\\r|\\n|r'n/g,' ').replace(/\s{2,}/g,' ').trim()}
function esc(v){return cleanUiText(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function frontTopHtml(f,closed){var statusLabel=f?(closed?'問卷已關閉':'問卷開放中'):'請使用完整網址';return '<header class="frontHeader"><img src="assets/company-logo.png" alt="環興科技股份有限公司"><div class="frontActions"><span id="formStatus" class="statusPill">'+statusLabel+'</span>'+(isAdmin?'':'<button class="ghostBtn" onclick="openAdmin()">管理登入</button>')+'</div></header>'}
function renderFront(){var route=formRouteId(),publicForms=forms.filter(function(x){return x.deleted!==true});if(!route){activeFormId='';document.body.removeAttribute('data-front-theme');formStatus.textContent='請使用完整問卷網址';frontMain.innerHTML=frontPreviewBannerHtml()+frontTopHtml(null,true)+'<div class="successCard"><h2>請使用完整問卷網址</h2><p>請由問卷管理者提供的正式連結進入，網址後方需包含 #form/問卷代碼。</p></div>';return}var f=publicForms.find(function(x){return x.id===route});if(!f){activeFormId='';document.body.removeAttribute('data-front-theme');formStatus.textContent='找不到問卷';frontMain.innerHTML=frontPreviewBannerHtml()+frontTopHtml(null,true)+'<div class="successCard"><h2>找不到這份問卷</h2><p>請確認問卷網址是否完整，或洽問卷管理者重新提供連結。</p></div>';return}activeFormId=f.id;applyFormTheme(f);var closed=f.state!=='open'||deadlinePassed(f.deadline),heroImage=imageUrl(f.imageUrl),description=String(f.description||'').trim();formStatus.textContent=closed?'問卷已關閉':'問卷開放中';frontMain.innerHTML=frontPreviewBannerHtml()+frontTopHtml(f,closed)+'<section class="formHero"><h1>'+esc(f.title)+'</h1>'+(description?'<p>'+esc(description)+'</p>':'')+(f.deadline?'<span class="deadlineBadge">請於 '+esc(formatDeadline(f.deadline))+' 前完成</span>':'')+(heroImage?'<img class="referenceImage" src="'+attr(heroImage)+'" alt="問卷參考圖片">':'')+'</section>'+(closed?'<div class="successCard" style="margin-top:18px"><h2>本問卷目前未開放填寫</h2></div>':'<form id="publicForm" class="questionList frontFormStack" onsubmit="submitResponse(event)"><div class="frontFormHeading"><h2>填寫問卷</h2></div>'+(f.identityMode==='member'?renderIdentityBlock(f):'')+normalizeQuestions(f.questions||[]).map(function(q){return renderPublicQuestion(q)}).join('')+'<div class="submitArea"><button id="submitBtn" class="btn primary" type="submit">確認並送出</button><span id="submitNote" class="questionHelp"></span></div></form>')}
function formRowHtml(f){var manage=canManageForm(f.id),canDelete=canDeleteFormDirectly(f),id=attr(f.id),role=formRoleLabel(f);var buttons=[manage?actionButton('編輯',"editForm('"+id+"')"):'',actionButton('結果',"openResults('"+id+"')"),manage?actionButton('複製',"duplicateForm('"+id+"')"):'',canDelete?actionButton('刪除',"deleteForm('"+id+"')",'danger'):''];return '<tr><td><b>'+esc(f.title)+'</b><br><small>'+(f.questions||[]).length+' 題・'+esc(f.id)+'</small></td><td>'+statePillHtml(effectiveState(f))+'</td><td>'+esc(role)+'</td><td>'+creatorCellHtml(f)+'</td><td>'+esc(formatDeadline(f.deadline)||'未設定')+'</td><td>'+countPillHtml(responseCountForForm(f.id))+'</td><td>'+actionGroup(buttons)+'</td></tr>'}
function creatorCellHtml(f){var label=esc(formCreatorLabel(f));if(!isSystemAdmin)return label;return '<button type="button" class="creatorNameButton" onclick="changeFormCreator(\''+attr(f.id)+'\')" title="變更問卷建立者">'+label+'</button>'}
function renderFormManagers(){var rows=formManagers.map(function(m){var id=attr(m.id),enabled=m.enabled!==false,role=m.role==='manager'?'問卷管理者':'結果檢視者';var actions=[actionButton(enabled?'停用':'啟用',"toggleFormManager('"+id+"',"+(enabled?'false':'true')+")"),actionButton('移除',"removeFormManager('"+id+"')",'danger')];return '<tr><td><b>'+esc(managerPersonLabel(m.email))+'</b></td><td>'+esc(role)+'</td><td><span class="statePill '+(enabled?'state-open':'state-closed')+'">'+(enabled?'啟用':'停用')+'</span></td><td>'+actionGroup(actions)+'</td></tr>'});$('formManagersTable').innerHTML=table(['分享成員','權限','狀態','操作'],rows,'尚無資料')}
function resultTimeValue(r){var raw=r.submittedAt&&r.submittedAt.toDate?r.submittedAt.toDate():r.submittedAt;var d=raw instanceof Date?raw:new Date(raw||r.submittedAtText||0);return Number.isNaN(d.getTime())?0:d.getTime()}
function resultMemberKeyword(r){return [r.departmentName,r.respondentDepartment,r.memberName,r.respondentName,r.employeeNo,r.respondentEmployeeId].map(function(x){return String(x||'')}).join(' ').toLowerCase()}
function resultDepartmentsForForm(f){if(!f||f.identityMode!=='member')return[];return Array.from(new Set(responses.map(function(r){return r.departmentName||r.respondentDepartment||''}).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'zh-Hant')})}
function missingScopeData(form,department){var data=completionData(form);if(!department)return data;var expected=data.expected.filter(function(member){return memberDepartmentName(member)===department}),filled=expected.filter(function(member){return data.filled.some(function(item){return item.id===member.id})}),filledIds=new Set(filled.map(function(member){return member.id})),missing=expected.filter(function(member){return !filledIds.has(member.id)});return{expected:expected,filled:filled,missing:missing}}
function renderMissingMembers(form){var panel=ensureMissingPanel();if(!panel)return;if(!form||form.identityMode!=='member'){panel.style.display='none';return}panel.style.display='block';var data=completionData(form),filter=$('missingDepartmentFilter'),previous=filter.value,deps=Array.from(new Set(data.expected.map(memberDepartmentName).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'zh-Hant')});filter.innerHTML='<option value="">全部部門</option>'+deps.map(function(dep){return '<option value="'+attr(dep)+'">'+esc(dep)+'</option>'}).join('');if(previous&&deps.includes(previous))filter.value=previous;var selected=filter.value,scoped=missingScopeData(form,selected),list=scoped.missing,manage=canManageForm(form.id);$('missingCaption').textContent=(selected?selected+'：':'全部部門：')+'顯示 '+list.length+' 位未填寫人員';$('completionStats').innerHTML='<div class="completionStat"><span>應填人數</span><strong>'+scoped.expected.length+'</strong></div><div class="completionStat"><span>已填人數</span><strong>'+scoped.filled.length+'</strong></div><div class="completionStat"><span>未填人數</span><strong>'+scoped.missing.length+'</strong></div>';$('missingMembersTable').innerHTML=list.length?table(['部門','姓名','員工編號','狀態'].concat(manage?['操作']:[]),list.map(function(member){return '<tr><td>'+esc(memberDepartmentName(member))+'</td><td><b>'+esc(member.name||'')+'</b></td><td>'+esc(memberEmployeeNo(member))+'</td><td><span class="statePill state-draft">未填寫</span></td>'+(manage?'<td>'+actionGroup([actionButton('協助填寫',"openAssistedFill('"+attr(member.id)+"')")])+'</td>':'')+'</tr>'})):emptyState(selected?'此部門目前沒有未填寫人員':'所有應填人員皆已完成','目前篩選條件下沒有未填寫人員。')}
function safeSheetName(name,used){var base=String(name||'工作表').replace(/[\\/?*\[\]:]/g,'').slice(0,28)||'工作表',out=base,i=1;used=used||{};while(used[out]){out=(base.slice(0,25)+'_'+i++).slice(0,31)}used[out]=true;return out}
function exportMissingMembers(){var form=activeForm();if(!form||form.identityMode!=='member')return notify('目前問卷未使用公司人員名單');var data=completionData(form),deps=Array.from(new Set(data.expected.map(memberDepartmentName).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'zh-Hant')}),wb=XLSX.utils.book_new(),used={};setPageLoading(true,'正在匯出未填寫名單');try{XLSX.utils.book_append_sheet(wb,missingMembersSheet(form,''),safeSheetName('未填寫名單',used));deps.forEach(function(dep){XLSX.utils.book_append_sheet(wb,missingMembersSheet(form,dep),safeSheetName(dep,used))});XLSX.writeFile(wb,(form.title||'問卷')+'_未填寫名單.xlsx');toast('未填寫名單已匯出','success')}catch(e){console.error(e);notify('未填寫名單匯出失敗','error')}finally{setPageLoading(false)}}
function openDialog(opts){opts=opts||{};var mask=$('dialogMask'),inputWrap=$('dialogInputWrap'),input=$('dialogInput'),confirm=$('dialogConfirm'),message=$('dialogMessage');$('dialogTitle').textContent=opts.title||'確認操作';message.innerHTML=opts.messageHtml||esc(opts.message||'').replace(/\n/g,'<br>');$('dialogCancel').textContent=opts.cancelText||'取消';confirm.textContent=opts.confirmText||'確定';confirm.className='btn '+(opts.danger?'danger':'primary');dialogOptions={requiredText:opts.requiredText||''};inputWrap.style.display=opts.inputLabel?'flex':'none';inputWrap.classList.toggle('deleteConfirmInput',!!opts.deleteConfirm);inputWrap.firstChild.textContent=opts.inputLabel||'確認文字';input.value=opts.inputValue||'';input.placeholder=opts.inputPlaceholder||'';mask.style.display='grid';if(opts.inputLabel)setTimeout(function(){input.focus()},60);return new Promise(function(resolve){dialogResolve=resolve})}
function inputConfirmDialog(opts){opts=opts||{};return openDialog({title:opts.title||'確認操作',message:opts.message||'',messageHtml:opts.messageHtml||'',danger:!!opts.danger,inputLabel:opts.inputLabel||'請輸入確認文字',inputPlaceholder:opts.inputPlaceholder||'',requiredText:opts.requiredText||'',confirmText:opts.confirmText||(opts.danger?'確認刪除':'確定'),deleteConfirm:!!opts.deleteConfirm}).then(function(result){return result.ok?result.value:null})}
function confirmDeleteFormModalV136(f){return new Promise(function(resolve){document.querySelectorAll('.deleteFormModalV136').forEach(function(el){el.remove()});var overlay=document.createElement('div');overlay.className='deleteFormModalV136';overlay.innerHTML='<div class="deleteFormDialogV136" role="dialog" aria-modal="true" aria-label="永久刪除問卷"><button type="button" class="deleteFormCloseV136" aria-label="關閉">×</button><h3>永久刪除問卷</h3><p class="muted">這會刪除「'+esc(f.title||f.id||'未命名問卷')+'」及本問卷的填寫資料。此操作無法復原。</p><div class="deleteFormScopeV136"><b>會一起刪除</b><ul><li>問卷基本資料、題目設定與參考圖片設定</li><li>填寫結果、填寫鎖定與協助填寫紀錄</li><li>本問卷的分享成員與權限設定</li></ul><b>會保留</b><ul><li>人員主檔、部門資料</li><li>其他問卷與其他問卷的填寫資料</li></ul></div><label class="deleteFormConfirmFieldV136">請輸入 DELETE 確認刪除<input class="deleteFormConfirmInputV136" autocomplete="off" placeholder="DELETE"></label><div class="deleteFormActionsV136"><button type="button" class="btn deleteFormCancelV136">取消</button><button type="button" class="btn danger deleteFormConfirmBtnV136" disabled>永久刪除</button></div></div>';document.body.appendChild(overlay);var input=overlay.querySelector('.deleteFormConfirmInputV136'),confirmBtn=overlay.querySelector('.deleteFormConfirmBtnV136');function close(ok){overlay.remove();resolve(!!ok)}overlay.querySelector('.deleteFormCloseV136').onclick=function(){close(false)};overlay.querySelector('.deleteFormCancelV136').onclick=function(){close(false)};input.addEventListener('input',function(){confirmBtn.disabled=input.value.trim()!=='DELETE'});confirmBtn.onclick=function(){if(input.value.trim()==='DELETE')close(true)};setTimeout(function(){input.focus()},50)})}
async function deleteForm(id){var f=forms.find(function(x){return x.id===id});if(!f)return;if(!canDeleteFormDirectly(f))return notify('只有系統管理員或問卷建立者可以刪除此問卷','error');var confirmed=await confirmDeleteFormModalV136(f);if(!confirmed)return;setPageLoading(true,'正在刪除問卷與關聯資料');try{var responseSnap=await col('universalResponses').where('formId','==',id).get(),lockSnap=await col('universalResponseLocks').where('formId','==',id).get(),managerSnap=await col('universalFormManagers').where('formId','==',id).get();await deleteSnapshotInChunks(responseSnap);await deleteSnapshotInChunks(lockSnap);await deleteSnapshotInChunks(managerSnap);await doc('universalForms',id).delete();if(activeFormId===id)activeFormId='';await loadAdminData();showPanel('formsPanel');toast('問卷及其關聯資料已刪除','success')}catch(e){console.error(e);notify('刪除失敗，請確認 Firestore 規則已部署','error')}finally{setPageLoading(false)}}
/* v1.38: keep admin modal overlays above the sticky header and lock background scroll. */
function syncAdminModalLockV138(){
  var hasOpenModal=Array.from(document.querySelectorAll('.modalMask')).some(function(el){
    return window.getComputedStyle(el).display!=='none';
  })||!!document.querySelector('.deleteFormModalV136');
  document.documentElement.classList.toggle('adminModalOpenV138',hasOpenModal);
  document.body.classList.toggle('adminModalOpenV138',hasOpenModal);
}
function openManagedModalV138(id){
  var el=$(id);
  if(!el)return;
  el.style.display='grid';
  el.classList.add('adminModalActiveV138');
  syncAdminModalLockV138();
}
function closeManagedModalV138(id){
  var el=$(id);
  if(el){
    el.style.display='none';
    el.classList.remove('adminModalActiveV138');
  }
  setTimeout(syncAdminModalLockV138,0);
}
var openAssistedFillV138Base=typeof openAssistedFill==='function'?openAssistedFill:null;
if(openAssistedFillV138Base){
  openAssistedFill=function(memberId){
    openAssistedFillV138Base(memberId);
    if($('assistedFillMask')&&$('assistedFillMask').style.display!=='none')openManagedModalV138('assistedFillMask');
  };
}
var closeAssistedFillV138Base=typeof closeAssistedFill==='function'?closeAssistedFill:null;
if(closeAssistedFillV138Base){
  closeAssistedFill=function(){
    closeAssistedFillV138Base();
    closeManagedModalV138('assistedFillMask');
  };
}
var openResponseEditorV138Base=typeof openResponseEditor==='function'?openResponseEditor:null;
if(openResponseEditorV138Base){
  openResponseEditor=function(id){
    openResponseEditorV138Base(id);
    if($('responseEditMask')&&$('responseEditMask').style.display!=='none')openManagedModalV138('responseEditMask');
  };
}
var closeResponseEditorV138Base=typeof closeResponseEditor==='function'?closeResponseEditor:null;
if(closeResponseEditorV138Base){
  closeResponseEditor=function(){
    closeResponseEditorV138Base();
    closeManagedModalV138('responseEditMask');
  };
}
var openDialogV138Base=typeof openDialog==='function'?openDialog:null;
if(openDialogV138Base){
  openDialog=function(opts){
    var result=openDialogV138Base(opts);
    openManagedModalV138('dialogMask');
    return result;
  };
}
var closeDialogV138Base=typeof closeDialog==='function'?closeDialog:null;
if(closeDialogV138Base){
  closeDialog=function(ok){
    closeDialogV138Base(ok);
    setTimeout(syncAdminModalLockV138,0);
  };
}
var creatorDialogV138Base=typeof creatorDialog==='function'?creatorDialog:null;
if(creatorDialogV138Base){
  creatorDialog=function(f){
    var promise=creatorDialogV138Base(f);
    setTimeout(function(){openManagedModalV138('creatorDialogMask')},0);
    return promise;
  };
}
var closeCreatorDialogV138Base=typeof closeCreatorDialog==='function'?closeCreatorDialog:null;
if(closeCreatorDialogV138Base){
  closeCreatorDialog=function(value){
    closeCreatorDialogV138Base(value);
    setTimeout(syncAdminModalLockV138,0);
  };
}
var confirmDeleteFormModalV138Base=typeof confirmDeleteFormModalV136==='function'?confirmDeleteFormModalV136:null;
if(confirmDeleteFormModalV138Base){
  confirmDeleteFormModalV136=function(f){
    var promise=confirmDeleteFormModalV138Base(f);
    setTimeout(syncAdminModalLockV138,0);
    return Promise.resolve(promise).finally(function(){setTimeout(syncAdminModalLockV138,0)});
  };
}
/* v1.39: redesign creator change dialog as a clean form field, not an inline label/select block. */
creatorDialog=function(f){
  return new Promise(function(resolve){
    document.querySelectorAll('#creatorDialogMask').forEach(function(el){el.remove()});
    var current=formCreatedByEmail(f);
    document.body.insertAdjacentHTML('beforeend','<div id="creatorDialogMask" class="modalMask creatorDialogMask creatorDialogV139" style="display:grid"><div class="dialogCard creatorDialogCardV139" role="dialog" aria-modal="true" aria-labelledby="creatorDialogTitleV139"><div class="modalHeader creatorDialogHeaderV139"><div><h3 id="creatorDialogTitleV139">變更問卷建立者</h3><p>調整後，該成員會成為此問卷的建立者與主要管理人。</p></div><button class="modalClose" type="button" onclick="closeCreatorDialog(\'\')" aria-label="關閉">×</button></div><div class="creatorDialogBodyV139"><div class="creatorDialogSurveyV139"><span>目前問卷</span><strong>'+esc(f.title||'未命名問卷')+'</strong></div><label class="creatorFieldV139" for="creatorEmailSelect"><span>建立者</span><select id="creatorEmailSelect"><option value="">請選擇建立者</option>'+creatorSelectOptions(current)+'</select><small>請從共用人員名單選擇，系統會同步移除該成員在本問卷的分享權限，避免重複身分。</small></label></div><div class="modalActions creatorDialogActionsV139"><button class="btn" type="button" onclick="closeCreatorDialog(\'\')">取消</button><button class="btn primary" type="button" onclick="closeCreatorDialog(document.getElementById(\'creatorEmailSelect\').value)">儲存</button></div></div></div>');
    $('creatorDialogMask')._resolve=resolve;
    openManagedModalV138('creatorDialogMask');
    setTimeout(function(){var select=$('creatorEmailSelect');if(select)select.focus()},80);
  });
};
/* v1.40: direct question ordering and per-form target member settings. */
var formMemberSelectionFormIdV140='';
var formMemberSelectionSetV140=new Set();
var formMemberFilterStateV140={department:'',search:''};
function formTargetMemberIdsV140(form){
  var ids=Array.isArray(form&&form.targetMemberIds)?form.targetMemberIds:(Array.isArray(form&&form.participantMemberIds)?form.participantMemberIds:[]);
  return ids.map(function(id){return String(id||'')}).filter(Boolean);
}
function departmentTargetMembersForFormV140(form){
  if(!form||form.identityMode!=='member')return[];
  var allowed=new Set(allowedDepartmentNames(form));
  return members.filter(function(member){return member.active!==false&&allowed.has(memberDepartmentName(member))});
}
function targetMembersForForm(form){
  var base=departmentTargetMembersForFormV140(form),custom=formTargetMemberIdsV140(form);
  if(!custom.length)return base;
  var idSet=new Set(custom);
  return base.filter(function(member){return idSet.has(String(member.id||''))});
}
function completionData(form){
  var expected=targetMembersForForm(form),filled=expected.filter(function(member){return responses.some(function(response){return responseBelongsToMember(response,member)})}),filledIds=new Set(filled.map(function(member){return member.id})),missing=expected.filter(function(member){return !filledIds.has(member.id)});
  return{expected:expected,filled:filled,missing:missing};
}
function memberAllowedForFormV140(form,member){
  if(!form||form.identityMode!=='member'||!member)return false;
  return targetMembersForForm(form).some(function(item){return item.id===member.id});
}
function eligibleDepartmentsForFormV140(form){
  var seen={},out=[];
  targetMembersForForm(form).forEach(function(member){
    var dep=memberDepartmentName(member);
    if(dep&&!seen[dep]){seen[dep]=true;out.push(dep)}
  });
  return out.sort(function(a,b){return a.localeCompare(b,'zh-Hant')});
}
function renderIdentityBlock(f){
  var deps=eligibleDepartmentsForFormV140(f);
  return '<section class="questionCard identityCard"><label class="title">填寫者資料 <span class="required">*</span></label><div class="identityGrid"><label>部門<select id="identityDepartment" required onchange="updateIdentityMembers(this.value)"><option value="">請選擇部門</option>'+deps.map(function(d){return '<option value="'+attr(d)+'">'+esc(d)+'</option>'}).join('')+'</select></label><label>姓名<select id="identityMember" required disabled><option value="">請先選擇部門</option></select></label></div></section>';
}
function updateIdentityMembers(department){
  var select=$('identityMember'),form=activeForm();
  if(!select)return;
  var list=targetMembersForForm(form).filter(function(member){return memberDepartmentName(member)===department});
  select.innerHTML='<option value="">請選擇姓名</option>'+list.map(function(member){return '<option value="'+attr(member.id)+'">'+esc(member.name||'')+(memberEmployeeNo(member)?'（'+esc(memberEmployeeNo(member))+'）':'')+'</option>'}).join('');
  select.disabled=!department;
}
async function submitResponse(event){
  event.preventDefault();
  var f=activeForm();
  if(!f||f.state!=='open'||deadlinePassed(f.deadline))return notify('問卷已關閉，請重新整理頁面');
  var identity={},note=$('submitNote');
  if(note){note.textContent='';note.classList.remove('submitError')}
  if(f.identityMode==='member'){
    var departmentName=$('identityDepartment')&&$('identityDepartment').value||'',memberId=$('identityMember')&&$('identityMember').value||'',m=members.find(function(x){return x.id===memberId});
    if(!departmentName||!m)return notify('請選擇您的部門與姓名');
    if(m.active===false)return notify('這位同仁目前為停用狀態，無法填寫');
    if(memberDepartmentName(m)!==departmentName)return notify('人員資料與部門不相符，請重新選擇');
    if(!memberAllowedForFormV140(f,m))return notify('您不在本問卷開放填寫名單內，請洽管理者確認','warn');
    identity={departmentName:departmentName,memberId:memberId,memberName:m.name||'',employeeNo:memberEmployeeNo(m),respondentMemberId:m.id,respondentEmployeeId:memberEmployeeNo(m),respondentName:m.name||'',respondentDepartment:departmentName};
  }
  var answers;
  try{answers=collectAnswers(event.target,f)}catch(e){return notify(e.message||'請確認填寫內容','warn')}
  var responseKey=f.identityMode==='member'?f.id+'__'+identity.memberId:'';
  if(!await confirmDialog('確認送出這份問卷嗎？送出後如需更正，請洽管理員。','確認送出'))return;
  var btn=$('submitBtn');btn.disabled=true;btn.textContent='送出中';setPageLoading(true,'正在送出問卷');
  var payload=Object.assign({formId:f.id,formTitle:f.title},identity,{answers:answers,submissionMethod:'self',submittedAt:firebase.firestore.FieldValue.serverTimestamp(),submittedAtText:new Date().toLocaleString('zh-TW')});
  try{
    await writeResponseWithLock(f,responseKey,payload,responseKey?{formId:f.id,memberId:identity.memberId,submissionMethod:'self',createdAt:firebase.firestore.FieldValue.serverTimestamp()}:null);
    frontMain.innerHTML='<div class="successCard submitSuccessCard"><h2>填寫成功</h2><p>已收到您的填寫內容。每位同仁限填一次；如需更正請洽管理員。</p><button class="btn primary" onclick="location.reload()">返回問卷</button></div>';
    toast('填寫成功','success');
  }catch(e){
    console.error(e);
    var message=e.message==='duplicate-response'||e.code==='permission-denied'?'您已填寫過這份問卷，無法重複送出。如需更正，請洽管理員。':'送出失敗，請檢查網路後再試一次';
    if(note){note.textContent=message;note.classList.add('submitError')}
    notify(message,e.message==='duplicate-response'?'warn':'error');
    btn.disabled=false;btn.textContent='確認並送出';
  }finally{setPageLoading(false)}
}
function questionJumpSelectHtmlV140(index){
  if(draftQuestions.length<2)return'';
  return '<label class="questionJumpControlV140">移至第<select onchange="moveQuestionToV140('+index+',Number(this.value)-1)">'+draftQuestions.map(function(_,idx){return '<option value="'+(idx+1)+'" '+(idx===index?'selected':'')+'>'+(idx+1)+'</option>'}).join('')+'</select>題</label>';
}
function moveQuestionToV140(from,to){
  from=Number(from);to=Number(to);
  if(Number.isNaN(from)||Number.isNaN(to)||from===to||from<0||to<0||from>=draftQuestions.length||to>=draftQuestions.length)return;
  var item=draftQuestions.splice(from,1)[0];
  draftQuestions.splice(to,0,item);
  window.__scrollToQuestionIndex=to;
  renderQuestionEditor();
  toast('題目已移至第 '+(to+1)+' 題','success');
}
function renderQuestionEditor(){
  draftQuestions=normalizeQuestions(draftQuestions);
  var html=draftQuestions.map(function(q,i){
    return '<div class="questionEdit" data-question-index="'+i+'" draggable="true" ondragstart="onQuestionDragStart(event,'+i+')" ondragover="onQuestionDragOver(event,'+i+')" ondragleave="onQuestionDragLeave(event)" ondrop="onQuestionDrop(event,'+i+')" ondragend="onQuestionDragEnd(event)"><div class="questionEditHeader"><button type="button" class="dragHandle" title="拖曳排序" aria-label="拖曳排序">⋮⋮</button><span class="questionNumber">題目 '+(i+1)+'</span>'+questionJumpSelectHtmlV140(i)+'</div><div class="questionGrid"><label>題目名稱<input value="'+attr(q.title)+'" oninput="updateQuestion('+i+',\'title\',this.value)"></label><label>題型<select onchange="updateQuestion('+i+',\'type\',this.value);renderQuestionEditor()">'+QUESTION_TYPES_V132.map(function(x){return '<option value="'+x[0]+'" '+(q.type===x[0]?'selected':'')+'>'+x[1]+'</option>'}).join('')+'</select></label><label>必填<select onchange="updateQuestion('+i+',\'required\',this.value===\'true\')"><option value="false" '+(!q.required?'selected':'')+'>否</option><option value="true" '+(q.required?'selected':'')+'>是</option></select></label></div>'+optionEditorHtml(q,i)+questionImageEditorHtml(q,i)+questionMoreBar(q,i)+questionExtraSettingsHtml(q,i)+'<div class="miniActions"><button class="btn" type="button" onclick="moveQuestion('+i+',-1)">上移</button><button class="btn" type="button" onclick="moveQuestion('+i+',1)">下移</button><button class="btn" type="button" onclick="copyQuestion('+i+')">複製題目</button><button class="btn danger" type="button" onclick="removeQuestion('+i+')">移除</button></div></div>';
  }).join('');
  questionEditor.innerHTML=html||'<div class="questionHelp">尚未建立題目，請按「新增題目」。</div>';
  questionEditor.insertAdjacentHTML('beforeend','<div class="questionAddBottom"><button class="btn primary" type="button" onclick="addQuestion()">＋ 新增題目</button></div>');
  if(window.__scrollToQuestionIndex!=null){
    var idx=window.__scrollToQuestionIndex;window.__scrollToQuestionIndex=null;
    setTimeout(function(){var el=document.querySelector('[data-question-index="'+idx+'"]');if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('activeQuestion');var input=el.querySelector('input,textarea,select');if(input)input.focus()}},50);
  }
}
function ensureFormMembersNavV140(){
  if($('formMembersNav'))return;
  var menus=[].slice.call(document.querySelectorAll('.topNavMenu'));
  var menu=menus.find(function(el){return /問卷管理/.test(el.textContent)&&/填寫結果/.test(el.textContent)});
  if(!menu)return;
  var before=[].slice.call(menu.querySelectorAll('button')).find(function(btn){return /未填寫名單/.test(btn.textContent)});
  var html='<button id="formMembersNav" class="nav" onclick="showPanel(\'formMembersPanel\',this);renderFormMembersPanel()">人員設定</button>';
  if(before)before.insertAdjacentHTML('beforebegin',html);else menu.insertAdjacentHTML('beforeend',html);
}
function ensureFormMembersPanelV140(){
  if($('formMembersPanel'))return;
  var anchor=$('resultsPanel')||$('permissionsPanel')||$('membersPanel');
  if(!anchor)return;
  anchor.insertAdjacentHTML('beforebegin','<section id="formMembersPanel" class="panel"><div class="card"><div class="sectionHead"><div><h2>問卷人員設定</h2><p>針對使用公司人員資料庫的問卷，指定實際應填寫的人員名單。</p></div><button class="btn primary" type="button" onclick="saveFormMemberSettingsV140()">儲存人員設定</button></div><div id="formMembersBody"></div></div></section>');
}
function resetFormMemberSelectionIfNeededV140(form){
  if(!form)return;
  if(formMemberSelectionFormIdV140===form.id)return;
  formMemberSelectionFormIdV140=form.id;
  formMemberFilterStateV140={department:'',search:''};
  formMemberSelectionSetV140=new Set((formTargetMemberIdsV140(form).length?formTargetMemberIdsV140(form):departmentTargetMembersForFormV140(form).map(function(member){return member.id})).map(String));
}
function formMemberFilteredListV140(form){
  var dep=$('formMemberDepartmentFilter')?$('formMemberDepartmentFilter').value:(formMemberFilterStateV140.department||''),keyword=String($('formMemberSearch')?$('formMemberSearch').value:(formMemberFilterStateV140.search||'')).trim().toLowerCase(),list=departmentTargetMembersForFormV140(form);
  formMemberFilterStateV140.department=dep;
  formMemberFilterStateV140.search=keyword;
  if(dep)list=list.filter(function(member){return memberDepartmentName(member)===dep});
  if(keyword)list=list.filter(function(member){return [memberDepartmentName(member),member.name,memberEmployeeNo(member),memberGoogleEmail(member)].join(' ').toLowerCase().includes(keyword)});
  return list.sort(function(a,b){return memberDepartmentName(a).localeCompare(memberDepartmentName(b),'zh-Hant')||memberEmployeeNo(a).localeCompare(memberEmployeeNo(b),'zh-Hant',{numeric:true})||String(a.name||'').localeCompare(String(b.name||''),'zh-Hant')});
}
function renderFormMembersPanel(){
  ensureFormMembersPanelV140();ensureFormMembersNavV140();
  var body=$('formMembersBody'),form=activeForm();
  if(!body)return;
  if(!form){body.innerHTML=emptyState('尚未選擇問卷','請先從右上角選擇要設定人員的問卷。');return}
  if(form.identityMode!=='member'){body.innerHTML=emptyState('此問卷未使用公司人員資料庫','自由填寫或自行設計填寫者資料的問卷，不需要設定應填人員。');return}
  if(!canManageForm(form.id)){body.innerHTML=emptyState('沒有管理權限','只有系統管理員、問卷建立者或問卷管理者可以維護人員設定。');return}
  resetFormMemberSelectionIfNeededV140(form);
  var all=departmentTargetMembersForFormV140(form),deps=Array.from(new Set(all.map(memberDepartmentName).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'zh-Hant')}),list=formMemberFilteredListV140(form),data=completionData(form);
  body.innerHTML='<div class="formMemberIntroV140"><div><b>'+esc(form.title||'未命名問卷')+'</b><p>未另外設定時，系統會依「開放填寫部門」納入所有啟用同仁；儲存後則以此清單作為應填名單。</p></div><div class="formMemberStatsV140"><span>候選 '+all.length+' 人</span><span>已選 '+formMemberSelectionSetV140.size+' 人</span><span>已填 '+data.filled.length+' 人</span></div></div><div class="formMemberToolsV140"><label>部門<select id="formMemberDepartmentFilter" onchange="formMemberFilterStateV140.department=this.value;renderFormMembersTableV140(formMemberFilteredListV140(activeForm()))"><option value="">全部部門</option>'+deps.map(function(dep){return '<option value="'+attr(dep)+'" '+(formMemberFilterStateV140.department===dep?'selected':'')+'>'+esc(dep)+'</option>'}).join('')+'</select></label><label>搜尋<input id="formMemberSearch" type="search" placeholder="姓名、部門、員工編號" value="'+attr(formMemberFilterStateV140.search||'')+'" oninput="formMemberFilterStateV140.search=this.value;renderFormMembersTableV140(formMemberFilteredListV140(activeForm()))"></label><button class="btn" type="button" onclick="selectFilteredFormMembersV140(true)">全選目前篩選</button><button class="btn" type="button" onclick="selectFilteredFormMembersV140(false)">取消目前篩選</button><button class="btn" type="button" onclick="useDepartmentMembersV140()">依部門全部帶入</button></div><div id="formMemberTableV140"></div>';
  renderFormMembersTableV140(list);
}
function renderFormMembersTableV140(list){
  var target=$('formMemberTableV140');
  if(!target)return;
  target.innerHTML=list.length?table(['選取','部門','姓名','員工編號','狀態'],list.map(function(member){
    var checked=formMemberSelectionSetV140.has(String(member.id||'')),filled=responses.some(function(response){return responseBelongsToMember(response,member)});
    return '<tr><td><label class="memberPickV140"><input type="checkbox" '+(checked?'checked':'')+' onchange="toggleFormMemberV140(\''+attr(member.id)+'\',this.checked)"><span></span></label></td><td>'+esc(memberDepartmentName(member))+'</td><td><b>'+esc(member.name||'')+'</b></td><td>'+esc(memberEmployeeNo(member))+'</td><td><span class="statePill '+(filled?'state-open':'state-draft')+'">'+(filled?'已填寫':'未填寫')+'</span></td></tr>';
  }),emptyState('查無人員','請調整部門或搜尋條件。')):emptyState('查無人員','目前開放部門沒有可選擇的啟用人員。');
}
function toggleFormMemberV140(id,checked){
  id=String(id||'');
  if(!id)return;
  if(checked)formMemberSelectionSetV140.add(id);else formMemberSelectionSetV140.delete(id);
  var stat=document.querySelector('.formMemberStatsV140 span:nth-child(2)');
  if(stat)stat.textContent='已選 '+formMemberSelectionSetV140.size+' 人';
}
function selectFilteredFormMembersV140(checked){
  var form=activeForm();
  formMemberFilteredListV140(form).forEach(function(member){toggleFormMemberV140(member.id,checked)});
  renderFormMembersPanel();
}
function useDepartmentMembersV140(){
  var form=activeForm();
  formMemberSelectionSetV140=new Set(departmentTargetMembersForFormV140(form).map(function(member){return String(member.id||'')}));
  renderFormMembersPanel();
  toast('已依開放部門帶入所有啟用同仁','success');
}
async function saveFormMemberSettingsV140(){
  var form=activeForm();
  if(!form||form.identityMode!=='member')return notify('此問卷未使用公司人員資料庫','warn');
  if(!canManageForm(form.id))return notify('您沒有維護此問卷人員設定的權限','error');
  var allowed=new Set(departmentTargetMembersForFormV140(form).map(function(member){return String(member.id||'')})),ids=Array.from(formMemberSelectionSetV140).filter(function(id){return allowed.has(String(id))});
  if(!ids.length)return notify('請至少選擇一位應填人員','warn');
  setPageLoading(true,'正在儲存問卷人員設定');
  try{
    await doc('universalForms',form.id).set({targetMemberIds:ids,targetMemberMode:'custom',targetMemberUpdatedAt:firebase.firestore.FieldValue.serverTimestamp(),targetMemberUpdatedByEmail:normalizeEmail((currentUser&&currentUser.email)||''),targetMemberUpdatedByName:adminDisplayName()}, {merge:true});
    await loadAdminData();
    formMemberSelectionFormIdV140='';
    renderFormMembersPanel();
    renderDashboard();
    renderResults();
    toast('問卷人員設定已儲存','success');
  }catch(e){console.error(e);notify('人員設定儲存失敗，請確認權限或網路狀態','error')}
  finally{setPageLoading(false)}
}
var ensureAdminExtensionsV140Base=typeof ensureAdminExtensions==='function'?ensureAdminExtensions:null;
ensureAdminExtensions=function(){
  if(ensureAdminExtensionsV140Base)ensureAdminExtensionsV140Base();
  ensureFormMembersPanelV140();
  ensureFormMembersNavV140();
};
var showPanelV140Base=typeof showPanel==='function'?showPanel:null;
if(showPanelV140Base){
  showPanel=async function(id,button){
    ensureFormMembersPanelV140();ensureFormMembersNavV140();
    await showPanelV140Base(id,button);
    if(id==='formMembersPanel'){
      if($('panelTitle'))$('panelTitle').textContent='人員設定';
      renderFormMembersPanel();
    }
  };
}
var updateRoleUiV140Base=typeof updateRoleUi==='function'?updateRoleUi:null;
updateRoleUi=function(){
  if(updateRoleUiV140Base)updateRoleUiV140Base();
  var form=activeForm(),show=!!(form&&form.identityMode==='member'&&canManageForm(form.id));
  if($('formMembersNav'))$('formMembersNav').style.display=show?'':'none';
  if(!show&&$('formMembersPanel')&&$('formMembersPanel').classList.contains('active'))showPanel('formsPanel');
};
var renderAdminV140Base=typeof renderAdmin==='function'?renderAdmin:null;
if(renderAdminV140Base){
  renderAdmin=function(){
    renderAdminV140Base();
    if($('formMembersPanel')&&$('formMembersPanel').classList.contains('active'))renderFormMembersPanel();
  };
}
var openAssistedFillV140Base=typeof openAssistedFill==='function'?openAssistedFill:null;
if(openAssistedFillV140Base){
  openAssistedFill=function(memberId){
    var form=activeForm(),member=members.find(function(m){return m.id===memberId});
    if(form&&member&&!memberAllowedForFormV140(form,member))return notify('此同仁不在本問卷應填名單內','warn');
    openAssistedFillV140Base(memberId);
  };
}
async function duplicateForm(id){
  var source=forms.find(function(x){return x.id===id});
  if(!source)return notify('找不到要複製的問卷','error');
  if(!canManageForm(id))return toast('您沒有複製此問卷的權限','error');
  var targetIds=formTargetMemberIdsV140(source),newId='form_'+Date.now(),data={title:(source.title||'未命名問卷')+'（複製）',description:source.description||'',deadline:'',state:'draft',imageUrl:source.imageUrl||'',theme:formTheme(source),identityMode:source.identityMode||'member',targetDepartments:[].concat(source.targetDepartments||[]),questions:normalizeQuestions(JSON.parse(JSON.stringify(source.questions||[]))),createdByEmail:normalizeEmail((currentUser&&currentUser.email)||''),createdByName:adminDisplayName()||(currentUser&&currentUser.displayName)||(currentUser&&currentUser.email)||'',createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedByEmail:normalizeEmail((currentUser&&currentUser.email)||''),updatedByName:adminDisplayName()};
  if(targetIds.length){data.targetMemberIds=targetIds;data.targetMemberMode=source.targetMemberMode||'custom'}
  setPageLoading(true,'正在複製問卷');
  try{
    await doc('universalForms',newId).set(data);
    activeFormId=newId;
    await loadAdminData();
    editForm(newId);
    toast('已複製問卷，請確認內容後再開放填寫','success');
  }catch(e){console.error(e);notify('複製問卷失敗，請確認權限或網路狀態','error')}
  finally{setPageLoading(false)}
}
/* v1.41: split company-member forms and free-entry forms across dashboard, results, and exports. */
function formUsesMemberDatabaseV141(form){
  return !!(form&&form.identityMode==='member');
}
function resultAnswerKeywordV141(form,response){
  var questions=normalizeQuestions((form&&form.questions)||[]).filter(function(q){return q.type!=='image'});
  return questions.map(function(q){return answerText(q,response)}).join(' ');
}
function resultSearchKeywordV141(form,response){
  var values=[response.submittedAtText,formatAnyDate(response.submittedAt),submissionMethodLabel(response),submitterLabel(response)];
  if(formUsesMemberDatabaseV141(form))values=values.concat([response.departmentName,response.respondentDepartment,response.memberName,response.respondentName,response.employeeNo,response.respondentEmployeeId]);
  values.push(resultAnswerKeywordV141(form,response));
  return values.map(function(x){return String(x||'')}).join(' ').toLowerCase();
}
function effectiveResultSortV141(form){
  if(formUsesMemberDatabaseV141(form))return resultDetailState.sort||'department';
  return resultDetailState.sort==='oldest'?'oldest':'newest';
}
function filteredResultResponses(f){
  var list=responses.slice(),search=String(resultDetailState.search||'').trim().toLowerCase(),dep=formUsesMemberDatabaseV141(f)?(resultDetailState.department||''):'',sort=effectiveResultSortV141(f);
  if(search)list=list.filter(function(r){return resultSearchKeywordV141(f,r).includes(search)});
  if(dep)list=list.filter(function(r){return (r.departmentName||r.respondentDepartment||'')===dep});
  if(sort==='oldest')list.sort(function(a,b){return resultTimeValue(a)-resultTimeValue(b)});
  else if(sort==='newest')list.sort(function(a,b){return resultTimeValue(b)-resultTimeValue(a)});
  else list.sort(function(a,b){return String(a.departmentName||a.respondentDepartment||'').localeCompare(String(b.departmentName||b.respondentDepartment||''),'zh-Hant')||String(a.employeeNo||a.respondentEmployeeId||'').localeCompare(String(b.employeeNo||b.respondentEmployeeId||''),'zh-Hant',{numeric:true})||String(a.memberName||a.respondentName||'').localeCompare(String(b.memberName||b.respondentName||''),'zh-Hant')});
  return list;
}
function ensureResultDetailTools(f){
  var head=document.querySelector('#resultsPanel .resultDetailHead');
  if(!head||!f)return;
  var mode=formUsesMemberDatabaseV141(f)?'member':'free',existing=$('resultDetailTools');
  if(existing&&existing.dataset.formId===f.id&&existing.dataset.mode===mode)return;
  if(existing)existing.remove();
  if(!formUsesMemberDatabaseV141(f)){
    resultDetailState.department='';
    if(resultDetailState.sort==='department')resultDetailState.sort='newest';
  }
  var deps=resultDepartmentsForForm(f),searchPlaceholder=formUsesMemberDatabaseV141(f)?'姓名、部門、員編':'填答內容、送出時間',departmentHtml=formUsesMemberDatabaseV141(f)?'<label>部門<select id="resultDepartmentFilter" onchange="resultDetailState.department=this.value;renderResults()"><option value="">全部部門</option>'+deps.map(function(dep){return '<option value="'+attr(dep)+'" '+(resultDetailState.department===dep?'selected':'')+'>'+esc(dep)+'</option>'}).join('')+'</select></label>':'',sortOptions=formUsesMemberDatabaseV141(f)?'<option value="department" '+(effectiveResultSortV141(f)==='department'?'selected':'')+'>預設部門 / 員編</option><option value="oldest" '+(effectiveResultSortV141(f)==='oldest'?'selected':'')+'>最早送出</option><option value="newest" '+(effectiveResultSortV141(f)==='newest'?'selected':'')+'>最新送出</option>':'<option value="newest" '+(effectiveResultSortV141(f)==='newest'?'selected':'')+'>最新送出</option><option value="oldest" '+(effectiveResultSortV141(f)==='oldest'?'selected':'')+'>最早送出</option>';
  var html='<div id="resultDetailTools" class="resultDetailTools" data-form-id="'+attr(f.id)+'" data-mode="'+mode+'"><label>搜尋<input id="resultSearchInput" type="search" placeholder="'+attr(searchPlaceholder)+'" value="'+attr(resultDetailState.search||'')+'" oninput="resultDetailState.search=this.value;renderResults()"></label>'+departmentHtml+'<label>顯示排序<select id="resultSortSelect" onchange="resultDetailState.sort=this.value;renderResults()">'+sortOptions+'</select></label><button class="btn success" type="button" onclick="exportFilteredResults()">Excel 匯出</button></div>';
  head.insertAdjacentHTML('afterend',html);
}
function renderAnalysis(f){
  var total=responses.length,memberMode=formUsesMemberDatabaseV141(f),departmentsUsed=new Set(responses.map(function(r){return r.departmentName||r.respondentDepartment}).filter(Boolean)),latest=(responses[0]&&responses[0].submittedAtText)||'',depMap=new Map();
  responses.forEach(function(r){var d=r.departmentName||r.respondentDepartment||'未填部門';depMap.set(d,(depMap.get(d)||0)+1)});
  var cards=[];
  if(memberMode)cards.push(pieHtml('部門分布',[...depMap].map(function(x){return {label:x[0],count:x[1]}}),total));
  for(var q of normalizeQuestions(f.questions||[])){if(q.type==='image')continue;if(['single','dropdown','department'].includes(q.type))cards.push(pieHtml(q.title,optionCounts(q),total));else if(q.type==='multiple')cards.push(multipleAnalysisHtml(q));else if(['linearScale','rating'].includes(q.type))cards.push(scaleAnalysisHtml(q));else if(MATRIX_TYPES_V132.includes(q.type))cards.push(matrixAnalysisHtml(q));else if(['short','long','time','datetime'].includes(q.type))cards.push(textAnalysisHtml(q))}
  var secondLabel=memberMode?'填寫部門數':'題目數',secondValue=memberMode?departmentsUsed.size:normalizeQuestions(f.questions||[]).filter(function(q){return q.type!=='image'}).length;
  return '<div class="analysisSummary"><div class="analysisMetric"><span>總填寫份數</span><b>'+total+'</b></div><div class="analysisMetric"><span>'+secondLabel+'</span><b>'+secondValue+'</b></div><div class="analysisMetric"><span>最近填寫時間</span><b style="font-size:15px">'+esc(latest||'尚無紀錄')+'</b></div></div>'+(total?'<div class="analysisGrid">'+cards.join('')+'</div>':'<div class="emptyAnalysis">目前尚無填寫資料，收到回覆後會自動產生統計。</div>');
}
function responseDetailRow(f,qs,r,manage){
  var id=attr(r.id),method='<b>'+esc(submissionMethodLabel(r))+'</b>'+(r.submissionMethod==='assisted'?'<br><small>由 '+esc(submitterLabel(r))+' 協助填寫</small>':''),actions=manage?actionGroup([actionButton('編輯',"openResponseEditor('"+id+"')"),actionButton('刪除',"deleteResponse('"+id+"')",'danger')]):roleBadgeHtml('唯讀',false);
  return '<tr>'+(formUsesMemberDatabaseV141(f)?'<td>'+esc(r.departmentName||r.respondentDepartment||'')+'</td><td>'+esc(r.memberName||r.respondentName||'')+'</td><td>'+esc(r.employeeNo||r.respondentEmployeeId||'')+'</td>':'')+qs.map(function(q){return '<td>'+esc(answerText(q,r))+'</td>'}).join('')+'<td>'+esc(r.submittedAtText||formatAnyDate(r.submittedAt)||'')+'</td><td>'+method+'</td><td>'+actions+'</td></tr>';
}
function renderResults(){
  var f=activeForm(),progress=f&&formUsesMemberDatabaseV141(f)?completionData(f):null;
  $('resultCaption').textContent=f?f.title+'：共 '+responses.length+' 份回覆'+(progress?'；應填 '+progress.expected.length+' 人，未填 '+progress.missing.length+' 人':''):'請先選擇問卷。';
  if(!f){$('resultAnalysis').innerHTML='';resultsTable.innerHTML='';var p=$('missingResponsesPanel');if(p)p.style.display='none';return}
  $('resultAnalysis').innerHTML=renderAnalysis(f);
  renderMissingMembers(f);
  ensureResultDetailTools(f);
  var qs=normalizeQuestions(f.questions||[]).filter(function(q){return q.type!=='image'}),identityHeaders=formUsesMemberDatabaseV141(f)?['部門','姓名','員工編號']:[],manage=canManageForm(f.id),list=filteredResultResponses(f);
  resultsTable.innerHTML=table(identityHeaders.concat(qs.map(function(q){return q.title}),['送出時間','填寫方式','操作']),list.map(function(r){return responseDetailRow(f,qs,r,manage)}),emptyState('查無填寫明細','請調整搜尋或篩選條件。'));
}
function resultExportRowV141(f,qs,r){
  var row={'送出時間':r.submittedAtText||formatAnyDate(r.submittedAt)||'','填寫方式':submissionMethodLabel(r)};
  if(formUsesMemberDatabaseV141(f)){row['部門']=r.departmentName||r.respondentDepartment||'';row['姓名']=r.memberName||r.respondentName||'';row['員工編號']=r.employeeNo||r.respondentEmployeeId||'';row['實際填寫者']=r.memberName||r.respondentName||'';row['協助填寫者']=r.submissionMethod==='assisted'?submitterLabel(r):''}
  qs.forEach(function(q){row[q.title]=answerText(q,r)});
  return row;
}
function exportResults(){
  var f=activeForm();if(!f)return notify('請先選擇問卷');
  setPageLoading(true,'正在產生 Excel');
  try{
    var qs=normalizeQuestions(f.questions||[]).filter(function(q){return q.type!=='image'}),detailRows=responses.map(function(r){return resultExportRowV141(f,qs,r)}),detailSheet=detailRows.length?XLSX.utils.json_to_sheet(detailRows):XLSX.utils.aoa_to_sheet([['目前尚無填寫明細']]),wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,cleanSummarySheet(f),'選項統計總表');
    if(formUsesMemberDatabaseV141(f)){
      XLSX.utils.book_append_sheet(wb,departmentCrossSheet(f),'部門交叉統計');
      XLSX.utils.book_append_sheet(wb,completionProgressSheet(f),'填寫進度');
      XLSX.utils.book_append_sheet(wb,missingMembersSheet(f),'未填寫名單');
    }
    XLSX.utils.book_append_sheet(wb,detailSheet,'填寫明細');
    XLSX.writeFile(wb,(f.title||'問卷')+'_統計報表.xlsx');
    toast('Excel 已匯出','success');
  }catch(e){console.error(e);notify('Excel 匯出失敗','error')}
  finally{setPageLoading(false)}
}
function exportFilteredResults(){
  var f=activeForm();if(!f)return notify('請先選擇問卷');
  var qs=normalizeQuestions(f.questions||[]).filter(function(q){return q.type!=='image'}),list=filteredResultResponses(f),rows=list.map(function(r){return resultExportRowV141(f,qs,r)});
  setPageLoading(true,'正在匯出填寫明細');
  try{var wb=XLSX.utils.book_new(),sheet=rows.length?XLSX.utils.json_to_sheet(rows):XLSX.utils.aoa_to_sheet([['查無填寫明細']]);XLSX.utils.book_append_sheet(wb,sheet,'填寫明細');XLSX.writeFile(wb,(f.title||'問卷')+'_填寫明細.xlsx');toast('填寫明細已匯出','success')}catch(e){console.error(e);notify('填寫明細匯出失敗','error')}finally{setPageLoading(false)}
}
function setMetricLabelV141(id,label){
  var metric=$(id)&&$(id).closest('.metric'),span=metric&&metric.querySelector('span:not(.metricProgress)');
  if(span)span.textContent=label;
}
function latestResponseTextV141(){
  var list=responses.slice().sort(function(a,b){return resultTimeValue(b)-resultTimeValue(a)});
  return list[0]?(list[0].submittedAtText||formatAnyDate(list[0].submittedAt)||'未紀錄'):'尚無紀錄';
}
function renderDashboard(){
  var f=activeForm(),memberMode=formUsesMemberDatabaseV141(f),progress=memberMode?completionData(f):null,rate=progress&&progress.expected.length?Math.round(progress.filled.length*1000/progress.expected.length)/10:null,questionCount=f?normalizeQuestions(f.questions||[]).filter(function(q){return q.type!=='image'}).length:0;
  setMetricLabelV141('dashResponseCount','填寫份數');
  setMetricLabelV141('dashExpectedCount',memberMode?'應填人數':'題目數');
  setMetricLabelV141('dashCompletionRate',memberMode?'完成率':'問卷狀態');
  setMetricLabelV141('dashMissingCount',memberMode?'未填人數':'最近填寫');
  if($('dashResponseCount'))$('dashResponseCount').textContent=f?responses.length:0;
  if($('dashExpectedCount'))$('dashExpectedCount').textContent=f?(memberMode?progress.expected.length:questionCount):'—';
  if($('dashCompletionRate'))$('dashCompletionRate').textContent=f?(memberMode?(rate!==null?rate+'%':'—'):stateLabel(effectiveState(f))):'—';
  var rateMetric=$('dashCompletionRate')&&$('dashCompletionRate').closest('.metric');
  if(rateMetric){var bar=rateMetric.querySelector('.metricProgress');if(memberMode&&rate!==null){if(!bar){bar=document.createElement('span');bar.className='metricProgress';bar.innerHTML='<i></i>';rateMetric.appendChild(bar)}bar.querySelector('i').style.width=Math.max(0,Math.min(100,rate))+'%'}else if(bar)bar.remove()}
  if($('dashMissingCount'))$('dashMissingCount').textContent=f?(memberMode?progress.missing.length:latestResponseTextV141()):'—';
  if($('dashCurrentNote'))$('dashCurrentNote').textContent='';
  if($('dashboardCurrent'))$('dashboardCurrent').innerHTML=f?'<div class="currentSurveyCard compactCurrent"><h3>'+esc(f.title)+'</h3><p>狀態：'+esc(stateLabel(effectiveState(f)))+'</p><p>截止時間：'+esc(formatDeadline(f.deadline)||'未設定')+'</p><p>'+(memberMode?'填寫進度：'+progress.filled.length+'/'+progress.expected.length:'填寫份數：'+responses.length)+'</p><p>建立者：'+esc(formCreatorLabel(f))+'</p></div>':emptyState('尚未選擇問卷','請先從右上角選擇問卷，或建立新的問卷。','<button class="btn primary" onclick="openNewFormSafely()">建立問卷</button>');
}
async function saveForm(){
  var title=$('formTitle').value.trim();if(!title)return notify('請輸入問卷標題');
  draftQuestions=normalizeQuestions(draftQuestions);if(!draftQuestions.length)return notify('請至少建立一個題目');
  var err=formQuestionsValid();if(err)return notify(err);
  var identityMode=$('identityMode').value,targetDepartments=identityMode==='member'?[].slice.call(document.querySelectorAll('.targetDepartment:checked')).map(function(x){return x.value}):[];
  if(identityMode==='member'&&!targetDepartments.length)return notify('請至少選擇一個開放填寫部門');
  var id=editMode==='edit'?editingId:'form_'+Date.now(),data={title:title,description:$('formDescription').value.trim(),deadline:$('formDeadline').value,state:$('formState').value,imageUrl:$('formImageUrl').value.trim(),theme:formTheme({theme:($('formTheme')||{}).value}),identityMode:identityMode,targetDepartments:targetDepartments,questions:draftQuestions,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedByEmail:normalizeEmail((currentUser&&currentUser.email)||''),updatedByName:adminDisplayName()};
  if(identityMode!=='member'){data.targetMemberIds=firebase.firestore.FieldValue.delete();data.targetMemberMode=firebase.firestore.FieldValue.delete();data.targetMemberUpdatedAt=firebase.firestore.FieldValue.delete();data.targetMemberUpdatedByEmail=firebase.firestore.FieldValue.delete();data.targetMemberUpdatedByName=firebase.firestore.FieldValue.delete()}
  if(editMode==='new'){data.createdAt=firebase.firestore.FieldValue.serverTimestamp();data.createdByEmail=normalizeEmail((currentUser&&currentUser.email)||'');data.createdByName=adminDisplayName()||(currentUser&&currentUser.displayName)||(currentUser&&currentUser.email)||''}
  var btn=$('saveFormBtn');btn.disabled=true;btn.textContent='儲存中';setPageLoading(true,'正在儲存問卷');
  try{await doc('universalForms',id).set(data,{merge:true});formDirty=false;activeFormId=id;await loadAdminData();showPanel('formsPanel');toast(editMode==='edit'?'問卷變更已儲存':'問卷已建立','success')}catch(e){console.error(e);notify('問卷儲存失敗，請確認權限或網路狀態','error')}finally{setPageLoading(false);btn.disabled=false;btn.textContent=editMode==='edit'?'儲存變更':'建立問卷'}
}

var activeQuestionIndexV143=null;
function setActiveQuestionV143(index){
  activeQuestionIndexV143=Number(index);
  document.querySelectorAll('#questionEditor .questionEdit').forEach(function(card){
    var isActive=Number(card.getAttribute('data-question-index'))===activeQuestionIndexV143;
    card.classList.toggle('isEditingV143',isActive);
    var chip=card.querySelector('.editingChipV143');
    if(chip)chip.hidden=!isActive;
  });
}
function addQuestionAfterV143(index,type){
  index=Number(index);
  if(Number.isNaN(index)||index<0||index>=draftQuestions.length)return addQuestion(type||'short');
  draftQuestions.splice(index+1,0,newQuestion(type||'short'));
  window.__scrollToQuestionIndex=index+1;
  activeQuestionIndexV143=index+1;
  renderQuestionEditor();
  toast('已在第 '+(index+1)+' 題下方新增題目','success');
}
function enhanceQuestionEditorV143(){
  var editor=document.getElementById('questionEditor');
  if(!editor)return;
  editor.querySelectorAll('.questionEdit').forEach(function(card){
    var index=Number(card.getAttribute('data-question-index'));
    var header=card.querySelector('.questionEditHeader');
    if(header&&!header.querySelector('.editingChipV143')){
      header.insertAdjacentHTML('beforeend','<span class="editingChipV143" hidden>目前編輯</span>');
    }
    card.addEventListener('pointerdown',function(){setActiveQuestionV143(index)});
    card.addEventListener('focusin',function(){setActiveQuestionV143(index)});
    var actions=card.querySelector('.miniActions');
    if(actions&&!actions.querySelector('.questionAddAfterV143')){
      actions.insertAdjacentHTML('afterbegin','<button class="btn questionAddAfterV143" type="button" onclick="addQuestionAfterV143('+index+')">在下方新增</button>');
    }
  });
  if(activeQuestionIndexV143!=null)setActiveQuestionV143(activeQuestionIndexV143);
}
function installQuestionEditorV143(){
  if(typeof renderQuestionEditor!=='function'||window.__questionEditorV143Installed)return;
  window.__questionEditorV143Installed=true;
  var base=renderQuestionEditor;
  renderQuestionEditor=function(){
    base();
    enhanceQuestionEditorV143();
  };
}
function installModalPolishV143(){
  if(window.__modalPolishV143Installed)return;
  window.__modalPolishV143Installed=true;
}
installQuestionEditorV143();
installModalPolishV143();

/* v1.46: merged enhancements plus full unsaved-change guards. */
var activeQuestionIdV144=null;
var dragQuestionIdV144=null;
var assistedFormDirtyV144=false;
var responseEditDirtyV144=false;
var modalBusyV144=false;
var modalProgrammaticCloseV144=false;
var lastModalTriggerV144=null;
function markFormDirty(){
  formDirty=true;
}
function questionIdAtV144(index){
  var q=draftQuestions[Number(index)];
  return q&&q.id?String(q.id):'';
}
function questionIndexByIdV144(id){
  id=String(id||'');
  return draftQuestions.findIndex(function(q){return String(q&&q.id||'')===id});
}
function focusQuestionByIdV144(id,focusSelector){
  id=String(id||'');
  var index=questionIndexByIdV144(id);
  if(index<0)return;
  window.__scrollToQuestionIndex=index;
  activeQuestionIdV144=id;
  setTimeout(function(){
    var card=document.querySelector('[data-question-id="'+CSS.escape(id)+'"]')||document.querySelector('[data-question-index="'+index+'"]');
    if(!card)return;
    card.scrollIntoView({behavior:'smooth',block:'center'});
    setActiveQuestionByIdV144(id);
    var target=focusSelector?card.querySelector(focusSelector):card.querySelector('input,textarea,select,button');
    if(target&&typeof target.focus==='function')target.focus({preventScroll:true});
  },60);
}
function setActiveQuestionByIdV144(id){
  activeQuestionIdV144=String(id||'');
  document.querySelectorAll('#questionEditor .questionEdit').forEach(function(card){
    var isActive=card.getAttribute('data-question-id')===activeQuestionIdV144;
    card.classList.toggle('isEditingV143',isActive);
    card.classList.toggle('isEditingV144',isActive);
    var chip=card.querySelector('.editingChipV143');
    if(chip)chip.hidden=!isActive;
  });
}
function markQuestionDirtyAndActiveV144(index){
  markFormDirty();
  var id=questionIdAtV144(index);
  if(id)activeQuestionIdV144=id;
}
function cleanQuestionForTypeV144(q){
  q=normalizeQuestion(q);
  if(!['single','multiple','dropdown'].includes(q.type))delete q.options;
  if(!MATRIX_TYPES_V132.includes(q.type)){delete q.rows;delete q.columns}
  if(!['linearScale','rating'].includes(q.type)&&q.settings)q.settings={};
  if(q.type==='linearScale')q.settings=Object.assign({min:1,max:5,minLabel:'非常不滿意',maxLabel:'非常滿意'},q.settings||{});
  if(q.type==='rating')q.settings=Object.assign({max:5,minLabel:'',maxLabel:''},q.settings||{});
  return q;
}
var updateQuestionV144Base=typeof updateQuestion==='function'?updateQuestion:null;
if(updateQuestionV144Base){
  updateQuestion=function(i,key,value){
    var oldId=questionIdAtV144(i);
    updateQuestionV144Base(i,key,value);
    if(key==='type')draftQuestions[i]=cleanQuestionForTypeV144(draftQuestions[i]);
    markQuestionDirtyAndActiveV144(i);
    if(key==='type')setTimeout(function(){focusQuestionByIdV144(oldId,'select,textarea,input')},30);
  };
}
['setQuestionSettings','setQuestionValidation','updateQuestionImage'].forEach(function(name){
  var base=window[name]||eval('typeof '+name+'==="function"?'+name+':null');
  if(!base)return;
  window[name]=function(i,key,value){
    var result=base.apply(this,arguments);
    markQuestionDirtyAndActiveV144(i);
    return result;
  };
  try{eval(name+'=window[name]')}catch(e){}
});
var applyOptionsFromTextareaV144Base=typeof applyOptionsFromTextarea==='function'?applyOptionsFromTextarea:null;
if(applyOptionsFromTextareaV144Base){
  applyOptionsFromTextarea=function(i,target){
    var id=questionIdAtV144(i);
    var result=applyOptionsFromTextareaV144Base(i,target);
    markQuestionDirtyAndActiveV144(questionIndexByIdV144(id));
    focusQuestionByIdV144(id);
    return result;
  };
}
var applyBulkOptionsV144Base=typeof applyBulkOptions==='function'?applyBulkOptions:null;
if(applyBulkOptionsV144Base){
  applyBulkOptions=function(i,target){
    var id=questionIdAtV144(i);
    var result=applyBulkOptionsV144Base(i,target);
    markQuestionDirtyAndActiveV144(questionIndexByIdV144(id));
    focusQuestionByIdV144(id);
    return result;
  };
}
var addQuestionV144Base=typeof addQuestion==='function'?addQuestion:null;
if(addQuestionV144Base){
  addQuestion=function(type){
    addQuestionV144Base(type);
    var q=draftQuestions[draftQuestions.length-1];
    activeQuestionIdV144=q&&q.id?String(q.id):activeQuestionIdV144;
    markFormDirty();
  };
}
var copyQuestionV144Base=typeof copyQuestion==='function'?copyQuestion:null;
if(copyQuestionV144Base){
  copyQuestion=function(i){
    copyQuestionV144Base(i);
    var copied=draftQuestions[Number(i)+1];
    activeQuestionIdV144=copied&&copied.id?String(copied.id):activeQuestionIdV144;
    markFormDirty();
    focusQuestionByIdV144(activeQuestionIdV144);
  };
}
var moveQuestionV144Base=typeof moveQuestion==='function'?moveQuestion:null;
if(moveQuestionV144Base){
  moveQuestion=function(i,delta){
    var id=questionIdAtV144(i);
    moveQuestionV144Base(i,delta);
    if(questionIndexByIdV144(id)>=0){
      activeQuestionIdV144=id;
      markFormDirty();
      focusQuestionByIdV144(id);
    }
  };
}
var removeQuestionV144Base=typeof removeQuestion==='function'?removeQuestion:null;
if(removeQuestionV144Base){
  removeQuestion=async function(i){
    i=Number(i);
    var oldId=questionIdAtV144(i);
    var ok=await confirmDialog('確定移除此題？','移除題目',true);
    if(!ok)return;
    draftQuestions.splice(i,1);
    var next=draftQuestions[i]||draftQuestions[i-1]||null;
    activeQuestionIdV144=next&&next.id?String(next.id):'';
    markFormDirty();
    renderQuestionEditor();
    if(activeQuestionIdV144)focusQuestionByIdV144(activeQuestionIdV144);
  };
}
var moveQuestionToV140V144Base=typeof moveQuestionToV140==='function'?moveQuestionToV140:null;
if(moveQuestionToV140V144Base){
  moveQuestionToV140=function(from,to){
    var id=questionIdAtV144(from);
    moveQuestionToV140V144Base(from,to);
    if(questionIndexByIdV144(id)>=0){
      activeQuestionIdV144=id;
      markFormDirty();
      focusQuestionByIdV144(id);
    }
  };
}
var addQuestionAfterV143V144Base=typeof addQuestionAfterV143==='function'?addQuestionAfterV143:null;
if(addQuestionAfterV143V144Base){
  addQuestionAfterV143=function(index,type){
    index=Number(index);
    if(Number.isNaN(index)||index<0||index>=draftQuestions.length)return addQuestion(type||'short');
    var q=newQuestion(type||'short');
    draftQuestions.splice(index+1,0,q);
    activeQuestionIdV144=String(q.id||'');
    window.__scrollToQuestionIndex=index+1;
    markFormDirty();
    renderQuestionEditor();
    focusQuestionByIdV144(activeQuestionIdV144);
    toast('已在第 '+(index+1)+' 題下方新增題目','success');
  };
}
onQuestionDragStart=function(event,i){
  if(!event.target.closest('.dragHandle')){event.preventDefault();return false}
  if(window.matchMedia&&window.matchMedia('(max-width: 760px)').matches){event.preventDefault();return false}
  dragQuestionIndex=i;
  dragQuestionIdV144=questionIdAtV144(i);
  event.currentTarget.classList.add('dragging');
  event.dataTransfer.effectAllowed='move';
  event.dataTransfer.setData('text/plain',dragQuestionIdV144||String(i));
};
onQuestionDrop=function(event,i){
  event.preventDefault();
  event.currentTarget.classList.remove('dragOver');
  var from=dragQuestionIdV144?questionIndexByIdV144(dragQuestionIdV144):dragQuestionIndex;
  if(from==null||from<0||from===i)return;
  var item=draftQuestions.splice(from,1)[0];
  draftQuestions.splice(i,0,item);
  activeQuestionIdV144=String(item.id||'');
  window.__scrollToQuestionIndex=questionIndexByIdV144(activeQuestionIdV144);
  dragQuestionIndex=null;
  dragQuestionIdV144=null;
  markFormDirty();
  renderQuestionEditor();
  focusQuestionByIdV144(activeQuestionIdV144);
  toast('題目順序已更新','success');
};
var renderQuestionEditorV144Base=typeof renderQuestionEditor==='function'?renderQuestionEditor:null;
if(renderQuestionEditorV144Base){
  renderQuestionEditor=function(){
    renderQuestionEditorV144Base();
    document.querySelectorAll('#questionEditor .questionEdit').forEach(function(card){
      var index=Number(card.getAttribute('data-question-index'));
      var id=questionIdAtV144(index);
      if(id)card.setAttribute('data-question-id',id);
      card.setAttribute('draggable','false');
      var handle=card.querySelector('.dragHandle');
      if(handle){
        handle.setAttribute('draggable',window.matchMedia&&window.matchMedia('(max-width: 760px)').matches?'false':'true');
        handle.addEventListener('pointerdown',function(){if(id)setActiveQuestionByIdV144(id)});
      }
      card.addEventListener('focusin',function(){if(id)setActiveQuestionByIdV144(id)});
      card.addEventListener('pointerdown',function(event){
        if(event.target.closest('input,textarea,select,button'))return;
        if(id)setActiveQuestionByIdV144(id);
      });
    });
    if(activeQuestionIdV144&&questionIndexByIdV144(activeQuestionIdV144)>=0)setActiveQuestionByIdV144(activeQuestionIdV144);
  };
}
var startNewFormV144Base=typeof startNewForm==='function'?startNewForm:null;
if(startNewFormV144Base){
  startNewForm=function(){
    activeQuestionIdV144='';
    startNewFormV144Base();
  };
}
function submissionMethodLabelV144(r,form){
  if(r&&r.submissionMethod==='assisted')return '管理員協助填寫';
  return form&&formUsesMemberDatabaseV141(form)?'本人填寫':'一般填寫';
}
var responseDetailRowV144Base=typeof responseDetailRow==='function'?responseDetailRow:null;
if(responseDetailRowV144Base){
  responseDetailRow=function(f,qs,r,manage){
    var html=responseDetailRowV144Base(f,qs,r,manage);
    if(!formUsesMemberDatabaseV141(f))html=html.replace(/本人填寫/g,'一般填寫');
    return html;
  };
}
var resultExportRowV141V144Base=typeof resultExportRowV141==='function'?resultExportRowV141:null;
if(resultExportRowV141V144Base){
  resultExportRowV141=function(f,qs,r){
    var row=resultExportRowV141V144Base(f,qs,r);
    row['填寫方式']=submissionMethodLabelV144(r,f);
    return row;
  };
}

