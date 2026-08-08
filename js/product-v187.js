/* v1.87: front-end presentation modes, theme refinement, and responsive form feedback. */
(function(){
  'use strict';
  var focusIndexV187=0;

  function fillLayoutV187(form){return form&&form.fillLayout==='focus'?'focus':'standard'}
  function ensureFillLayoutSettingsV187(){
    var pane=$('editorPaneAppearanceV181'),themes=pane&&pane.querySelector('.themeSettings');
    if(!themes||$('formFillLayoutV187'))return;
    themes.insertAdjacentHTML('beforebegin','<section class="fillLayoutSettingsV187"><div><h4>填寫版型</h4><p>標準模式適合一般公司問卷；專注模式一次呈現一個內容項目。有區段時仍依區段分頁。</p></div><input id="formFillLayoutV187" type="hidden" value="standard"><div class="fillLayoutChoicesV187"><button type="button" data-layout="standard" onclick="selectFillLayoutV187(\'standard\')"><span class="layoutPreviewV187 standard" aria-hidden="true"><i></i><i></i><i></i></span><b>標準模式</b><small>一頁瀏覽多個題目</small></button><button type="button" data-layout="focus" onclick="selectFillLayoutV187(\'focus\')"><span class="layoutPreviewV187 focus" aria-hidden="true"><i></i></span><b>專注模式</b><small>一次聚焦一個內容項目</small></button></div></section>');
  }
  function setFillLayoutFieldV187(value){
    ensureFillLayoutSettingsV187();
    var field=$('formFillLayoutV187');if(!field)return;
    field.value=value==='focus'?'focus':'standard';
    document.querySelectorAll('.fillLayoutChoicesV187 button').forEach(function(button){var active=button.dataset.layout===field.value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
  }
  window.selectFillLayoutV187=function(value){setFillLayoutFieldV187(value);markFormDirty()};

  var baseStartNewFormV187=startNewForm;
  startNewForm=function(){var result=baseStartNewFormV187();setFillLayoutFieldV187('standard');return result};
  var baseEditFormV187=editForm;
  editForm=function(id){var result=baseEditFormV187(id),form=forms.find(function(item){return item.id===id});setFillLayoutFieldV187(fillLayoutV187(form));return result};
  var baseSetEditorTabV187=setEditorTabV181;
  setEditorTabV181=function(name){var result=baseSetEditorTabV187(name);if(name==='appearance')ensureFillLayoutSettingsV187();return result};

  function decorateHeroV187(form){
    var hero=document.querySelector('.frontMain>.formHero');if(!hero||!form)return;
    var hasDescription=!!String(form.descriptionHtml||form.description||'').replace(/<[^>]+>/g,'').trim(),hasImage=!!imageUrl(form.imageUrl),hasFiles=Array.isArray(form.referenceFiles)&&form.referenceFiles.length>0,hasDeadline=!!form.deadline;
    hero.classList.toggle('heroCompactV187',!hasDescription&&!hasImage&&!hasFiles&&!hasDeadline);
    hero.classList.toggle('heroMediumV187',!hasImage&&(hasDescription||hasFiles||hasDeadline));
    hero.classList.toggle('heroVisualV187',hasImage);
  }
  function cardHasValueV187(card){
    if(card.classList.contains('contentBlockV175'))return false;
    if(card.classList.contains('identityCard'))return [].slice.call(card.querySelectorAll('select')).every(function(field){return !!field.value});
    var controls=[].slice.call(card.querySelectorAll('input:not([type=hidden]),select,textarea'));
    return controls.some(function(field){if(field.type==='checkbox'||field.type==='radio')return field.checked;if(field.type==='file')return field.files&&field.files.length;return String(field.value||'').trim()!==''})||!!card.querySelector('.storedFileItemV154');
  }
  function syncQuestionStatesV187(){
    var form=$('publicForm');if(!form)return;
    form.querySelectorAll('.questionCard').forEach(function(card){card.classList.toggle('isAnsweredV187',cardHasValueV187(card));if(cardHasValueV187(card))card.classList.remove('hasErrorV187')});
  }
  function focusCardsV187(){var form=$('publicForm');return form?[].slice.call(form.querySelectorAll(':scope>.focusStepV187')).filter(function(node){return node.getAttribute('aria-hidden')!=='true'}):[]}
  function renderFocusProgressV187(){
    var form=$('publicForm'),cards=focusCardsV187(),progress=$('frontFocusProgressV187');if(!form||!progress||!cards.length)return;
    focusIndexV187=Math.max(0,Math.min(focusIndexV187,cards.length-1));
    cards.forEach(function(card,index){card.hidden=index!==focusIndexV187;card.classList.toggle('focusCurrentV187',index===focusIndexV187)});
    var label=progress.querySelector('span'),bar=progress.querySelector('i');if(label)label.textContent='第 '+(focusIndexV187+1)+'／'+cards.length+' 步';if(bar)bar.style.width=((focusIndexV187+1)/cards.length*100)+'%';
    var prev=$('frontFocusPrevV187'),next=$('frontFocusNextV187'),submit=$('submitBtn');if(prev)prev.hidden=focusIndexV187===0;if(next)next.hidden=focusIndexV187>=cards.length-1;if(submit)submit.hidden=focusIndexV187<cards.length-1;
    syncQuestionStatesV187();
  }
  window.moveFocusStepV187=function(delta){
    var cards=focusCardsV187(),current=cards[focusIndexV187];if(!current)return;
    if(delta>0){var invalid=current.querySelector(':invalid');if(invalid){current.classList.add('hasErrorV187');invalid.reportValidity();invalid.focus();return}}
    focusIndexV187=Math.max(0,Math.min(cards.length-1,focusIndexV187+delta));renderFocusProgressV187();
    var next=focusCardsV187()[focusIndexV187];if(next){next.scrollIntoView({behavior:'smooth',block:'center'});(next.querySelector('input,select,textarea,button')||next).focus({preventScroll:true})}
  };
  function installFocusLayoutV187(form){
    var publicForm=$('publicForm');if(!publicForm)return;
    var hasSections=!!publicForm.querySelector('.frontSectionPageV182');
    publicForm.dataset.layoutEffective=hasSections?'section':fillLayoutV187(form);
    if(fillLayoutV187(form)!=='focus'||hasSections)return;
    focusIndexV187=0;
    [].slice.call(publicForm.children).filter(function(node){return node.classList&&node.classList.contains('questionCard')}).forEach(function(card){card.classList.add('focusStepV187')});
    publicForm.insertAdjacentHTML('afterbegin','<div id="frontFocusProgressV187" class="frontFocusProgressV187" aria-label="填寫進度"><div><span></span><b><i></i></b></div></div>');
    var area=publicForm.querySelector('.submitArea');if(area)area.insertAdjacentHTML('afterbegin','<button id="frontFocusPrevV187" class="btn" type="button" onclick="moveFocusStepV187(-1)" hidden>上一步</button><button id="frontFocusNextV187" class="btn primary" type="button" onclick="moveFocusStepV187(1)">下一步</button>');
    renderFocusProgressV187();
  }
  function sectionTitleV187(page,index){var heading=page.querySelector('.frontSectionHeaderV182 h2');return heading?heading.textContent.trim():(index===0?'開始填寫':'區段 '+(index+1))}
  function renderSectionStepsV187(){
    var form=$('publicForm'),progress=$('frontSectionProgressBarV182')&&$('frontSectionProgressBarV182').closest('.frontSectionProgressV182'),pages=form?[].slice.call(form.querySelectorAll('.frontSectionPageV182')):[];if(!progress||!pages.length)return;
    var nav=progress.querySelector('.frontSectionStepsV187');if(!nav){progress.insertAdjacentHTML('afterbegin','<ol class="frontSectionStepsV187"></ol>');nav=progress.querySelector('.frontSectionStepsV187')}
    var current=getFrontSectionIndexV182();nav.innerHTML=pages.map(function(page,index){return '<li class="'+(index<current?'done ':index===current?'current ':'')+'"><span>'+(index<current?'✓':index+1)+'</span><b>'+esc(sectionTitleV187(page,index))+'</b></li>'}).join('');
    syncMobileSectionActionsV187();
  }
  function ensureMobileSectionActionsV187(){
    var form=$('publicForm');if(!form||!form.querySelector('.frontSectionPageV182')||$('frontMobileActionsV187'))return;
    form.insertAdjacentHTML('beforeend','<div id="frontMobileActionsV187" class="frontMobileActionsV187"><button id="frontMobilePrevV187" class="btn" type="button" onclick="moveFrontSectionV182(-1)">上一步</button><button id="frontMobileNextV187" class="btn primary" type="button" onclick="moveFrontSectionV182(1)">下一步</button><button id="frontMobileSubmitV187" class="btn primary" type="button" onclick="document.getElementById(\'publicForm\').requestSubmit()">確認並送出</button></div>');
  }
  function syncMobileSectionActionsV187(){
    ensureMobileSectionActionsV187();var pages=document.querySelectorAll('#publicForm .frontSectionPageV182'),current=getFrontSectionIndexV182(),prev=$('frontMobilePrevV187'),next=$('frontMobileNextV187'),submit=$('frontMobileSubmitV187');if(!pages.length||!prev)return;
    prev.hidden=current===0;next.hidden=current>=pages.length-1;submit.hidden=current<pages.length-1;
  }
  var baseRenderSectionProgressV187=renderSectionProgressV182;
  renderSectionProgressV182=function(){var result=baseRenderSectionProgressV187();renderSectionStepsV187();return result};

  function enhanceFrontV187(form){
    if(!form)return;document.body.setAttribute('data-front-layout',fillLayoutV187(form));var publicForm=$('publicForm');decorateHeroV187(form);if(!publicForm)return;
    var heading=publicForm.querySelector('.frontFormHeading');if(heading)heading.remove();
    installFocusLayoutV187(form);renderSectionStepsV187();syncQuestionStatesV187();
  }
  var baseRenderFrontV187=renderFront;
  renderFront=function(){var result=baseRenderFrontV187();enhanceFrontV187(activeForm());return result};

  document.addEventListener('focusin',function(event){var card=event.target.closest&&event.target.closest('#publicForm .questionCard');if(card)card.classList.add('isActiveV187')});
  document.addEventListener('focusout',function(event){var card=event.target.closest&&event.target.closest('#publicForm .questionCard');if(card)setTimeout(function(){if(!card.contains(document.activeElement))card.classList.remove('isActiveV187')},0)});
  document.addEventListener('input',function(event){if(event.target.closest&&event.target.closest('#publicForm'))syncQuestionStatesV187()});
  document.addEventListener('change',function(event){if(event.target.closest&&event.target.closest('#publicForm')){syncQuestionStatesV187();setTimeout(function(){if($('publicForm')&&$('publicForm').dataset.layoutEffective==='focus')renderFocusProgressV187()},0)}});
  document.addEventListener('invalid',function(event){var card=event.target.closest&&event.target.closest('#publicForm .questionCard');if(card)card.classList.add('hasErrorV187')},true);

  ensureFillLayoutSettingsV187();
  document.documentElement.setAttribute('data-product-version','1.87');
})();
