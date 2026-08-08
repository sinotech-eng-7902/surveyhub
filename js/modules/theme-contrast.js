/* v1.89: full-theme contrast audit and editor disclosure consistency. */
(function(){
  'use strict';

  var HERO_PRESETS_V189={
    appleWhite:{bg:'linear-gradient(135deg,#ffffff,#f8fbfe)',text:'#08264a'},
    oceanBlue:{bg:'linear-gradient(135deg,#135f75,#168a87)',text:'#ffffff'},
    sunnyOrange:{bg:'linear-gradient(135deg,#fffaf2,#f3e3cb)',text:'#563719'},
    forestGreen:{bg:'linear-gradient(135deg,#285f4e,#3f8069)',text:'#ffffff'},
    sinotechRed:{bg:'linear-gradient(135deg,#b8332c,#e46f3d)',text:'#ffffff'},
    sakura:{bg:'linear-gradient(135deg,#315b82,#5c83a8)',text:'#ffffff'},
    mistGray:{bg:'linear-gradient(135deg,#394d61,#5d7184)',text:'#ffffff'},
    navyGold:{bg:'linear-gradient(135deg,#132d50,#244d78)',text:'#ffffff'},
    lavenderCare:{bg:'linear-gradient(135deg,#594776,#725e91)',text:'#ffffff'},
    paperWarm:{bg:'linear-gradient(135deg,#fffdf8,#eee0ca)',text:'#554332'},
    techGradient:{bg:'linear-gradient(125deg,#3154a4,#6b57c7)',text:'#ffffff'},
    freshIllustration:{bg:'linear-gradient(135deg,#1c6865,#2d7f75)',text:'#ffffff'},
    brandCustom:{bg:'linear-gradient(135deg,#245f9e,#3c80bb)',text:'#ffffff'}
  };

  function normalizeHexV189(value){
    var hex=String(value||'').trim();
    if(/^#[0-9a-f]{3}$/i.test(hex))return '#'+hex.slice(1).split('').map(function(x){return x+x}).join('');
    return /^#[0-9a-f]{6}$/i.test(hex)?hex.toLowerCase():'';
  }
  function luminanceV189(hex){
    hex=normalizeHexV189(hex)||'#245f9e';
    var values=[1,3,5].map(function(i){var v=parseInt(hex.slice(i,i+2),16)/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
    return .2126*values[0]+.7152*values[1]+.0722*values[2];
  }
  function contrastV189(a,b){var l1=luminanceV189(a),l2=luminanceV189(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)}
  function readableTextV189(background){return contrastV189(background,'#ffffff')>=4.5?'#ffffff':'#102a43'}

  function clearCustomContrastV189(){
    ['--front-hero-text','--front-action-bg','--front-action-text','--front-pill-text','--front-deadline-text'].forEach(function(name){document.body.style.removeProperty(name)});
  }
  function applyCustomContrastV189(){
    clearCustomContrastV189();
    if(document.body.dataset.frontTheme!=='brandCustom')return;
    var styles=getComputedStyle(document.body),accent=normalizeHexV189(styles.getPropertyValue('--front-accent'))||'#245f9e',text=normalizeHexV189(styles.getPropertyValue('--front-text'))||'#17324d',readable=readableTextV189(accent);
    document.body.style.setProperty('--front-hero-text',readable);
    document.body.style.setProperty('--front-action-bg',accent);
    document.body.style.setProperty('--front-action-text',readable);
    document.body.style.setProperty('--front-pill-text',text);
    document.body.style.setProperty('--front-deadline-text',text);
  }

  function refreshPreviewContrastV189(){
    var preview=document.getElementById('themePreviewV188');if(!preview)return;
    var theme=preview.dataset.previewTheme||'appleWhite',preset=HERO_PRESETS_V189[theme]||HERO_PRESETS_V189.appleWhite;
    if(theme==='brandCustom'){
      var accent=normalizeHexV189((document.getElementById('customAccentV188')||{}).value)||'#245f9e';
      preset={bg:'linear-gradient(135deg,'+accent+','+accent+'d9)',text:readableTextV189(accent)};
    }
    preview.style.setProperty('--preview-hero-bg',preset.bg);
    preview.style.setProperty('--preview-hero-text',preset.text);
  }

  var previousRenderFrontV189=window.renderFront;
  if(typeof previousRenderFrontV189==='function')window.renderFront=function(){var result=previousRenderFrontV189.apply(this,arguments);applyCustomContrastV189();return result};

  var previousUpdatePreviewV189=window.updateThemePreviewV188;
  if(typeof previousUpdatePreviewV189==='function')window.updateThemePreviewV188=function(){var result=previousUpdatePreviewV189.apply(this,arguments);refreshPreviewContrastV189();return result};

  document.addEventListener('DOMContentLoaded',function(){
    applyCustomContrastV189();
    refreshPreviewContrastV189();
    document.querySelectorAll('.editorDescriptionV181>summary,.editorAttachmentsInlineV182>summary').forEach(function(summary){summary.setAttribute('aria-label',summary.textContent.trim())});
  });
  document.documentElement.setAttribute('data-product-version','1.89');
})();
