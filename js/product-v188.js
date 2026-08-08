/* v1.88: theme studio and polished front-end presentation. */
(function(){
  'use strict';
  var THEME_META_V188={
    appleWhite:{group:'formal',description:'清楚穩重的公司標準樣式'},
    oceanBlue:{group:'fresh',description:'清爽藍綠與柔和漸層'},
    sunnyOrange:{group:'warm',description:'溫暖親切的行政問卷'},
    forestGreen:{group:'fresh',description:'自然沉穩的綠色層次'},
    sinotechRed:{group:'active',description:'適合活動與意見募集'},
    sakura:{group:'image',description:'以自訂圖片作為視覺焦點'},
    mistGray:{group:'formal',description:'低彩度、安靜而專業'},
    navyGold:{group:'formal',description:'深藍與淡金的正式質感'},
    lavenderCare:{group:'soft',description:'適合滿意度與關懷調查'},
    paperWarm:{group:'warm',description:'長問卷也舒適的閱讀風格'},
    techGradient:{group:'active',description:'資訊、研發與創新提案'},
    freshIllustration:{group:'fresh',description:'清新活潑的活動風格'},
    brandCustom:{group:'custom',description:'使用自訂品牌色彩'}
  };
  var THEME_PREVIEW_V188={
    appleWhite:['#f4f7fa','#ffffff','#245f9e','#17324d'],oceanBlue:['#eff8fa','#157b82','#168a87','#17324d'],sunnyOrange:['#fbf6ee','#f1dfc8','#a8672e','#563719'],forestGreen:['#f0f7f3','#33705c','#3c8068','#173f34'],sinotechRed:['#fff7f2','#d85835','#c44731','#55241d'],sakura:['#eef3f9','#416b92','#326fa8','#17324d'],mistGray:['#f2f4f6','#ffffff','#536f8a','#2c3e50'],navyGold:['#f5f1e8','#17355c','#aa7b28','#142e52'],lavenderCare:['#f5f1fa','#e7def4','#7d68aa','#433a5c'],paperWarm:['#faf6ed','#fffdf8','#916b42','#574535'],techGradient:['#edf2ff','#4c61bd','#5856c8','#25355f'],freshIllustration:['#eff9f6','#e1f4ef','#df7969','#205a57'],brandCustom:['#f3f6fa','#ffffff','#245f9e','#17324d']
  };
  var DEFAULT_CUSTOM_V188={accent:'#245f9e',background:'#f3f6fa',card:'#ffffff',text:'#17324d'};

  function safeColorV188(value,fallback){value=String(value||'').trim();return /^#[0-9a-f]{6}$/i.test(value)?value:fallback}
  function heroStyleForV188(form){var value=form&&form.heroStyle;return ['compact','banner','image','sideAccent'].includes(value)?value:'banner'}
  function customThemeForV188(form){var value=form&&form.customTheme&&typeof form.customTheme==='object'?form.customTheme:{};return{accent:safeColorV188(value.accent,DEFAULT_CUSTOM_V188.accent),background:safeColorV188(value.background,DEFAULT_CUSTOM_V188.background),card:safeColorV188(value.card,DEFAULT_CUSTOM_V188.card),text:safeColorV188(value.text,DEFAULT_CUSTOM_V188.text)}}

  function ensureThemeStudioV188(){
    var pane=$('editorPaneAppearanceV181'),themeSettings=pane&&pane.querySelector('.themeSettings');
    if(!themeSettings||$('themeStudioV188'))return;
    themeSettings.classList.add('themeSettingsV188');
    themeSettings.querySelector('h4')?.insertAdjacentHTML('afterend','<p class="themeIntroV188">選擇適合問卷用途的完整視覺風格，可再搭配標題區樣式。</p><div class="themeFiltersV188" role="group" aria-label="主題分類"><button type="button" class="active" data-filter="all" onclick="filterThemeGalleryV188(\'all\')">全部</button><button type="button" data-filter="formal" onclick="filterThemeGalleryV188(\'formal\')">正式</button><button type="button" data-filter="fresh" onclick="filterThemeGalleryV188(\'fresh\')">清新</button><button type="button" data-filter="soft" onclick="filterThemeGalleryV188(\'soft\')">柔和</button><button type="button" data-filter="active" onclick="filterThemeGalleryV188(\'active\')">活潑</button><button type="button" data-filter="custom" onclick="filterThemeGalleryV188(\'custom\')">自訂</button></div>');
    themeSettings.insertAdjacentHTML('afterend','<section id="themeStudioV188" class="themeStudioV188"><div class="themeControlsV188"><div class="heroStyleSettingsV188"><h4>標題區樣式</h4><p>只改變問卷頁首的呈現方式，不影響題目與填寫流程。</p><input id="formHeroStyleV188" type="hidden" value="banner"><div class="heroStyleChoicesV188"><button type="button" data-hero="compact" onclick="setHeroStyleV188(\'compact\')"><i class="compact"></i><b>精簡標題</b></button><button type="button" data-hero="banner" onclick="setHeroStyleV188(\'banner\')"><i class="banner"></i><b>色塊橫幅</b></button><button type="button" data-hero="image" onclick="setHeroStyleV188(\'image\')"><i class="image"></i><b>圖片封面</b></button><button type="button" data-hero="sideAccent" onclick="setHeroStyleV188(\'sideAccent\')"><i class="side"></i><b>側邊色帶</b></button></div></div><div id="customThemePanelV188" class="customThemePanelV188" hidden><div><h4>自訂品牌色</h4><p>系統會自動將顏色套用至背景、卡片、選項與按鈕。</p></div><div class="customColorGridV188"><label>主題色<input id="customAccentV188" type="color" value="#245f9e" oninput="updateThemePreviewV188();markFormDirty()"></label><label>頁面背景<input id="customBackgroundV188" type="color" value="#f3f6fa" oninput="updateThemePreviewV188();markFormDirty()"></label><label>卡片背景<input id="customCardV188" type="color" value="#ffffff" oninput="updateThemePreviewV188();markFormDirty()"></label><label>文字顏色<input id="customTextV188" type="color" value="#17324d" oninput="updateThemePreviewV188();markFormDirty()"></label></div><p id="themeContrastNoteV188" class="themeContrastNoteV188"></p></div></div><aside class="themePreviewPanelV188"><div class="themePreviewHeadV188"><div><h4>即時預覽</h4><span>示意前台的標題、題目與按鈕</span></div><div class="previewDeviceSwitchV188"><button type="button" class="active" data-device="desktop" onclick="setThemePreviewDeviceV188(\'desktop\')">桌機</button><button type="button" data-device="mobile" onclick="setThemePreviewDeviceV188(\'mobile\')">手機</button></div></div><div id="themePreviewFrameV188" class="themePreviewFrameV188 desktop"><div id="themePreviewV188" class="themePreviewV188" data-preview-theme="appleWhite"><div class="previewHeroV188"><span>員工意見調查</span><small>希望了解同仁的工作感受</small></div><div class="previewQuestionV188"><b>您對整體工作體驗的滿意程度為何？</b><i></i><i class="selected"></i><i></i></div><button type="button" tabindex="-1">確認並送出</button></div></div></aside></section>');
  }

  function decorateThemeCardsV188(){
    ensureThemeStudioV188();
    document.querySelectorAll('#themeChoices .themeCard').forEach(function(card,index){
      var theme=FORM_THEMES_V132[index],meta=theme&&THEME_META_V188[theme.id];if(!theme||!meta)return;
      card.dataset.theme=theme.id;card.dataset.group=meta.group;
      if(!card.querySelector('small'))card.insertAdjacentHTML('beforeend','<small>'+esc(meta.description)+'</small>');
      card.setAttribute('aria-label',theme.label+'：'+meta.description);
    });
    updateThemePreviewV188();
  }
  window.filterThemeGalleryV188=function(group){
    document.querySelectorAll('.themeFiltersV188 button').forEach(function(button){button.classList.toggle('active',button.dataset.filter===group)});
    document.querySelectorAll('#themeChoices .themeCard').forEach(function(card){card.hidden=group!=='all'&&card.dataset.group!==group});
  };
  window.setHeroStyleV188=function(value,silent){
    ensureThemeStudioV188();value=['compact','banner','image','sideAccent'].includes(value)?value:'banner';$('formHeroStyleV188').value=value;
    document.querySelectorAll('.heroStyleChoicesV188 button').forEach(function(button){var active=button.dataset.hero===value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
    updateThemePreviewV188();if(!silent&&typeof markFormDirty==='function')markFormDirty();
  };
  window.setThemePreviewDeviceV188=function(device){
    var frame=$('themePreviewFrameV188');if(!frame)return;device=device==='mobile'?'mobile':'desktop';frame.className='themePreviewFrameV188 '+device;
    document.querySelectorAll('.previewDeviceSwitchV188 button').forEach(function(button){button.classList.toggle('active',button.dataset.device===device)});
  };
  function relativeLuminanceV188(hex){var rgb=[1,3,5].map(function(i){var v=parseInt(hex.slice(i,i+2),16)/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]}
  function contrastV188(a,b){var x=relativeLuminanceV188(a),y=relativeLuminanceV188(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
  window.customThemeDataV188=function(){return customThemeForV188({customTheme:{accent:$('customAccentV188')?.value,background:$('customBackgroundV188')?.value,card:$('customCardV188')?.value,text:$('customTextV188')?.value}})};
  window.heroStyleDataV188=function(){return heroStyleForV188({heroStyle:$('formHeroStyleV188')?.value})};
  window.updateThemePreviewV188=function(){
    ensureThemeStudioV188();var preview=$('themePreviewV188'),theme=formTheme({theme:$('formTheme')?.value}),custom=customThemeDataV188(),palette=theme==='brandCustom'?[custom.background,custom.card,custom.accent,custom.text]:(THEME_PREVIEW_V188[theme]||THEME_PREVIEW_V188.appleWhite),hero=heroStyleDataV188();if(!preview)return;
    preview.dataset.previewTheme=theme;preview.dataset.previewHero=hero;preview.style.setProperty('--preview-bg',palette[0]);preview.style.setProperty('--preview-card',palette[1]);preview.style.setProperty('--preview-accent',palette[2]);preview.style.setProperty('--preview-text',palette[3]);
    var customPanel=$('customThemePanelV188');if(customPanel)customPanel.hidden=theme!=='brandCustom';
    var note=$('themeContrastNoteV188');if(note){var ratio=contrastV188(custom.text,custom.card);note.className='themeContrastNoteV188 '+(ratio<4.5?'warn':'ok');note.textContent=ratio<4.5?'文字與卡片背景對比較低，建議調整為較深或較淺的文字色。':'文字對比清楚，適合閱讀。'}
  };
  function setThemeStudioFieldsV188(form){
    ensureThemeStudioV188();var custom=customThemeForV188(form);$('customAccentV188').value=custom.accent;$('customBackgroundV188').value=custom.background;$('customCardV188').value=custom.card;$('customTextV188').value=custom.text;setHeroStyleV188(heroStyleForV188(form),true);updateThemePreviewV188();
  }

  var baseRenderThemeChoicesV188=renderThemeChoices;
  renderThemeChoices=function(selected){var result=baseRenderThemeChoicesV188(selected);decorateThemeCardsV188();return result};
  var baseSelectThemeV188=selectTheme;
  selectTheme=function(id){var result=baseSelectThemeV188(id);decorateThemeCardsV188();updateThemePreviewV188();return result};
  var baseStartNewFormV188=startNewForm;
  startNewForm=function(){var result=baseStartNewFormV188();setThemeStudioFieldsV188(null);return result};
  var baseEditFormV188=editForm;
  editForm=function(id){var result=baseEditFormV188(id),form=forms.find(function(item){return item.id===id});setThemeStudioFieldsV188(form);return result};
  var baseSetEditorTabV188=setEditorTabV181;
  setEditorTabV181=function(name){var result=baseSetEditorTabV188(name);if(name==='appearance'){ensureThemeStudioV188();decorateThemeCardsV188()}return result};

  function clearCustomThemeVarsV188(){['--front-bg','--front-card','--front-card-border','--front-accent','--front-hero-bg','--front-hero-text','--front-text','--front-choice-selected','--front-choice-hover'].forEach(function(name){document.body.style.removeProperty(name)})}
  function applyCustomThemeV188(form){
    clearCustomThemeVarsV188();if(!form||formTheme(form)!=='brandCustom')return;var custom=customThemeForV188(form);
    document.body.style.setProperty('--front-bg',custom.background);document.body.style.setProperty('--front-card',custom.card);document.body.style.setProperty('--front-card-border',custom.accent+'38');document.body.style.setProperty('--front-accent',custom.accent);document.body.style.setProperty('--front-hero-bg','linear-gradient(135deg,'+custom.accent+','+custom.accent+'d9)');document.body.style.setProperty('--front-hero-text','#ffffff');document.body.style.setProperty('--front-text',custom.text);document.body.style.setProperty('--front-choice-selected',custom.accent+'16');document.body.style.setProperty('--front-choice-hover',custom.accent+'0d');
  }
  function applyHeroStyleV188(form){
    var hero=document.querySelector('.frontMain>.formHero');if(!hero||!form)return;var style=heroStyleForV188(form),url=imageUrl(form.imageUrl);hero.classList.remove('heroStyleCompactV188','heroStyleBannerV188','heroStyleImageV188','heroStyleSideV188');hero.classList.add(style==='compact'?'heroStyleCompactV188':style==='image'&&url?'heroStyleImageV188':style==='sideAccent'?'heroStyleSideV188':'heroStyleBannerV188');hero.dataset.heroStyle=style;
    hero.style.removeProperty('--hero-image-v188');if(style==='image'&&url)hero.style.setProperty('--hero-image-v188','url("'+String(url).replace(/["\\]/g,'')+'")');
  }
  function decorateQuestionCardsV188(){
    var form=$('publicForm');if(!form)return;var number=0;
    form.querySelectorAll('.questionCard').forEach(function(card){if(card.classList.contains('identityCard')||card.classList.contains('contentBlockV175')||card.classList.contains('frontSectionHeaderV182'))return;number++;card.classList.add('answerQuestionV188');var title=card.querySelector('label.title');if(title&&!title.querySelector('.frontQuestionNumberV188'))title.insertAdjacentHTML('afterbegin','<span class="frontQuestionNumberV188">'+number+'</span>')});
  }
  function enhanceSuccessCardV188(){var card=document.querySelector('.submitSuccessCard');if(!card||card.classList.contains('completionVisualV188'))return;card.classList.add('completionVisualV188');var heading=card.querySelector('h2');if(heading)heading.insertAdjacentHTML('beforebegin','<span class="completionIconV188" aria-hidden="true">✓</span>')}
  function enhanceFrontV188(form){if(!form)return;applyCustomThemeV188(form);applyHeroStyleV188(form);decorateQuestionCardsV188();enhanceSuccessCardV188()}
  var baseRenderFrontV188=renderFront;
  renderFront=function(){var result=baseRenderFrontV188(),form=activeForm();if(form)enhanceFrontV188(form);else clearCustomThemeVarsV188();return result};
  var baseSubmitResponseV188=submitResponse;
  submitResponse=async function(event){var result=await baseSubmitResponseV188(event);enhanceFrontV188(activeForm());return result};

  ensureThemeStudioV188();
  document.documentElement.setAttribute('data-product-version','1.88');
})();
