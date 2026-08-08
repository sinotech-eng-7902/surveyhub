/* v1.83: explicit save/publish workflow and pre-publish quality checks. */
(function(){
  'use strict';
  var publishIntentV183='open';

  function answerQuestionsV183(){return normalizeQuestions(draftQuestions).filter(function(q){return isAnswerBlockV182(q)})}
  function collectPublishIssuesV183(){
    var errors=[],warnings=[],title=String(($('formTitle')||{}).value||'').trim(),questions=normalizeQuestions(draftQuestions),answers=questions.filter(isAnswerBlockV182),sections=questions.filter(isSectionBlockV182),start=($('formStartTime')||{}).value||'',deadline=($('formDeadline')||{}).value||'';
    if(!title)errors.push({tab:'content',text:'尚未填寫問卷標題'});
    if(!answers.length)errors.push({tab:'content',text:'至少需要一個作答題目'});
    questions.forEach(function(q,index){
      if(isSectionBlockV182(q)&&!String(q.title||'').trim())errors.push({tab:'content',text:'第 '+(index+1)+' 個區段缺少標題'});
      if(isAnswerBlockV182(q)&&!String(q.title||'').trim())errors.push({tab:'content',text:'第 '+(index+1)+' 個題目缺少題目名稱'});
      if(['single','multiple','dropdown'].includes(q.type)&&!(q.options||[]).length)errors.push({tab:'content',text:'「'+(q.title||'未命名題目')+'」沒有選項'});
      if(q.visibility&&q.visibility.enabled&&!q.visibility.sourceQuestionId)errors.push({tab:'content',text:'「'+(q.title||'未命名題目')+'」的顯示條件不完整'});
    });
    if(start&&deadline&&new Date(start)>new Date(deadline))errors.push({tab:'settings',text:'開啟時間不可晚於截止時間'});
    var identity=($('identityMode')||{}).value||'none',deps=[].slice.call(document.querySelectorAll('.targetDepartment:checked'));
    if(identity==='member'&&!deps.length)errors.push({tab:'settings',text:'尚未選擇開放填寫部門'});
    if(!deadline)warnings.push({tab:'settings',text:'未設定截止時間，問卷將持續開放'});
    if(!start)warnings.push({tab:'settings',text:'未設定開啟時間，發布後會立即開放'});
    if(answers.length>12&&!sections.length)warnings.push({tab:'content',text:'題目較多，建議加入區段提升填寫體驗'});
    if(!questions.some(function(q){return q.required&&isAnswerBlockV182(q)}))warnings.push({tab:'content',text:'目前沒有任何必填題目'});
    return {errors:errors,warnings:warnings,summary:{title:title||'未命名問卷',questions:answers.length,required:answers.filter(function(q){return q.required}).length,sections:sections.length,start:start,deadline:deadline,departments:deps.map(function(x){return x.value})}};
  }
  window.focusPublishIssueV183=function(tab){closePublishReviewV183();setEditorTabV181(tab);setTimeout(function(){(tab==='content'?$('formTitle'):$('formStartTime'))?.focus()},80)};
  function issueRowsV183(items,kind){return items.length?'<ul class="publishIssueListV183 '+kind+'">'+items.map(function(item){return '<li><button type="button" onclick="focusPublishIssueV183(\''+item.tab+'\')">'+esc(item.text)+'</button></li>'}).join('')+'</ul>':'<p class="publishAllClearV183">未發現'+(kind==='error'?'阻擋發布的問題':'提醒事項')+'。</p>'}
  function publishModalHtmlV183(result){var s=result.summary;return '<div id="publishReviewMaskV183" class="modalMask publishReviewMaskV183" style="display:grid"><div class="dialogCard publishReviewCardV183" role="dialog" aria-modal="true" aria-labelledby="publishReviewTitleV183"><div class="modalHeader"><div><h3 id="publishReviewTitleV183">發布前檢查</h3><p>確認內容、對象與開放期間後再發布。</p></div><button class="modalClose" type="button" onclick="closePublishReviewV183()" aria-label="關閉">×</button></div><div class="publishSummaryV183"><strong>'+esc(s.title)+'</strong><div><span>'+s.questions+' 題</span><span>'+s.required+' 題必填</span><span>'+s.sections+' 個區段</span></div><dl><div><dt>開啟</dt><dd>'+esc(s.start?formatDeadline(s.start):'發布後立即開放')+'</dd></div><div><dt>截止</dt><dd>'+esc(s.deadline?formatDeadline(s.deadline):'未設定')+'</dd></div><div><dt>對象</dt><dd>'+esc(s.departments.length?s.departments.join('、'):'未指定部門')+'</dd></div></dl></div><section><h4>需要修正 <span>'+result.errors.length+'</span></h4>'+issueRowsV183(result.errors,'error')+'</section><section><h4>發布提醒 <span>'+result.warnings.length+'</span></h4>'+issueRowsV183(result.warnings,'warning')+'</section><div class="modalActions"><button class="btn" type="button" onclick="closePublishReviewV183()">返回編輯</button><button id="confirmPublishBtnV183" class="btn primary" type="button" onclick="confirmPublishV183()" '+(result.errors.length?'disabled':'')+'>'+(publishIntentV183==='close'?'停止收件':'確認發布')+'</button></div></div></div>'}
  window.openPublishReviewV183=function(intent){publishIntentV183=intent||'open';document.querySelector('#publishReviewMaskV183')?.remove();var result=collectPublishIssuesV183();if(publishIntentV183==='close'){result.errors=[];result.warnings=[]}document.body.insertAdjacentHTML('beforeend',publishModalHtmlV183(result));syncAdminModalLockV138()};
  window.closePublishReviewV183=function(){document.querySelector('#publishReviewMaskV183')?.remove();syncAdminModalLockV138()};
  window.confirmPublishV183=async function(){var state=$('formState');if(!state)return;state.value=publishIntentV183==='close'?'closed':'open';closePublishReviewV183();await saveForm()};

  window.handleEditorPublishActionV183=function(){var state=($('formState')||{}).value||'draft';openPublishReviewV183(state==='open'?'close':'open')};
  function syncEditorPublishUiV183(){
    var action=$('editorStateActionV181'),state=($('formState')||{}).value||'draft',save=$('saveFormBtn');
    if(action){action.onclick=handleEditorPublishActionV183;action.className='btn '+(state==='open'?'danger':'success');action.textContent=state==='open'?'停止收件':(state==='closed'?'重新發布':'發布問卷')}
    if(save)save.textContent=editMode==='edit'?'儲存變更':'儲存問卷';
    var head=document.querySelector('.editorHeadActionsV181');if(head&&!head.querySelector('.publishCheckButtonV183'))head.insertAdjacentHTML('afterbegin','<button class="btn publishCheckButtonV183" type="button" onclick="openPublishReviewV183(\'check\')">檢查問卷</button>');
  }
  var baseRenderEditorStateV183=renderEditorStateV181;
  renderEditorStateV181=function(){baseRenderEditorStateV183();syncEditorPublishUiV183()};
  var baseStartNewFormV183=startNewForm;
  startNewForm=function(){baseStartNewFormV183();syncEditorPublishUiV183()};
  var baseEditFormV183=editForm;
  editForm=function(id){var result=baseEditFormV183(id);syncEditorPublishUiV183();return result};
  document.documentElement.setAttribute('data-product-version','1.83');
  setTimeout(syncEditorPublishUiV183,0);
})();
