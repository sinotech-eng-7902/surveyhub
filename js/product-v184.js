/* v1.84: local autosave recovery, undo/redo, and long-form outline. */
(function(){
  'use strict';
  var historyV184=[],historyIndexV184=-1,historyBusyV184=false,historyTimerV184=null,autosaveTimerV184=null;
  function draftKeyV184(){return 'universalFormDraftV184:'+(editingId||'new')}
  function editorSnapshotV184(){
    return {version:1,savedAt:new Date().toISOString(),title:($('formTitle')||{}).value||'',descriptionHtml:($('formDescriptionEditor')||{}).innerHTML||'',descriptionFontSize:($('formDescriptionFontSize')||{}).value||'16',descriptionAlign:($('formDescriptionAlign')||{}).value||'left',startTime:($('formStartTime')||{}).value||'',deadline:($('formDeadline')||{}).value||'',state:($('formState')||{}).value||'draft',identityMode:($('identityMode')||{}).value||'member',theme:($('formTheme')||{}).value||'appleWhite',targetDepartments:[].slice.call(document.querySelectorAll('.targetDepartment:checked')).map(function(x){return x.value}),questions:normalizeQuestions(JSON.parse(JSON.stringify(draftQuestions)))}
  }
  function snapshotSignatureV184(s){var copy=Object.assign({},s);delete copy.savedAt;return JSON.stringify(copy)}
  function setSaveStatusV184(text,tone){var el=$('editorAutosaveStatusV184');if(el){el.textContent=text;el.dataset.tone=tone||''}}
  function ensureEditorUtilitiesV184(){
    var actions=document.querySelector('.editorHeadActionsV181');if(actions&&!$('editorAutosaveStatusV184'))actions.insertAdjacentHTML('afterbegin','<span id="editorAutosaveStatusV184" class="editorAutosaveStatusV184">尚未變更</span><div class="editorHistoryActionsV184"><button id="undoEditorV184" type="button" class="btn" onclick="undoEditorV184()" title="復原" disabled>↶</button><button id="redoEditorV184" type="button" class="btn" onclick="redoEditorV184()" title="重做" disabled>↷</button></div>');
    var pane=$('editorPaneContentV181');if(pane&&!$('editorOutlineV184'))pane.insertAdjacentHTML('afterbegin','<aside id="editorOutlineV184" class="editorOutlineV184"><div><strong>問卷大綱</strong><button type="button" onclick="toggleEditorOutlineV184()" aria-label="收合大綱">‹</button></div><nav id="editorOutlineListV184" aria-label="題目大綱"></nav></aside>');
  }
  function updateHistoryButtonsV184(){var u=$('undoEditorV184'),r=$('redoEditorV184');if(u)u.disabled=historyIndexV184<=0;if(r)r.disabled=historyIndexV184>=historyV184.length-1}
  function captureHistoryV184(force){
    if(historyBusyV184||!$('editorPanel')?.classList.contains('active'))return;
    var snap=editorSnapshotV184(),sig=snapshotSignatureV184(snap),current=historyV184[historyIndexV184];if(!force&&current&&snapshotSignatureV184(current)===sig)return;
    historyV184=historyV184.slice(0,historyIndexV184+1);historyV184.push(snap);if(historyV184.length>40)historyV184.shift();historyIndexV184=historyV184.length-1;updateHistoryButtonsV184();
  }
  function applySnapshotV184(s){
    if(!s)return;historyBusyV184=true;
    $('formTitle').value=s.title||'';$('formDescriptionEditor').innerHTML=s.descriptionHtml||'';$('formDescriptionFontSize').value=s.descriptionFontSize||'16';$('formDescriptionAlign').value=s.descriptionAlign||'left';$('formStartTime').value=s.startTime||'';$('formDeadline').value=s.deadline||'';$('formState').value=s.state||'draft';$('identityMode').value=s.identityMode||'member';draftQuestions=normalizeQuestions(JSON.parse(JSON.stringify(s.questions||[])));renderTargetDepartments(s.targetDepartments||[]);renderThemeChoices(s.theme||'appleWhite');renderQuestionEditor();renderEditorStateV181();formDirty=true;historyBusyV184=false;setSaveStatusV184('已復原變更','changed')
  }
  window.undoEditorV184=function(){if(historyIndexV184<=0)return;historyIndexV184--;applySnapshotV184(historyV184[historyIndexV184]);updateHistoryButtonsV184()};
  window.redoEditorV184=function(){if(historyIndexV184>=historyV184.length-1)return;historyIndexV184++;applySnapshotV184(historyV184[historyIndexV184]);updateHistoryButtonsV184()};
  window.toggleEditorOutlineV184=function(){document.querySelector('.editorCardV181')?.classList.toggle('outlineCollapsedV184')};
  window.focusOutlineItemV184=function(id){var el=document.querySelector('#questionEditor [data-question-id="'+CSS.escape(id)+'"]')||document.querySelector('#questionEditor [data-question-index="'+questionIndexByIdV144(id)+'"]');if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.querySelector('input,textarea,select')?.focus()}};
  function renderOutlineV184(){
    ensureEditorUtilitiesV184();var list=$('editorOutlineListV184');if(!list)return;var qn=0;
    list.innerHTML=normalizeQuestions(draftQuestions).map(function(q){var section=isSectionBlockV182(q),content=q.type==='image'&&!section;if(!section&&!content)qn++;var label=section?'區段：'+(q.title||'未命名區段'):(content?'說明：'+(q.title||'未命名內容'):qn+'．'+(q.title||'未命名題目'));return '<button type="button" class="'+(section?'section':'')+'" onclick="focusOutlineItemV184(\''+attr(q.id)+'\')"><span>'+esc(label)+'</span></button>'}).join('')||'<p>尚未建立內容</p>';
  }
  var baseRenderQuestionEditorV184=renderQuestionEditor;
  renderQuestionEditor=function(){baseRenderQuestionEditorV184();renderOutlineV184()};

  function scheduleDraftSaveV184(){
    clearTimeout(autosaveTimerV184);setSaveStatusV184('儲存草稿中…','saving');autosaveTimerV184=setTimeout(function(){try{var snap=editorSnapshotV184();localStorage.setItem(draftKeyV184(),JSON.stringify(snap));setSaveStatusV184('草稿已自動儲存 '+new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}),'saved')}catch(e){setSaveStatusV184('草稿暫存失敗','error')}},700)
  }
  function scheduleHistoryV184(){clearTimeout(historyTimerV184);historyTimerV184=setTimeout(function(){captureHistoryV184(false);renderOutlineV184()},450)}
  document.addEventListener('input',function(e){if($('editorPanel')?.contains(e.target)){scheduleDraftSaveV184();scheduleHistoryV184()}},true);
  document.addEventListener('change',function(e){if($('editorPanel')?.contains(e.target)){scheduleDraftSaveV184();scheduleHistoryV184()}},true);

  function offerDraftRecoveryV184(){
    ensureEditorUtilitiesV184();historyV184=[];historyIndexV184=-1;captureHistoryV184(true);var raw=localStorage.getItem(draftKeyV184());if(!raw)return;
    try{var draft=JSON.parse(raw);if(!draft||snapshotSignatureV184(draft)===snapshotSignatureV184(editorSnapshotV184()))return;var existing=$('editorDraftRecoveryV184');if(existing)existing.remove();var pane=$('editorPaneContentV181');pane.insertAdjacentHTML('afterbegin','<div id="editorDraftRecoveryV184" class="editorDraftRecoveryV184"><div><strong>發現未儲存草稿</strong><span>暫存於 '+esc(new Date(draft.savedAt).toLocaleString('zh-TW'))+'</span></div><div><button class="btn" type="button" onclick="discardDraftV184()">捨棄</button><button class="btn primary" type="button" onclick="restoreDraftV184()">復原草稿</button></div></div>');window.__pendingDraftV184=draft}catch(e){localStorage.removeItem(draftKeyV184())}
  }
  window.restoreDraftV184=function(){if(window.__pendingDraftV184){applySnapshotV184(window.__pendingDraftV184);captureHistoryV184(true)}$('editorDraftRecoveryV184')?.remove();window.__pendingDraftV184=null};
  window.discardDraftV184=function(){localStorage.removeItem(draftKeyV184());$('editorDraftRecoveryV184')?.remove();window.__pendingDraftV184=null;setSaveStatusV184('草稿已捨棄','')};
  var baseStartNewFormV184=startNewForm;startNewForm=function(){var r=baseStartNewFormV184();setTimeout(offerDraftRecoveryV184,0);return r};
  var baseEditFormV184=editForm;editForm=function(id){var r=baseEditFormV184(id);setTimeout(offerDraftRecoveryV184,0);return r};
  var baseSaveFormV184=saveForm;saveForm=async function(){await baseSaveFormV184();if(!formDirty){localStorage.removeItem(draftKeyV184());setSaveStatusV184('已儲存','saved')}};
  document.documentElement.setAttribute('data-product-version','1.84');
  setTimeout(ensureEditorUtilitiesV184,0);
})();
