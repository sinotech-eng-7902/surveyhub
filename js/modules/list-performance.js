/* v1.92 list performance: search, filter and client pagination for large datasets. */
(function(){
  'use strict';
  var formPage=1,formPageSize=10,memberPage=1,memberPageSize=25;
  function stateOf(f){return String(f.state||'draft')}
  function creatorSearchText(f){
    var label=typeof formCreatorLabel==='function'?formCreatorLabel(f):String(f?.createdByName||f?.creatorName||f?.ownerName||'');
    var email=typeof formCreatedByEmail==='function'?formCreatedByEmail(f):String(f?.createdByEmail||f?.creatorEmail||f?.ownerEmail||'');
    return [label,email].join(' ');
  }
  function pager(target,page,total,size,callback){if(!target)return;var pages=Math.max(1,Math.ceil(total/size));page=Math.min(Math.max(1,page),pages);target.innerHTML='<span>第 '+page+'／'+pages+' 頁，共 '+total+' 筆</span><div class="buttonRow"><button class="btn" type="button" '+(page<=1?'disabled':'')+' onclick="'+callback+'('+(page-1)+')">上一頁</button><button class="btn" type="button" '+(page>=pages?'disabled':'')+' onclick="'+callback+'('+(page+1)+')">下一頁</button></div>';return page}
  window.setFormPageSizeV192=function(value){formPageSize=Number(value)||10;formPage=1;renderFormsTable()};
  window.setFormPageV192=function(value){formPage=Number(value)||1;renderFormsTable();$('formsPanel')?.scrollIntoView({behavior:'smooth',block:'start'})};
  window.renderFormsTable=function(){var sections=formsBySection();if(!sections.some(function(x){return x.key===activeFormSection}))activeFormSection=sections[0]?.key||'mine';var current=sections.find(function(x){return x.key===activeFormSection})||sections[0],keyword=String($('formSearchV192')?.value||'').trim().toLowerCase(),state=String($('formStateFilterV192')?.value||''),items=(current?.items||[]).filter(function(f){var hay=[f.title,creatorSearchText(f)].join(' ').toLowerCase();return(!keyword||hay.includes(keyword))&&(!state||stateOf(f)===state)}),pages=Math.max(1,Math.ceil(items.length/formPageSize));formPage=Math.min(formPage,pages);var start=(formPage-1)*formPageSize,visible=items.slice(start,start+formPageSize);formsTable.innerHTML='<div class="surveyTabs">'+sections.map(function(section){return '<button class="'+(section.key===activeFormSection?'active':'')+'" onclick="setFormSection(\''+attr(section.key)+'\');setFormPageV192(1)">'+esc(section.title)+' <span>'+section.items.length+'</span></button>'}).join('')+'</div><p class="surveyTabHint">'+esc(current?.hint||'')+'</p>'+table(['問卷','狀態','我的角色','建立者','問卷期間','填寫','操作'],visible.map(formRowHtml),items.length?'':'沒有符合條件的問卷');formPage=pager($('formPaginationV192'),formPage,items.length,formPageSize,'setFormPageV192')||1};
  window.setMemberPageV192=function(value){memberPage=Number(value)||1;renderMemberPanel()};
  var baseMember=window.renderMemberPanel;
  window.renderMemberPanel=function(){baseMember();var target=$('membersTable'),body=target?.querySelector('tbody');if(!body)return;var rows=[].slice.call(body.children),total=rows.length,pages=Math.max(1,Math.ceil(total/memberPageSize));memberPage=Math.min(memberPage,pages);rows.forEach(function(row,index){row.hidden=index<(memberPage-1)*memberPageSize||index>=memberPage*memberPageSize});var pagerNode=$('memberPaginationV192');if(!pagerNode){target.insertAdjacentHTML('afterend','<div id="memberPaginationV192" class="paginationV192"></div>');pagerNode=$('memberPaginationV192')}memberPage=pager(pagerNode,memberPage,total,memberPageSize,'setMemberPageV192')||1};
  document.addEventListener('input',function(event){if(event.target?.id==='memberSearch'){memberPage=1}});
})();
