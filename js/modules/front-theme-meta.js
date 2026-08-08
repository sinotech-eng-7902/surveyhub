/* v1.90: heading-style visual integrity and real cover preview. */
(function(){
  'use strict';

  function safePreviewImageV190(){
    var pending=typeof pendingHeaderImagePreviewUrl!=='undefined'?pendingHeaderImagePreviewUrl:'';
    if(pending)return pending;
    var raw=(document.getElementById('formImageUrl')||{}).value||'';
    return typeof imageUrl==='function'?imageUrl(raw):raw;
  }

  function enhanceHeroStyleChoicesV190(){
    var settings=document.querySelector('.heroStyleSettingsV188'),button=settings&&settings.querySelector('button[data-hero="image"]');
    if(!settings||!button)return;
    var label=button.querySelector('b');if(label)label.textContent='圖片標題區';
    var note=button.querySelector('small');
    if(!note){note=document.createElement('small');button.appendChild(note)}
    note.textContent='搭配頁首圖片';
    button.setAttribute('aria-label','圖片標題區：使用頁首圖片作為問卷標題背景');
    button.title='使用頁首圖片作為問卷標題背景';
    if(!settings.querySelector('.heroStyleHelpV190')){
      var help=document.createElement('p');help.className='heroStyleHelpV190';help.textContent='圖片標題區需搭配下方「頁首圖片」；未設定圖片時，前台會自動使用色塊橫幅。';
      settings.querySelector('.heroStyleChoicesV188')?.insertAdjacentElement('afterend',help);
    }
  }

  function refreshCoverPreviewV190(){
    var preview=document.getElementById('themePreviewV188'),hero=preview&&preview.querySelector('.previewHeroV188');if(!preview||!hero)return;
    var url=safePreviewImageV190(),old=hero.querySelector('.previewCoverHintV190');
    preview.style.removeProperty('--preview-cover-image-v190');
    if(url){
      preview.style.setProperty('--preview-cover-image-v190','url("'+String(url).replace(/["\\]/g,'')+'")');
      if(old)old.remove();
    }else if(preview.dataset.previewHero==='image'){
      if(!old){old=document.createElement('em');old.className='previewCoverHintV190';old.textContent='尚未設定頁首圖片';hero.appendChild(old)}
    }else if(old)old.remove();
  }

  function deadlineIconV190(){
    return '<span class="frontDeadlineIconV190" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M7 3v3M17 3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><circle cx="15.5" cy="15" r="2.8"/><path d="M15.5 13.6v1.6l1.1.7"/></svg></span>';
  }

  function arrangeHeroMetaV190(){
    var hero=document.querySelector('.frontMain>.formHero');if(!hero)return;
    var files=hero.querySelector('.frontReferenceFilesV156'),deadline=hero.querySelector('.deadlineBadge'),meta=hero.querySelector('.frontHeroMetaV190');
    if(!files&&!deadline){if(meta)meta.remove();return}
    if(!meta){meta=document.createElement('div');meta.className='frontHeroMetaV190';(files||deadline).insertAdjacentElement('beforebegin',meta)}
    if(files&&files.parentElement!==meta)meta.appendChild(files);
    if(deadline&&deadline.parentElement!==meta)meta.appendChild(deadline);
    if(deadline&&!deadline.querySelector('.frontDeadlineIconV190'))deadline.insertAdjacentHTML('afterbegin',deadlineIconV190());
  }

  var previousPreviewV190=window.updateThemePreviewV188;
  if(typeof previousPreviewV190==='function')window.updateThemePreviewV188=function(){
    var result=previousPreviewV190.apply(this,arguments);enhanceHeroStyleChoicesV190();refreshCoverPreviewV190();return result;
  };

  var previousHeaderPreviewV190=window.previewHeaderImage;
  if(typeof previousHeaderPreviewV190==='function')window.previewHeaderImage=function(){
    var result=previousHeaderPreviewV190.apply(this,arguments);refreshCoverPreviewV190();return result;
  };

  var previousEditorTabV190=window.setEditorTabV181;
  if(typeof previousEditorTabV190==='function')window.setEditorTabV181=function(){
    var result=previousEditorTabV190.apply(this,arguments);enhanceHeroStyleChoicesV190();refreshCoverPreviewV190();return result;
  };

  var previousRenderFrontV190=window.renderFront;
  if(typeof previousRenderFrontV190==='function')window.renderFront=function(){
    var result=previousRenderFrontV190.apply(this,arguments);arrangeHeroMetaV190();return result;
  };

  document.addEventListener('DOMContentLoaded',function(){enhanceHeroStyleChoicesV190();refreshCoverPreviewV190();arrangeHeroMetaV190()});
  document.documentElement.setAttribute('data-product-version','1.90');
})();
