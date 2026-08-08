/* v1.94 reusable UTF-8 HTML EML generation helpers. */
(function(global){
  'use strict';
  function cleanHeader(value){return String(value||'').replace(/[\r\n]+/g,' ').trim()}
  function bytesBase64(bytes){var binary='',step=0x8000;for(var i=0;i<bytes.length;i+=step)binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+step));return btoa(binary)}
  function utf8Base64(value){return bytesBase64(new TextEncoder().encode(String(value||'')))}
  function foldBase64(value){return String(value||'').match(/.{1,76}/g)?.join('\r\n')||''}
  function encodedHeader(value){return'=?UTF-8?B?'+utf8Base64(cleanHeader(value))+'?='}
  function address(person){var email=cleanHeader(person.email||person.googleEmail||person.companyEmail||'');if(!email)return'';var label=cleanHeader([person.department,person.name].filter(Boolean).join('-'));return label?encodedHeader(label)+' <'+email+'>':email}
  function foldAddresses(name,items){if(!items.length)return name+':';var lines=[],current=name+': '+items[0];items.slice(1).forEach(function(item){var part=', '+item;if(current.length+part.length>76){lines.push(current+',');current=' '+item}else current+=part});lines.push(current);return lines.join('\r\n')}
  function safeFilename(value){return cleanHeader(value||'問卷通知').replace(/[\\/:*?"<>|]/g,'-').slice(0,80)||'問卷通知'}
  function stripHtml(html){var doc=new DOMParser().parseFromString(String(html||''),'text/html');return(doc.body.textContent||'').replace(/\n{3,}/g,'\n\n').trim()}
  async function inlineAsset(asset){var response=await fetch(asset.url,{cache:'no-store'});if(!response.ok)throw new Error('無法載入信件圖示');var bytes=new Uint8Array(await response.arrayBuffer());return{cid:asset.cid,type:asset.type||'image/png',name:asset.name||asset.cid+'.png',data:foldBase64(bytesBase64(bytes))}}
  async function downloadEml(options){
    options=options||{};
    var recipients=[].concat(options.recipients||[]).map(address).filter(Boolean);
    if(!recipients.length)throw new Error('沒有可使用的收件者信箱');
    var subject=cleanHeader(options.subject||'問卷通知'),html=String(options.html||''),plain=String(options.plainText||stripHtml(html));
    if(!subject)throw new Error('請輸入信件主旨');
    if(!plain.trim())throw new Error('請輸入信件內容');
    var headers=['Date: '+new Date().toUTCString(),'Subject: '+encodedHeader(subject),foldAddresses('To',recipients),'X-Unsent: 1','MIME-Version: 1.0'];
    var assets=await Promise.all([].concat(options.assets||[]).map(inlineAsset));
    var eml;
    if(html){
      var related='----=_SurveyRelated_'+Date.now(),alternative='----=_SurveyAlternative_'+Date.now();
      var parts=headers.concat(['Content-Type: multipart/related; boundary="'+related+'"','', '--'+related,'Content-Type: multipart/alternative; boundary="'+alternative+'"','', '--'+alternative,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',foldBase64(utf8Base64(plain)),'','--'+alternative,'Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: base64','',foldBase64(utf8Base64(html)),'','--'+alternative+'--','']);
      assets.forEach(function(asset){parts.push('--'+related,'Content-Type: '+asset.type+'; name="'+asset.name+'"','Content-Transfer-Encoding: base64','Content-ID: <'+asset.cid+'>','Content-Disposition: inline; filename="'+asset.name+'"','',asset.data,'')});
      parts.push('--'+related+'--','');eml=parts.join('\r\n');
    }else eml=headers.concat(['Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',foldBase64(utf8Base64(plain)),'']).join('\r\n');
    var blob=new Blob([eml],{type:'message/rfc822'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=safeFilename(options.filename)+'.eml';a.click();setTimeout(function(){URL.revokeObjectURL(url)},1000);return recipients.length;
  }
  global.SurveyNotificationToolsV194={downloadEml:downloadEml,address:address,encodedHeader:encodedHeader,stripHtml:stripHtml};
})(window);
