/* v1.82: sections, paged front flow, content-first attachments, and UI consistency. */
(function(){
  'use strict';
  var baseNormalizeQuestion=normalizeQuestion;
  var baseNewQuestion=newQuestion;
  var baseRenderQuestionEditor=renderQuestionEditor;
  var baseRenderPublicQuestion=renderPublicQuestion;
  var baseRemoveQuestion=removeQuestion;
  var baseCopyQuestion=copyQuestion;
  var frontSectionIndex=0;
  window.getFrontSectionIndexV182=function(){return frontSectionIndex};
  window.setFrontSectionIndexV182=function(value){frontSectionIndex=Math.max(0,Number(value)||0);return frontSectionIndex};

  function isSectionBlockV182(q){return !!q&&q.type==='image'&&q.contentKind==='section'}
  window.isSectionBlockV182=isSectionBlockV182;
  window.isAnswerBlockV182=function(q){q=normalizeQuestion(q);return q.type!=='image'};

  normalizeQuestion=function(q){
    q=q||{};
    var next=baseNormalizeQuestion(q);
    next.contentKind=q.contentKind==='section'?'section':(q.contentKind||'');
    next.sectionNext=(q.sectionNext&&typeof q.sectionNext==='object')?Object.assign({mode:'next',targetSectionId:'',sourceQuestionId:'',values:[]},q.sectionNext):{mode:'next',targetSectionId:'',sourceQuestionId:'',values:[]};
    if(next.contentKind==='section'){next.type='image';next.required=false;next.imageUrl='';next.imageStoragePath='';next.contentFiles=[]}
    return next;
  };
  normalizeQuestions=function(list){return (Array.isArray(list)?list:[]).map(normalizeQuestion)};
  newQuestion=function(type){
    if(type==='section')return normalizeQuestion({id:'section_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),type:'image',contentKind:'section',title:'新區段',description:''});
    return normalizeQuestion(baseNewQuestion(type));
  };
  window.addSectionV182=function(){addQuestion('section');markFormDirty()};

  function sectionEditorHtmlV182(q,i){
    return '<div class="questionEdit sectionEditorV182" data-question-index="'+i+'" data-question-id="'+attr(q.id)+'" draggable="true" ondragstart="onQuestionDragStart(event,'+i+')" ondragover="onQuestionDragOver(event,'+i+')" ondragleave="onQuestionDragLeave(event)" ondrop="onQuestionDrop(event,'+i+')" ondragend="onQuestionDragEnd(event)">'+
      '<div class="questionEditHeader"><button type="button" class="dragHandle" title="拖曳排序" aria-label="拖曳排序">⋮⋮</button><span class="questionNumber">區段</span><span class="contentPurposeBadgeV180">前台分頁</span>'+questionJumpSelectHtmlV140(i)+'</div>'+
      '<p class="contentPurposeHelpV180">區段標題會顯示在新頁面頂端；填寫者完成本區段後再前往下一頁。</p>'+
      '<div class="sectionEditorFieldsV182"><label>區段標題<span>*</span><input value="'+attr(q.title)+'" oninput="updateQuestion('+i+',\'title\',this.value);markFormDirty()" placeholder="例如：基本資料"></label><label>區段說明（選填）<textarea oninput="updateQuestion('+i+',\'description\',this.value);markFormDirty()" placeholder="簡要說明本區段的填寫內容">'+esc(questionDescription(q))+'</textarea></label></div>'+
      '<div class="miniActions"><button class="btn" type="button" onclick="moveQuestion('+i+',-1)">上移</button><button class="btn" type="button" onclick="moveQuestion('+i+',1)">下移</button><button class="btn" type="button" onclick="copyQuestion('+i+')">複製區段</button><button class="btn danger" type="button" onclick="removeQuestion('+i+')">移除</button></div></div>';
  }

  renderQuestionEditor=function(){
    baseRenderQuestionEditor();
    normalizeQuestions(draftQuestions).forEach(function(q,i){
      if(!isSectionBlockV182(q))return;
      var card=document.querySelector('#questionEditor [data-question-index="'+i+'"]');
      if(card)card.outerHTML=sectionEditorHtmlV182(q,i);
    });
    var addArea=document.querySelector('#questionEditor .questionAddBottomV180');
    if(addArea&&!addArea.querySelector('.sectionChoiceV182'))addArea.insertAdjacentHTML('beforeend','<div class="questionAddChoiceV180 sectionChoiceV182"><button class="btn" type="button" onclick="addSectionV182()">新增區段</button><small>將後續題目放到新的填寫頁面</small></div>');
  };
  removeQuestion=async function(i){
    var q=normalizeQuestion(draftQuestions[i]);
    if(!isSectionBlockV182(q))return baseRemoveQuestion(i);
    if(await confirmDialog('移除區段後，區段內題目會接續到前一個區段，確定移除嗎？','移除區段',true)){draftQuestions.splice(i,1);markFormDirty();renderQuestionEditor()}
  };
  copyQuestion=function(i){
    var q=normalizeQuestion(draftQuestions[i]);
    if(!isSectionBlockV182(q))return baseCopyQuestion(i);
    var copy=JSON.parse(JSON.stringify(q));copy.id='section_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);copy.title=(copy.title||'新區段')+'（複製）';draftQuestions.splice(i+1,0,copy);window.__scrollToQuestionIndex=i+1;markFormDirty();renderQuestionEditor();toast('區段已複製','success')
  };

  var baseFormQuestionsValid=formQuestionsValid;
  formQuestionsValid=function(){
    var sections=normalizeQuestions(draftQuestions).filter(isSectionBlockV182);
    var empty=sections.find(function(q){return !String(q.title||'').trim()});
    if(empty)return '每個區段都需要區段標題';
    return baseFormQuestionsValid();
  };

  renderPublicQuestion=function(q,prefix,value){
    q=normalizeQuestion(q);
    if(isSectionBlockV182(q))return '<header class="frontSectionHeaderV182"><span>問卷區段</span><h2>'+esc(q.title||'未命名區段')+'</h2>'+(questionDescription(q)?'<p>'+esc(questionDescription(q))+'</p>':'')+'</header>';
    return baseRenderPublicQuestion(q,prefix,value);
  };

  function buildSectionPagesV182(form,prefix,values){
    var questions=normalizeQuestions(form.questions||[]),hasSections=questions.some(isSectionBlockV182),pages=[],current={id:'start',title:'填寫問卷',blocks:[]};
    questions.forEach(function(q){
      if(isSectionBlockV182(q)){if(current.blocks.length||current.id!=='start')pages.push(current);current={id:q.id,title:q.title||'未命名區段',header:q,blocks:[]}}
      else current.blocks.push(q);
    });
    if(current.blocks.length||current.header||!pages.length)pages.push(current);
    return {hasSections:hasSections,pages:pages.map(function(page,index){return '<section class="frontSectionPageV182" data-section-page="'+index+'" '+(index?'hidden':'')+'>'+(page.header?renderPublicQuestion(page.header,prefix):'')+page.blocks.map(function(q){return renderPublicQuestion(q,prefix,values&&values[q.id])}).join('')+'</section>'})};
  }
  window.renderSectionProgressV182=function(){
    var form=$('publicForm'),pages=form?[].slice.call(form.querySelectorAll('.frontSectionPageV182')):[],bar=$('frontSectionProgressBarV182'),label=$('frontSectionProgressLabelV182');
    pages.forEach(function(page,index){page.hidden=index!==frontSectionIndex});
    if(bar)bar.style.width=((frontSectionIndex+1)/Math.max(1,pages.length)*100)+'%';
    if(label)label.textContent='第 '+(frontSectionIndex+1)+'／'+pages.length+' 頁';
    var prev=$('frontSectionPrevV182'),next=$('frontSectionNextV182'),submit=$('submitBtn');
    if(prev)prev.hidden=frontSectionIndex===0;if(next)next.hidden=frontSectionIndex>=pages.length-1;if(submit)submit.hidden=frontSectionIndex<pages.length-1;
    applyConditionalVisibilityV171(form,activeForm(),'q_');
  };
  window.moveFrontSectionV182=function(delta){
    var form=$('publicForm'),pages=form?[].slice.call(form.querySelectorAll('.frontSectionPageV182')):[];
    if(!pages.length)return;
    if(delta>0){var invalid=pages[frontSectionIndex].querySelector(':invalid');if(invalid){invalid.reportValidity();invalid.focus();return}}
    frontSectionIndex=Math.max(0,Math.min(pages.length-1,frontSectionIndex+delta));renderSectionProgressV182();window.scrollTo({top:Math.max(0,form.getBoundingClientRect().top+window.scrollY-90),behavior:'smooth'});
  };

  var baseRenderFront=renderFront;
  renderFront=function(){
    baseRenderFront();
    var form=$('publicForm'),f=activeForm();if(!form||!f)return;
    var pack=buildSectionPagesV182(f,'q_',{});if(!pack.hasSections)return;
    frontSectionIndex=0;
    var identity=form.querySelector('.identityCard'),heading=form.querySelector('.frontFormHeading');
    normalizeQuestions(f.questions||[]).forEach(function(q){var el=form.querySelector('[data-question-id-v171="'+CSS.escape(String(q.id))+'"]');if(el)el.remove()});
    var anchor=identity||heading;anchor.insertAdjacentHTML('afterend','<div class="frontSectionProgressV182" aria-label="填寫進度"><div><span id="frontSectionProgressLabelV182"></span><b><i id="frontSectionProgressBarV182"></i></b></div></div>'+pack.pages.join(''));
    var submitArea=form.querySelector('.submitArea');submitArea.insertAdjacentHTML('afterbegin','<button id="frontSectionPrevV182" class="btn" type="button" onclick="moveFrontSectionV182(-1)" hidden>上一步</button><button id="frontSectionNextV182" class="btn primary" type="button" onclick="moveFrontSectionV182(1)">下一步</button>');
    renderSectionProgressV182();
  };

  var baseRenderAssistedFillForm=renderAssistedFillForm;
  renderAssistedFillForm=function(f,member){return baseRenderAssistedFillForm(f,member).replace(/<header class="frontSectionHeaderV182"[\s\S]*?<\/header>/g,'')};

  document.documentElement.setAttribute('data-product-version','1.82');
})();
