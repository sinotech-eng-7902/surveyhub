let app,auth,db,currentUser=null,isAdmin=false,isSystemAdmin=false,formAssignments=[],formManagers=[],forms=[],responses=[],departments=[],members=[],memberAccounts=[],activeFormId='',editMode='new',editingId='',draftQuestions=[],editingResponseId='',memberEditMode='view',editingMemberId='',submissionLocksPrepared=false,loginPurpose='admin',formDirty=false,activeFormSection='mine';
let memberImportMode='partial',pendingMemberImport=null,storage=null;
let initialAuthResolved=false,initialPublicDataResolved=false;
const IMAGE_MAX_BYTES=10*1024*1024,FILE_MAX_BYTES=10*1024*1024,IMAGE_TYPES=['image/jpeg','image/png','image/webp'];
const DOCUMENT_FILE_EXTENSIONS=['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv','zip','rar','7z'];
const DOCUMENT_FILE_ACCEPT=['.pdf','application/pdf','.doc','application/msword','.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xls','application/vnd.ms-excel','.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.ppt','application/vnd.ms-powerpoint','.pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation','.txt','text/plain','.csv','text/csv','.zip','application/zip','application/x-zip-compressed','.rar','application/vnd.rar','application/x-rar-compressed','.7z','application/x-7z-compressed'].join(',');
let pendingHeaderImageFile=null,pendingHeaderImagePreviewUrl='',headerImageSourceMode='upload';
const pendingQuestionImageFiles=new Map(),pendingQuestionImagePreviewUrls=new Map();
const $=id=>document.getElementById(id);
const front=$('front'),frontMain=$('frontMain'),formStatus=$('formStatus'),admin=$('admin'),loginMask=$('loginMask'),loginBtn=$('loginBtn'),loginMsg=$('loginMsg'),adminUser=$('adminUser'),activeFormSelect=$('activeFormSelect'),activeFormLabel=$('activeFormLabel'),formsTable=$('formsTable'),resultsTable=$('resultsTable'),questionEditor=$('questionEditor');

function syncInitialBootState(){
  let ready=initialAuthResolved&&initialPublicDataResolved,boot=$('appBootScreen');
  document.body.classList.toggle('appBooting',!ready);
  document.body.setAttribute('aria-busy',ready?'false':'true');
  if(boot)boot.hidden=ready;
  return ready;
}

function col(name){return db.collection(name)}
function doc(name,id){return col(name).doc(id)}
function attr(v){return esc(v)}
function normalizeEmail(value){return String(value||'').trim().toLowerCase()}
function memberDisplayName(member){return [member?.department||member?.departmentName||'',member?.name||''].filter(Boolean).join(' ')||member?.name||''}
function memberGoogleEmail(member){let account=memberAccounts.find(a=>a.memberId===member?.id||a.id===member?.id);return normalizeEmail(account?.email||member?.googleEmail||member?.googleAccount||member?.email||member?.gmail||'')}
function findMemberByGoogleEmail(email){let target=normalizeEmail(email);return target?members.find(m=>memberGoogleEmail(m)===target)||null:null}
function toast(message,type='info'){let t=$('toast');t.textContent=message;t.className='toast '+type;t.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.style.display='none',2600)}
function notify(message,type='warn'){toast(message,type);return false}
let dialogResolve=null,dialogOptions={};
function closeDialog(ok){let mask=$('dialogMask'),input=$('dialogInput'),required=dialogOptions.requiredText||'';if(ok&&required&&input.value!==required){toast('輸入內容不一致，請重新確認。','warn');input.focus();return}mask.style.display='none';let resolve=dialogResolve;dialogResolve=null;if(resolve)resolve(ok?{ok:true,value:input.value}:{ok:false,value:''})}
async function confirmDialog(message,title='確認操作',danger=false){let result=await openDialog({title,message,danger,confirmText:danger?'確認':'確定'});return !!result.ok}
async function showCopyDialog(title,value){await openDialog({title,message:'瀏覽器不允許自動複製，請從下方欄位複製。',inputLabel:'連結',inputValue:value,confirmText:'關閉',cancelText:'取消'});return value}
function setPageLoading(visible,text='處理中…'){let box=$('pageLoading');if(!box)return;box.hidden=!visible;let inner=box.querySelector('div');if(inner)inner.textContent=text}
function formatDeadline(value){if(!value)return '';let d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleString('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
function formatAnyDate(value){if(!value)return '';let raw=value?.toDate?value.toDate():value;let d=raw instanceof Date?raw:new Date(raw);return Number.isNaN(d.getTime())?String(value||''):d.toLocaleString('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
function formStartLabel(f){return formatAnyDate(f?.startAt||f?.openAt||f?.createdAt)||'未紀錄'}
function deadlinePassed(value){if(!value)return false;let d=new Date(value);return !Number.isNaN(d.getTime())&&d<new Date()}
function driveFileId(value){let v=String(value||'').trim();if(!v)return '';try{let u=new URL(v);if(!/(^|\.)drive\.google\.com$/i.test(u.hostname))return '';let pathMatch=u.pathname.match(/\/file\/d\/([^/]+)/i)||u.pathname.match(/\/d\/([^/]+)/i);return pathMatch?.[1]||u.searchParams.get('id')||''}catch(e){return''}}
function imageUrl(value){let v=String(value||'').trim();if(!v)return '';if(/^assets\/[\w./-]+$/i.test(v))return v;let driveId=driveFileId(v);if(driveId)return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1600`;try{let u=new URL(v,location.href);return /^https?:$/.test(u.protocol)?u.href:''}catch(e){return''}}
function imagePreviewHtml(value,alt='圖片預覽'){let url=imageUrl(value);return url?`<img src="${attr(url)}" alt="${attr(alt)}" onerror="this.parentElement.innerHTML='<div class=&quot;imagePreviewError&quot;>圖片無法顯示，請確認 Google Drive 分享權限。</div>'">`:''}
function revokeObjectUrl(value){if(value&&String(value).startsWith('blob:'))URL.revokeObjectURL(value)}
function validateImageFile(file){if(!file)return'請先選擇圖片';if(!IMAGE_TYPES.includes(file.type))return'僅支援 JPG、PNG 或 WebP 圖片';return''}
function previewImageHtmlFromUrl(url,alt){return url?'<img src="'+attr(url)+'" alt="'+attr(alt||'圖片預覽')+'">':''}
function resetPendingImages(){revokeObjectUrl(pendingHeaderImagePreviewUrl);pendingHeaderImageFile=null;pendingHeaderImagePreviewUrl='';pendingQuestionImagePreviewUrls.forEach(revokeObjectUrl);pendingQuestionImageFiles.clear();pendingQuestionImagePreviewUrls.clear()}
function setHeaderImageSourceMode(mode){headerImageSourceMode=mode==='url'?'url':'upload';if($('headerUploadPanel'))$('headerUploadPanel').hidden=headerImageSourceMode!=='upload';if($('headerUrlPanel'))$('headerUrlPanel').hidden=headerImageSourceMode!=='url';if($('headerUploadTab'))$('headerUploadTab').classList.toggle('active',headerImageSourceMode==='upload');if($('headerUrlTab'))$('headerUrlTab').classList.toggle('active',headerImageSourceMode==='url')}
function chooseHeaderImageFile(){var input=$('formImageFile');if(input)input.click()}
function handleHeaderImageFile(file){var error=validateImageFile(file);if(error)return notify(error,'warn');revokeObjectUrl(pendingHeaderImagePreviewUrl);pendingHeaderImageFile=file;pendingHeaderImagePreviewUrl=URL.createObjectURL(file);$('formImageUrl').value='';setHeaderImageSourceMode('upload');markFormDirty();previewHeaderImage()}
function updateHeaderImageUrl(){revokeObjectUrl(pendingHeaderImagePreviewUrl);pendingHeaderImageFile=null;pendingHeaderImagePreviewUrl='';previewHeaderImage();markFormDirty()}
function clearHeaderImage(){revokeObjectUrl(pendingHeaderImagePreviewUrl);pendingHeaderImageFile=null;pendingHeaderImagePreviewUrl='';$('formImageUrl').value='';previewHeaderImage();markFormDirty()}
function previewHeaderImage(){var url=pendingHeaderImagePreviewUrl||imageUrl(($('formImageUrl')||{}).value),preview=$('headerImagePreview'),has=!!url,current=editMode==='edit'?forms.find(function(f){return f.id===editingId}):null;if(preview)preview.innerHTML=previewImageHtmlFromUrl(url,'頁首圖片預覽');if($('headerImageFileName'))$('headerImageFileName').textContent=pendingHeaderImageFile?pendingHeaderImageFile.name:'支援 JPG、PNG、WebP';if($('headerImageSourceStatus'))$('headerImageSourceStatus').textContent=pendingHeaderImageFile?'待上傳至 Firebase Storage':(has?(current&&current.imageStoragePath?'目前使用 Firebase Storage 圖片':'目前使用網址圖片'):'尚未選擇圖片');if($('clearHeaderImageBtn'))$('clearHeaderImageBtn').hidden=!has}
function chooseQuestionImageFile(i){var input=$('questionImageFile_'+i);if(input)input.click()}
function handleQuestionImageFile(i,file){var error=validateImageFile(file),q=draftQuestions[i];if(error)return notify(error,'warn');if(!q)return;revokeObjectUrl(pendingQuestionImagePreviewUrls.get(q.id));pendingQuestionImageFiles.set(q.id,file);pendingQuestionImagePreviewUrls.set(q.id,URL.createObjectURL(file));q.imageUrl='';markFormDirty();renderQuestionEditor()}
function updateQuestionImage(i,value){var q=draftQuestions[i];if(!q)return;revokeObjectUrl(pendingQuestionImagePreviewUrls.get(q.id));pendingQuestionImageFiles.delete(q.id);pendingQuestionImagePreviewUrls.delete(q.id);q.imageUrl=value;q.imageStoragePath='';let preview=$('questionImagePreview_'+i);if(preview)preview.innerHTML=imagePreviewHtml(value,q.title||'參考圖片預覽');markFormDirty()}
function clearQuestionImage(i){var q=draftQuestions[i];if(!q)return;revokeObjectUrl(pendingQuestionImagePreviewUrls.get(q.id));pendingQuestionImageFiles.delete(q.id);pendingQuestionImagePreviewUrls.delete(q.id);q.imageUrl='';q.imageStoragePath='';markFormDirty();renderQuestionEditor()}
function setQuestionImageSourceMode(i,mode){var upload=$('questionImageUploadPanel_'+i),url=$('questionImageUrlPanel_'+i),uploadTab=$('questionImageUploadTab_'+i),urlTab=$('questionImageUrlTab_'+i),isUrl=mode==='url';if(upload)upload.hidden=isUrl;if(url)url.hidden=!isUrl;if(uploadTab)uploadTab.classList.toggle('active',!isUrl);if(urlTab)urlTab.classList.toggle('active',isUrl)}
function formRouteId(){let m=location.hash.match(/^#form\/([^/?#]+)/);return m?decodeURIComponent(m[1]):''}

async function init(){
  if(!window.firebase||typeof firebaseConfig==='undefined'||!firebaseConfig.apiKey){initialAuthResolved=true;initialPublicDataResolved=true;syncInitialBootState();front.style.display='block';frontMain.innerHTML='<div class="successCard"><h2>尚未設定 Firebase</h2><p>請確認 js/config.js 已正確上傳。</p></div>';return}
  app=firebase.initializeApp(firebaseConfig,'universal-survey');auth=app.auth();db=app.firestore();storage=app.storage();
  window.addEventListener('hashchange',applyRoute);
  window.addEventListener('beforeunload',e=>{if(formDirty){e.preventDefault();e.returnValue=''}});
  document.addEventListener('input',e=>{if($('editorPanel')?.contains(e.target))formDirty=true});
  document.addEventListener('change',e=>{if($('editorPanel')?.contains(e.target))formDirty=true});
  document.addEventListener('click',e=>{if(!e.target.closest('.adminMoreMenu')){let more=$('adminMoreMenu');if(more)more.open=false}if(!e.target.closest('.topNavGroup'))closeTopNavGroups()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){let more=$('adminMoreMenu');if(more)more.open=false;closeTopNavGroups()}});
  document.querySelectorAll('.topNavGroup').forEach(group=>{group.addEventListener('mouseenter',()=>{clearTimeout(window.__topNavCloseTimer)});group.addEventListener('mouseleave',()=>{clearTimeout(window.__topNavCloseTimer);window.__topNavCloseTimer=setTimeout(()=>group.removeAttribute('open'),280)});group.querySelectorAll('.nav').forEach(item=>item.addEventListener('click',()=>closeTopNavGroups()))});
  auth.onAuthStateChanged(async user=>{currentUser=user;isAdmin=false;isSystemAdmin=false;formAssignments=[];if(user){try{await loadMemberAccounts();isSystemAdmin=await checkAdmin(user);formAssignments=await loadCurrentAssignments(user);let member=findMemberByGoogleEmail(user.email),memberDisabled=member?.active===false,hasMemberAccount=!!member&&!memberDisabled;isAdmin=isSystemAdmin||(!memberDisabled&&(hasMemberAccount||formAssignments.some(x=>x.enabled!==false)));if(isAdmin){let name=memberDisplayName(member)||user.displayName||'後台使用者';if($('adminUserName'))$('adminUserName').textContent=name;adminUser.textContent=(user.email||'')+(isSystemAdmin?'・系統管理員':'');loginMask.style.display='none';await loadAdminData()}else if(loginPurpose==='response'){loginMask.style.display='none'}else loginMsg.textContent=memberDisabled?'此人員帳號目前已停用，如有疑問請聯絡系統管理員。':'此 Google 帳號尚未建立於人員管理或問卷權限中，請聯絡系統管理員。'}catch(e){console.error('admin auth failed',e);loginMsg.textContent='後台登入檢查失敗，請確認 Firestore 規則與人員 Google 帳號設定。'}}else{memberAccounts=[]}initialAuthResolved=true;applyRoute()});
  try{await loadPublicData()}finally{initialPublicDataResolved=true;applyRoute()}
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



function closeTopNavGroups(){document.querySelectorAll('.topNavGroup[open]').forEach(d=>d.removeAttribute('open'))}
async function showPanel(id,button){let active=document.querySelector('.panel.active');if(active?.id==='editorPanel'&&id!=='editorPanel'&&formDirty&&!await confirmDialog('問卷內容尚未儲存，確定要離開編輯頁面？','尚未儲存'))return;document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));$(id).classList.add('active');document.querySelectorAll('.nav').forEach(n=>n.classList.remove('active'));if(button)button.classList.add('active');else{let nav=[...document.querySelectorAll('.nav')].find(n=>(n.getAttribute('onclick')||'').includes("'"+id+"'"));if(nav)nav.classList.add('active')}$('panelTitle').textContent=({dashboardPanel:'儀表板',formsPanel:'問卷總覽',editorPanel:'問卷編輯',membersPanel:'人員管理',trashPanel:'垃圾桶',permissionsPanel:'權限管理',resultsPanel:'填寫結果',progressPanel:'填寫追蹤'})[id]||'通用問卷後台';if(id==='dashboardPanel')renderDashboard();if(id==='resultsPanel')renderResults();if(id==='progressPanel')renderProgressPanelV171();if(id==='membersPanel')renderMemberPanel();if(id==='trashPanel')renderTrash();if(id==='permissionsPanel')loadFormManagers();closeTopNavGroups()}
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
function moveQuestion(i,delta){let j=i+delta;if(j<0||j>=draftQuestions.length)return;[draftQuestions[i],draftQuestions[j]]=[draftQuestions[j],draftQuestions[i]];renderQuestionEditor()}
async function removeQuestion(i){if(await confirmDialog('確定移除此題？','移除題目',true)){var q=draftQuestions[i];if(q){revokeObjectUrl(pendingQuestionImagePreviewUrls.get(q.id));pendingQuestionImageFiles.delete(q.id);pendingQuestionImagePreviewUrls.delete(q.id)}draftQuestions.splice(i,1);markFormDirty();renderQuestionEditor()}}

async function copyFormLink(id=activeFormId){if(!id)return notify('請先選擇問卷');let url=location.href.split('#')[0]+'#form/'+encodeURIComponent(id);if(navigator.clipboard?.writeText)try{await navigator.clipboard.writeText(url);toast('問卷網址已複製','success');return}catch(e){}await showCopyDialog('複製問卷網址',url)}
function formRoleLabel(f){let a=assignmentFor(f&&f.id);if(isSystemAdmin){if(isCreatedByCurrentUser(f))return'發起人／系統管理員';if(a?.role==='manager')return'問卷管理者／系統管理員';if(a?.role==='viewer')return'結果檢視者／系統管理員';return'系統管理員'}if(isCreatedByCurrentUser(f))return'發起人';return a?.role==='manager'?'問卷管理者':'檢視者'}
function responseCountForForm(formId){return formId===activeFormId?responses.length:(forms.find(f=>f.id===formId)?.responseCount||0)}
function formsBySection(){let list=accessibleForms(),open=list.filter(f=>f.deleted!==true&&effectiveState(f)!=='closed'&&effectiveState(f)!=='expired'),mine=open.filter(isCreatedByCurrentUser),shared=open.filter(f=>!isCreatedByCurrentUser(f)&&!!assignmentFor(f.id)),closed=list.filter(f=>f.deleted!==true&&(effectiveState(f)==='closed'||effectiveState(f)==='expired')),all=isSystemAdmin?forms.filter(f=>f.deleted!==true):[];return[{key:'mine',title:'我建立的問卷',hint:'由目前登入帳號建立，可直接管理內容與填寫結果。',items:mine},{key:'shared',title:'被分享的問卷',hint:'由其他管理者分享給您的問卷，依指派權限可管理或檢視。',items:shared},{key:'closed',title:'已關閉的問卷',hint:'已關閉或已截止的問卷集中在此，方便查詢歷史資料。',items:closed},...(isSystemAdmin?[{key:'all',title:'系統內所有問卷',hint:'系統管理員可查看所有未刪除問卷與建立者紀錄。',items:all}]:[])]}
function adminRouteId(){let m=location.hash.match(/^#admin\/([^/?#]+)/);return m?decodeURIComponent(m[1]):''}


/* Stable functional blocks retained for v1.25 final consolidation. */
const chartColors=['#2563eb','#e34f5f','#f59e0b','#16a36a','#7c5ce7','#0891b2','#d9468f','#65a30d','#c65d21','#4f6f8f'];

function chartAnswerValuesV168(q,value){var source=Array.isArray(value)?value:[value],seen=new Set(),values=[];for(var item of source){var key=String(item==null?'':item).trim();if(key&&!seen.has(key)){seen.add(key);values.push(key)}}return q&&q.type!=='multiple'?values.slice(0,1):values}

function answeredResponseCountV168(q){return responses.reduce(function(total,response){return total+(responseQuestionVisibleV171(response,q)&&chartAnswerValuesV168(q,response.answers&&response.answers[q.id]).length?1:0)},0)}

function optionCounts(q){var map=new Map((Array.isArray(q.options)?q.options:[]).map(function(option){return [String(option),0]}));for(var response of responses){if(!responseQuestionVisibleV171(response,q))continue;var values=chartAnswerValuesV168(q,response.answers&&response.answers[q.id]);for(var key of values)map.set(key,(map.get(key)||0)+1)}return [...map.entries()].map(function(entry){return {label:entry[0],count:entry[1]}})}

function analysisCardHeaderV170(title,count,note){return '<div class="analysisCardHeadV170"><div><h3>'+esc(title)+'</h3><p>'+Number(count||0)+' 則有效回覆'+(note?'・'+esc(note):'')+'</p></div><button type="button" class="copyChartButtonV170" data-copy-chart-v170 onclick="copyAnalysisCardV170(this)" aria-label="複製「'+attr(title)+'」圖表">複製圖表</button></div>'}

function analysisCardShellV170(title,count,body,className,note){return '<div class="analysisCard '+(className||'')+'">'+analysisCardHeaderV170(title,count,note)+'<div class="analysisCardVisualV170">'+body+'</div></div>'}

function pieHtml(title,items,denominator=responses.length){items=(Array.isArray(items)?items:[]).map(function(item){var count=Number(item&&item.count);return {label:String(item&&item.label!=null?item.label:'未命名選項'),count:Number.isFinite(count)&&count>0?Math.round(count):0}});var shown=items.map(function(x,index){return {label:x.label,count:x.count,index:index}}).filter(function(x){return x.count>0}),sum=shown.reduce(function(n,x){return n+x.count},0),cursor=0,labels=[];var slices=shown.map(function(x){var start=cursor,end=cursor+(sum?x.count/sum*360:0),p=percentage(x.count,denominator),path=pieSlicePathV165(start,end),mid=start+(end-start)/2,labelPoint=piePointV165(mid,37);cursor=end;if(p>=6.5)labels.push('<text x="'+labelPoint.x.toFixed(2)+'" y="'+labelPoint.y.toFixed(2)+'" class="piePercentLabelV170">'+p+'%</text>');return '<path d="'+path+'" fill="'+chartColors[x.index%chartColors.length]+'" class="chartSliceV165 chartInteractiveV165" tabindex="0" data-chart-index="'+x.index+'" data-chart-label="'+attr(x.label)+'" data-chart-count="'+x.count+'" data-chart-percent="'+p+'" aria-label="選項 '+attr(x.label)+'，票數 '+x.count+'，百分比 '+p+'%"></path>'}).join(''),chart=sum?'<svg class="pieSvgV165" viewBox="0 0 128 128" role="img" aria-label="'+attr(title)+'圓餅圖">'+slices+'<g aria-hidden="true" class="piePercentLabelsV170">'+labels.join('')+'</g></svg>':'<div class="pieEmptyV165" aria-label="尚無資料"></div>',legend=items.map(function(x,i){var p=percentage(x.count,denominator);return '<div class="legendRow chartLegendInteractiveV165 chartInteractiveV165" tabindex="0" data-chart-index="'+i+'" data-chart-label="'+attr(x.label)+'" data-chart-count="'+x.count+'" data-chart-percent="'+p+'" aria-label="選項 '+attr(x.label)+'，票數 '+x.count+'，百分比 '+p+'%"><span class="legendDot" style="background:'+chartColors[i%chartColors.length]+'"></span><span>'+esc(x.label)+'</span><strong>'+x.count+' 人・'+p+'%</strong></div>'}).join('')||'<span class="questionHelp">尚無資料</span>';return analysisCardShellV170(title,denominator,'<div class="pieLayout"><div class="pieChart pieChartV165">'+chart+'</div><div class="chartLegend">'+legend+'</div></div>')}

function multipleAnalysisHtml(q){var items=optionCounts(q),total=answeredResponseCountV168(q),body='<div class="barList">'+(items.map(function(x,index){var p=percentage(x.count,total),color=chartColors[index%chartColors.length];return '<div'+chartDatumAttrsV165(x.label,x.count,p,index)+'><div class="barRowHead"><span>'+esc(x.label)+'</span><strong>'+x.count+' 人・'+p+'%</strong></div><div class="barTrack"><div class="barFill" style="width:'+p+'%;background:'+color+'"></div></div></div>'}).join('')||'<span class="questionHelp">尚無資料</span>')+'</div>';return analysisCardShellV170(q.title,total,body)}

function textAnalysisHtml(q){let items=responses.filter(function(response){return responseQuestionVisibleV171(response,q)}).map(r=>({who:r.memberName||r.employeeNo||'未具名',text:String(r.answers?.[q.id]??'').trim()})).filter(x=>x.text),body=`<div class="textAnswerList">${items.map(x=>`<div class="textAnswer"><b>${esc(x.who)}</b><p>${esc(x.text)}</p></div>`).join('')||'<span class="questionHelp">尚無文字回覆</span>'}</div>`;return analysisCardShellV170(q.title,items.length,body)}


function memberDepartmentName(member){return String(member?.department||member?.departmentName||'').trim()}

function memberEmployeeNo(member){return String(member?.employeeNo||member?.empNo||'').trim()}


function responseBelongsToMember(response,member){
  if(response.memberId&&response.memberId===member.id)return true;
  let employeeNo=memberEmployeeNo(member);
  return !!employeeNo&&String(response.employeeNo||'').trim()===employeeNo;
}


function ensureMissingPanel(){
  return $('missingResponsesPanel');
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


function editMemberOptions(department,selected=''){return members.filter(m=>(m.department||m.departmentName||'')===department&&(m.active!==false||m.id===selected)).map(m=>`<option value="${attr(m.id)}" ${m.id===selected?'selected':''}>${esc(m.name||'')}（${esc(m.employeeNo||m.empNo||'')}）</option>`).join('')}

function memberDepartmentOptions(selected=''){return departments.map(d=>d.name||d.departmentName||d.department||'').filter(Boolean).map(d=>`<option value="${attr(d)}" ${d===selected?'selected':''}>${esc(d)}</option>`).join('')}

function renderMemberPanel(){let target=$('membersTable');if(!target)return;let keyword=String($('memberSearch')?.value||'').trim().toLowerCase(),list=members.filter(m=>!keyword||`${m.department||m.departmentName||''} ${m.name||''} ${m.employeeNo||m.empNo||''} ${memberGoogleEmail(m)}`.toLowerCase().includes(keyword));$('memberCountLabel').textContent=`顯示 ${list.length}／${members.length} 人`;target.innerHTML=table(['部門','姓名','員工編號','Google 帳號','狀態','操作'],list.map(m=>{let active=m.active!==false;return `<tr><td>${esc(m.department||m.departmentName||'')}</td><td><b>${esc(m.name||'')}</b></td><td>${esc(m.employeeNo||m.empNo||'')}</td><td>${memberGoogleEmail(m)?esc(memberGoogleEmail(m)):'<span class="questionHelp">未設定</span>'}</td><td><span class="statusBadge ${active?'active':'inactive'}">${active?'啟用':'停用'}</span></td><td><div class="buttonRow"><button class="btn" onclick="editMember('${attr(m.id)}')">編輯</button><button class="btn" onclick="toggleMember('${attr(m.id)}',${active?'false':'true'})">${active?'停用':'啟用'}</button><button class="btn danger" onclick="deleteMember('${attr(m.id)}')">刪除</button></div></td></tr>`}))}

function fillMemberEditor(m=null){$('memberDepartment').innerHTML='<option value="">請選擇部門</option>'+memberDepartmentOptions(m?.department||m?.departmentName||'');$('memberName').value=m?.name||'';$('memberEmployeeNo').value=m?.employeeNo||m?.empNo||'';$('memberGoogleEmail').value=m?memberGoogleEmail(m):'';$('memberActive').value=String(m?.active!==false)}

function startNewMember(){memberEditMode='new';editingMemberId='';$('memberEditorHeading').textContent='新增人員';$('memberEditorMode').textContent='新增模式';$('saveMemberBtn').textContent='新增人員';fillMemberEditor();$('memberEditor').style.display='block';$('memberName').focus()}

function editMember(id){let m=members.find(x=>x.id===id);if(!m)return;memberEditMode='edit';editingMemberId=id;$('memberEditorHeading').textContent='編輯人員：'+(m.name||'');$('memberEditorMode').textContent='編輯模式';$('saveMemberBtn').textContent='儲存變更';fillMemberEditor(m);$('memberEditor').style.display='block';$('memberEditor').scrollIntoView({behavior:'smooth',block:'start'})}

function cancelMemberEdit(){memberEditMode='view';editingMemberId='';$('memberEditor').style.display='none'}

async function deleteMember(id){let m=members.find(x=>x.id===id);if(!m)return;let ok=await confirmDialog(`確定刪除 ${m.name||'這位人員'}（${m.employeeNo||m.empNo||''}）？\n建議優先使用「停用」，以保留歷史資料關聯。`,'刪除人員',true);if(!ok)return;ok=await confirmDialog('再次確認永久刪除這筆共用人員資料？兩套系統都會同步消失。','永久刪除人員',true);if(!ok)return;setPageLoading(true,'正在刪除人員資料…');try{await doc('members',id).delete();let account=await doc('memberAccounts',id).get();if(account.exists)await doc('memberAccounts',id).delete();await loadAdminData();showPanel('membersPanel');toast('共用人員資料已刪除','success')}catch(e){console.error(e);notify('人員資料刪除失敗，請確認權限或網路狀態','error')}finally{setPageLoading(false)}}
function chooseMemberImport(){
  pendingMemberImport=null;
  document.querySelectorAll('input[name="memberImportMode"]').forEach(input=>{input.checked=input.value==='partial'});
  $('memberImportModeMask').style.display='grid';
}

function closeMemberImportMode(){$('memberImportModeMask').style.display='none'}

function continueMemberImport(){
  let selected=document.querySelector('input[name="memberImportMode"]:checked');
  memberImportMode=selected?.value==='full'?'full':'partial';
  closeMemberImportMode();
  $('memberImportInput').click();
}

function closeMemberImportReview(){
  $('memberImportReviewMask').style.display='none';
  pendingMemberImport=null;
}

function setMissingMemberSelection(checked){
  document.querySelectorAll('.missingMemberImportCheck').forEach(input=>{input.checked=checked});
  updateMemberImportConfirmLabel();
}

function selectedMissingMemberIds(){
  return [...document.querySelectorAll('.missingMemberImportCheck:checked')].map(input=>input.value);
}

function updateMemberImportConfirmLabel(){
  let count=selectedMissingMemberIds().length,button=$('confirmMemberImportBtn');
  if(button)button.textContent=count?`匯入並停用 ${count} 人`:'匯入名單';
}

function renderMemberImportReview(review){
  let {fileName,mode,addCount,updateCount,errors,missing}=review;
  $('memberImportReviewCaption').textContent=`${fileName}・${mode==='full'?'完整名單核對':'部分名單更新'}`;
  let summary=`<div class="memberImportSummary"><span>可匯入 <b>${review.items.length}</b> 筆</span><span>新增 <b>${addCount}</b> 筆</span><span>更新 <b>${updateCount}</b> 筆</span><span>錯誤 <b>${errors.length}</b> 筆</span></div>`;
  let errorsHtml=errors.length?`<details class="memberImportErrors"><summary>${errors.length} 筆資料有誤，將略過</summary><ul>${errors.map(error=>`<li>${esc(error)}</li>`).join('')}</ul></details>`:'';
  let missingHtml='';
  if(mode==='full'){
    missingHtml=missing.length?`<section class="memberImportMissing"><div class="memberImportMissingHead"><div><h4>本次名單未出現的啟用人員</h4><p>可能為離職、調職或名單遺漏。系統不會自動停用，請確認後自行勾選。</p></div><div class="buttonRow"><button class="btn" type="button" onclick="setMissingMemberSelection(true)">全選</button><button class="btn" type="button" onclick="setMissingMemberSelection(false)">取消全選</button></div></div><div class="memberImportMissingTable"><table><thead><tr><th>停用</th><th>部門</th><th>姓名</th><th>員工編號</th><th>Google 帳號</th></tr></thead><tbody>${missing.map(member=>`<tr><td><input class="missingMemberImportCheck" type="checkbox" value="${attr(member.id)}" onchange="updateMemberImportConfirmLabel()" aria-label="停用 ${attr(member.name||'此人員')}"></td><td>${esc(memberDepartmentName(member))}</td><td><b>${esc(member.name||'')}</b></td><td>${esc(memberEmployeeNo(member))}</td><td>${esc(memberGoogleEmail(member)||'未設定')}</td></tr>`).join('')}</tbody></table></div></section>`:`<div class="memberImportNoMissing">完整名單核對完成，沒有發現本次缺少的啟用人員。</div>`;
  }
  $('memberImportReviewBody').innerHTML=summary+errorsHtml+missingHtml;
  $('memberImportReviewMask').style.display='grid';
  updateMemberImportConfirmLabel();
}

function memberWorkbook(rows,sheetName='人員名單'){let wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(rows,{header:['部門','姓名','員工編號','Google帳號','狀態']});ws['!cols']=[{wch:16},{wch:14},{wch:14},{wch:28},{wch:10}];XLSX.utils.book_append_sheet(wb,ws,sheetName);return wb}

function downloadMemberTemplate(){XLSX.writeFile(memberWorkbook([{'部門':'行政部','姓名':'王小明','員工編號':'7901','Google帳號':'example@gmail.com','狀態':'啟用'}],'匯入範本'),'人員匯入標準範本.xlsx')}

function exportMembers(){let rows=members.map(m=>({'部門':m.department||m.departmentName||'','姓名':m.name||'','員工編號':m.employeeNo||m.empNo||'','Google帳號':memberGoogleEmail(m),'狀態':m.active===false?'停用':'啟用'}));XLSX.writeFile(memberWorkbook(rows),'共用人員名單.xlsx')}

function memberCell(row,names){let keys=Object.keys(row);for(let name of names){let key=keys.find(k=>String(k).replace(/^\uFEFF/,'').trim()===name);if(key!==undefined)return row[key]}return''}

async function importMembers(file){if(!file)return;let result=$('memberImportResult');result.className='memberImportResult';result.style.display='block';result.textContent=`正在讀取 ${file.name}…`;setPageLoading(true,'正在讀取匯入檔…');try{let data=await file.arrayBuffer(),wb=XLSX.read(data,{type:'array'}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});if(!rows.length)throw new Error('檔案內沒有可匯入的資料');let validDepartments=new Set(departments.map(d=>d.name||d.departmentName||d.department||'').filter(Boolean)),existingByNo=new Map(members.map(m=>[String(m.employeeNo||m.empNo||'').trim(),m]).filter(x=>x[0])),seen=new Set(),seenEmails=new Set(),errors=[],items=[];rows.forEach((row,index)=>{let line=index+2,department=String(memberCell(row,['部門'])).trim(),name=String(memberCell(row,['姓名'])).trim(),employeeNo=String(memberCell(row,['員工編號','員編'])).trim(),googleEmail=normalizeEmail(memberCell(row,['Google帳號','Google 帳號','Google Email','Email','電子郵件'])),status=String(memberCell(row,['狀態'])).trim();if(!department||!name||!employeeNo){errors.push(`第 ${line} 列：部門、姓名與員工編號為必填`);return}if(!validDepartments.has(department)){errors.push(`第 ${line} 列：找不到部門「${department}」`);return}if(seen.has(employeeNo)){errors.push(`第 ${line} 列：員工編號 ${employeeNo} 在檔案中重複`);return}seen.add(employeeNo);if(googleEmail&&!/^\S+@\S+\.\S+$/.test(googleEmail)){errors.push(`第 ${line} 列：Google 帳號格式不正確`);return}if(googleEmail&&seenEmails.has(googleEmail)){errors.push(`第 ${line} 列：Google 帳號 ${googleEmail} 在檔案中重複`);return}if(googleEmail)seenEmails.add(googleEmail);let existing=existingByNo.get(employeeNo)||null,owner=members.find(m=>memberGoogleEmail(m)===googleEmail&&m.id!==existing?.id);if(googleEmail&&owner){errors.push(`第 ${line} 列：Google 帳號已由 ${owner.name||'其他人員'} 使用`);return}let active=!['停用','否','false','0','no'].includes(status.toLowerCase());items.push({existing,googleEmail,data:{department,name,employeeNo,active,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}})});let addCount=items.filter(x=>!x.existing).length,updateCount=items.length-addCount,summary=`可匯入 ${items.length} 筆（新增 ${addCount}、更新 ${updateCount}）`+(errors.length?`\n另有 ${errors.length} 筆錯誤將略過：\n${errors.slice(0,8).join('\n')}${errors.length>8?'\n…':''}`:'');result.textContent=summary;if(!items.length){result.className='memberImportResult error';notify(summary,'warn');return}if(!await confirmDialog(summary+'\n\n確定寫入共用人員名單嗎？兩套系統會同步使用。','確認匯入人員')){result.textContent='已取消匯入';return}setPageLoading(true,'正在寫入人員名單…');for(let item of items){let memberId;if(item.existing){memberId=item.existing.id;await doc('members',memberId).set(item.data,{merge:true})}else{item.data.createdAt=firebase.firestore.FieldValue.serverTimestamp();memberId=(await col('members').add(item.data)).id}if(item.googleEmail)await doc('memberAccounts',memberId).set({memberId,email:item.googleEmail,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});else{let account=await doc('memberAccounts',memberId).get();if(account.exists)await doc('memberAccounts',memberId).delete()}}await loadAdminData();showPanel('membersPanel');result=$('memberImportResult');result.className='memberImportResult success';result.textContent=`匯入完成：新增 ${addCount} 筆、更新 ${updateCount} 筆${errors.length?'，略過 '+errors.length+' 筆錯誤':''}`;toast('共用人員名單匯入完成','success')}catch(e){console.error(e);result.className='memberImportResult error';result.textContent='匯入失敗：'+(e.message||e);notify('人員名單匯入失敗','error')}finally{setPageLoading(false)}}

async function importMembersV152(file){
  if(!file)return;
  let result=$('memberImportResult');
  result.className='memberImportResult';
  result.style.display='block';
  result.textContent=`正在讀取 ${file.name}…`;
  setPageLoading(true,'正在讀取匯入檔…');
  try{
    let data=await file.arrayBuffer(),wb=XLSX.read(data,{type:'array'}),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
    if(!rows.length)throw new Error('檔案內沒有可匯入的資料');
    let googleHeaders=['Google帳號','Google 帳號','Google Email','Email','電子郵件'],hasGoogleColumn=Object.keys(rows[0]||{}).some(key=>googleHeaders.includes(String(key).replace(/^\uFEFF/,'').trim())),validDepartments=new Set(departments.map(d=>d.name||d.departmentName||d.department||'').filter(Boolean)),existingByNo=new Map(members.map(m=>[String(m.employeeNo||m.empNo||'').trim(),m]).filter(x=>x[0])),seen=new Set(),uploadedEmployeeNos=new Set(),seenEmails=new Set(),errors=[],items=[];
    rows.forEach((row,index)=>{
      let line=index+2,department=String(memberCell(row,['部門'])).trim(),name=String(memberCell(row,['姓名'])).trim(),employeeNo=String(memberCell(row,['員工編號','員編'])).trim(),googleEmail=normalizeEmail(memberCell(row,['Google帳號','Google 帳號','Google Email','Email','電子郵件'])),status=String(memberCell(row,['狀態'])).trim();
      if(employeeNo)uploadedEmployeeNos.add(employeeNo);
      if(!department||!name||!employeeNo){errors.push(`第 ${line} 列：部門、姓名與員工編號為必填`);return}
      if(!validDepartments.has(department)){errors.push(`第 ${line} 列：找不到部門「${department}」`);return}
      if(seen.has(employeeNo)){errors.push(`第 ${line} 列：員工編號 ${employeeNo} 在檔案中重複`);return}
      seen.add(employeeNo);
      if(googleEmail&&!/^\S+@\S+\.\S+$/.test(googleEmail)){errors.push(`第 ${line} 列：Google 帳號格式不正確`);return}
      if(googleEmail&&seenEmails.has(googleEmail)){errors.push(`第 ${line} 列：Google 帳號 ${googleEmail} 在檔案中重複`);return}
      if(googleEmail)seenEmails.add(googleEmail);
      let existing=existingByNo.get(employeeNo)||null,owner=members.find(m=>memberGoogleEmail(m)===googleEmail&&m.id!==existing?.id);
      if(googleEmail&&owner){errors.push(`第 ${line} 列：Google 帳號已由 ${owner.name||'其他人員'} 使用`);return}
      let active=!['停用','否','false','0','no'].includes(status.toLowerCase());
      items.push({existing,googleEmail,hasGoogleColumn,data:{department,name,employeeNo,active,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}});
    });
    let addCount=items.filter(item=>!item.existing).length,updateCount=items.length-addCount,missing=memberImportMode==='full'?members.filter(member=>member.active!==false&&!uploadedEmployeeNos.has(memberEmployeeNo(member))):[];
    if(!items.length){let summary=`沒有可匯入的資料${errors.length?'，共 '+errors.length+' 筆錯誤':''}`;result.className='memberImportResult error';result.textContent=summary;notify(summary,'warn');return}
    pendingMemberImport={fileName:file.name,mode:memberImportMode,items,errors,missing,addCount,updateCount};
    result.textContent=`已讀取 ${items.length} 筆，請在差異核對視窗確認。`;
    renderMemberImportReview(pendingMemberImport);
  }catch(e){
    console.error(e);result.className='memberImportResult error';result.textContent='匯入失敗：'+(e.message||e);notify('人員名單匯入失敗','error');
  }finally{setPageLoading(false)}
}

async function confirmMemberImport(){
  let review=pendingMemberImport;
  if(!review)return;
  let disableIds=review.mode==='full'?selectedMissingMemberIds():[],button=$('confirmMemberImportBtn');
  button.disabled=true;
  setPageLoading(true,'正在寫入人員名單…');
  try{
    for(let item of review.items){
      let memberId;
      if(item.existing){memberId=item.existing.id;await doc('members',memberId).set(item.data,{merge:true})}
      else{item.data.createdAt=firebase.firestore.FieldValue.serverTimestamp();memberId=(await col('members').add(item.data)).id}
      if(item.hasGoogleColumn){
        if(item.googleEmail)await doc('memberAccounts',memberId).set({memberId,email:item.googleEmail,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
        else{let account=await doc('memberAccounts',memberId).get();if(account.exists)await doc('memberAccounts',memberId).delete()}
      }
    }
    for(let memberId of disableIds){
      let member=members.find(item=>item.id===memberId);
      if(!member||member.active===false)continue;
      await doc('members',memberId).set({active:false,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),deactivatedAt:firebase.firestore.FieldValue.serverTimestamp(),deactivatedByEmail:normalizeEmail(currentUser?.email||''),deactivationReason:'full-roster-import-missing'},{merge:true});
    }
    let {addCount,updateCount,errors}=review;
    closeMemberImportReview();
    await loadAdminData();
    showPanel('membersPanel');
    let result=$('memberImportResult');
    result.className='memberImportResult success';
    result.textContent=`匯入完成：新增 ${addCount} 筆、更新 ${updateCount} 筆${disableIds.length?'、停用 '+disableIds.length+' 人':''}${errors.length?'，略過 '+errors.length+' 筆錯誤':''}`;
    toast(disableIds.length?'人員名單已匯入並完成停用核對':'共用人員名單匯入完成','success');
  }catch(e){
    console.error(e);notify('人員名單寫入失敗，請確認權限或網路狀態','error');
  }finally{setPageLoading(false);button.disabled=false;updateMemberImportConfirmLabel()}
}

importMembers=importMembersV152;

function openResponseEditor(id){let f=activeForm(),r=responses.find(x=>x.id===id);if(!f||!r)return;editingResponseId=id;$('responseEditCaption').textContent=`${r.memberName||'未具名'} ${r.employeeNo?`（${r.employeeNo}）`:''}`;let identity='';if(f.identityMode==='member'){let deps=departments.map(d=>d.name||d.departmentName||d.department||'').filter(Boolean);identity=`<div class="editIdentityGrid"><label>部門<select id="editDepartment" onchange="refreshEditMemberOptions(this.value)"><option value="">請選擇部門</option>${deps.map(d=>`<option value="${attr(d)}" ${d===r.departmentName?'selected':''}>${esc(d)}</option>`).join('')}</select></label><label>姓名<select id="editMember" onchange="refreshEditEmployee()"><option value="">請選擇姓名</option>${editMemberOptions(r.departmentName||'',r.memberId||'')}</select></label><label>員工編號<input id="editEmployeeNo" value="${attr(r.employeeNo||'')}" readonly></label></div>`}let questions=(f.questions||[]).filter(q=>q.type!=='image').map(q=>editQuestionHtml(q,r.answers?.[q.id])).join('');$('responseEditBody').innerHTML=identity+questions;$('responseEditMask').style.display='grid'}


function refreshEditMemberOptions(department){let select=$('editMember');select.innerHTML='<option value="">請選擇姓名</option>'+editMemberOptions(department);$('editEmployeeNo').value=''}

function refreshEditEmployee(){let m=members.find(x=>x.id===$('editMember').value);$('editEmployeeNo').value=m?.employeeNo||m?.empNo||''}

function closeResponseEditor(){$('responseEditMask').style.display='none';editingResponseId='';$('responseEditBody').innerHTML=''}


async function deleteResponse(id){let r=responses.find(x=>x.id===id);if(!r)return;let who=[r.memberName,r.employeeNo].filter(Boolean).join('／')||'這筆未具名回覆';let ok=await confirmDialog(`確定要刪除「${who}」的填寫結果嗎？\n刪除後同仁可以重新填寫。`,'刪除填寫結果',true);if(!ok)return;ok=await confirmDialog(`再次確認：即將永久刪除「${who}」的資料，此動作無法復原。`,'永久刪除填寫結果',true);if(!ok)return;setPageLoading(true,'正在刪除填寫結果…');try{let batch=db.batch();batch.delete(doc('universalResponses',id));if(r.formId&&r.memberId)batch.delete(doc('universalResponseLocks',`${r.formId}__${r.memberId}`));await batch.commit();await loadResponses();renderAdmin();showPanel('resultsPanel');toast('填寫結果與填寫鎖定已刪除，同仁可重新填寫','success')}catch(e){console.error(e);notify('刪除失敗，請確認管理員權限與 Firestore 規則','error')}finally{setPageLoading(false)}}




function cleanSummarySheet(f){let total=responses.length,questions=selectionQuestions(f),maxCols=Math.max(4,...questions.map(q=>questionOptionLabels(q).length+2)),rows=[['問卷選項統計總表'],['問卷名稱',f.title],['總填寫份數',total],['匯出時間',new Date().toLocaleString('zh-TW')],[]],merges=[{s:{r:0,c:0},e:{r:0,c:maxCols-1}}];if(!questions.length){rows.push(['目前沒有可統計的選項題目']);merges.push({s:{r:5,c:0},e:{r:5,c:maxCols-1}})}for(let q of questions){let items=optionCounts(q),isMultiple=q.type==='multiple',answered=answeredResponseCountV168(q),titleRow=rows.length;rows.push([`${q.title}${isMultiple?'（複選）':''}`]);merges.push({s:{r:titleRow,c:0},e:{r:titleRow,c:Math.max(1,items.length+1)}});rows.push(['選項',...items.map(x=>x.label),'合計']);let sum=items.reduce((n,x)=>n+x.count,0);rows.push(['數量',...items.map(x=>x.count),sum]);rows.push(['占實際作答人數',...items.map(x=>percentage(x.count,answered)+'%'),isMultiple?'—':percentage(sum,answered)+'%']);rows.push(['實際作答人數',answered]);rows.push([])}let sheet=XLSX.utils.aoa_to_sheet(rows);sheet['!merges']=merges;sheet['!cols']=[{wch:18},...Array.from({length:maxCols-1},()=>({wch:13}))];return sheet}

function optionRosterNameV170(response,index,memberMode){if(memberMode)return String(response.memberName||response.respondentName||'未具名').trim()||'未具名';return '匿名填答者 '+(index+1)}
function optionSelectionRosterRowsV170(f){var memberMode=formUsesMemberDatabaseV141(f),questions=normalizeQuestions(f.questions||[]).filter(function(q){return ['single','multiple','dropdown'].includes(q.type)}),responseIndex=new Map(responses.map(function(response,index){return [response,index]})),scopes=[{name:'全部',items:responses}],departmentNames=[];if(memberMode){var known=new Set();try{completionData(f).expected.forEach(function(member){var dep=memberDepartmentName(member);if(dep)known.add(dep)})}catch(e){}responses.forEach(function(response){var dep=String(response.departmentName||response.respondentDepartment||'').trim();if(dep)known.add(dep)});var configured=departments.map(function(dep){return dep.name||dep.departmentName||dep.department||''}).filter(Boolean);departmentNames=configured.filter(function(dep){return known.has(dep)}).concat(Array.from(known).filter(function(dep){return !configured.includes(dep)}).sort(function(a,b){return a.localeCompare(b,'zh-Hant')}));departmentNames.forEach(function(dep){scopes.push({name:dep,items:responses.filter(function(response){return String(response.departmentName||response.respondentDepartment||'').trim()===dep})})})}var rows=[];questions.forEach(function(q){var options=optionCounts(q).map(function(item){return item.label});scopes.forEach(function(scope){var answered=scope.items.filter(function(response){return responseQuestionVisibleV171(response,q,f)&&chartAnswerValuesV168(q,response.answers&&response.answers[q.id]).length}),denominator=answered.length;options.forEach(function(option){var selected=answered.filter(function(response){return responseHasOption(response,q,option)}),names=selected.map(function(response){return optionRosterNameV170(response,responseIndex.get(response)||0,memberMode)});rows.push({'題目':q.title,'部門':scope.name,'選項':option,'票數':selected.length,'百分比':percentage(selected.length,denominator)+'%','選擇人員':names.length?names.join('、'):'無人選擇'})})})});return rows}
function optionSelectionRosterSheetV170(f){var rows=optionSelectionRosterRowsV170(f),sheet=rows.length?XLSX.utils.json_to_sheet(rows,{header:['題目','部門','選項','票數','百分比','選擇人員']}):XLSX.utils.aoa_to_sheet([['目前沒有單選、複選或下拉選單題目']]);sheet['!cols']=[{wch:30},{wch:16},{wch:24},{wch:10},{wch:12},{wch:60}];if(rows.length)sheet['!autofilter']={ref:'A1:F'+(rows.length+1)};return sheet}

function departmentCrossSheet(f){let questions=selectionQuestions(f),configured=departments.map(d=>d.name||d.departmentName||d.department||'').filter(Boolean),used=[...new Set(responses.map(r=>r.departmentName||'未填部門'))],depNames=[...configured.filter(d=>used.includes(d)),...used.filter(d=>!configured.includes(d))],maxCols=Math.max(4,...questions.map(q=>questionOptionLabels(q).length+2)),rows=[['部門 × 選項交叉統計'],['問卷名稱',f.title],['總填寫份數',responses.length],[]],merges=[{s:{r:0,c:0},e:{r:0,c:maxCols-1}}];if(f.identityMode!=='member'){rows.push(['此問卷未使用公司人員資料，因此沒有部門交叉統計。']);merges.push({s:{r:4,c:0},e:{r:4,c:maxCols-1}})}else if(!questions.length){rows.push(['目前沒有可統計的選項題目。']);merges.push({s:{r:4,c:0},e:{r:4,c:maxCols-1}})}else for(let q of questions){let options=questionOptionLabels(q),titleRow=rows.length;rows.push([q.title]);merges.push({s:{r:titleRow,c:0},e:{r:titleRow,c:Math.max(1,options.length+1)}});rows.push(['部門',...options,'合計']);for(let dep of depNames){let depResponses=responses.filter(r=>(r.departmentName||'未填部門')===dep),counts=options.map(o=>depResponses.filter(r=>responseHasOption(r,q,o)).length);rows.push([dep,...counts,counts.reduce((n,x)=>n+x,0)])}let totals=options.map(o=>responses.filter(r=>responseHasOption(r,q,o)).length);rows.push(['總計',...totals,totals.reduce((n,x)=>n+x,0)]);rows.push([])}let sheet=XLSX.utils.aoa_to_sheet(rows);sheet['!merges']=merges;sheet['!cols']=[{wch:18},...Array.from({length:maxCols-1},()=>({wch:13}))];return sheet}


async function loadCurrentAssignments(user){if(!user?.email)return[];let email=normalizeEmail(user.email);try{if(isSystemAdmin){let all=await col('universalFormManagers').get();return all.docs.map(x=>({id:x.id,...x.data()})).filter(x=>normalizeEmail(x.email)===email)}let q=await col('universalFormManagers').where('email','==',email).get();return q.docs.map(x=>({id:x.id,...x.data()}))}catch(e){console.warn('讀取問卷指派失敗，請發布最新 Firestore 規則',e);return[]}}

function assignmentFor(formId){return formAssignments.find(x=>x.formId===formId&&x.enabled!==false)||null}

function canViewForm(formId){let f=forms.find(x=>x.id===formId);return isSystemAdmin||isCreatedByCurrentUser(f)||!!assignmentFor(formId)}

function canManageForm(formId){let f=forms.find(x=>x.id===formId),a=assignmentFor(formId);return isSystemAdmin||isCreatedByCurrentUser(f)||!!(a&&a.role==='manager')}

function accessibleForms(includeDeleted=false){return forms.filter(f=>(includeDeleted||f.deleted!==true)&&canViewForm(f.id))}

function formCreatedByEmail(f){return normalizeEmail(f?.createdByEmail||f?.creatorEmail||f?.ownerEmail||'')}

function isCreatedByCurrentUser(f){let email=normalizeEmail(currentUser?.email||'');return !!email&&formCreatedByEmail(f)===email}

function formCreatorLabel(f){let email=formCreatedByEmail(f),member=findMemberByGoogleEmail(email);return memberDisplayName(member)||f?.createdByName||email||'未紀錄'}
function formCreatorMember(f){
  var email=formCreatedByEmail(f),byEmail=findMemberByGoogleEmail(email);
  if(byEmail)return byEmail;
  var recorded=String((f&&f.createdByName)||'').replace(/\s+/g,' ').trim();
  if(!recorded)return null;
  return members.find(function(member){
    var full=memberDisplayName(member).replace(/\s+/g,' ').trim(),name=String(member.name||'').trim();
    return full===recorded||name===recorded||(name&&recorded.endsWith(' '+name));
  })||null;
}
function formCreatorContact(f){
  var member=formCreatorMember(f),label=memberDisplayName(member)||String((f&&f.createdByName)||'').trim()||'問卷建立者',employeeNo=memberEmployeeNo(member);
  return label+(employeeNo?'（分機0'+employeeNo+'）':'');
}
function formCorrectionContactText(f){return '如需更正，請洽'+formCreatorContact(f)+'。'}

function creatorSelectOptions(currentEmail=''){let current=normalizeEmail(currentEmail);return members.filter(m=>m.active!==false&&memberGoogleEmail(m)).map(m=>{let email=memberGoogleEmail(m);return `<option value="${attr(email)}" ${email===current?'selected':''}>${esc(memberDisplayName(m)||m.name||'未命名人員')}</option>`}).join('')}


function percentage(count,total){count=Number(count);total=Number(total);if(!Number.isFinite(count)||!Number.isFinite(total)||count<=0||total<=0)return 0;return Math.min(100,Math.round(count*1000/total)/10)}
async function saveMember(){let department=$('memberDepartment').value,name=$('memberName').value.trim(),employeeNo=$('memberEmployeeNo').value.trim(),googleEmail=normalizeEmail($('memberGoogleEmail')?.value||'');if(!department||!name||!employeeNo)return notify('請完整填寫部門、姓名與員工編號');if(googleEmail&&!/^\S+@\S+\.\S+$/.test(googleEmail))return notify('請輸入有效的 Google 帳號');let duplicate=members.find(m=>String(m.employeeNo||m.empNo||'').trim()===employeeNo&&m.id!==editingMemberId);if(duplicate)return notify(`員工編號 ${employeeNo} 已由 ${duplicate.name||'其他人員'} 使用`);let duplicateGoogle=members.find(m=>memberGoogleEmail(m)===googleEmail&&m.id!==editingMemberId);if(googleEmail&&duplicateGoogle)return notify(`Google 帳號已由 ${duplicateGoogle.name||'其他人員'} 使用`);let data={department,name,employeeNo,active:$('memberActive').value==='true',updatedAt:firebase.firestore.FieldValue.serverTimestamp()},btn=$('saveMemberBtn');btn.disabled=true;btn.textContent='儲存中…';setPageLoading(true,'正在儲存人員資料…');try{let memberId=editingMemberId;if(memberEditMode==='new'){data.createdAt=firebase.firestore.FieldValue.serverTimestamp();memberId=(await col('members').add(data)).id}else await doc('members',memberId).set(data,{merge:true});if(googleEmail)await doc('memberAccounts',memberId).set({memberId,email:googleEmail,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});else{let account=await doc('memberAccounts',memberId).get();if(account.exists)await doc('memberAccounts',memberId).delete()}let wasNew=memberEditMode==='new';cancelMemberEdit();await loadAdminData();showPanel('membersPanel');toast(wasNew?'人員已新增，兩套系統將同步使用':'人員資料已更新','success')}catch(e){console.error(e);notify('人員資料儲存失敗，請確認權限或網路狀態','error')}finally{setPageLoading(false);btn.disabled=false;btn.textContent=memberEditMode==='edit'?'儲存變更':'新增人員'}}
async function toggleMember(id,active){let m=members.find(x=>x.id===id);if(!m)return;if(!active&&!await confirmDialog(`確定停用 ${m.name||'這位人員'}？停用後兩套調查系統的前台都不會顯示。`,'停用人員',true))return;setPageLoading(true,'正在更新人員狀態…');try{await doc('members',id).set({active,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});await loadAdminData();showPanel('membersPanel');toast(active?'人員已啟用':'人員已停用','success')}catch(e){console.error(e);notify('人員狀態更新失敗','error')}finally{setPageLoading(false)}}
async function loadPublicData(){let[fs,ds,ms]=await Promise.all([col('universalForms').get(),col('departments').get(),col('members').get()]);forms=fs.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));departments=ds.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(a.sortOrder??999)-(b.sortOrder??999));let depOrder=new Map(departments.map((d,i)=>[d.name||d.departmentName||d.department||'',i]));members=ms.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>{let ad=a.department||a.departmentName||'',bd=b.department||b.departmentName||'',diff=(depOrder.get(ad)??9999)-(depOrder.get(bd)??9999);if(diff)return diff;return String(a.employeeNo||a.empNo||'').localeCompare(String(b.employeeNo||b.empNo||''),'zh-Hant',{numeric:true})||String(a.name||'').localeCompare(String(b.name||''),'zh-Hant')});let publicForms=forms.filter(f=>f.deleted!==true),route=formRouteId(),adminId=adminRouteId(),allowed=isAdmin?accessibleForms():[];if(adminId&&allowed.some(f=>f.id===adminId))activeFormId=adminId;else if(route&&publicForms.some(f=>f.id===route))activeFormId=route;else if(isAdmin&&allowed.length&&!allowed.some(f=>f.id===activeFormId))activeFormId=allowed[0].id;else if(!isAdmin)activeFormId=''}
async function loadAdminData(){await loadPublicData();await loadMemberAccounts();if(isSystemAdmin&&!submissionLocksPrepared)await prepareSubmissionLocks();await loadResponses();renderAdmin()}
async function refreshAdminView(){let btn=$('refreshAdminBtn');if(btn)btn.disabled=true;setPageLoading(true,'正在重新整理資料…');try{await loadAdminData();toast('資料已重新整理','success')}catch(e){console.error(e);notify('重新整理失敗，請稍後再試','error')}finally{setPageLoading(false);if(btn)btn.disabled=false}}
async function loadResponses(){if(!isAdmin||!activeFormId||!canViewForm(activeFormId)){responses=[];return}try{let q=await col('universalResponses').where('formId','==',activeFormId).get();responses=q.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(b.submittedAt?.seconds||0)-(a.submittedAt?.seconds||0))}catch(e){console.warn(e);responses=[]}}
function applyRoute(){if(!syncInitialBootState()){front.style.display='none';admin.style.display='none';loginMask.style.display='none';return}let wantsAdmin=location.hash==='#admin'||location.hash.startsWith('#admin/');if(wantsAdmin&&isAdmin){front.style.display='none';admin.style.display='block';loginMask.style.display='none';let routeId=adminRouteId();if(routeId&&canViewForm(routeId)&&routeId!==activeFormId){activeFormId=routeId;loadResponses().then(renderAdmin);return}renderAdmin();return}admin.style.display='none';front.style.display='block';loginMask.style.display=wantsAdmin&&!isAdmin?'grid':'none';renderFront();if(loginPurpose==='response'&&currentUser)setTimeout(showMyResponse,0)}
function myResponseButton(f){return f?.identityMode==='member'?'<button class="ghostBtn" type="button" onclick="startMyResponseView()">查看我的填寫結果</button>':''}
function frontPreviewBannerHtml(){if(!isAdmin)return'';let label=adminDisplayName()||currentUser?.email||'管理員';return `<div class="frontPreviewBanner"><div><b>管理員預覽模式</b><span>${esc(label)}</span></div><div class="frontPreviewActions"><button class="btn primary" type="button" onclick="openAdmin()">返回管理後台</button><button class="btn" type="button" onclick="logout()">登出</button></div></div>`}

async function startMyResponseView(){loginPurpose='response';loginMsg.textContent='';if(!currentUser){loginMask.style.display='grid';return}await loadMemberAccounts();await showMyResponse()}
async function showMyResponse(){let box=$('myResponseBox'),f=activeForm();if(!box||!f)return;let member=findMemberByGoogleEmail(currentUser?.email||'');if(!member){box.innerHTML='<div class="notice myResponseCard">找不到此 Google 帳號對應的人員資料，請確認是否使用公司行事曆同一組帳號。</div>';return}box.innerHTML='<div class="notice myResponseCard">正在讀取您的填寫內容…</div>';try{let snap=await doc('universalResponses',`${f.id}__${member.id}`).get();if(!snap.exists){box.innerHTML='<div class="notice myResponseCard">目前查無您的填寫紀錄。</div>';return}let r={id:snap.id,...snap.data()},questions=(f.questions||[]).filter(q=>q.type!=='image'),answers=questions.map(q=>`<div class="myAnswerItem"><b>${esc(q.title||'未命名題目')}</b><p>${esc(answerText(q,r)||'未填')}</p></div>`).join('');box.innerHTML=`<section class="notice myResponseCard"><h2>我的填寫結果</h2><p class="myResponseMeta"><span>${esc(r.departmentName||member.department||'')}</span><span>${esc(r.memberName||member.name||'')}</span><span>${esc(r.employeeNo||member.employeeNo||member.empNo||'')}</span><span>${esc(r.submittedAtText||'')}</span></p><div class="myAnswerList">${answers||'<div class="myAnswerItem"><p>此問卷沒有可顯示的題目。</p></div>'}</div></section>`}catch(e){console.error(e);box.innerHTML='<div class="notice myResponseCard">讀取失敗，請確認 Firestore 規則已部署 v1.27 完整合併版。</div>'}}

function renderShareMemberOptions(){let select=$('managerEmail');if(!select)return;let current=select.value,creatorEmail=formCreatedByEmail(activeForm()),options=members.filter(m=>m.active!==false&&memberGoogleEmail(m)&&memberGoogleEmail(m)!==creatorEmail).map(m=>({email:memberGoogleEmail(m),label:memberDisplayName(m)||m.name||m.id}));select.innerHTML='<option value="">請選擇成員</option>'+options.map(x=>`<option value="${attr(x.email)}">${esc(x.label)}</option>`).join('');select.value=options.some(x=>x.email===current)?current:''}
function managerPersonLabel(email){let member=findMemberByGoogleEmail(email),label=memberDisplayName(member);return label||'未對應人員'}
function adminDisplayName(){let member=findMemberByGoogleEmail(currentUser?.email||'');return memberDisplayName(member)||currentUser?.displayName||currentUser?.email||''}
function ensureAdminExtensions(){if(!$('permissionsPanel')){$('resultsPanel')?.insertAdjacentHTML('beforebegin',`<section id="permissionsPanel" class="panel"><div class="card"><div class="sectionHead"><div><h2>問卷權限管理</h2><p>針對目前選取的問卷分享管理或檢視權限。問卷管理者可編輯問卷與回覆，檢視者只能查看結果與匯出。</p></div></div><div class="permissionForm flatPermissionForm"><label>分享成員<select id="managerEmail"><option value="">請選擇成員</option></select></label><label>權限<select id="managerRole"><option value="manager">問卷管理者</option><option value="viewer">結果檢視者</option></select></label><button class="btn primary" onclick="saveFormManager()">新增／更新權限</button><p class="questionHelp permissionHelp">Google 帳號係同仁部門行事曆使用之帳號；如帳號異動，請洽系統管理員修正後方可登入。</p></div><div id="formManagersTable"></div></div></section>`)}renderShareMemberOptions()}
function renderAdmin(){ensureAdminExtensions();let list=accessibleForms();if(list.length&&!list.some(f=>f.id===activeFormId))activeFormId=list[0].id;activeFormSelect.innerHTML='<option value="">請選擇問卷</option>'+list.map(f=>`<option value="${attr(f.id)}" ${f.id===activeFormId?'selected':''}>${esc(f.title)}</option>`).join('');let f=activeForm();activeFormLabel.textContent=f?f.title:'尚未選擇問卷';if($('formCount'))$('formCount').textContent=list.length;if($('currentFormName'))$('currentFormName').textContent=f?.title||'—';if($('responseCount'))$('responseCount').textContent=responses.length;renderDashboard();renderFormsTable();if(isSystemAdmin){renderMemberPanel();renderTrash()}if($('permissionsPanel')?.classList.contains('active'))loadFormManagers();renderResults();updateRoleUi()}
function setFormSection(key){activeFormSection=key;renderFormsTable()}
function renderFormsTable(){let sections=formsBySection();if(!sections.some(x=>x.key===activeFormSection))activeFormSection=sections[0]?.key||'mine';let current=sections.find(x=>x.key===activeFormSection)||sections[0];formsTable.innerHTML=`<div class="surveyTabs">${sections.map(section=>`<button class="${section.key===activeFormSection?'active':''}" onclick="setFormSection('${attr(section.key)}')">${esc(section.title)} <span>${section.items.length}</span></button>`).join('')}</div><p class="surveyTabHint">${esc(current?.hint||'')}</p>${table(['問卷','狀態','我的角色','建立者','問卷期間','填寫','操作'],(current?.items||[]).map(formRowHtml),'尚無資料')}`}
async function selectForm(id){if(!id||!canViewForm(id))return;activeFormId=id;history.replaceState(null,'','#admin/'+encodeURIComponent(id));await loadResponses();renderAdmin()}
async function openResults(id){await selectForm(id);showPanel('resultsPanel')}
async function openPermissions(id){await selectForm(id);showPanel('permissionsPanel');await loadFormManagers()}
function closeCreatorDialog(value=''){let mask=$('creatorDialogMask');if(!mask)return;let resolver=mask._resolve;mask.remove();if(resolver)resolver(value)}
function creatorDialog(f){return new Promise(resolve=>{let current=formCreatedByEmail(f);document.body.insertAdjacentHTML('beforeend',`<div id="creatorDialogMask" class="modalMask creatorDialogMask" style="display:grid"><div class="dialogCard" role="dialog" aria-modal="true"><div class="modalHeader"><h3>變更問卷建立者</h3><button class="modalClose" type="button" onclick="closeCreatorDialog('')">×</button></div><p class="dialogMessage">問卷：${esc(f.title||'未命名問卷')}</p><label class="dialogInputWrap">建立者<select id="creatorEmailSelect"><option value="">請選擇建立者</option>${creatorSelectOptions(current)}</select></label><div class="modalActions"><button class="btn" type="button" onclick="closeCreatorDialog('')">取消</button><button class="btn primary" type="button" onclick="closeCreatorDialog(document.getElementById('creatorEmailSelect').value)">儲存</button></div></div></div>`);$('creatorDialogMask')._resolve=resolve})}
async function changeFormCreator(id){if(!isSystemAdmin)return toast('只有系統管理員可以變更建立者','error');let f=forms.find(x=>x.id===id);if(!f)return;let email=normalizeEmail(await creatorDialog(f));if(!email)return;let member=findMemberByGoogleEmail(email);if(!member)return toast('請從人員名單選擇建立者','warn');setPageLoading(true,'正在更新問卷建立者…');try{await doc('universalForms',id).set({createdByEmail:email,createdByName:memberDisplayName(member),creatorEmail:firebase.firestore.FieldValue.delete(),ownerEmail:firebase.firestore.FieldValue.delete(),updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedByEmail:normalizeEmail(currentUser?.email||'')},{merge:true});let managerId=managerDocumentId(id,email),managerDoc=await doc('universalFormManagers',managerId).get();if(managerDoc.exists)await doc('universalFormManagers',managerId).delete();await loadAdminData();toast('問卷建立者已更新','success')}catch(e){console.error(e);notify('建立者更新失敗，請確認權限或網路狀態','error')}finally{setPageLoading(false)}}
async function openMissingList(button){var form=activeForm();if(!form||!formUsesMemberDatabaseV141(form))return notify('目前問卷無法使用填寫追蹤','warn');await showPanel('progressPanel',button);renderProgressPanelV171()}
async function copyAdminLink(id=activeFormId){if(!id)return notify('請先選擇問卷');let url=location.href.split('#')[0]+'#admin/'+encodeURIComponent(id);if(navigator.clipboard?.writeText)try{await navigator.clipboard.writeText(url);toast('專屬後台網址已複製','success');return}catch(e){}await showCopyDialog('複製專屬後台網址',url)}


async function restoreForm(id){if(!isSystemAdmin)return;await doc('universalForms',id).update({deleted:false,deletedAt:firebase.firestore.FieldValue.delete(),deletedBy:firebase.firestore.FieldValue.delete()});await loadAdminData();toast('問卷已復原')}
async function deleteSnapshotInChunks(snapshot){let docs=snapshot.docs;for(let i=0;i<docs.length;i+=400){let batch=db.batch();docs.slice(i,i+400).forEach(x=>batch.delete(x.ref));await batch.commit()}}
async function permanentlyDeleteForm(id){if(!isSystemAdmin)return notify('只有系統管理員可以永久刪除問卷','error');let f=forms.find(x=>x.id===id);if(!f)return;setPageLoading(true,'正在讀取關聯資料…');let responseSnap;try{responseSnap=await col('universalResponses').where('formId','==',id).get()}finally{setPageLoading(false)}let typed=await inputConfirmDialog({title:'永久刪除問卷',message:`永久刪除後無法復原。\n問卷：${f.title}\n回覆：${responseSnap.size} 份`,requiredText:f.title,danger:true});if(typed===null)return;setPageLoading(true,'正在永久刪除問卷與關聯資料…');try{let[lockSnap,managerSnap]=await Promise.all([col('universalResponseLocks').where('formId','==',id).get(),col('universalFormManagers').where('formId','==',id).get()]);await deleteSnapshotInChunks(responseSnap);await deleteSnapshotInChunks(lockSnap);await deleteSnapshotInChunks(managerSnap);await doc('universalForms',id).delete();await loadAdminData();toast('問卷及其回覆已永久刪除','success')}catch(e){console.error(e);notify('永久刪除失敗，請確認權限或網路狀態','error')}finally{setPageLoading(false)}}


async function loadFormManagers(){let requestedFormId=activeFormId;if(!requestedFormId||!canManageForm(requestedFormId))return;$('formManagersTable').innerHTML='<p class="questionHelp loadingBox">讀取中…</p>';try{let q=await col('universalFormManagers').where('formId','==',requestedFormId).get();if(activeFormId!==requestedFormId)return;let creatorEmail=formCreatedByEmail(activeForm());formManagers=q.docs.map(x=>({id:x.id,...x.data()})).filter(x=>normalizeEmail(x.email)!==creatorEmail).sort((a,b)=>String(a.email).localeCompare(String(b.email)));renderShareMemberOptions();renderFormManagers()}catch(e){if(activeFormId!==requestedFormId)return;console.error(e);$('formManagersTable').innerHTML='<p class="errorText">無法讀取權限資料，請確認已發布 v1.27 Firestore 規則。</p>'}}
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
  {id:'sakura',label:'少女粉',a:'#b95778',b:'#e59aaa',accent:'#a94d6b'},
  {id:'oceanBlue',label:'海洋藍',a:'#155e75',b:'#dff5fb',accent:'#0e7490'},
  {id:'forestGreen',label:'森林綠',a:'#166534',b:'#eaf7ed',accent:'#15803d'},
  {id:'sunnyOrange',label:'暖陽橘',a:'#c2410c',b:'#fff1e6',accent:'#ea580c'}
];
var QUESTION_TYPES_V132=[['short','簡答'],['long','長文'],['single','單選'],['multiple','複選'],['dropdown','下拉選單'],['department','部門選單'],['linearScale','線性刻度'],['rating','星等評分'],['time','時間'],['datetime','日期與時間'],['matrixSingle','單選矩陣'],['matrixMultiple','複選矩陣'],['file','檔案上傳'],['image','圖片／說明']];
var MATRIX_TYPES_V132=['matrixSingle','matrixMultiple'];
function formTheme(f){var v=(f&&f.theme)||'appleWhite';return FORM_THEMES_V132.some(function(t){return t.id===v})?v:'appleWhite'}
function questionDescription(q){return String((q&&q.description)!==undefined?q.description:((q&&q.help)||''))}
function splitLines(value){return String(value||'').split(/\r?\n/).map(function(x){return x.trim()}).filter(Boolean)}
function uniqueLines(value){var seen={},dupes=[],items=[];splitLines(value).forEach(function(x){var k=x.toLowerCase();if(seen[k])dupes.push(x);else{seen[k]=true;items.push(x)}});if(dupes.length)toast('已略過重複項目：'+dupes.join('、'),'warn');return items}
function normalizeQuestionVisibilityV171(value){value=value&&typeof value==='object'?value:{};return{enabled:value.enabled===true,sourceQuestionId:String(value.sourceQuestionId||''),operator:value.operator==='isNotAnyOf'?'isNotAnyOf':'isAnyOf',values:Array.from(new Set((Array.isArray(value.values)?value.values:[]).map(function(item){return String(item)}).filter(Boolean)))}}
function normalizeQuestion(q){q=q||{};var next={id:q.id||('q_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)),type:q.type||'short',title:q.title||'',description:questionDescription(q),help:questionDescription(q),required:!!q.required,options:Array.isArray(q.options)?q.options:[],rows:Array.isArray(q.rows)?q.rows:[],columns:Array.isArray(q.columns)?q.columns:[],imageUrl:q.imageUrl||'',imageStoragePath:q.imageStoragePath||'',settings:Object.assign({},q.settings||{}),validation:Object.assign({},q.validation||{}),visibility:normalizeQuestionVisibilityV171(q.visibility)};if(next.type==='linearScale')next.settings={min:Number(next.settings.min!=null?next.settings.min:1),max:Number(next.settings.max!=null?next.settings.max:5),minLabel:next.settings.minLabel||'',maxLabel:next.settings.maxLabel||''};if(next.type==='rating')next.settings={max:Number(next.settings.max||5),minLabel:next.settings.minLabel||'',maxLabel:next.settings.maxLabel||''};if(next.type==='file')next.settings={fileKind:['all','image','document'].includes(next.settings.fileKind)?next.settings.fileKind:'all',multiple:next.settings.multiple===true,maxFiles:Math.max(1,Math.min(5,Number(next.settings.maxFiles||1)))};if(MATRIX_TYPES_V132.includes(next.type)){if(!next.rows.length)next.rows=['項目一'];if(!next.columns.length)next.columns=['選項一']}return next}
function normalizeQuestions(list){return (Array.isArray(list)?list:[]).map(normalizeQuestion)}
function newQuestion(type){type=type||'short';var q=normalizeQuestion({type:type,title:'',required:false,description:'',imageUrl:'',imageStoragePath:''});if(['single','multiple','dropdown'].includes(type))q.options=['選項一'];if(type==='linearScale')q.settings={min:1,max:5,minLabel:'非常不滿意',maxLabel:'非常滿意'};if(type==='rating')q.settings={max:5,minLabel:'',maxLabel:''};if(type==='file')q.settings={fileKind:'all',multiple:false,maxFiles:1};if(MATRIX_TYPES_V132.includes(type)){q.rows=['項目一','項目二'];q.columns=['非常不滿意','不滿意','普通','滿意','非常滿意']}return q}
function answerEmpty(value){return Array.isArray(value)?!value.length:(value&&typeof value==='object'?!Object.keys(value).length:!String(value==null?'':value).trim())}
function answerText(q,r){q=normalizeQuestion(q);var v=r.answers&&r.answers[q.id];if(q.type==='file')return responseFilesV154(v).map(function(file){return file.name}).join('、');if(Array.isArray(v))return v.join('、');if(v&&typeof v==='object')return Object.keys(v).map(function(k){var val=v[k];return k+'：'+(Array.isArray(val)?val.join('、'):val)}).join('；');return String(v==null?'':v)}
function submissionMethodLabel(r){return r.submissionMethod==='assisted'?'管理員協助填寫':'本人填寫'}
function submitterLabel(r){return r.submissionMethod==='assisted'?(r.submittedByName||r.submittedByEmail||'管理員'):(r.memberName||r.respondentName||'本人')}
function renderThemeChoices(selected){var target=$('themeChoices'),hidden=$('formTheme');if(!target||!hidden)return;hidden.value=formTheme({theme:selected});target.innerHTML=FORM_THEMES_V132.map(function(t){return '<button type="button" class="themeCard '+(hidden.value===t.id?'active':'')+'" onclick="selectTheme(\''+attr(t.id)+'\')"><span class="themeSwatch" style="--a:'+attr(t.a)+';--b:'+attr(t.b)+';--accent:'+attr(t.accent)+'"></span><b>'+esc(t.label)+'</b></button>'}).join('')}
function selectTheme(id){var hidden=$('formTheme');if(hidden)hidden.value=formTheme({theme:id});renderThemeChoices(id);formDirty=true}
function setQuestionSettings(i,key,value){draftQuestions[i]=normalizeQuestion(draftQuestions[i]);draftQuestions[i].settings[key]=value}
function setQuestionValidation(i,key,value){draftQuestions[i]=normalizeQuestion(draftQuestions[i]);draftQuestions[i].validation[key]=value}
function updateQuestion(i,key,value){draftQuestions[i]=normalizeQuestion(draftQuestions[i]);if(['options','rows','columns'].includes(key))draftQuestions[i][key]=splitLines(value);else if(key==='description'||key==='help'){draftQuestions[i].description=value;draftQuestions[i].help=value}else draftQuestions[i][key]=value}
function conditionalSourceQuestionsV171(index){return normalizeQuestions(draftQuestions).slice(0,index).filter(function(q){return ['single','multiple','dropdown','department'].includes(q.type)})}
function conditionalSourceOptionsV171(source){if(!source)return[];return source.type==='department'?departments.map(function(dep){return dep.name||dep.departmentName||dep.department||''}).filter(Boolean):(source.options||[]).map(String).filter(Boolean)}
function setQuestionVisibilityEnabledV171(index,enabled){var q=draftQuestions[index]=normalizeQuestion(draftQuestions[index]),eligible=conditionalSourceQuestionsV171(index);q.visibility.enabled=!!enabled;if(enabled&&!q.visibility.sourceQuestionId&&eligible.length)q.visibility.sourceQuestionId=eligible[eligible.length-1].id;if(!enabled){q.visibility.sourceQuestionId='';q.visibility.values=[]}markFormDirty();renderQuestionEditor()}
function setQuestionVisibilitySourceV171(index,sourceId){var q=draftQuestions[index]=normalizeQuestion(draftQuestions[index]);q.visibility.sourceQuestionId=String(sourceId||'');q.visibility.values=[];markFormDirty();renderQuestionEditor()}
function setQuestionVisibilityOperatorV171(index,operator){var q=draftQuestions[index]=normalizeQuestion(draftQuestions[index]);q.visibility.operator=operator==='isNotAnyOf'?'isNotAnyOf':'isAnyOf';markFormDirty()}
function toggleQuestionVisibilityValueV171(index,value,checked){var q=draftQuestions[index]=normalizeQuestion(draftQuestions[index]),values=new Set(q.visibility.values.map(String));if(checked)values.add(String(value));else values.delete(String(value));q.visibility.values=Array.from(values);markFormDirty()}
function toggleQuestionVisibilityValueByIndexV171(index,optionIndex,checked){var q=normalizeQuestion(draftQuestions[index]),source=normalizeQuestions(draftQuestions).find(function(item){return item.id===q.visibility.sourceQuestionId}),options=conditionalSourceOptionsV171(source),value=options[Number(optionIndex)];if(value!=null)toggleQuestionVisibilityValueV171(index,value,checked)}
function applyBulkOptions(i,target){target=target||'options';var items=uniqueLines(($('bulk_'+target+'_'+i)||{}).value||'');if(!items.length)return toast('請先貼上項目內容','warn');draftQuestions[i]=normalizeQuestion(draftQuestions[i]);draftQuestions[i][target]=items;renderQuestionEditor();toast('已批次建立 '+items.length+' 個項目','success')}
function startNewForm(){resetPendingImages();resetReferenceFilesV156([]);setDescriptionEditorV156({});formDirty=false;editMode='new';editingId='';draftQuestions=[];$('editorHeading').textContent='新增問卷';$('editorMode').textContent='新增模式';$('saveFormBtn').textContent='建立問卷';$('formTitle').value='';$('formDeadline').value='';$('formState').value='draft';$('formImageUrl').value='';setHeaderImageSourceMode('upload');previewHeaderImage();$('identityMode').value='member';renderThemeChoices('appleWhite');renderTargetDepartments([]);renderQuestionEditor()}
function editForm(id){var f=forms.find(function(x){return x.id===id});if(!f)return;resetPendingImages();resetReferenceFilesV156(f.referenceFiles||[]);setDescriptionEditorV156(f);formDirty=false;editMode='edit';editingId=id;draftQuestions=normalizeQuestions(JSON.parse(JSON.stringify(f.questions||[])));$('editorHeading').textContent='編輯問卷：'+f.title;$('editorMode').textContent='編輯模式';$('saveFormBtn').textContent='儲存變更';$('formTitle').value=f.title||'';$('formDeadline').value=(f.deadline||'').slice(0,16);$('formState').value=f.state||'draft';$('formImageUrl').value=f.imageUrl||'';setHeaderImageSourceMode(f.imageStoragePath||!f.imageUrl?'upload':'url');previewHeaderImage();$('identityMode').value=f.identityMode||'none';renderThemeChoices(formTheme(f));renderTargetDepartments(f.targetDepartments||[]);renderQuestionEditor();showPanel('editorPanel')}
function formQuestionsValid(){var questions=normalizeQuestions(draftQuestions);for(var index=0;index<questions.length;index++){var q=questions[index];if(!q.title.trim())return'每一題都需要題目名稱';if(['single','multiple','dropdown'].includes(q.type)&&!(q.options||[]).length)return'選擇題至少需要一個選項';if(MATRIX_TYPES_V132.includes(q.type)&&(!(q.rows||[]).length||!(q.columns||[]).length))return'矩陣題至少需要列項目與欄選項';if(q.type==='linearScale'&&Number(q.settings.max)<=Number(q.settings.min))return'線性刻度的結束數字必須大於起始數字';if(q.visibility.enabled){var sourceIndex=questions.findIndex(function(item){return item.id===q.visibility.sourceQuestionId}),source=questions[sourceIndex];if(sourceIndex<0||sourceIndex>=index||!['single','multiple','dropdown','department'].includes((source||{}).type))return'「'+q.title+'」的顯示條件必須選擇前面的選項題';if(!q.visibility.values.length)return'「'+q.title+'」的顯示條件至少需要選擇一個答案'}}return''}
function validateTextAnswer(q,value){var v=String(value==null?'':value),rule=q.validation||{},type=rule.type||'';if(!type)return'';var n=Number(v),min=Number(rule.min),max=Number(rule.max),msg=rule.message||'回答格式不符合規則';if(type==='number'&&v&&Number.isNaN(n))return msg;if(type==='integer'&&v&&!Number.isInteger(n))return msg;if(type==='email'&&v&&!/^\S+@\S+\.\S+$/.test(v))return msg;if(type==='phone'&&v&&!/^[0-9+\-#()\s]{6,20}$/.test(v))return msg;if(type==='minLength'&&v.length<min)return msg;if(type==='maxLength'&&v.length>max)return msg;if(type==='gt'&&!(n>min))return msg;if(type==='lt'&&!(n<max))return msg;if(type==='range'&&(Number.isNaN(n)||n<min||n>max))return msg;if(type==='regex'&&rule.pattern){try{if(!new RegExp(rule.pattern).test(v))return msg}catch(e){return'自訂正規表示式格式錯誤'}}return''}
function responseFilesV154(value){var list=Array.isArray(value)?value:(value&&typeof value==='object'?[value]:[]);return list.filter(function(file){return file&&file.path&&file.name}).map(function(file){return {name:String(file.name),path:String(file.path),size:Number(file.size||0),type:String(file.type||'application/octet-stream')}})}
function fileAcceptV154(q){var kind=normalizeQuestion(q).settings.fileKind;if(kind==='image')return'image/jpeg,image/png,image/webp,image/*';if(kind==='document')return DOCUMENT_FILE_ACCEPT;return''}
function fileKindHelpV155(q){var kind=normalizeQuestion(q).settings.fileKind;if(kind==='image')return'支援 JPG、PNG、WebP 圖片';if(kind==='document')return'支援 PDF、Word、Excel、PowerPoint、TXT、CSV、ZIP、RAR、7Z';return'支援照片、文件與其他檔案'}
function fileSizeTextV154(size){var mb=Number(size||0)/1024/1024;return mb>=1?mb.toFixed(mb>=10?0:1)+' MB':Math.max(1,Math.round(Number(size||0)/1024))+' KB'}
function fileExtensionV155(file){var match=String((file&&file.name)||'').toLowerCase().match(/\.([a-z0-9]+)$/);return match?match[1]:''}
function validateResponseFileV154(file,q){if(!file)return'請先選擇檔案';if(file.size>FILE_MAX_BYTES)return file.name+' 超過 10 MB';var kind=normalizeQuestion(q).settings.fileKind,type=String(file.type||'').toLowerCase(),extension=fileExtensionV155(file);if(kind==='image'&&!type.startsWith('image/')&&!['jpg','jpeg','png','webp'].includes(extension))return file.name+' 不是支援的照片格式';if(kind==='document'&&!DOCUMENT_FILE_EXTENSIONS.includes(extension))return file.name+' 不屬於支援的文件或壓縮檔';return''}
function handleResponseFileSelectionV155(input){if(!input)return;var f=activeForm(),questionId=String(input.dataset.questionId||''),q=normalizeQuestions((f&&f.questions)||[]).find(function(item){return String(item.id)===questionId}),files=Array.from(input.files||[]),status=document.getElementById(input.dataset.statusId||'');if(!q)return;var errors=files.map(function(file){return validateResponseFileV154(file,q)}).filter(Boolean);if(errors.length){input.value='';if(status)status.textContent=fileKindHelpV155(q)+'；每個檔案上限 10 MB';return notify(errors[0],'warn')}if(status)status.textContent=files.length?(files.length===1?'已選擇：'+files[0].name:'已選擇 '+files.length+' 個檔案：'+files.map(function(file){return file.name}).join('、')):(fileKindHelpV155(q)+'；每個檔案上限 10 MB')}
async function openResponseFileV154(path){if(!path)return;setPageLoading(true,'正在取得檔案');try{var url=await storage.ref().child(path).getDownloadURL();window.open(url,'_blank','noopener')}catch(e){console.error(e);notify('無法開啟檔案，請確認登入身分與 Storage 規則','error')}finally{setPageLoading(false)}}
function responseFileListHtmlV154(value,removable,name){var files=responseFilesV154(value);if(!files.length)return'';return '<div class="storedFileListV154">'+files.map(function(file){return '<div class="storedFileItemV154"><button type="button" class="storedFileLinkV154" onclick="openResponseFileV154(\''+attr(file.path)+'\')"><span aria-hidden="true">📎</span><span>'+esc(file.name)+'</span><small>'+esc(fileSizeTextV154(file.size))+'</small></button>'+(removable?'<label class="storedFileRemoveV154"><input type="checkbox" name="'+attr(name+'__remove')+'" value="'+attr(file.path)+'">移除此檔</label>':'')+'</div>'}).join('')+'</div>'}
function collectAnswers(formEl,f,prefix,existingAnswers){prefix=prefix||'q_';var fd=new FormData(formEl),answers={};existingAnswers=existingAnswers||{};for(var q of normalizeQuestions(f.questions||[])){if(q.type==='image')continue;var section=formEl.querySelector('[data-question-id-v171="'+CSS.escape(String(q.id))+'"]');if(section&&section.hidden)continue;var name=prefix+q.id;if(q.type==='file'){var kept=responseFilesV154(existingAnswers[q.id]).filter(function(file){return !fd.getAll(name+'__remove').map(String).includes(file.path)}),input=formEl.querySelector('[name="'+CSS.escape(name)+'"]'),selected=input&&input.files?Array.from(input.files):[];answers[q.id]=kept;if(q.required&&!kept.length&&!selected.length)throw new Error('請完成必填題目：'+q.title);continue}if(q.type==='multiple')answers[q.id]=fd.getAll(name);else if(q.type==='matrixSingle'){var out={};(q.rows||[]).forEach(function(row){var value=String(fd.get(name+'__'+row)||'').trim();if(value)out[row]=value});answers[q.id]=out}else if(q.type==='matrixMultiple'){var out2={};(q.rows||[]).forEach(function(row){var values=fd.getAll(name+'__'+row);if(values.length)out2[row]=values});answers[q.id]=out2}else answers[q.id]=String(fd.get(name)||'').trim();if(q.required){if(MATRIX_TYPES_V132.includes(q.type)){var obj=answers[q.id]||{};if((q.rows||[]).some(function(row){return answerEmpty(obj[row])}))throw new Error('請完成必填題目：'+q.title)}else if(answerEmpty(answers[q.id]))throw new Error('請完成必填題目：'+q.title)}if(['short','long'].includes(q.type)){var message=validateTextAnswer(q,answers[q.id]);if(message)throw new Error(q.title+'：'+message)}}return answers}
async function uploadResponseFileV154(formId,uploadKey,questionId,file){var path='universal-responses/'+storageSafeSegmentV153(formId)+'/'+storageSafeSegmentV153(uploadKey)+'/'+storageSafeSegmentV153(questionId)+'/'+Date.now()+'_'+Math.random().toString(36).slice(2,8)+'_'+storageSafeSegmentV153(file.name),ref=storage.ref().child(path);await ref.put(file,{contentType:file.type||'application/octet-stream',customMetadata:{formId:String(formId),questionId:String(questionId),originalName:file.name,uploadedByUid:(currentUser&&currentUser.uid)||''}});return {name:file.name,path:path,size:file.size,type:file.type||'application/octet-stream'}}
async function collectAndUploadResponseFilesV154(formEl,f,prefix,uploadKey,answers){prefix=prefix||'q_';var uploaded=[];try{for(var q of normalizeQuestions(f.questions||[])){if(q.type!=='file')continue;var section=formEl.querySelector('[data-question-id-v171="'+CSS.escape(String(q.id))+'"]');if(section&&section.hidden){delete answers[q.id];continue}var input=formEl.querySelector('[name="'+CSS.escape(prefix+q.id)+'"]'),selected=input&&input.files?Array.from(input.files):[],settings=q.settings||{},limit=settings.multiple?Math.max(2,Math.min(5,Number(settings.maxFiles||5))):1,kept=responseFilesV154(answers[q.id]);if(selected.length+kept.length>limit)throw new Error(q.title+'：最多可上傳 '+limit+' 個檔案');for(var file of selected){var error=validateResponseFileV154(file,q);if(error)throw new Error(q.title+'：'+error);var stored=await uploadResponseFileV154(f.id,uploadKey,q.id,file);uploaded.push(stored.path);kept.push(stored)}answers[q.id]=kept}return {answers:answers,uploaded:uploaded}}catch(e){await Promise.all(uploaded.map(function(path){return deleteStoragePathV153(path).catch(function(){})}));throw e}}
function responseFilePathsV154(response){var paths=[];normalizeQuestions((forms.find(function(f){return f.id===response.formId})||{}).questions||[]).forEach(function(q){if(q.type==='file')responseFilesV154((response.answers||{})[q.id]).forEach(function(file){paths.push(file.path)})});return Array.from(new Set(paths))}
async function writeResponseWithLock(f,responseKey,payload,lockPayload){if(!responseKey){await col('universalResponses').add(payload);return}var responseRef=doc('universalResponses',responseKey),lockRef=doc('universalResponseLocks',responseKey);await db.runTransaction(async function(tx){var lock=await tx.get(lockRef);if(lock.exists)throw new Error('duplicate-response');tx.set(responseRef,payload);tx.set(lockRef,lockPayload)})}
function renderAssistedFillForm(f,member){return '<div class="assistNotice"><b>目前正在協助填寫：'+esc(memberDisplayName(member))+'（員工編號 '+esc(memberEmployeeNo(member))+'）</b><span>實際填寫管理者：'+esc(adminDisplayName())+'</span></div><form id="assistedForm" class="questionList" onsubmit="submitAssistedResponse(event)">'+normalizeQuestions(f.questions||[]).map(function(q){return renderPublicQuestion(q,'assist_q_')}).join('')+'<div class="submitArea"><button id="assistSubmitBtn" class="btn primary" type="submit">協助送出</button><span id="assistSubmitNote" class="questionHelp"></span></div></form>'}
function openAssistedFill(memberId){var f=activeForm(),member=members.find(function(m){return m.id===memberId});if(!f||!member||!canManageForm(f.id))return notify('您沒有協助填寫權限','error');if(responses.some(function(r){return responseBelongsToMember(r,member)}))return notify('此同仁已填寫，無法重複協助填寫','warn');assistedTargetMemberId=memberId;$('assistedFillTitle').textContent='協助填寫問卷';$('assistedFillBody').innerHTML=renderAssistedFillForm(f,member);$('assistedFillMask').style.display='grid'}
function closeAssistedFill(){$('assistedFillMask').style.display='none';$('assistedFillBody').innerHTML='';assistedTargetMemberId=''}
async function submitAssistedResponse(event){event.preventDefault();var f=activeForm(),member=members.find(function(m){return m.id===assistedTargetMemberId});if(!f||!member||!canManageForm(f.id))return notify('您沒有協助填寫權限','error');var answers;try{answers=collectAnswers(event.target,f,'assist_q_')}catch(e){return notify(e.message||'請確認填寫內容','warn')}if(!await confirmDialog('確定要代替'+memberDisplayName(member)+'送出本問卷嗎？','確認協助填寫'))return;var departmentName=memberDepartmentName(member),responseKey=f.id+'__'+member.id,payload={formId:f.id,formTitle:f.title,departmentName:departmentName,memberId:member.id,memberName:member.name||'',employeeNo:memberEmployeeNo(member),respondentMemberId:member.id,respondentEmployeeId:memberEmployeeNo(member),respondentName:member.name||'',respondentDepartment:departmentName,answers:answers,submissionMethod:'assisted',submittedByUid:(currentUser&&currentUser.uid)||'',submittedByEmail:normalizeEmail((currentUser&&currentUser.email)||''),submittedByName:adminDisplayName(),submittedAt:firebase.firestore.FieldValue.serverTimestamp(),submittedAtText:new Date().toLocaleString('zh-TW')},btn=$('assistSubmitBtn');btn.disabled=true;btn.textContent='送出中';setPageLoading(true,'正在協助送出問卷');try{await writeResponseWithLock(f,responseKey,payload,{formId:f.id,memberId:member.id,submissionMethod:'assisted',submittedByUid:(currentUser&&currentUser.uid)||'',createdAt:firebase.firestore.FieldValue.serverTimestamp()});closeAssistedFill();await loadResponses();renderAdmin();showPanel('resultsPanel');var panel=ensureMissingPanel();if(panel)panel.scrollIntoView({behavior:'smooth',block:'start'});toast('已完成協助填寫','success')}catch(e){console.error(e);notify(e.message==='duplicate-response'?'此同仁已填寫，無法重複協助填寫':'協助填寫失敗，請確認權限或網路狀態','error')}finally{setPageLoading(false);if(btn){btn.disabled=false;btn.textContent='協助送出'}}}
function selectionQuestions(f){return normalizeQuestions(f.questions||[]).filter(function(q){return ['single','dropdown','department','multiple','linearScale','rating','matrixSingle','matrixMultiple'].includes(q.type)})}
function scaleItems(q){var settings=q&&q.settings||{},min=Number(settings.min!=null?settings.min:1),max=Number(settings.max!=null?settings.max:5);if(q&&q.type==='rating'){min=1;max=[3,5,7,10].includes(max)?max:5}else{min=min===0?0:1;max=Number.isFinite(max)?Math.round(max):5;max=Math.max(min+1,Math.min(10,max))}return Array.from({length:max-min+1},function(_,i){return String(min+i)})}
function questionOptionLabels(q){q=normalizeQuestion(q);if(q.type==='department')return departments.map(function(d){return d.name||d.departmentName||''}).filter(Boolean);if(['linearScale','rating'].includes(q.type))return scaleItems(q);return optionCounts(q).map(function(x){return x.label})}
function responseHasOption(r,q,option){if(!responseQuestionVisibleV171(r,q))return false;var value=r.answers&&r.answers[q.id];if(value&&typeof value==='object'&&!Array.isArray(value))return Object.values(value).some(function(v){return Array.isArray(v)?v.map(String).includes(String(option)):String(v)===String(option)});return Array.isArray(value)?value.map(String).includes(String(option)):String(value==null?'':value)===String(option)}
function questionAnsweredCountV170(q){return responses.filter(function(response){if(!responseQuestionVisibleV171(response,q))return false;var value=response.answers&&response.answers[q.id];if(value&&typeof value==='object'&&!Array.isArray(value))return Object.values(value).some(function(item){return Array.isArray(item)?item.some(function(v){return String(v==null?'':v).trim()}):String(item==null?'':item).trim()});if(Array.isArray(value))return value.some(function(item){return String(item==null?'':item).trim()});return String(value==null?'':value).trim()}).length}
function scaleAnalysisHtml(q){var labels=scaleItems(q),valid=new Set(labels),answered=responses.filter(function(response){return responseQuestionVisibleV171(response,q)}).map(function(response){var raw=(response.answers||{})[q.id],text=String(raw==null?'':raw).trim();return text&&valid.has(text)?Number(text):null}).filter(function(value){return value!=null&&Number.isFinite(value)}),items=labels.map(function(label){return {label:label,count:answered.filter(function(value){return String(value)===label}).length}}),denominator=answered.length,avg=answered.length?Math.round(answered.reduce(function(a,b){return a+b},0)*10/answered.length)/10:null,body='<div class="barList">'+items.map(function(x,index){var p=percentage(x.count,denominator),color=chartColors[index%chartColors.length];return '<div'+chartDatumAttrsV165(x.label,x.count,p,index)+'><div class="barRowHead"><span>'+esc(x.label)+'</span><strong>'+x.count+' 人・'+p+'%</strong></div><div class="barTrack"><div class="barFill" style="width:'+p+'%;background:'+color+'"></div></div></div>'}).join('')+'</div>';return analysisCardShellV170(q.title,denominator,body,'',avg==null?'尚無評分':'平均 '+avg)}
function matrixAnalysisHtml(q){var rows=Array.isArray(q.rows)?q.rows:[],cols=Array.isArray(q.columns)?q.columns:[],body='<div class="matrixScroll"><table class="matrixTable"><thead><tr><th>列項目</th>'+cols.map(function(c){return '<th>'+esc(c)+'</th>'}).join('')+'</tr></thead><tbody>'+rows.map(function(row){var answered=responses.filter(function(response){return responseQuestionVisibleV171(response,q)}).map(function(response){return response.answers&&response.answers[q.id]&&response.answers[q.id][row]}).filter(function(value){return Array.isArray(value)?value.some(function(item){return String(item==null?'':item).trim()}):String(value==null?'':value).trim()});return '<tr><th>'+esc(row)+'</th>'+cols.map(function(col,index){var count=answered.filter(function(value){return Array.isArray(value)?new Set(value.map(String)).has(String(col)):String(value)===String(col)}).length,p=percentage(count,answered.length);return '<td'+chartDatumAttrsV165(row+'－'+col,count,p,index)+'>'+count+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>';return analysisCardShellV170(q.title,questionAnsweredCountV170(q),body,'wideAnalysis')}
function editQuestionHtml(q,value){return '<div class="editQuestion">'+renderPublicQuestion(q,'edit_q_',value)+'</div>'}
async function saveEditedResponse(event){event.preventDefault();var f=activeForm(),r=responses.find(function(x){return x.id===editingResponseId});if(!f||!r)return;var answers;try{answers=collectAnswers(event.target,f,'edit_q_')}catch(e){return notify(e.message||'請確認填寫內容','warn')}var update={answers:answers,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:(currentUser&&currentUser.email)||'',updatedByName:adminDisplayName()};if(f.identityMode==='member'){var memberId=$('editMember').value,m=members.find(function(x){return x.id===memberId}),departmentName=$('editDepartment').value;if(!m||!departmentName)return notify('請選擇部門與姓名');Object.assign(update,{departmentName:departmentName,memberId:memberId,memberName:m.name||'',employeeNo:memberEmployeeNo(m),respondentMemberId:m.id,respondentEmployeeId:memberEmployeeNo(m),respondentName:m.name||'',respondentDepartment:departmentName})}var btn=$('saveResponseBtn');btn.disabled=true;btn.textContent='儲存中';setPageLoading(true,'正在儲存填寫結果');try{if(f.identityMode==='member'){var newId=f.id+'__'+update.memberId,newLock=doc('universalResponseLocks',newId),oldLockId=r.memberId?f.id+'__'+r.memberId:'';if(newId!==r.id){var existing=await doc('universalResponses',newId).get(),locked=await newLock.get();if(existing.exists||locked.exists)throw new Error('所選同仁已有這份問卷的填寫資料');var oldData=Object.assign({},r);delete oldData.id;var batch=db.batch();batch.set(doc('universalResponses',newId),Object.assign(oldData,update));batch.delete(doc('universalResponses',r.id));if(oldLockId&&oldLockId!==newId)batch.delete(doc('universalResponseLocks',oldLockId));batch.set(newLock,{formId:f.id,memberId:update.memberId,submissionMethod:r.submissionMethod||'self',createdAt:firebase.firestore.FieldValue.serverTimestamp()});await batch.commit()}else{var sameBatch=db.batch();sameBatch.update(doc('universalResponses',r.id),update);sameBatch.set(newLock,{formId:f.id,memberId:update.memberId,submissionMethod:r.submissionMethod||'self',createdAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});await sameBatch.commit()}}else await doc('universalResponses',r.id).update(update);closeResponseEditor();await loadResponses();renderAdmin();showPanel('resultsPanel');toast('填寫結果已更新','success')}catch(e){console.error(e);notify('更新失敗：'+(e.message||'請確認 Firestore 規則'),'error')}finally{setPageLoading(false);btn.disabled=false;btn.textContent='儲存變更'}}
function applyFormTheme(f){var theme=formTheme(f);document.body.setAttribute('data-front-theme',theme);if(front)front.setAttribute('data-front-theme',theme)}

/* v1.32 usability correction: Google-Forms-like question editor and real controls */
var questionUiState={description:{},validation:{},visibility:{}};
var dragQuestionIndex=null;
function questionSettingOpen(kind,i,q){var bucket=questionUiState[kind]||{};if(bucket[i]!==undefined)return bucket[i];if(kind==='description')return !!questionDescription(q);if(kind==='validation')return !!((q.validation||{}).type);if(kind==='visibility')return !!((q.visibility||{}).enabled);return false}
function toggleQuestionSetting(kind,i){questionUiState[kind]=questionUiState[kind]||{};questionUiState[kind][i]=!questionUiState[kind][i];renderQuestionEditor();setTimeout(function(){var el=document.querySelector('[data-question-index="'+i+'"]');if(el)el.scrollIntoView({block:'nearest'})},0)}
function starPreviewHtml(q){var max=Number((q.settings&&q.settings.max)||5);return '<div class="ratingPreview" aria-hidden="true">'+Array.from({length:max},function(){return '<span class="ratingStar isFilled">★</span>'}).join('')+'</div>'}
function settingStatusLabel(text,on){return '<span class="modeBadge '+(on?'':'mutedModeBadge')+'">'+esc(text)+'</span>'}
function applyOptionsFromTextarea(i,target){var q=normalizeQuestion(draftQuestions[i]);var value=(q[target]||[]).join('\n');var items=uniqueLines(value);var raw=splitLines(value);if(new Set(raw).size!==raw.length)toast('已偵測到重複項目，請確認是否需要保留','warn');draftQuestions[i][target]=items;renderQuestionEditor();toast('已整理 '+items.length+' 個項目','success')}
function optionEditorHtml(q,i){
  q=normalizeQuestion(q);
  if(['single','multiple','dropdown'].includes(q.type))return '<label class="optionsField optionEditorUnified">選項（每行一個）<textarea oninput="updateQuestion('+i+',\'options\',this.value)">'+esc((q.options||[]).join('\n'))+'</textarea><small class="questionHelp">可一次貼上多個選項，每行一個；系統會在儲存時排除空白行。</small></label><div class="optionTools"><button class="btn" type="button" onclick="applyOptionsFromTextarea('+i+',\'options\')">整理選項</button></div>';
  if(q.type==='linearScale')return '<div class="questionGrid"><label>起始數字<select onchange="setQuestionSettings('+i+',\'min\',Number(this.value));renderQuestionEditor()"><option value="0" '+(q.settings.min===0?'selected':'')+'>0</option><option value="1" '+(q.settings.min!==0?'selected':'')+'>1</option></select></label><label>結束數字<input type="number" min="2" max="10" value="'+attr(q.settings.max||5)+'" oninput="setQuestionSettings('+i+',\'max\',Number(this.value));renderQuestionEditor()"></label><label>起始文字<input value="'+attr(q.settings.minLabel||'')+'" oninput="setQuestionSettings('+i+',\'minLabel\',this.value)"></label><label>結束文字<input value="'+attr(q.settings.maxLabel||'')+'" oninput="setQuestionSettings('+i+',\'maxLabel\',this.value)"></label></div>';
  if(q.type==='rating')return '<div class="questionGrid"><label>最高星數<select onchange="setQuestionSettings('+i+',\'max\',Number(this.value));renderQuestionEditor()">'+[3,5,7,10].map(function(n){return '<option value="'+n+'" '+(Number(q.settings.max||5)===n?'selected':'')+'>'+n+' 星</option>'}).join('')+'</select></label><label>起始說明<input value="'+attr(q.settings.minLabel||'')+'" oninput="setQuestionSettings('+i+',\'minLabel\',this.value)"></label><label>結束說明<input value="'+attr(q.settings.maxLabel||'')+'" oninput="setQuestionSettings('+i+',\'maxLabel\',this.value)"></label></div>'+starPreviewHtml(q);
  if(q.type==='file')return '<div class="questionGrid fileQuestionSettingsV154"><label>允許檔案類型<select onchange="setQuestionSettings('+i+',\'fileKind\',this.value);markFormDirty()"><option value="all" '+(q.settings.fileKind==='all'?'selected':'')+'>所有檔案與照片</option><option value="image" '+(q.settings.fileKind==='image'?'selected':'')+'>僅照片</option><option value="document" '+(q.settings.fileKind==='document'?'selected':'')+'>文件與壓縮檔</option></select></label><label>上傳數量<select onchange="setQuestionSettings('+i+',\'multiple\',this.value===\'true\');setQuestionSettings('+i+',\'maxFiles\',this.value===\'true\'?Math.max(2,Number(draftQuestions['+i+'].settings.maxFiles||5)):1);markFormDirty();renderQuestionEditor()"><option value="false" '+(!q.settings.multiple?'selected':'')+'>單一檔案</option><option value="true" '+(q.settings.multiple?'selected':'')+'>可上傳多個檔案</option></select></label>'+(q.settings.multiple?'<label>最多檔案數<input type="number" min="2" max="5" value="'+attr(q.settings.maxFiles||5)+'" onchange="setQuestionSettings('+i+',\'maxFiles\',Math.max(2,Math.min(5,Number(this.value)||5)));markFormDirty()"></label>':'')+'<p class="questionHelp fileLimitNoteV154">每個檔案上限 10 MB；檔案會儲存於 Firebase Storage，只有具結果檢視權限者可下載。</p></div>';
  if(MATRIX_TYPES_V132.includes(q.type))return '<div class="questionGrid"><label>列項目（每行一個）<textarea oninput="updateQuestion('+i+',\'rows\',this.value)">'+esc((q.rows||[]).join('\n'))+'</textarea></label><label>欄選項（每行一個）<textarea oninput="updateQuestion('+i+',\'columns\',this.value)">'+esc((q.columns||[]).join('\n'))+'</textarea></label></div><div class="optionTools"><button class="btn" type="button" onclick="applyOptionsFromTextarea('+i+',\'rows\')">整理列項目</button><button class="btn" type="button" onclick="applyOptionsFromTextarea('+i+',\'columns\')">整理欄選項</button></div>';
  return ''
}
function validationEditorHtml(q,i){if(!['short','long'].includes(q.type))return'';var v=q.validation||{},types=[['','不驗證'],['number','數字'],['integer','整數'],['email','Email'],['phone','電話號碼'],['minLength','最小字數'],['maxLength','最大字數'],['gt','數值大於'],['lt','數值小於'],['range','數值介於範圍'],['regex','自訂正規表示式']];return '<div class="validationBox"><b>回答驗證</b><div class="questionGrid"><label>驗證規則<select onchange="setQuestionValidation('+i+',\'type\',this.value);renderQuestionEditor()">'+types.map(function(x){return '<option value="'+x[0]+'" '+(v.type===x[0]?'selected':'')+'>'+x[1]+'</option>'}).join('')+'</select></label><label>最小值／字數<input value="'+attr(v.min==null?'':v.min)+'" oninput="setQuestionValidation('+i+',\'min\',this.value)"></label><label>最大值／字數<input value="'+attr(v.max==null?'':v.max)+'" oninput="setQuestionValidation('+i+',\'max\',this.value)"></label></div><div class="questionGrid"><label>正規表示式<input value="'+attr(v.pattern||'')+'" oninput="setQuestionValidation('+i+',\'pattern\',this.value)"></label><label>錯誤訊息<input value="'+attr(v.message||'')+'" placeholder="請輸入正確格式" oninput="setQuestionValidation('+i+',\'message\',this.value)"></label></div></div>'}
function conditionalEditorHtmlV171(q,i){var visibility=normalizeQuestionVisibilityV171(q.visibility),eligible=conditionalSourceQuestionsV171(i);if(!eligible.length)return '<div class="conditionalBoxV171"><b>條件式顯示</b><p class="questionHelp">前面尚無單選、複選、下拉或部門題，這一題目前只能永遠顯示。</p></div>';var source=eligible.find(function(item){return item.id===visibility.sourceQuestionId})||eligible[eligible.length-1],options=conditionalSourceOptionsV171(source),selected=new Set(visibility.values.map(String));return '<div class="conditionalBoxV171"><div class="conditionalHeadingV171"><b>條件式顯示</b><span>只有符合條件時才顯示本題；不符合時不驗證也不儲存答案。</span></div><div class="questionGrid"><label>顯示方式<select onchange="setQuestionVisibilityEnabledV171('+i+',this.value===\'conditional\')"><option value="always" '+(!visibility.enabled?'selected':'')+'>永遠顯示</option><option value="conditional" '+(visibility.enabled?'selected':'')+'>符合條件時顯示</option></select></label>'+(visibility.enabled?'<label>依據題目<select onchange="setQuestionVisibilitySourceV171('+i+',this.value)">'+eligible.map(function(item,index){return '<option value="'+attr(item.id)+'" '+(item.id===source.id?'selected':'')+'>'+(index+1)+'．'+esc(item.title||'未命名題目')+'</option>'}).join('')+'</select></label><label>判斷方式<select onchange="setQuestionVisibilityOperatorV171('+i+',this.value)"><option value="isAnyOf" '+(visibility.operator==='isAnyOf'?'selected':'')+'>回答為任一選項</option><option value="isNotAnyOf" '+(visibility.operator==='isNotAnyOf'?'selected':'')+'>回答不是這些選項</option></select></label>':'')+'</div>'+(visibility.enabled?'<fieldset class="conditionalValuesV171"><legend>觸發答案</legend>'+options.map(function(option,optionIndex){return '<label><input type="checkbox" '+(selected.has(String(option))?'checked':'')+' onchange="toggleQuestionVisibilityValueByIndexV171('+i+','+optionIndex+',this.checked)"><span>'+esc(option)+'</span></label>'}).join('')+'</fieldset>':'')+'</div>'}
function questionMoreBar(q,i){var descOpen=questionSettingOpen('description',i,q),validOpen=questionSettingOpen('validation',i,q),visibilityOpen=questionSettingOpen('visibility',i,q),hasDesc=!!questionDescription(q),hasValid=!!((q.validation||{}).type),hasVisibility=!!((q.visibility||{}).enabled);return '<div class="questionMoreBar"><button class="settingToggle '+(descOpen?'active':'')+'" type="button" onclick="toggleQuestionSetting(\'description\','+i+')">'+(descOpen?'收合題目說明':'＋ 題目說明')+'</button><button class="settingToggle '+(validOpen?'active':'')+'" type="button" onclick="toggleQuestionSetting(\'validation\','+i+')">'+(validOpen?'收合回答驗證':'＋ 回答驗證')+'</button>'+(i>0?'<button class="settingToggle '+(visibilityOpen?'active':'')+'" type="button" onclick="toggleQuestionSetting(\'visibility\','+i+')">'+(visibilityOpen?'收合顯示條件':'＋ 顯示條件')+'</button>':'')+(hasDesc?settingStatusLabel('已設定說明',true):'')+(hasValid?settingStatusLabel('已設定驗證',true):'')+(hasVisibility?settingStatusLabel('條件式顯示',true):'')+'</div>'}
function questionExtraSettingsHtml(q,i){var descOpen=questionSettingOpen('description',i,q),validOpen=questionSettingOpen('validation',i,q),visibilityOpen=questionSettingOpen('visibility',i,q);return '<div class="collapsibleSetting '+(descOpen?'open':'')+'"><label>題目說明<input value="'+attr(questionDescription(q))+'" oninput="updateQuestion('+i+',\'description\',this.value)"></label></div><div class="collapsibleSetting '+(validOpen?'open':'')+'">'+validationEditorHtml(q,i)+'</div>'+(i>0?'<div class="collapsibleSetting '+(visibilityOpen?'open':'')+'">'+conditionalEditorHtmlV171(q,i)+'</div>':'')}
function questionImageEditorHtml(q,i){q=normalizeQuestion(q);var pending=pendingQuestionImageFiles.get(q.id),preview=pendingQuestionImagePreviewUrls.get(q.id)||imageUrl(q.imageUrl),urlMode=!pending&&!q.imageStoragePath&&!!q.imageUrl,status=pending?'待上傳至 Firebase Storage':(q.imageStoragePath?'目前使用 Firebase Storage 圖片':(q.imageUrl?'目前使用網址圖片':'尚未選擇圖片'));return '<div class="questionImageField imageSourceField"><b>圖片上傳</b><div class="imageSourceTabs" role="group" aria-label="題目圖片來源"><button id="questionImageUploadTab_'+i+'" class="imageSourceTab '+(!urlMode?'active':'')+'" type="button" onclick="setQuestionImageSourceMode('+i+',\'upload\')">上傳圖片</button><button id="questionImageUrlTab_'+i+'" class="imageSourceTab '+(urlMode?'active':'')+'" type="button" onclick="setQuestionImageSourceMode('+i+',\'url\')">貼上網址</button></div><div id="questionImageUploadPanel_'+i+'" class="imageSourcePanel" '+(urlMode?'hidden':'')+'><input id="questionImageFile_'+i+'" class="hiddenFileInput" type="file" accept="image/jpeg,image/png,image/webp" onchange="handleQuestionImageFile('+i+',this.files[0]);this.value=\'\'" aria-label="上傳題目圖片"><div class="imageUploadRow"><button class="btn" type="button" onclick="chooseQuestionImageFile('+i+')">選擇圖片</button><span class="imageFileName">'+esc(pending?pending.name:'JPG、PNG、WebP')+'</span></div></div><div id="questionImageUrlPanel_'+i+'" class="imageSourcePanel" '+(!urlMode?'hidden':'')+'><label>圖片網址<input value="'+attr(q.imageUrl||'')+'" placeholder="貼上 Google Drive 或一般圖片網址" oninput="updateQuestionImage('+i+',this.value)"></label><p>Drive 圖片需開啟「知道連結的使用者皆可查看」。</p></div><div class="imagePreviewToolbar"><span class="imageSourceStatus">'+esc(status)+'</span>'+(preview?'<button class="btn danger" type="button" onclick="clearQuestionImage('+i+')">移除圖片</button>':'')+'</div><div id="questionImagePreview_'+i+'" class="imagePreview">'+previewImageHtmlFromUrl(preview,q.title||'圖片預覽')+'</div></div>'}
function addQuestion(type){draftQuestions.push(newQuestion(type||'short'));window.__scrollToQuestionIndex=draftQuestions.length-1;renderQuestionEditor()}
function copyQuestion(i){var copy=JSON.parse(JSON.stringify(normalizeQuestion(draftQuestions[i])));copy.id='q_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);copy.imageStoragePath='';copy.title=(copy.title||'未命名題目')+'（複製）';draftQuestions.splice(i+1,0,copy);window.__scrollToQuestionIndex=i+1;renderQuestionEditor();toast('題目已複製','success')}
function onQuestionDragStart(event,i){dragQuestionIndex=i;event.currentTarget.classList.add('dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(i))}
function onQuestionDragOver(event,i){event.preventDefault();event.currentTarget.classList.add('dragOver');event.dataTransfer.dropEffect='move'}
function onQuestionDragLeave(event){event.currentTarget.classList.remove('dragOver')}
function onQuestionDrop(event,i){event.preventDefault();event.currentTarget.classList.remove('dragOver');var from=dragQuestionIndex;if(from==null||from===i)return;var item=draftQuestions.splice(from,1)[0];draftQuestions.splice(i,0,item);window.__scrollToQuestionIndex=i;dragQuestionIndex=null;renderQuestionEditor();toast('題目順序已更新','success')}
function onQuestionDragEnd(event){event.currentTarget.classList.remove('dragging');document.querySelectorAll('.dragOver').forEach(function(el){el.classList.remove('dragOver')});dragQuestionIndex=null}
function renderPublicQuestion(q,prefix,value){q=normalizeQuestion(q);prefix=prefix||'q_';var required=q.required?'<span class="required"> *</span>':'',title=esc(q.title||'未命名題目')+required,help=questionDescription(q)?'<div class="questionHelp">'+esc(questionDescription(q))+'</div>':'',img=imageUrl(q.imageUrl),image=img?'<img class="questionImage" src="'+attr(img)+'" alt="'+attr(q.title||'參考圖片')+'">':'';if(q.type==='image')return '<section class="questionCard"><label class="title">'+title+'</label>'+help+image+'</section>';var name=prefix+q.id,req=q.required?'required':'',input='',current=value==null?null:value;if(q.type==='long')input='<textarea name="'+attr(name)+'" '+req+'>'+esc(current==null?'':current)+'</textarea>';else if(q.type==='single'||q.type==='multiple'){var t=q.type==='multiple'?'checkbox':'radio',selected=Array.isArray(current)?current:[current];input='<div class="choiceList">'+(q.options||[]).map(function(o){return '<label class="choice"><input type="'+t+'" name="'+attr(name)+'" value="'+attr(o)+'" '+(selected.map(String).includes(String(o))?'checked':'')+' '+(q.type==='single'?req:'')+'>'+esc(o)+'</label>'}).join('')+'</div>'}else if(q.type==='dropdown'||q.type==='department'){var opts=q.type==='department'?departments.map(function(d){return d.name||d.departmentName||''}).filter(Boolean):(q.options||[]);input='<select name="'+attr(name)+'" '+req+'><option value="">請選擇</option>'+opts.map(function(o){return '<option value="'+attr(o)+'" '+(String(current==null?'':current)===String(o)?'selected':'')+'>'+esc(o)+'</option>'}).join('')+'</select>'}else if(q.type==='linearScale'){var min=Number(q.settings.min==null?1:q.settings.min),max=Number(q.settings.max||5);max=Math.max(min+1,Math.min(10,max));var nums=Array.from({length:max-min+1},function(_,k){return min+k});input='<div class="scaleQuestion"><span class="scaleLabel">'+esc(q.settings.minLabel||'')+'</span><div class="scaleOptions">'+nums.map(function(n){var checked=String(current==null?'':current)===String(n);return '<label class="scaleOption '+(checked?'isSelected':'')+'"><input type="radio" name="'+attr(name)+'" value="'+n+'" '+(checked?'checked':'')+' '+req+'><span>'+n+'</span></label>'}).join('')+'</div><span class="scaleLabel">'+esc(q.settings.maxLabel||'')+'</span></div>'}else if(q.type==='rating'){var maxStar=Number(q.settings.max||5);maxStar=[3,5,7,10].includes(maxStar)?maxStar:5;var selectedRating=Number(current||0);input='<div class="ratingQuestion" role="radiogroup" aria-label="'+attr(q.title||'星等評分')+'">'+(q.settings.minLabel?'<span class="scaleLabel">'+esc(q.settings.minLabel)+'</span>':'')+Array.from({length:maxStar},function(_,k){var n=k+1,filled=selectedRating>=n;return '<label class="ratingStar '+(filled?'isFilled':'')+'" title="'+n+' 星"><input type="radio" name="'+attr(name)+'" value="'+n+'" '+(selectedRating===n?'checked':'')+' '+req+' aria-label="'+attr(n+' 星')+'">★</label>'}).join('')+(q.settings.maxLabel?'<span class="scaleLabel">'+esc(q.settings.maxLabel)+'</span>':'')+'</div>'}else if(q.type==='time')input='<input type="time" name="'+attr(name)+'" value="'+attr(current==null?'':current)+'" '+req+'>';else if(q.type==='datetime')input='<input type="datetime-local" name="'+attr(name)+'" value="'+attr(current==null?'':current)+'" '+req+'>';else if(MATRIX_TYPES_V132.includes(q.type)){var multi=q.type==='matrixMultiple',currentObj=current&&typeof current==='object'?current:{};input='<div class="matrixScroll"><table class="matrixTable"><thead><tr><th></th>'+(q.columns||[]).map(function(c){return '<th>'+esc(c)+'</th>'}).join('')+'</tr></thead><tbody>'+(q.rows||[]).map(function(row){return '<tr><th>'+esc(row)+'</th>'+(q.columns||[]).map(function(col){var checked=multi?(Array.isArray(currentObj[row])&&currentObj[row].includes(col)):currentObj[row]===col;return '<td><label class="matrixChoice"><input type="'+(multi?'checkbox':'radio')+'" name="'+attr(name+'__'+row)+'" value="'+attr(col)+'" '+(checked?'checked':'')+' aria-label="'+attr(row+'－'+col)+'"><span class="matrixChoiceText">'+esc(row+'－'+col)+'</span></label></td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>'}else input='<input type="text" name="'+attr(name)+'" value="'+attr(current==null?'':current)+'" '+req+'>';return '<section class="questionCard"><label class="title">'+title+'</label>'+help+image+input+'</section>'}

/* v1.32 deletion policy correction: no trash, creator/admin delete directly */
function canDeleteFormDirectly(form){if(typeof form==='string')form=forms.find(function(x){return x.id===form});return !!form&&(isSystemAdmin||isCreatedByCurrentUser(form))}
function updateRoleUi(){ensureAdminExtensions();var current=activeForm(),memberSurvey=!!(current&&formUsesMemberDatabaseV141(current));if($('membersNav'))$('membersNav').style.display=isSystemAdmin?'':'none';if($('permissionsNav'))$('permissionsNav').style.display=activeFormId&&canManageForm(activeFormId)?'':'none';if($('progressNav'))$('progressNav').style.display=memberSurvey?'':'none';if($('systemManagementNavGroup'))$('systemManagementNavGroup').style.display=(isSystemAdmin||(activeFormId&&canManageForm(activeFormId)))?'':'none';if(!isSystemAdmin&&$('membersPanel')&&$('membersPanel').classList.contains('active'))showPanel('dashboardPanel');if(!memberSurvey&&$('progressPanel')&&$('progressPanel').classList.contains('active'))showPanel('resultsPanel');if(activeFormId&&!canManageForm(activeFormId)&&(($('editorPanel')&&$('editorPanel').classList.contains('active'))||($('permissionsPanel')&&$('permissionsPanel').classList.contains('active'))))showPanel('resultsPanel')}
function renderTrash(){return}

/* v1.33 填寫管理與介面修正版 */
var resultDetailState={search:'',department:'',sort:'department'};
function cleanUiText(value){return String(value==null?'':value).replace(/\\r\\n|\\r|\\n|r'n/g,' ').replace(/\s{2,}/g,' ').trim()}
function esc(v){return cleanUiText(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function frontTopHtml(f,closed){var statusLabel=f?(closed?'問卷已關閉':'問卷開放中'):'請使用完整網址';return '<header class="frontHeader"><img src="assets/company-logo.png" alt="環興科技股份有限公司"><div class="frontActions"><span id="formStatus" class="statusPill">'+statusLabel+'</span>'+(isAdmin?'':'<button class="ghostBtn" onclick="openAdmin()">管理登入</button>')+'</div></header>'}
function renderFront(){var route=formRouteId(),publicForms=forms.filter(function(x){return x.deleted!==true});if(!route){activeFormId='';document.body.removeAttribute('data-front-theme');formStatus.textContent='請使用完整問卷網址';frontMain.innerHTML=frontPreviewBannerHtml()+frontTopHtml(null,true)+'<div class="successCard"><h2>請使用完整問卷網址</h2><p>請由問卷管理者提供的正式連結進入，網址後方需包含 #form/問卷代碼。</p></div>';return}var f=publicForms.find(function(x){return x.id===route});if(!f){activeFormId='';document.body.removeAttribute('data-front-theme');formStatus.textContent='找不到問卷';frontMain.innerHTML=frontPreviewBannerHtml()+frontTopHtml(null,true)+'<div class="successCard"><h2>找不到這份問卷</h2><p>請確認問卷網址是否完整，或洽問卷管理者重新提供連結。</p></div>';return}activeFormId=f.id;applyFormTheme(f);var closed=f.state!=='open'||deadlinePassed(f.deadline),heroImage=imageUrl(f.imageUrl),descriptionHtml=frontDescriptionHtmlV156(f),referenceFiles=frontReferenceFilesHtmlV156(f);formStatus.textContent=closed?'問卷已關閉':'問卷開放中';frontMain.innerHTML=frontPreviewBannerHtml()+frontTopHtml(f,closed)+'<section class="formHero"><h1>'+esc(f.title)+'</h1>'+descriptionHtml+(heroImage?'<img class="referenceImage" src="'+attr(heroImage)+'" alt="問卷參考圖片">':'')+referenceFiles+(f.deadline?'<span class="deadlineBadge">請於 '+esc(formatDeadline(f.deadline))+' 前完成</span>':'')+'</section>'+(closed?'<div class="successCard" style="margin-top:18px"><h2>本問卷目前未開放填寫</h2></div>':'<form id="publicForm" class="questionList frontFormStack" onsubmit="submitResponse(event)"><div class="frontFormHeading"><h2>填寫問卷</h2></div>'+(f.identityMode==='member'?renderIdentityBlock(f):'')+normalizeQuestions(f.questions||[]).map(function(q){return renderPublicQuestion(q)}).join('')+'<div id="submitNotice" class="frontSubmitNotice questionHelp" hidden aria-live="polite"></div><div class="submitArea"><button id="submitBtn" class="btn primary" type="submit">確認並送出</button></div></form>')}
function formRowHtml(f){var manage=canManageForm(f.id),canDelete=canDeleteFormDirectly(f),id=attr(f.id),role=formRoleLabel(f);var buttons=[manage?actionButton('編輯',"editForm('"+id+"')"):'',actionButton('結果',"openResults('"+id+"')"),manage?actionButton('複製',"duplicateForm('"+id+"')"):'',canDelete?actionButton('刪除',"deleteForm('"+id+"')",'danger'):''];return '<tr><td><b>'+esc(f.title)+'</b><br><small>'+(f.questions||[]).length+' 題・'+esc(f.id)+'</small></td><td>'+statePillHtml(effectiveState(f))+'</td><td>'+esc(role)+'</td><td>'+creatorCellHtml(f)+'</td><td>'+esc(formatDeadline(f.deadline)||'未設定')+'</td><td>'+countPillHtml(responseCountForForm(f.id))+'</td><td>'+actionGroup(buttons)+'</td></tr>'}
function creatorCellHtml(f){var label=esc(formCreatorLabel(f));if(!isSystemAdmin)return label;return '<button type="button" class="creatorNameButton" onclick="changeFormCreator(\''+attr(f.id)+'\')" title="變更問卷建立者">'+label+'</button>'}
function renderFormManagers(){var rows=formManagers.map(function(m){var id=attr(m.id),enabled=m.enabled!==false,role=m.role==='manager'?'問卷管理者':'結果檢視者',member=findMemberByGoogleEmail(m.email),department=String(member?.department||member?.departmentName||'').trim()||'未紀錄',name=String(member?.name||'').trim()||'未紀錄',employeeNo=String(member?.employeeNo||member?.empNo||'').trim()||'未紀錄';var actions=[actionButton(enabled?'停用':'啟用',"toggleFormManager('"+id+"',"+(enabled?'false':'true')+")"),actionButton('移除',"removeFormManager('"+id+"')",'danger')];return '<tr><td>'+esc(department)+'</td><td><b>'+esc(name)+'</b></td><td>'+esc(employeeNo)+'</td><td>'+esc(role)+'</td><td><span class="statePill '+(enabled?'state-open':'state-closed')+'">'+(enabled?'啟用':'停用')+'</span></td><td>'+actionGroup(actions)+'</td></tr>'});$('formManagersTable').innerHTML=table(['部門','姓名','員工編號','權限','狀態','操作'],rows,'尚無資料');$('formManagersTable').querySelector('table')?.classList.add('formPermissionTableV161')}
function resultTimeValue(r){var raw=r.submittedAt&&r.submittedAt.toDate?r.submittedAt.toDate():r.submittedAt;var d=raw instanceof Date?raw:new Date(raw||r.submittedAtText||0);return Number.isNaN(d.getTime())?0:d.getTime()}
function resultMemberKeyword(r){return [r.departmentName,r.respondentDepartment,r.memberName,r.respondentName,r.employeeNo,r.respondentEmployeeId].map(function(x){return String(x||'')}).join(' ').toLowerCase()}
function resultDepartmentsForForm(f){if(!f||f.identityMode!=='member')return[];return Array.from(new Set(responses.map(function(r){return r.departmentName||r.respondentDepartment||''}).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'zh-Hant')})}
function missingScopeData(form,department){var data=completionData(form);if(!department)return data;var expected=data.expected.filter(function(member){return memberDepartmentName(member)===department}),filled=expected.filter(function(member){return data.filled.some(function(item){return item.id===member.id})}),filledIds=new Set(filled.map(function(member){return member.id})),missing=expected.filter(function(member){return !filledIds.has(member.id)});return{expected:expected,filled:filled,missing:missing}}
function renderMissingMembers(form){var panel=ensureMissingPanel();if(!panel)return;if(!form||form.identityMode!=='member'){panel.style.display='none';return}panel.style.display='block';var data=completionData(form),filter=$('missingDepartmentFilter'),previous=filter.value,deps=Array.from(new Set(data.expected.map(memberDepartmentName).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'zh-Hant')});filter.innerHTML='<option value="">全部部門</option>'+deps.map(function(dep){return '<option value="'+attr(dep)+'">'+esc(dep)+'</option>'}).join('');if(previous&&deps.includes(previous))filter.value=previous;var selected=filter.value,scoped=missingScopeData(form,selected),list=scoped.missing,manage=canManageForm(form.id);$('missingCaption').textContent=(selected?selected+'：':'全部部門：')+'顯示 '+list.length+' 位未填寫人員';$('completionStats').innerHTML='<div class="completionStat"><span>應填人數</span><strong>'+scoped.expected.length+'</strong></div><div class="completionStat"><span>已填人數</span><strong>'+scoped.filled.length+'</strong></div><div class="completionStat"><span>未填人數</span><strong>'+scoped.missing.length+'</strong></div>';$('missingMembersTable').innerHTML=list.length?table(['部門','姓名','員工編號','狀態'].concat(manage?['操作']:[]),list.map(function(member){return '<tr><td>'+esc(memberDepartmentName(member))+'</td><td><b>'+esc(member.name||'')+'</b></td><td>'+esc(memberEmployeeNo(member))+'</td><td><span class="statePill state-draft">未填寫</span></td>'+(manage?'<td>'+actionGroup([actionButton('協助填寫',"openAssistedFill('"+attr(member.id)+"')")])+'</td>':'')+'</tr>'})):emptyState(selected?'此部門目前沒有未填寫人員':'所有應填人員皆已完成','目前篩選條件下沒有未填寫人員。')}
function renderProgressPanelV171(){var form=activeForm(),caption=$('progressCaptionV171'),panel=ensureMissingPanel();if(!form||!formUsesMemberDatabaseV141(form)){if(caption)caption.textContent='此問卷未使用公司人員資料庫，無法計算應填及未填人員。';if(panel)panel.style.display='none';return}var data=completionData(form);if(caption)caption.textContent=form.title+'：應填 '+data.expected.length+' 人，已填 '+data.filled.length+' 人，未填 '+data.missing.length+' 人';renderMissingMembers(form)}
function safeSheetName(name,used){var base=String(name||'工作表').replace(/[\\/?*\[\]:]/g,'').slice(0,28)||'工作表',out=base,i=1;used=used||{};while(used[out]){out=(base.slice(0,25)+'_'+i++).slice(0,31)}used[out]=true;return out}
function exportMissingMembers(){var form=activeForm();if(!form||form.identityMode!=='member')return notify('目前問卷未使用公司人員名單');var data=completionData(form),deps=Array.from(new Set(data.expected.map(memberDepartmentName).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'zh-Hant')}),wb=XLSX.utils.book_new(),used={};setPageLoading(true,'正在匯出未填寫名單');try{XLSX.utils.book_append_sheet(wb,missingMembersSheet(form,''),safeSheetName('未填寫名單',used));deps.forEach(function(dep){XLSX.utils.book_append_sheet(wb,missingMembersSheet(form,dep),safeSheetName(dep,used))});XLSX.writeFile(wb,(form.title||'問卷')+'_未填寫名單.xlsx');toast('未填寫名單已匯出','success')}catch(e){console.error(e);notify('未填寫名單匯出失敗','error')}finally{setPageLoading(false)}}
function openDialog(opts){opts=opts||{};var mask=$('dialogMask'),inputWrap=$('dialogInputWrap'),input=$('dialogInput'),confirm=$('dialogConfirm'),message=$('dialogMessage');$('dialogTitle').textContent=opts.title||'確認操作';message.innerHTML=opts.messageHtml||esc(opts.message||'').replace(/\n/g,'<br>');$('dialogCancel').textContent=opts.cancelText||'取消';confirm.textContent=opts.confirmText||'確定';confirm.className='btn '+(opts.danger?'danger':'primary');dialogOptions={requiredText:opts.requiredText||''};inputWrap.style.display=opts.inputLabel?'flex':'none';inputWrap.classList.toggle('deleteConfirmInput',!!opts.deleteConfirm);inputWrap.firstChild.textContent=opts.inputLabel||'確認文字';input.value=opts.inputValue||'';input.placeholder=opts.inputPlaceholder||'';mask.style.display='grid';if(opts.inputLabel)setTimeout(function(){input.focus()},60);return new Promise(function(resolve){dialogResolve=resolve})}
function inputConfirmDialog(opts){opts=opts||{};return openDialog({title:opts.title||'確認操作',message:opts.message||'',messageHtml:opts.messageHtml||'',danger:!!opts.danger,inputLabel:opts.inputLabel||'請輸入確認文字',inputPlaceholder:opts.inputPlaceholder||'',requiredText:opts.requiredText||'',confirmText:opts.confirmText||(opts.danger?'確認刪除':'確定'),deleteConfirm:!!opts.deleteConfirm}).then(function(result){return result.ok?result.value:null})}
function confirmDeleteFormModalV136(f){return new Promise(function(resolve){document.querySelectorAll('.deleteFormModalV136').forEach(function(el){el.remove()});var overlay=document.createElement('div');overlay.className='deleteFormModalV136';overlay.innerHTML='<div class="deleteFormDialogV136" role="dialog" aria-modal="true" aria-label="永久刪除問卷"><button type="button" class="deleteFormCloseV136" aria-label="關閉">×</button><h3>永久刪除問卷</h3><p class="muted">這會刪除「'+esc(f.title||f.id||'未命名問卷')+'」及本問卷的填寫資料。此操作無法復原。</p><div class="deleteFormScopeV136"><b>會一起刪除</b><ul><li>問卷基本資料、題目設定與參考圖片設定</li><li>填寫結果、填寫鎖定與協助填寫紀錄</li><li>本問卷的分享成員與權限設定</li></ul><b>會保留</b><ul><li>人員主檔、部門資料</li><li>其他問卷與其他問卷的填寫資料</li></ul></div><label class="deleteFormConfirmFieldV136">請輸入 DELETE 確認刪除<input class="deleteFormConfirmInputV136" autocomplete="off" placeholder="DELETE"></label><div class="deleteFormActionsV136"><button type="button" class="btn deleteFormCancelV136">取消</button><button type="button" class="btn danger deleteFormConfirmBtnV136" disabled>永久刪除</button></div></div>';document.body.appendChild(overlay);var input=overlay.querySelector('.deleteFormConfirmInputV136'),confirmBtn=overlay.querySelector('.deleteFormConfirmBtnV136');function close(ok){overlay.remove();resolve(!!ok)}overlay.querySelector('.deleteFormCloseV136').onclick=function(){close(false)};overlay.querySelector('.deleteFormCancelV136').onclick=function(){close(false)};input.addEventListener('input',function(){confirmBtn.disabled=input.value.trim()!=='DELETE'});confirmBtn.onclick=function(){if(input.value.trim()==='DELETE')close(true)};setTimeout(function(){input.focus()},50)})}
async function deleteForm(id){var f=forms.find(function(x){return x.id===id});if(!f)return;if(!canDeleteFormDirectly(f))return notify('只有系統管理員或問卷建立者可以刪除此問卷','error');var confirmed=await confirmDeleteFormModalV136(f);if(!confirmed)return;setPageLoading(true,'正在刪除問卷與關聯資料');try{var hasStorage=!!f.imageStoragePath||normalizeQuestions(f.questions||[]).some(function(q){return !!q.imageStoragePath});if(hasStorage)await deleteStorageFolderV153('universal-forms/'+storageSafeSegmentV153(id));var responseSnap=await col('universalResponses').where('formId','==',id).get(),lockSnap=await col('universalResponseLocks').where('formId','==',id).get(),managerSnap=await col('universalFormManagers').where('formId','==',id).get();await deleteSnapshotInChunks(responseSnap);await deleteSnapshotInChunks(lockSnap);await deleteSnapshotInChunks(managerSnap);await doc('universalForms',id).delete();if(activeFormId===id)activeFormId='';await loadAdminData();showPanel('formsPanel');toast('問卷、圖片及關聯資料已刪除','success')}catch(e){console.error(e);notify('刪除失敗，請確認 Firestore 與 Storage 規則已部署','error')}finally{setPageLoading(false)}}
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
  select.innerHTML='<option value="">請選擇姓名</option>'+list.map(function(member){var employeeNo=memberEmployeeNo(member);return '<option value="'+attr(member.id)+'">'+(employeeNo?esc(employeeNo)+' ':'')+esc(member.name||'')+'</option>'}).join('');
  select.disabled=!department;
}
async function submitResponse(event){
  event.preventDefault();
  var f=activeForm();
  if(!f||f.state!=='open'||deadlinePassed(f.deadline))return notify('問卷已關閉，請重新整理頁面');
  var identity={},note=$('submitNotice')||$('submitNote');
  if(note){note.textContent='';note.classList.remove('submitError');note.hidden=true}
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
  if(!await confirmDialog('確認送出這份問卷嗎？送出後'+formCorrectionContactText(f),'確認送出'))return;
  var btn=$('submitBtn');btn.disabled=true;btn.textContent='送出中';setPageLoading(true,'正在送出問卷');
  var uploadKey=responseKey||('free_'+Date.now()+'_'+Math.random().toString(36).slice(2,8)),uploaded=[];
  try{
    var prepared=await collectAndUploadResponseFilesV154(event.target,f,'q_',uploadKey,answers);
    answers=prepared.answers;uploaded=prepared.uploaded;
    var payload=Object.assign({formId:f.id,formTitle:f.title},identity,{answers:answers,submissionMethod:'self',submittedAt:firebase.firestore.FieldValue.serverTimestamp(),submittedAtText:new Date().toLocaleString('zh-TW')});
    await writeResponseWithLock(f,responseKey,payload,responseKey?{formId:f.id,memberId:identity.memberId,submissionMethod:'self',createdAt:firebase.firestore.FieldValue.serverTimestamp()}:null);
    var successText=formUsesMemberDatabaseV141(f)?'已收到您的填寫內容。每位同仁限填一次；'+formCorrectionContactText(f):'已收到您的填寫內容，感謝您的填寫。';
    frontMain.innerHTML='<div class="successCard submitSuccessCard"><h2>填寫成功</h2><p>'+esc(successText)+'</p><button class="btn primary" onclick="location.reload()">返回問卷</button></div>';
    toast('填寫成功','success');
  }catch(e){
    console.error(e);
    await Promise.all(uploaded.map(function(path){return deleteStoragePathV153(path)}));
    var message=e.message==='duplicate-response'||e.code==='permission-denied'?'您已填寫過這份問卷，無法重複送出。'+formCorrectionContactText(f):'送出失敗，請檢查網路後再試一次';
    if(note){note.textContent=message;note.classList.add('submitError');note.hidden=false;note.scrollIntoView({behavior:'smooth',block:'center'})}
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
  var menu=$('surveyWorkMenu');
  if(!menu)return;
  var before=[].slice.call(menu.querySelectorAll('button')).find(function(btn){return /填寫結果|回覆與分析/.test(btn.textContent)});
  var html='<button id="formMembersNav" class="nav" onclick="showPanel(\'formMembersPanel\',this);renderFormMembersPanel()">填寫對象</button>';
  if(before)before.insertAdjacentHTML('beforebegin',html);else menu.insertAdjacentHTML('beforeend',html);
}
function ensureFormMembersPanelV140(){
  if($('formMembersPanel'))return;
  var anchor=$('resultsPanel')||$('permissionsPanel')||$('membersPanel');
  if(!anchor)return;
  anchor.insertAdjacentHTML('beforebegin','<section id="formMembersPanel" class="panel"><div class="card"><div class="sectionHead"><div><h2>填寫對象</h2><p>選擇可在前台填寫本問卷的人員；已選人員會納入應填、已填及未填統計。</p></div><button class="btn primary" type="button" onclick="saveFormMemberSettingsV140()">儲存填寫對象</button></div><div id="formMembersBody"></div></div></section>');
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
  if(form.identityMode!=='member'){body.innerHTML=emptyState('此問卷未使用公司人員資料庫','自由填寫或自行設計填寫者資料的問卷，不需要設定填寫對象。');return}
  if(!canManageForm(form.id)){body.innerHTML=emptyState('沒有管理權限','只有系統管理員、問卷建立者或問卷管理者可以維護填寫對象。');return}
  resetFormMemberSelectionIfNeededV140(form);
  var all=departmentTargetMembersForFormV140(form),deps=Array.from(new Set(all.map(memberDepartmentName).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'zh-Hant')}),list=formMemberFilteredListV140(form),data=completionData(form);
  body.innerHTML='<div class="formMemberIntroV140"><div><b>'+esc(form.title||'未命名問卷')+'</b><p>未另外設定時，系統會依「開放填寫部門」納入所有啟用同仁；儲存後僅開放已選人員填寫，並納入填寫進度統計。</p></div><div class="formMemberStatsV140"><span>候選 '+all.length+' 人</span><span>已選 '+formMemberSelectionSetV140.size+' 人</span><span>已填 '+data.filled.length+' 人</span></div></div><div class="formMemberToolsV140"><label>部門<select id="formMemberDepartmentFilter" onchange="formMemberFilterStateV140.department=this.value;renderFormMembersTableV140(formMemberFilteredListV140(activeForm()))"><option value="">全部部門</option>'+deps.map(function(dep){return '<option value="'+attr(dep)+'" '+(formMemberFilterStateV140.department===dep?'selected':'')+'>'+esc(dep)+'</option>'}).join('')+'</select></label><label>搜尋<input id="formMemberSearch" type="search" placeholder="姓名、部門、員工編號" value="'+attr(formMemberFilterStateV140.search||'')+'" oninput="formMemberFilterStateV140.search=this.value;renderFormMembersTableV140(formMemberFilteredListV140(activeForm()))"></label><button class="btn" type="button" onclick="selectFilteredFormMembersV140(true)">全選目前篩選</button><button class="btn" type="button" onclick="selectFilteredFormMembersV140(false)">取消目前篩選</button><button class="btn" type="button" onclick="useDepartmentMembersV140()">依部門全部帶入</button></div><div id="formMemberTableV140"></div>';
  renderFormMembersTableV140(list);
}
function renderFormMembersTableV140(list){
  var target=$('formMemberTableV140');
  if(!target)return;
  target.innerHTML=list.length?table(['開放填寫','部門','姓名','員工編號','狀態'],list.map(function(member){
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
  if(!canManageForm(form.id))return notify('您沒有維護此問卷填寫對象的權限','error');
  var allowed=new Set(departmentTargetMembersForFormV140(form).map(function(member){return String(member.id||'')})),ids=Array.from(formMemberSelectionSetV140).filter(function(id){return allowed.has(String(id))});
  if(!ids.length)return notify('請至少選擇一位填寫對象','warn');
  setPageLoading(true,'正在儲存填寫對象');
  try{
    await doc('universalForms',form.id).set({targetMemberIds:ids,targetMemberMode:'custom',targetMemberUpdatedAt:firebase.firestore.FieldValue.serverTimestamp(),targetMemberUpdatedByEmail:normalizeEmail((currentUser&&currentUser.email)||''),targetMemberUpdatedByName:adminDisplayName()}, {merge:true});
    await loadAdminData();
    formMemberSelectionFormIdV140='';
    renderFormMembersPanel();
    renderDashboard();
    renderResults();
    toast('填寫對象已儲存','success');
  }catch(e){console.error(e);notify('填寫對象儲存失敗，請確認權限或網路狀態','error')}
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
      if($('panelTitle'))$('panelTitle').textContent='填寫對象';
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
  var targetIds=formTargetMemberIdsV140(source),newId='form_'+Date.now(),copiedQuestions=normalizeQuestions(JSON.parse(JSON.stringify(source.questions||[])));copiedQuestions.forEach(function(q){q.imageStoragePath=''});var data={title:(source.title||'未命名問卷')+'（複製）',description:source.description||'',descriptionHtml:source.descriptionHtml||'',descriptionFontSize:normalizeDescriptionFontSizeV156(source.descriptionFontSize),descriptionAlign:normalizeDescriptionAlignV156(source.descriptionAlign),deadline:'',state:'draft',imageUrl:source.imageUrl||'',imageStoragePath:'',referenceFiles:[],theme:formTheme(source),identityMode:source.identityMode||'member',targetDepartments:[].concat(source.targetDepartments||[]),questions:copiedQuestions,createdByUid:(currentUser&&currentUser.uid)||'',createdByEmail:normalizeEmail((currentUser&&currentUser.email)||''),createdByName:adminDisplayName()||(currentUser&&currentUser.displayName)||(currentUser&&currentUser.email)||'',createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedByUid:(currentUser&&currentUser.uid)||'',updatedByEmail:normalizeEmail((currentUser&&currentUser.email)||''),updatedByName:adminDisplayName()};
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
  var html='<div id="resultDetailTools" class="resultDetailTools" data-form-id="'+attr(f.id)+'" data-mode="'+mode+'"><label>搜尋<input id="resultSearchInput" type="search" placeholder="'+attr(searchPlaceholder)+'" value="'+attr(resultDetailState.search||'')+'" oninput="resultDetailState.search=this.value;renderResults()"></label>'+departmentHtml+'<label>顯示排序<select id="resultSortSelect" onchange="resultDetailState.sort=this.value;renderResults()">'+sortOptions+'</select></label></div>';
  head.insertAdjacentHTML('afterend',html);
}
function analysisQuestionsV170(f){return normalizeQuestions(f.questions||[]).filter(function(q){return q.type!=='image'&&q.type!=='file'})}
function questionAnalysisCardV170(q){if(['single','dropdown','department'].includes(q.type))return pieHtml(q.title,optionCounts(q),answeredResponseCountV168(q));if(q.type==='multiple')return multipleAnalysisHtml(q);if(['linearScale','rating'].includes(q.type))return scaleAnalysisHtml(q);if(MATRIX_TYPES_V132.includes(q.type))return matrixAnalysisHtml(q);return textAnalysisHtml(q)}
function renderAnalysis(f){
  var total=responses.length,memberMode=formUsesMemberDatabaseV141(f),departmentsUsed=new Set(responses.map(function(r){return r.departmentName||r.respondentDepartment}).filter(Boolean)),latest=(responses[0]&&responses[0].submittedAtText)||'',depMap=new Map();
  responses.forEach(function(r){var d=r.departmentName||r.respondentDepartment||'未填部門';depMap.set(d,(depMap.get(d)||0)+1)});
  var cards=[];
  if(memberMode)cards.push(pieHtml('部門分布',[...depMap].map(function(x){return {label:x[0],count:x[1]}}),total));
  analysisQuestionsV170(f).forEach(function(q){cards.push(questionAnalysisCardV170(q))});
  var secondLabel=memberMode?'填寫部門數':'題目數',secondValue=memberMode?departmentsUsed.size:analysisQuestionsV170(f).length;
  return '<div class="analysisSummary"><div class="analysisMetric"><span>總填寫份數</span><b>'+total+'</b></div><div class="analysisMetric"><span>'+secondLabel+'</span><b>'+secondValue+'</b></div><div class="analysisMetric"><span>最近填寫時間</span><b class="analysisMetricTimeV173">'+esc(latest||'尚無紀錄')+'</b></div></div>'+(total?'<div class="analysisGrid">'+cards.join('')+'</div>':'<div class="emptyAnalysis">目前尚無填寫資料，收到回覆後會自動產生統計。</div>');
}
var resultViewModeV170='summary',resultQuestionIndexV170=0,resultIndividualIndexV170=0;
function updateResultViewVisibilityV170(){var map={summary:'resultAnalysis',question:'resultQuestionViewV170',individual:'resultIndividualViewV170',details:'resultDetailViewV171'};Object.keys(map).forEach(function(mode){var panel=$(map[mode]);if(panel)panel.hidden=resultViewModeV170!==mode});document.querySelectorAll('[data-result-view-v170]').forEach(function(button){var selected=button.dataset.resultViewV170===resultViewModeV170;button.setAttribute('aria-selected',selected?'true':'false');button.tabIndex=selected?0:-1;button.disabled=!activeForm()})}
function setResultViewV170(mode,button){if(!['summary','question','individual','details'].includes(mode))return;resultViewModeV170=mode;updateResultViewVisibilityV170();if(button)button.focus()}
function moveResultQuestionV170(step){var f=activeForm(),questions=f?analysisQuestionsV170(f):[];if(!questions.length)return;resultQuestionIndexV170=Math.max(0,Math.min(questions.length-1,resultQuestionIndexV170+Number(step||0)));renderQuestionViewV170(f)}
function selectResultQuestionV170(value){resultQuestionIndexV170=Math.max(0,Number(value)||0);var f=activeForm();if(f)renderQuestionViewV170(f)}
function renderQuestionViewV170(f){var target=$('resultQuestionViewV170'),questions=f?analysisQuestionsV170(f):[];if(!target)return;if(!questions.length){target.innerHTML='<div class="emptyAnalysis">目前沒有可顯示的統計題目。</div>';return}resultQuestionIndexV170=Math.max(0,Math.min(questions.length-1,resultQuestionIndexV170));var q=questions[resultQuestionIndexV170],options=questions.map(function(item,index){return '<option value="'+index+'" '+(index===resultQuestionIndexV170?'selected':'')+'>'+esc((index+1)+'．'+item.title)+'</option>'}).join('');target.innerHTML='<div class="resultQuestionNavigatorV170"><button type="button" class="btn" onclick="moveResultQuestionV170(-1)" '+(resultQuestionIndexV170===0?'disabled':'')+'>上一題</button><label><span>選擇題目</span><select onchange="selectResultQuestionV170(this.value)">'+options+'</select></label><span class="resultPageCountV170">'+(resultQuestionIndexV170+1)+'／'+questions.length+'</span><button type="button" class="btn" onclick="moveResultQuestionV170(1)" '+(resultQuestionIndexV170===questions.length-1?'disabled':'')+'>下一題</button></div><div class="singleQuestionAnalysisV170">'+questionAnalysisCardV170(q)+'</div>'}
function resultIndividualResponsesV173(){return responses.slice()}
function moveResultIndividualV170(step){var f=activeForm(),list=f?resultIndividualResponsesV173():[];if(!list.length)return;resultIndividualIndexV170=Math.max(0,Math.min(list.length-1,resultIndividualIndexV170+Number(step||0)));renderIndividualNavigatorV170(f,list)}
function renderIndividualNavigatorV170(f,list){var target=$('resultIndividualNavigatorV170');if(!target)return;list=Array.isArray(list)?list:[];if(!list.length){target.innerHTML='<div class="emptyAnalysis">目前沒有個別回覆。</div>';return}resultIndividualIndexV170=Math.max(0,Math.min(list.length-1,resultIndividualIndexV170));var response=list[resultIndividualIndexV170],memberMode=formUsesMemberDatabaseV141(f),name=memberMode?(response.memberName||response.respondentName||'未具名'):'匿名回覆 '+(resultIndividualIndexV170+1),meta=[memberMode?(response.departmentName||response.respondentDepartment||''):null,response.submittedAtText||formatAnyDate(response.submittedAt)||'',submissionMethodLabelV144(response,f)].filter(Boolean).join('・'),questions=normalizeQuestions(f.questions||[]).filter(function(q){return q.type!=='image'}),answers=questions.map(function(q){return '<div class="individualAnswerV170"><dt>'+esc(q.title)+'</dt><dd>'+resultAnswerHtmlV154(q,response)+'</dd></div>'}).join('');target.innerHTML='<section class="individualResponseCardV170"><div class="individualResponseNavV170"><button type="button" class="btn" onclick="moveResultIndividualV170(-1)" '+(resultIndividualIndexV170===0?'disabled':'')+'>上一份</button><div><strong>'+esc(name)+'</strong><span>'+esc(meta)+'</span><small>第 '+(resultIndividualIndexV170+1)+'／'+list.length+' 份</small></div><button type="button" class="btn" onclick="moveResultIndividualV170(1)" '+(resultIndividualIndexV170===list.length-1?'disabled':'')+'>下一份</button></div><dl class="individualAnswerListV170">'+answers+'</dl></section>'}
function responseDetailRow(f,qs,r,manage){
  var id=attr(r.id),method='<b>'+esc(submissionMethodLabel(r))+'</b>'+(r.submissionMethod==='assisted'?'<br><small>由 '+esc(submitterLabel(r))+' 協助填寫</small>':''),actions=manage?actionGroup([actionButton('編輯',"openResponseEditor('"+id+"')"),actionButton('刪除',"deleteResponse('"+id+"')",'danger')]):roleBadgeHtml('唯讀',false);
  return '<tr>'+(formUsesMemberDatabaseV141(f)?'<td>'+esc(r.departmentName||r.respondentDepartment||'')+'</td><td>'+esc(r.memberName||r.respondentName||'')+'</td><td>'+esc(r.employeeNo||r.respondentEmployeeId||'')+'</td>':'')+qs.map(function(q){return '<td>'+esc(answerText(q,r))+'</td>'}).join('')+'<td>'+esc(r.submittedAtText||formatAnyDate(r.submittedAt)||'')+'</td><td>'+method+'</td><td>'+actions+'</td></tr>';
}
function updateResultExportMenuV169(f){var memberMode=!!(f&&formUsesMemberDatabaseV141(f));document.querySelectorAll('[data-member-export-v169]').forEach(function(button){button.hidden=!memberMode});var menu=$('resultExportMenuV169');if(menu&&!f)menu.removeAttribute('open')}
document.addEventListener('pointerdown',function(event){var menu=$('resultExportMenuV169');if(menu&&menu.open&&!menu.contains(event.target))menu.removeAttribute('open')});
document.addEventListener('keydown',function(event){var menu=$('resultExportMenuV169');if(event.key==='Escape'&&menu&&menu.open){menu.removeAttribute('open');menu.querySelector('summary')?.focus()}});
function renderResults(){
  var f=activeForm(),progress=f&&formUsesMemberDatabaseV141(f)?completionData(f):null;
  updateResultExportMenuV169(f);
  $('resultCaption').textContent=f?f.title+'：共 '+responses.length+' 份回覆'+(progress?'；應填 '+progress.expected.length+' 人，未填 '+progress.missing.length+' 人':''):'請先選擇問卷。';
  if(!f){$('resultAnalysis').innerHTML='';$('resultQuestionViewV170').innerHTML='';$('resultIndividualNavigatorV170').innerHTML='';resultsTable.innerHTML='';updateResultViewVisibilityV170();return}
  $('resultAnalysis').innerHTML=renderAnalysis(f);
  renderQuestionViewV170(f);
  ensureResultDetailTools(f);
  var qs=normalizeQuestions(f.questions||[]).filter(function(q){return q.type!=='image'}),identityHeaders=formUsesMemberDatabaseV141(f)?['部門','姓名','員工編號']:[],manage=canManageForm(f.id),list=filteredResultResponses(f);
  renderIndividualNavigatorV170(f,resultIndividualResponsesV173());
  resultsTable.innerHTML=table(identityHeaders.concat(qs.map(function(q){return q.title}),['送出時間','填寫方式','操作']),list.map(function(r){return responseDetailRow(f,qs,r,manage)}),emptyState('查無填寫明細','請調整搜尋或篩選條件。'));
  updateResultViewVisibilityV170();
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
    XLSX.utils.book_append_sheet(wb,optionSelectionRosterSheetV170(f),'選項填答名單');
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
function exportCompletionProgressV169(){
  var f=activeForm();if(!f)return notify('請先選擇問卷');if(!formUsesMemberDatabaseV141(f))return notify('此問卷沒有公司填寫對象資料','warn');
  setPageLoading(true,'正在匯出填寫進度');
  try{var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,completionProgressSheet(f),'填寫進度');XLSX.writeFile(wb,(f.title||'問卷')+'_填寫進度.xlsx');toast('填寫進度已匯出','success')}catch(e){console.error(e);notify('填寫進度匯出失敗','error')}finally{setPageLoading(false)}
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
function storageSafeSegmentV153(value){return String(value||'item').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(0,90)||'item'}
async function uploadImageFileV153(formId,kind,questionId,file){
  if(!storage)throw new Error('Firebase Storage 尚未初始化');
  var fileName=Date.now()+'_'+Math.random().toString(36).slice(2,8)+'_'+storageSafeSegmentV153(file.name),folder=kind==='header'?'header':('questions/'+storageSafeSegmentV153(questionId)),path='universal-forms/'+storageSafeSegmentV153(formId)+'/'+folder+'/'+fileName,ref=storage.ref().child(path);
  await ref.put(file,{contentType:file.type,customMetadata:{formId:String(formId),questionId:String(questionId||''),uploadedByUid:(currentUser&&currentUser.uid)||''}});
  return {path:path,url:await ref.getDownloadURL()};
}
async function deleteStoragePathV153(path){if(!storage||!path)return;try{await storage.ref().child(path).delete()}catch(e){if(!/object-not-found/i.test(String((e&&e.code)||e)))throw e}}
async function deleteStorageFolderV153(path){if(!storage||!path)return;var ref=storage.ref().child(path),result;try{result=await ref.listAll()}catch(e){if(/object-not-found/i.test(String((e&&e.code)||e)))return;throw e}await Promise.all(result.items.map(function(item){return item.delete()}));for(var prefix of result.prefixes)await deleteStorageFolderV153(prefix.fullPath)}
function existingQuestionMapV153(form){var map=new Map();normalizeQuestions((form&&form.questions)||[]).forEach(function(q){map.set(String(q.id),q)});return map}
async function prepareStoredImagesV153(formId,existing,questions){
  var uploaded=[],obsolete=[],headerUrl=$('formImageUrl').value.trim(),headerPath='',existingHeaderPath=(existing&&existing.imageStoragePath)||'',existingHeaderUrl=(existing&&existing.imageUrl)||'',oldQuestions=existingQuestionMapV153(existing);
  try{
    if(pendingHeaderImageFile){var header=await uploadImageFileV153(formId,'header','',pendingHeaderImageFile);uploaded.push(header.path);headerUrl=header.url;headerPath=header.path}else if(existingHeaderPath&&headerUrl===existingHeaderUrl)headerPath=existingHeaderPath;
    if(existingHeaderPath&&existingHeaderPath!==headerPath)obsolete.push(existingHeaderPath);
    for(var q of questions){var old=oldQuestions.get(String(q.id)),oldPath=(old&&old.imageStoragePath)||'',oldUrl=(old&&old.imageUrl)||'',pending=pendingQuestionImageFiles.get(q.id);if(pending){var image=await uploadImageFileV153(formId,'question',q.id,pending);uploaded.push(image.path);q.imageUrl=image.url;q.imageStoragePath=image.path}else if(oldPath&&q.imageUrl===oldUrl)q.imageStoragePath=oldPath;else q.imageStoragePath=q.imageStoragePath||'';if(oldPath&&oldPath!==q.imageStoragePath)obsolete.push(oldPath);oldQuestions.delete(String(q.id))}
    oldQuestions.forEach(function(q){if(q.imageStoragePath)obsolete.push(q.imageStoragePath)});
    return {headerUrl:headerUrl,headerPath:headerPath,questions:questions,uploaded:uploaded,obsolete:Array.from(new Set(obsolete))};
  }catch(e){await Promise.all(uploaded.map(function(path){return deleteStoragePathV153(path).catch(function(){})}));throw e}
}

/* v1.56: rich survey description and survey-level reference files. */
var pendingReferenceFilesV156=[];
var retainedReferenceFilesV156=[];
var descriptionSelectionV156=null;
function normalizeDescriptionFontSizeV156(value){value=Number(value);return [14,16,18,20].includes(value)?value:16}
function normalizeDescriptionAlignV156(value){return value==='center'?'center':'left'}
function safeRichHrefV156(value){value=String(value||'').trim();return /^(https?:\/\/|mailto:)/i.test(value)?value:''}
function richTextToHtmlV156(value){return esc(String(value||'')).replace(/\r?\n/g,'<br>')}
function sanitizeRichHtmlV156(html){
  var source=document.createElement('div'),output=document.createElement('div'),allowed=new Set(['B','STRONG','UL','OL','LI','A','BR','DIV','P']);
  source.innerHTML=String(html||'');
  function appendNode(node,parent){
    if(node.nodeType===Node.TEXT_NODE){parent.appendChild(document.createTextNode(node.nodeValue||''));return}
    if(node.nodeType!==Node.ELEMENT_NODE)return;
    var tag=node.tagName.toUpperCase();
    if(!allowed.has(tag)){Array.from(node.childNodes).forEach(function(child){appendNode(child,parent)});return}
    var element=document.createElement(tag==='STRONG'?'strong':tag.toLowerCase());
    if(tag==='A'){
      var href=safeRichHrefV156(node.getAttribute('href'));
      if(!href){Array.from(node.childNodes).forEach(function(child){appendNode(child,parent)});return}
      element.setAttribute('href',href);element.setAttribute('target','_blank');element.setAttribute('rel','noopener noreferrer');
    }
    Array.from(node.childNodes).forEach(function(child){appendNode(child,element)});parent.appendChild(element);
  }
  Array.from(source.childNodes).forEach(function(node){appendNode(node,output)});
  return output.innerHTML;
}
function descriptionDataV156(){
  var editor=$('formDescriptionEditor'),html=sanitizeRichHtmlV156(editor?editor.innerHTML:''),plain=String(editor?editor.innerText:'').replace(/\u00a0/g,' ').trim();
  if($('formDescription'))$('formDescription').value=plain;
  return {description:plain,descriptionHtml:html,descriptionFontSize:normalizeDescriptionFontSizeV156($('formDescriptionFontSize')&&$('formDescriptionFontSize').value),descriptionAlign:normalizeDescriptionAlignV156($('formDescriptionAlign')&&$('formDescriptionAlign').value)};
}
function setDescriptionEditorV156(form){
  form=form||{};var editor=$('formDescriptionEditor'),html=form.descriptionHtml?sanitizeRichHtmlV156(form.descriptionHtml):richTextToHtmlV156(form.description||'');
  if(editor)editor.innerHTML=html;if($('formDescription'))$('formDescription').value=String(form.description||'');
  if($('formDescriptionFontSize'))$('formDescriptionFontSize').value=String(normalizeDescriptionFontSizeV156(form.descriptionFontSize));
  if($('formDescriptionAlign'))$('formDescriptionAlign').value=normalizeDescriptionAlignV156(form.descriptionAlign);
}
async function runDescriptionCommandV156(command){
  var editor=$('formDescriptionEditor');if(!editor)return;
  editor.focus();
  if(command==='createLink'){
    var selection=window.getSelection();descriptionSelectionV156=selection&&selection.rangeCount?selection.getRangeAt(0).cloneRange():null;
    var rawHref=await inputConfirmDialog({title:'加入連結',message:'請輸入完整網址，例如 https://www.example.com',inputLabel:'連結網址',inputPlaceholder:'https://',confirmText:'加入連結'});
    if(rawHref===null)return;
    var href=safeRichHrefV156(rawHref);if(!href){notify('請輸入 http、https 或 mailto 開頭的安全連結','warn');return}
    editor.focus();if(descriptionSelectionV156){selection=window.getSelection();selection.removeAllRanges();selection.addRange(descriptionSelectionV156)}
    document.execCommand('createLink',false,href);
  }else{
    document.execCommand(command,false,null);
    if(command==='removeFormat')document.execCommand('unlink',false,null);
  }
  descriptionDataV156();markFormDirty();
}
function initDescriptionEditorV156(){
  if(window.__descriptionEditorV156Ready)return;window.__descriptionEditorV156Ready=true;
  document.querySelectorAll('.richToolButtonV156[data-command]').forEach(function(button){button.addEventListener('mousedown',function(event){event.preventDefault()});button.addEventListener('click',function(){runDescriptionCommandV156(button.getAttribute('data-command'))})});
  var editor=$('formDescriptionEditor');if(editor)editor.addEventListener('input',function(){descriptionDataV156();markFormDirty()});
  ['formDescriptionFontSize','formDescriptionAlign'].forEach(function(id){var field=$(id);if(field)field.addEventListener('change',markFormDirty)});
}
function referenceFileKeyV156(file){return String((file&&file.path)||'pending:'+((file&&file.pendingId)||''))}
function resetReferenceFilesV156(files){retainedReferenceFilesV156=[].concat(files||[]).filter(function(file){return file&&file.path});pendingReferenceFilesV156=[];renderReferenceFilesV156()}
function chooseReferenceFilesV156(){var input=$('formReferenceFiles');if(input)input.click()}
function handleReferenceFilesV156(fileList){
  var files=Array.from(fileList||[]);
  files.forEach(function(file){pendingReferenceFilesV156.push({file:file,pendingId:Date.now()+'_'+Math.random().toString(36).slice(2,8)})});
  if(files.length)markFormDirty();renderReferenceFilesV156();
}
function removeReferenceFileV156(key){
  retainedReferenceFilesV156=retainedReferenceFilesV156.filter(function(file){return referenceFileKeyV156(file)!==key});
  pendingReferenceFilesV156=pendingReferenceFilesV156.filter(function(file){return referenceFileKeyV156(file)!==key});
  markFormDirty();renderReferenceFilesV156();
}
function fileSizeTextV156(size){size=Number(size||0);if(size>=1048576)return (size/1048576).toFixed(size>=10485760?0:1)+' MB';if(size>=1024)return Math.round(size/1024)+' KB';return size+' B'}
function paperclipIconV173(){return '<svg class="paperclipIconV173" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 12.9 14.6 6.5a3 3 0 0 1 4.2 4.2l-8.1 8.1a5 5 0 0 1-7.1-7.1l8.2-8.2"></path><path d="m7.5 14.8 7.8-7.8a1.5 1.5 0 0 1 2.1 2.1l-7.8 7.8a2.7 2.7 0 0 1-3.8-3.8l7.5-7.5"></path></svg>'}
function frontPaperclipIconV174(){return '<svg class="frontPaperclipIconV174" viewBox="0 0 24 24" aria-hidden="true"><path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"></path></svg>'}
function renderReferenceFilesV156(){
  var list=$('referenceFileListV156'),status=$('referenceFileStatusV156');if(!list||!status)return;
  var existing=retainedReferenceFilesV156.map(function(file){return {key:referenceFileKeyV156(file),name:file.name||'檔案',size:file.size||0,pending:false}}),pending=pendingReferenceFilesV156.map(function(item){return {key:referenceFileKeyV156(item),name:item.file.name,size:item.file.size,pending:true}}),all=existing.concat(pending);
  status.textContent=all.length?('已選擇 '+all.length+' 個檔案'):'尚未選擇檔案';
  list.innerHTML=all.map(function(file){return '<div class="referenceFileItemV156">'+paperclipIconV173()+'<div><b>'+esc(file.name)+'</b><small>'+esc(fileSizeTextV156(file.size))+(file.pending?' · 儲存問卷時上傳':'')+'</small></div><button type="button" class="btn danger" onclick="removeReferenceFileV156(\''+attr(file.key)+'\')">移除</button></div>'}).join('');
}
async function uploadReferenceFileV156(formId,item){
  if(!storage)throw new Error('Firebase Storage 尚未初始化');var file=item.file,fileName=Date.now()+'_'+Math.random().toString(36).slice(2,8)+'_'+storageSafeSegmentV153(file.name),path='universal-forms/'+storageSafeSegmentV153(formId)+'/references/'+fileName,ref=storage.ref().child(path);
  await ref.put(file,{contentType:file.type||'application/octet-stream',customMetadata:{formId:String(formId),kind:'reference',originalName:file.name,uploadedByUid:(currentUser&&currentUser.uid)||''}});
  return {name:file.name,path:path,size:file.size,type:file.type||'application/octet-stream'};
}
async function prepareReferenceFilesV156(formId,existing){
  var uploaded=[],oldFiles=[].concat((existing&&existing.referenceFiles)||[]),retainedPaths=new Set(retainedReferenceFilesV156.map(function(file){return file.path}));
  try{for(var item of pendingReferenceFilesV156){var saved=await uploadReferenceFileV156(formId,item);uploaded.push(saved)}return {files:retainedReferenceFilesV156.concat(uploaded),uploaded:uploaded.map(function(file){return file.path}),obsolete:oldFiles.filter(function(file){return file&&file.path&&!retainedPaths.has(file.path)}).map(function(file){return file.path})}}catch(e){await Promise.all(uploaded.map(function(file){return deleteStoragePathV153(file.path).catch(function(){})}));throw e}
}
function frontDescriptionHtmlV156(form){
  var html=form.descriptionHtml?sanitizeRichHtmlV156(form.descriptionHtml):richTextToHtmlV156(form.description||'');if(!html)return '';
  return '<div class="frontDescriptionV156" style="font-size:'+normalizeDescriptionFontSizeV156(form.descriptionFontSize)+'px;text-align:'+normalizeDescriptionAlignV156(form.descriptionAlign)+'">'+html+'</div>';
}
function frontReferenceFilesHtmlV156(form){
  var files=[].concat(form.referenceFiles||[]).filter(function(file){return file&&file.path});if(!files.length)return '';
  return '<div class="frontReferenceFilesV156 frontFilesOnlyV173 frontAttachmentsV174"><div>'+files.map(function(file){var name=String(file.name||'檔案');return '<button type="button" title="'+attr('開啟附件：'+name)+'" aria-label="'+attr('開啟附件：'+name)+'" onclick="openReferenceFileV156(\''+attr(file.path)+'\')">'+frontPaperclipIconV174()+'<span>'+esc(name)+'</span></button>'}).join('')+'</div></div>';
}
async function openReferenceFileV156(path){try{var url=await storage.ref().child(path).getDownloadURL();window.open(url,'_blank','noopener')}catch(e){console.error(e);notify('檔案目前無法開啟','error')}}
function installMobileHeaderV156(){
  var area=document.querySelector('.adminShell .topUserArea');if(!area||$('mobileAccountMenuV156'))return;
  var menu=document.createElement('details');menu.id='mobileAccountMenuV156';menu.className='mobileAccountMenuV156';
  menu.innerHTML='<summary aria-label="帳號選單" title="帳號選單"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c.6-4 3.1-6 7-6s6.4 2 7 6"></path></svg></summary><div class="mobileAccountPanelV156"><div class="mobileAccountIdentityV156"><strong></strong><small></small></div><button type="button" onclick="logout()">登出</button></div>';
  area.appendChild(menu);
  function sync(){var name=$('adminUserName'),account=$('adminUser');menu.querySelector('strong').textContent=(name&&name.textContent.trim())||'目前帳號';menu.querySelector('small').textContent=(account&&account.textContent.trim())||''}
  sync();var observer=new MutationObserver(sync);if($('adminUserName'))observer.observe($('adminUserName'),{childList:true,subtree:true,characterData:true});if($('adminUser'))observer.observe($('adminUser'),{childList:true,subtree:true,characterData:true});
  document.addEventListener('pointerdown',function(event){if(menu.open&&!event.target.closest('#mobileAccountMenuV156'))menu.open=false});
}
async function saveForm(){
  var title=$('formTitle').value.trim();if(!title)return notify('請輸入問卷標題');
  draftQuestions=normalizeQuestions(draftQuestions);if(!draftQuestions.length)return notify('請至少建立一個題目');
  var err=formQuestionsValid();if(err)return notify(err);
  var identityMode=$('identityMode').value,targetDepartments=identityMode==='member'?[].slice.call(document.querySelectorAll('.targetDepartment:checked')).map(function(x){return x.value}):[];
  if(identityMode==='member'&&!targetDepartments.length)return notify('請至少選擇一個開放填寫部門');
  var id=editMode==='edit'?editingId:'form_'+Date.now(),existing=editMode==='edit'?forms.find(function(f){return f.id===editingId}):null,descriptionData=descriptionDataV156(),data={title:title,description:descriptionData.description,descriptionHtml:descriptionData.descriptionHtml,descriptionFontSize:descriptionData.descriptionFontSize,descriptionAlign:descriptionData.descriptionAlign,deadline:$('formDeadline').value,state:$('formState').value,imageUrl:$('formImageUrl').value.trim(),imageStoragePath:'',theme:formTheme({theme:($('formTheme')||{}).value}),identityMode:identityMode,targetDepartments:targetDepartments,questions:draftQuestions,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedByUid:(currentUser&&currentUser.uid)||'',updatedByEmail:normalizeEmail((currentUser&&currentUser.email)||''),updatedByName:adminDisplayName()};
  if(identityMode!=='member'){data.targetMemberIds=firebase.firestore.FieldValue.delete();data.targetMemberMode=firebase.firestore.FieldValue.delete();data.targetMemberUpdatedAt=firebase.firestore.FieldValue.delete();data.targetMemberUpdatedByEmail=firebase.firestore.FieldValue.delete();data.targetMemberUpdatedByName=firebase.firestore.FieldValue.delete()}
  if(editMode==='new'){data.createdAt=firebase.firestore.FieldValue.serverTimestamp();data.createdByUid=(currentUser&&currentUser.uid)||'';data.createdByEmail=normalizeEmail((currentUser&&currentUser.email)||'');data.createdByName=adminDisplayName()||(currentUser&&currentUser.displayName)||(currentUser&&currentUser.email)||''}
  var btn=$('saveFormBtn');btn.disabled=true;btn.textContent='儲存中';setPageLoading(true,'正在儲存問卷');
  var createdBase=false,prepared=null,referencePrepared=null;
  try{
    if(editMode==='new'){await doc('universalForms',id).set(data,{merge:true});createdBase=true}
    prepared=await prepareStoredImagesV153(id,existing,normalizeQuestions(JSON.parse(JSON.stringify(draftQuestions))));
    data.imageUrl=prepared.headerUrl;data.imageStoragePath=prepared.headerPath;data.questions=prepared.questions;
    referencePrepared=await prepareReferenceFilesV156(id,existing);data.referenceFiles=referencePrepared.files;
    await doc('universalForms',id).set(data,{merge:true});
    await Promise.all(prepared.obsolete.concat(referencePrepared.obsolete).map(function(path){return deleteStoragePathV153(path).catch(function(e){console.warn('舊附件清理失敗',path,e)})}));
    resetPendingImages();resetReferenceFilesV156(data.referenceFiles);formDirty=false;activeFormId=id;await loadAdminData();showPanel('formsPanel');toast(editMode==='edit'?'問卷變更已儲存':'問卷已建立','success')
  }catch(e){console.error(e);if(prepared&&prepared.uploaded)await Promise.all(prepared.uploaded.map(function(path){return deleteStoragePathV153(path).catch(function(){})}));if(referencePrepared&&referencePrepared.uploaded)await Promise.all(referencePrepared.uploaded.map(function(path){return deleteStoragePathV153(path).catch(function(){})}));if(createdBase)await doc('universalForms',id).delete().catch(function(){});notify('問卷儲存失敗：'+(e&&e.message?e.message:'請確認 Storage 規則、權限或網路狀態'),'error')}finally{setPageLoading(false);btn.disabled=false;btn.textContent=editMode==='edit'?'儲存變更':'建立問卷'}
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
  if(!['linearScale','rating','file'].includes(q.type)&&q.settings)q.settings={};
  if(q.type==='linearScale')q.settings=Object.assign({min:1,max:5,minLabel:'非常不滿意',maxLabel:'非常滿意'},q.settings||{});
  if(q.type==='rating')q.settings=Object.assign({max:5,minLabel:'',maxLabel:''},q.settings||{});
  if(q.type==='file')q.settings=Object.assign({fileKind:'all',multiple:false,maxFiles:1},q.settings||{});
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
    revokeObjectUrl(pendingQuestionImagePreviewUrls.get(oldId));
    pendingQuestionImageFiles.delete(oldId);
    pendingQuestionImagePreviewUrls.delete(oldId);
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

/* v1.54: response attachments, expanded themes, and role-overlap parity. */
var renderPublicQuestionV154Base=renderPublicQuestion;
renderPublicQuestion=function(q,prefix,value){
  q=normalizeQuestion(q);
  if(q.type!=='file')return renderPublicQuestionV154Base(q,prefix,value);
  prefix=prefix||'q_';
  var name=prefix+q.id,settings=q.settings||{},existing=responseFilesV154(value),multiple=!!settings.multiple;
  var required=q.required?'<span class="required"> *</span>':'',help=questionDescription(q)?'<div class="questionHelp">'+esc(questionDescription(q))+'</div>':'';
  var limit=multiple?Math.max(2,Math.min(5,Number(settings.maxFiles||5))):1;
  return '<section class="questionCard fileQuestionV154"><label class="title">'+esc(q.title||'未命名題目')+required+'</label>'+help+
    responseFileListHtmlV154(existing,true,name)+
    '<label class="fileDropFieldV154"><span class="fileDropIconV154" aria-hidden="true">＋</span><span><b>選擇'+(multiple?'檔案':'一個檔案')+'</b><small id="fileSelection_'+attr(name)+'">'+esc(fileKindHelpV155(q))+'；每個檔案上限 10 MB'+(multiple?'，最多 '+limit+' 個':'')+'</small></span><input type="file" name="'+attr(name)+'" data-question-id="'+attr(q.id)+'" data-status-id="fileSelection_'+attr(name)+'" accept="'+attr(fileAcceptV154(q))+'" onchange="handleResponseFileSelectionV155(this)" '+(multiple?'multiple':'')+' '+(q.required&&!existing.length?'required':'')+'></label></section>';
};

/* v1.71 conditional question visibility. */
function conditionAnswerValuesV171(value){return (Array.isArray(value)?value:[value]).map(function(item){return String(item==null?'':item).trim()}).filter(Boolean)}
function conditionMatchesV171(visibility,values){visibility=normalizeQuestionVisibilityV171(visibility);if(!visibility.enabled)return true;values=conditionAnswerValuesV171(values);if(!visibility.sourceQuestionId||!visibility.values.length||!values.length)return false;var selected=new Set(visibility.values.map(String)),matched=values.some(function(value){return selected.has(String(value))});return visibility.operator==='isNotAnyOf'?!matched:matched}
function responseQuestionVisibleV171(response,q,form){q=normalizeQuestion(q);var visibility=q.visibility;if(!visibility.enabled)return true;form=form||forms.find(function(item){return item.id===(response&&response.formId)})||activeForm();var questions=normalizeQuestions((form&&form.questions)||[]),targetIndex=questions.findIndex(function(item){return item.id===q.id}),sourceIndex=questions.findIndex(function(item){return item.id===visibility.sourceQuestionId});if(sourceIndex<0||targetIndex<0||sourceIndex>=targetIndex)return true;return conditionMatchesV171(visibility,response&&response.answers&&response.answers[visibility.sourceQuestionId])}
function conditionalFormValuesV171(formEl,source,prefix){var data=new FormData(formEl),name=prefix+source.id;return data.getAll(name).map(String).filter(Boolean)}
function clearConditionalQuestionV171(section){section.querySelectorAll('input,select,textarea').forEach(function(control){if(control.type==='checkbox'||control.type==='radio')control.checked=false;else if(control.type==='file')control.value='';else if(control.tagName==='SELECT')control.selectedIndex=0;else control.value=''})}
function applyConditionalVisibilityV171(formEl,form,prefix){if(!formEl||!form)return;prefix=prefix||'q_';var questions=normalizeQuestions(form.questions||[]);questions.forEach(function(q,index){var section=formEl.querySelector('[data-question-id-v171="'+CSS.escape(String(q.id))+'"]');if(!section)return;var visibility=q.visibility,met=true;if(visibility.enabled){var sourceIndex=questions.findIndex(function(item){return item.id===visibility.sourceQuestionId}),source=questions[sourceIndex];met=sourceIndex>=0&&sourceIndex<index&&conditionMatchesV171(visibility,conditionalFormValuesV171(formEl,source,prefix))}var wasVisible=!section.hidden;if(!met&&wasVisible)clearConditionalQuestionV171(section);section.hidden=!met;section.setAttribute('aria-hidden',met?'false':'true');section.querySelectorAll('input,select,textarea').forEach(function(control){control.disabled=!met});section.classList.toggle('conditionVisibleV171',met&&visibility.enabled)})}
var conditionalRefreshTimerV171=null;
function scheduleConditionalRefreshV171(){clearTimeout(conditionalRefreshTimerV171);conditionalRefreshTimerV171=setTimeout(function(){var form=activeForm();if(!form)return;[['publicForm','q_'],['assistedForm','assist_q_'],['responseEditForm','edit_q_']].forEach(function(pair){var formEl=$(pair[0]);if(formEl)applyConditionalVisibilityV171(formEl,form,pair[1])})},0)}
var renderPublicQuestionV171Base=renderPublicQuestion;
renderPublicQuestion=function(q,prefix,value){q=normalizeQuestion(q);var html=renderPublicQuestionV171Base(q,prefix,value),conditional=q.visibility.enabled?' hidden aria-hidden="true"':' aria-hidden="false"';scheduleConditionalRefreshV171();return html.replace('<section ','<section data-question-id-v171="'+attr(q.id)+'"'+conditional+' ')};
document.addEventListener('input',function(event){var formEl=event.target.closest&&event.target.closest('#publicForm,#assistedForm,#responseEditForm');if(formEl)scheduleConditionalRefreshV171()});
document.addEventListener('change',function(event){var formEl=event.target.closest&&event.target.closest('#publicForm,#assistedForm,#responseEditForm');if(formEl)scheduleConditionalRefreshV171()});
var answerTextV171Base=answerText;
answerText=function(q,response){var form=forms.find(function(item){return item.id===(response&&response.formId)})||activeForm();return responseQuestionVisibleV171(response,q,form)?answerTextV171Base(q,response):'未顯示（條件不符）'};

submitAssistedResponse=async function(event){
  event.preventDefault();
  var f=activeForm(),member=members.find(function(m){return m.id===assistedTargetMemberId});
  if(!f||!member||!canManageForm(f.id))return notify('您沒有協助填寫權限','error');
  var answers;
  try{answers=collectAnswers(event.target,f,'assist_q_')}catch(e){return notify(e.message||'請確認填寫內容','warn')}
  if(!await confirmDialog('確定要代替'+memberDisplayName(member)+'送出本問卷嗎？','確認協助填寫'))return;
  var departmentName=memberDepartmentName(member),responseKey=f.id+'__'+member.id,uploaded=[];
  var btn=$('assistSubmitBtn');if(btn){btn.disabled=true;btn.textContent='送出中'}
  setPageLoading(true,'正在協助送出問卷');
  try{
    var prepared=await collectAndUploadResponseFilesV154(event.target,f,'assist_q_',responseKey,answers);
    answers=prepared.answers;uploaded=prepared.uploaded;
    var payload={formId:f.id,formTitle:f.title,departmentName:departmentName,memberId:member.id,memberName:member.name||'',employeeNo:memberEmployeeNo(member),respondentMemberId:member.id,respondentEmployeeId:memberEmployeeNo(member),respondentName:member.name||'',respondentDepartment:departmentName,answers:answers,submissionMethod:'assisted',submittedByUid:(currentUser&&currentUser.uid)||'',submittedByEmail:normalizeEmail((currentUser&&currentUser.email)||''),submittedByName:adminDisplayName(),submittedAt:firebase.firestore.FieldValue.serverTimestamp(),submittedAtText:new Date().toLocaleString('zh-TW')};
    await writeResponseWithLock(f,responseKey,payload,{formId:f.id,memberId:member.id,submissionMethod:'assisted',submittedByUid:(currentUser&&currentUser.uid)||'',createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    modalProgrammaticCloseV144=true;await closeAssistedFill(true);modalProgrammaticCloseV144=false;
    await loadResponses();renderAdmin();showPanel('progressPanel');renderProgressPanelV171();
    toast('已完成協助填寫','success');
  }catch(e){
    console.error(e);await Promise.all(uploaded.map(function(path){return deleteStoragePathV153(path)}));
    notify(e.message==='duplicate-response'?'此同仁已填寫，無法重複協助填寫':(e.message||'協助填寫失敗，請確認權限或網路狀態'),'error');
  }finally{modalProgrammaticCloseV144=false;setPageLoading(false);if(btn){btn.disabled=false;btn.textContent='協助送出'}}
};

saveEditedResponse=async function(event){
  event.preventDefault();
  var f=activeForm(),r=responses.find(function(x){return x.id===editingResponseId});
  if(!f||!r)return;
  var answers;
  try{answers=collectAnswers(event.target,f,'edit_q_',r.answers||{})}catch(e){return notify(e.message||'請確認填寫內容','warn')}
  var btn=$('saveResponseBtn');if(btn){btn.disabled=true;btn.textContent='儲存中'}
  var uploadKey=r.id||('edit_'+Date.now()),uploaded=[],oldPaths=responseFilePathsV154(r);
  setPageLoading(true,'正在儲存填寫結果');
  try{
    var prepared=await collectAndUploadResponseFilesV154(event.target,f,'edit_q_',uploadKey,answers);
    answers=prepared.answers;uploaded=prepared.uploaded;
    var update={answers:answers,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:(currentUser&&currentUser.email)||'',updatedByName:adminDisplayName()};
    if(f.identityMode==='member'){
      var memberId=$('editMember').value,m=members.find(function(x){return x.id===memberId}),departmentName=$('editDepartment').value;
      if(!m||!departmentName)throw new Error('請選擇部門與姓名');
      Object.assign(update,{departmentName:departmentName,memberId:memberId,memberName:m.name||'',employeeNo:memberEmployeeNo(m),respondentMemberId:m.id,respondentEmployeeId:memberEmployeeNo(m),respondentName:m.name||'',respondentDepartment:departmentName});
      var newId=f.id+'__'+update.memberId,newLock=doc('universalResponseLocks',newId),oldLockId=r.memberId?f.id+'__'+r.memberId:'';
      if(newId!==r.id){
        var existing=await doc('universalResponses',newId).get(),locked=await newLock.get();
        if(existing.exists||locked.exists)throw new Error('所選同仁已有這份問卷的填寫資料');
        var oldData=Object.assign({},r);delete oldData.id;
        var batch=db.batch();batch.set(doc('universalResponses',newId),Object.assign(oldData,update));batch.delete(doc('universalResponses',r.id));
        if(oldLockId&&oldLockId!==newId)batch.delete(doc('universalResponseLocks',oldLockId));
        batch.set(newLock,{formId:f.id,memberId:update.memberId,submissionMethod:r.submissionMethod||'self',createdAt:firebase.firestore.FieldValue.serverTimestamp()});await batch.commit();
      }else{
        var sameBatch=db.batch();sameBatch.update(doc('universalResponses',r.id),update);sameBatch.set(newLock,{formId:f.id,memberId:update.memberId,submissionMethod:r.submissionMethod||'self',createdAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});await sameBatch.commit();
      }
    }else await doc('universalResponses',r.id).update(update);
    var newPaths=[];Object.keys(answers).forEach(function(key){responseFilesV154(answers[key]).forEach(function(file){newPaths.push(file.path)})});
    await Promise.all(oldPaths.filter(function(path){return !newPaths.includes(path)}).map(function(path){return deleteStoragePathV153(path)}));
    modalProgrammaticCloseV144=true;await closeResponseEditor(true);modalProgrammaticCloseV144=false;
    await loadResponses();renderAdmin();showPanel('resultsPanel');toast('填寫結果已更新','success');
  }catch(e){
    console.error(e);await Promise.all(uploaded.map(function(path){return deleteStoragePathV153(path)}));
    notify('更新失敗：'+(e.message||'請確認 Firestore 與 Storage 規則'),'error');
  }finally{modalProgrammaticCloseV144=false;setPageLoading(false);if(btn){btn.disabled=false;btn.textContent='儲存變更'}}
};

deleteResponse=async function(id){
  var r=responses.find(function(x){return x.id===id});if(!r)return;
  var who=[r.memberName,r.employeeNo].filter(Boolean).join('／')||'這筆未具名回覆';
  if(!await confirmDialog('確定要刪除「'+who+'」的填寫結果嗎？\n刪除後同仁可以重新填寫。','刪除填寫結果',true))return;
  if(!await confirmDialog('再次確認：即將永久刪除「'+who+'」的資料與附件，此動作無法復原。','永久刪除填寫結果',true))return;
  setPageLoading(true,'正在刪除填寫結果');
  try{
    var paths=responseFilePathsV154(r),batch=db.batch();batch.delete(doc('universalResponses',id));
    if(r.formId&&r.memberId)batch.delete(doc('universalResponseLocks',r.formId+'__'+r.memberId));
    await batch.commit();await Promise.all(paths.map(function(path){return deleteStoragePathV153(path)}));
    await loadResponses();renderAdmin();showPanel('resultsPanel');toast('填寫結果、附件與填寫鎖定已刪除','success');
  }catch(e){console.error(e);notify('刪除失敗，請確認管理員權限及規則','error')}finally{setPageLoading(false)}
};

deleteForm=async function(id){
  var f=forms.find(function(x){return x.id===id});if(!f)return;
  if(!canDeleteFormDirectly(f))return notify('只有系統管理員或問卷建立者可以刪除此問卷','error');
  if(!await confirmDeleteFormModalV136(f))return;
  setPageLoading(true,'正在刪除問卷與關聯資料');
  try{
    await deleteStorageFolderV153('universal-responses/'+storageSafeSegmentV153(id));
    var hasStorage=!!f.imageStoragePath||[].concat(f.referenceFiles||[]).some(function(file){return !!(file&&file.path)})||normalizeQuestions(f.questions||[]).some(function(q){return !!q.imageStoragePath});
    if(hasStorage)await deleteStorageFolderV153('universal-forms/'+storageSafeSegmentV153(id));
    var responseSnap=await col('universalResponses').where('formId','==',id).get(),lockSnap=await col('universalResponseLocks').where('formId','==',id).get(),managerSnap=await col('universalFormManagers').where('formId','==',id).get();
    await deleteSnapshotInChunks(responseSnap);await deleteSnapshotInChunks(lockSnap);await deleteSnapshotInChunks(managerSnap);await doc('universalForms',id).delete();
    if(activeFormId===id)activeFormId='';await loadAdminData();showPanel('formsPanel');toast('問卷、附件、圖片及關聯資料已刪除','success');
  }catch(e){console.error(e);notify('刪除失敗，請確認 Firestore 與 Storage 規則已部署','error')}finally{setPageLoading(false)}
};

function resultAnswerHtmlV154(q,r){
  if(!responseQuestionVisibleV171(r,q,forms.find(function(item){return item.id===r.formId})||activeForm()))return '<span class="muted">未顯示（條件不符）</span>';
  if(q.type!=='file')return esc(answerText(q,r));
  var files=responseFilesV154((r.answers||{})[q.id]);
  if(!files.length)return '<span class="muted">未上傳</span>';
  return '<div class="resultFileLinksV154">'+files.map(function(file){return '<button type="button" class="storedFileLinkV154" onclick="openResponseFileV154(\''+attr(file.path)+'\')"><span aria-hidden="true">📎</span><span>'+esc(file.name)+'</span><small>'+esc(fileSizeTextV154(file.size))+'</small></button>'}).join('')+'</div>';
}
responseDetailRow=function(f,qs,r,manage){
  var id=attr(r.id),method='<b>'+esc(submissionMethodLabelV144(r,f))+'</b>'+(r.submissionMethod==='assisted'?'<br><small>由 '+esc(submitterLabel(r))+' 協助填寫</small>':''),actions=manage?actionGroup([actionButton('編輯',"openResponseEditor('"+id+"')"),actionButton('刪除',"deleteResponse('"+id+"')",'danger')]):roleBadgeHtml('唯讀',false);
  return '<tr>'+(formUsesMemberDatabaseV141(f)?'<td>'+esc(r.departmentName||r.respondentDepartment||'')+'</td><td>'+esc(r.memberName||r.respondentName||'')+'</td><td>'+esc(r.employeeNo||r.respondentEmployeeId||'')+'</td>':'')+qs.map(function(q){return '<td>'+resultAnswerHtmlV154(q,r)+'</td>'}).join('')+'<td>'+esc(r.submittedAtText||formatAnyDate(r.submittedAt)||'')+'</td><td>'+method+'</td><td>'+actions+'</td></tr>';
};

initDescriptionEditorV156();

/* v1.70 chart image copy with a PNG download fallback. */
function canvasLinesV170(context,text,maxWidth){var chars=Array.from(String(text==null?'':text)),lines=[],line='';chars.forEach(function(char){var next=line+char;if(line&&context.measureText(next).width>maxWidth){lines.push(line);line=char}else line=next});if(line||!lines.length)lines.push(line);return lines}
function drawCanvasTextV170(context,text,x,y,maxWidth,lineHeight,maxLines){var lines=canvasLinesV170(context,text,maxWidth),limit=Math.max(1,Number(maxLines||lines.length));if(lines.length>limit){lines=lines.slice(0,limit);var last=lines.length-1;while(lines[last]&&context.measureText(lines[last]+'…').width>maxWidth)lines[last]=lines[last].slice(0,-1);lines[last]+='…'}lines.forEach(function(line,index){context.fillText(line,x,y+index*lineHeight)});return y+lines.length*lineHeight}
function canvasBlobV170(canvas){return new Promise(function(resolve,reject){canvas.toBlob(function(blob){blob?resolve(blob):reject(new Error('無法產生 PNG'))},'image/png')})}
async function analysisCardPngV170(card){if(!card||card.hidden)return Promise.reject(new Error('圖表目前不可見'));var title=(card.querySelector('h3')||{}).textContent||'問卷圖表',subtitle=(card.querySelector('.analysisCardHeadV170 p')||{}).textContent||'',pie=card.querySelector('.pieSvgV165'),barRows=Array.from(card.querySelectorAll('.barList>.chartInteractiveV165')),matrix=card.querySelector('.matrixTable'),textItems=Array.from(card.querySelectorAll('.textAnswer')),height=520;if(barRows.length)height=Math.max(360,150+barRows.length*72);else if(matrix)height=Math.max(360,150+matrix.querySelectorAll('tr').length*58);else if(textItems.length)height=Math.min(1600,180+textItems.length*105);var width=1000,scale=2,canvas=document.createElement('canvas');canvas.width=width*scale;canvas.height=height*scale;var context=canvas.getContext('2d');context.scale(scale,scale);context.fillStyle='#fff';context.fillRect(0,0,width,height);context.strokeStyle='#d8e3ec';context.lineWidth=2;context.strokeRect(2,2,width-4,height-4);context.fillStyle='#17324d';context.font='800 30px "Microsoft JhengHei",sans-serif';drawCanvasTextV170(context,title,48,55,880,38,2);context.fillStyle='#66788a';context.font='700 18px "Microsoft JhengHei",sans-serif';context.fillText(subtitle,48,105);
  if(pie){var legendRows=Array.from(card.querySelectorAll('.chartLegend .chartInteractiveV165')),items=legendRows.filter(function(row){return Number(row.dataset.chartCount||0)>0}),sum=items.reduce(function(total,row){return total+Number(row.dataset.chartCount||0)},0),cx=225,cy=315,radius=135,cursor=-Math.PI/2;items.forEach(function(row){var count=Number(row.dataset.chartCount||0),angle=sum?count/sum*Math.PI*2:0,end=cursor+angle,color=getComputedStyle(row.querySelector('.legendDot')).backgroundColor;context.beginPath();context.moveTo(cx,cy);context.arc(cx,cy,radius,cursor,end);context.closePath();context.fillStyle=color;context.fill();context.strokeStyle='#fff';context.lineWidth=4;context.stroke();var percent=Number(row.dataset.chartPercent||0);if(percent>=6.5){var mid=cursor+angle/2;context.fillStyle='#fff';context.font='900 19px "Microsoft JhengHei",sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(percent+'%',cx+Math.cos(mid)*82,cy+Math.sin(mid)*82)}cursor=end});context.textAlign='left';context.textBaseline='alphabetic';legendRows.forEach(function(row,index){var dot=row.querySelector('.legendDot'),y=165+index*43;context.fillStyle=getComputedStyle(dot).backgroundColor;context.beginPath();context.arc(440,y-6,8,0,Math.PI*2);context.fill();context.fillStyle='#17324d';context.font='700 18px "Microsoft JhengHei",sans-serif';drawCanvasTextV170(context,row.dataset.chartLabel||'',465,y,310,24,1);context.textAlign='right';context.fillText((row.dataset.chartCount||'0')+' 人・'+(row.dataset.chartPercent||'0')+'%',945,y);context.textAlign='left'})
  }else if(barRows.length){barRows.forEach(function(row,index){var y=145+index*72,percent=Math.max(0,Math.min(100,Number(row.dataset.chartPercent||0))),fill=row.querySelector('.barFill');context.fillStyle='#17324d';context.font='700 18px "Microsoft JhengHei",sans-serif';drawCanvasTextV170(context,row.dataset.chartLabel||'',48,y,620,24,1);context.textAlign='right';context.fillText((row.dataset.chartCount||'0')+' 人・'+percent+'%',950,y);context.textAlign='left';context.fillStyle='#e7edf2';context.fillRect(48,y+20,902,14);context.fillStyle=getComputedStyle(fill).backgroundColor;context.fillRect(48,y+20,902*percent/100,14)})
  }else if(matrix){var tableRows=Array.from(matrix.querySelectorAll('tr')),columnCount=Math.max(1,...tableRows.map(function(row){return row.children.length})),cellWidth=900/columnCount;tableRows.forEach(function(row,rowIndex){Array.from(row.children).forEach(function(cell,columnIndex){var x=48+columnIndex*cellWidth,y=130+rowIndex*58;context.fillStyle=rowIndex===0||columnIndex===0?'#eef6f5':'#fff';context.fillRect(x,y,cellWidth,58);context.strokeStyle='#cfdde7';context.lineWidth=1;context.strokeRect(x,y,cellWidth,58);context.fillStyle='#17324d';context.font=(rowIndex===0||columnIndex===0?'800 ':'700 ')+'15px "Microsoft JhengHei",sans-serif';drawCanvasTextV170(context,cell.textContent.trim(),x+8,y+24,cellWidth-16,19,2)})})
  }else if(textItems.length){var y=145;textItems.forEach(function(item){var who=(item.querySelector('b')||{}).textContent||'',answer=(item.querySelector('p')||{}).textContent||'';context.fillStyle='#176f69';context.font='800 17px "Microsoft JhengHei",sans-serif';context.fillText(who,48,y);context.fillStyle='#17324d';context.font='500 17px "Microsoft JhengHei",sans-serif';y=drawCanvasTextV170(context,answer,48,y+30,900,24,3)+28;context.strokeStyle='#e2eaf0';context.beginPath();context.moveTo(48,y-12);context.lineTo(952,y-12);context.stroke()})
  }else{context.fillStyle='#66788a';context.font='600 18px "Microsoft JhengHei",sans-serif';drawCanvasTextV170(context,(card.querySelector('.analysisCardVisualV170')||{}).textContent||'尚無資料',48,150,900,26,12)}return canvasBlobV170(canvas)}
function downloadChartPngV170(blob,title){var url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=(String(title||'問卷圖表').replace(/[\\/:*?"<>|]/g,'_').slice(0,70)||'問卷圖表')+'.png';document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000)}
async function copyAnalysisCardV170(button){var card=button&&button.closest('.analysisCard');if(!card)return;var original=button.textContent;button.disabled=true;button.textContent='處理中…';try{var blob=await analysisCardPngV170(card),title=(card.querySelector('h3')||{}).textContent||'問卷圖表';if(navigator.clipboard&&navigator.clipboard.write&&window.ClipboardItem){try{await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);toast('圖表已複製，可貼到文件或簡報','success');return}catch(error){console.warn('Clipboard image copy unavailable',error)}}downloadChartPngV170(blob,title);toast('瀏覽器未允許圖片剪貼簿，已下載 PNG','success')}catch(error){console.error(error);notify('圖表複製失敗，請稍後再試','error')}finally{button.disabled=false;button.textContent=original}}
document.addEventListener('keydown',function(event){var current=event.target.closest&&event.target.closest('[data-result-view-v170]');if(!current||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;var tabs=Array.from(document.querySelectorAll('[data-result-view-v170]:not(:disabled)')),index=tabs.indexOf(current),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;if(next<0||!tabs[next])return;event.preventDefault();setResultViewV170(tabs[next].dataset.resultViewV170,tabs[next])});

/* Result chart hover animation and accessible tooltip. */
function chartDatumAttrsV165(label,count,percent,index){
  return ' class="chartInteractiveV165" tabindex="0" data-chart-label="'+attr(label)+'" data-chart-count="'+Number(count||0)+'" data-chart-percent="'+Number(percent||0)+'"'+(index==null?'':' data-chart-index="'+index+'"')+' aria-label="選項 '+attr(label)+'，票數 '+Number(count||0)+'，百分比 '+Number(percent||0)+'%"';
}
function piePointV165(angle,radius){
  var rad=(angle-90)*Math.PI/180;
  return {x:64+radius*Math.cos(rad),y:64+radius*Math.sin(rad)};
}
function pieSlicePathV165(startAngle,endAngle){
  var sweep=endAngle-startAngle,start=piePointV165(startAngle,60),end=piePointV165(endAngle,60);
  if(sweep>=359.999){
    return 'M 64 64 L 64 4 A 60 60 0 1 1 63.999 4 Z';
  }
  return 'M 64 64 L '+start.x.toFixed(3)+' '+start.y.toFixed(3)+' A 60 60 0 '+(sweep>180?1:0)+' 1 '+end.x.toFixed(3)+' '+end.y.toFixed(3)+' Z';
}
function ensureChartTooltipV165(){
  var tip=$('resultChartTooltipV165');
  if(tip)return tip;
  tip=document.createElement('div');tip.id='resultChartTooltipV165';tip.className='resultChartTooltipV165';tip.setAttribute('role','status');tip.setAttribute('aria-live','polite');tip.innerHTML='<div><span>選項</span><b data-tip-label></b></div><div><span>票數</span><b data-tip-count></b></div><div><span>百分比</span><b data-tip-percent></b></div>';document.body.appendChild(tip);return tip;
}
function placeChartTooltipV165(tip,x,y){
  var pad=12,rect=tip.getBoundingClientRect(),maxLeft=Math.max(pad,window.innerWidth-rect.width-pad),left=Math.max(pad,Math.min(maxLeft,x+14)),above=y-rect.height-14,below=y+18,preferred=above>=pad?above:below,maxTop=Math.max(pad,window.innerHeight-rect.height-pad),top=Math.max(pad,Math.min(maxTop,preferred));
  tip.style.left=left+'px';tip.style.top=top+'px';
}
var activeChartTooltipTargetV166=null;
function clearChartTooltipStateV166(){
  document.querySelectorAll('.isChartActiveV165,.isChartRelatedV165').forEach(function(el){el.classList.remove('isChartActiveV165','isChartRelatedV165')});
  document.querySelectorAll('.isChartFocusV170').forEach(function(el){el.classList.remove('isChartFocusV170')});
}
function showChartTooltipV165(target,event){
  if(!target)return;clearChartTooltipStateV166();activeChartTooltipTargetV166=target;var tip=ensureChartTooltipV165(),label=target.dataset.chartLabel||'—';
  tip.querySelector('[data-tip-label]').textContent=label;tip.querySelector('[data-tip-count]').textContent=target.dataset.chartCount||'0';tip.querySelector('[data-tip-percent]').textContent=(target.dataset.chartPercent||'0')+'%';tip.classList.add('isVisible');target.classList.add('isChartActiveV165');
  var card=target.closest('.analysisCard'),index=target.dataset.chartIndex;if(card){card.classList.add('isChartFocusV170');if(index!=null)card.querySelectorAll('[data-chart-index="'+CSS.escape(index)+'"]').forEach(function(el){el.classList.add('isChartRelatedV165')})}
  var rect=target.getBoundingClientRect(),x=event&&Number.isFinite(event.clientX)?event.clientX:rect.left+rect.width/2,y=event&&Number.isFinite(event.clientY)?event.clientY:rect.top;placeChartTooltipV165(tip,x,y);
}
function hideChartTooltipV165(){
  var tip=$('resultChartTooltipV165');if(tip)tip.classList.remove('isVisible');
  clearChartTooltipStateV166();activeChartTooltipTargetV166=null;
}
function relatedChartTargetV166(node){return node&&node.closest?node.closest('.chartInteractiveV165'):null}
function sameChartDatumV166(a,b){return !!(a&&b&&a.closest('.analysisCard')===b.closest('.analysisCard')&&a.dataset.chartIndex!=null&&a.dataset.chartIndex===b.dataset.chartIndex)}
document.addEventListener('pointerover',function(event){if(event.pointerType&&event.pointerType!=='mouse')return;var target=relatedChartTargetV166(event.target);if(target)showChartTooltipV165(target,event)});
document.addEventListener('pointermove',function(event){if(event.pointerType&&event.pointerType!=='mouse')return;var target=relatedChartTargetV166(event.target),tip=$('resultChartTooltipV165');if(target&&tip&&tip.classList.contains('isVisible'))placeChartTooltipV165(tip,event.clientX,event.clientY)});
document.addEventListener('pointerout',function(event){if(event.pointerType&&event.pointerType!=='mouse')return;var target=relatedChartTargetV166(event.target),next=relatedChartTargetV166(event.relatedTarget);if(target&&!target.contains(event.relatedTarget)&&!sameChartDatumV166(target,next))hideChartTooltipV165()});
document.addEventListener('focusin',function(event){var target=event.target.closest&&event.target.closest('.chartInteractiveV165');if(target)showChartTooltipV165(target)});
document.addEventListener('focusout',function(event){var target=relatedChartTargetV166(event.target),next=relatedChartTargetV166(event.relatedTarget);if(target&&!sameChartDatumV166(target,next))hideChartTooltipV165()});
document.addEventListener('pointerdown',function(event){var target=relatedChartTargetV166(event.target);if(!target){hideChartTooltipV165();return}if(event.pointerType==='mouse')return;if(activeChartTooltipTargetV166===target){hideChartTooltipV165();return}showChartTooltipV165(target,event)});
document.addEventListener('keydown',function(event){if(event.key==='Escape'&&activeChartTooltipTargetV166)hideChartTooltipV165()});
window.addEventListener('scroll',function(){if(activeChartTooltipTargetV166)hideChartTooltipV165()},true);
window.addEventListener('resize',function(){if(activeChartTooltipTargetV166)hideChartTooltipV165()});
if(document.body)new MutationObserver(function(){if(activeChartTooltipTargetV166&&!activeChartTooltipTargetV166.isConnected)hideChartTooltipV165()}).observe(document.body,{childList:true,subtree:true});
installMobileHeaderV156();

