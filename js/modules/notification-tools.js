/* Reusable EML generation helpers introduced in v1.86. */
(function(global){
  'use strict';
  function cleanHeader(value){return String(value||'').replace(/[\r\n]+/g,' ').trim()}
  function address(person){var email=cleanHeader(person.email||person.googleEmail||person.companyEmail||'');if(!email)return'';var label=cleanHeader([person.department,person.name].filter(Boolean).join('-'));return label?label+' <'+email+'>':email}
  function downloadEml(options){options=options||{};var recipients=[].concat(options.recipients||[]).map(address).filter(Boolean),subject=cleanHeader(options.subject||'問卷填寫提醒'),body=String(options.body||'');if(!recipients.length)throw new Error('沒有可使用的收件者信箱');var content=['MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: 8bit','To: '+recipients.join('; '),'Subject: '+subject,'',''+body].join('\r\n'),blob=new Blob([content],{type:'message/rfc822;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(options.filename||'問卷填寫提醒')+'.eml';a.click();setTimeout(function(){URL.revokeObjectURL(url)},1000);return recipients.length}
  global.SurveyNotificationToolsV186={downloadEml:downloadEml,address:address};
})(window);
