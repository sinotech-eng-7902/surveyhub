/* v1.47: navigation, modal, dirty-state, and bootstrap guards extracted from app.js. */
var submitResponseV144Base=typeof submitResponse==='function'?submitResponse:null;
if(submitResponseV144Base){
  submitResponse=async function(event){
    var f=activeForm();
    if(f&&f.identityMode!=='member'){
      var oldConfirm=confirmDialog;
      confirmDialog=function(message,title,danger){
        return oldConfirm('確認送出這份問卷嗎？',title,danger);
      };
      try{
        await submitResponseV144Base(event);
        var card=document.querySelector('.submitSuccessCard p');
        if(card)card.textContent='已收到您的填寫內容，感謝您的填寫。';
      }finally{
        confirmDialog=oldConfirm;
      }
    }else{
      await submitResponseV144Base(event);
    }
  };
}
function markAssistDirtyV144(){
  assistedFormDirtyV144=true;
}
function markResponseEditDirtyV144(){
  responseEditDirtyV144=true;
}
var openAssistedFillV144Base=typeof openAssistedFill==='function'?openAssistedFill:null;
if(openAssistedFillV144Base){
  openAssistedFill=function(memberId){
    lastModalTriggerV144=document.activeElement;
    assistedFormDirtyV144=false;
    openAssistedFillV144Base(memberId);
    var form=document.getElementById('assistedForm');
    if(form){
      form.addEventListener('input',markAssistDirtyV144);
      form.addEventListener('change',markAssistDirtyV144);
    }
  };
}
var closeAssistedFillV144Base=typeof closeAssistedFill==='function'?closeAssistedFill:null;
if(closeAssistedFillV144Base){
  closeAssistedFill=async function(force){
    if(modalBusyV144&&!modalProgrammaticCloseV144)return;
    if(!modalProgrammaticCloseV144&&!force&&assistedFormDirtyV144&&!await confirmDialog('內容尚未儲存，確定關閉嗎？','尚未儲存'))return;
    assistedFormDirtyV144=false;
    closeAssistedFillV144Base();
    if(lastModalTriggerV144&&lastModalTriggerV144.focus)lastModalTriggerV144.focus();
  };
}
var submitAssistedResponseV144Base=typeof submitAssistedResponse==='function'?submitAssistedResponse:null;
if(submitAssistedResponseV144Base){
  submitAssistedResponse=async function(event){
    modalBusyV144=true;
    modalProgrammaticCloseV144=true;
    try{await submitAssistedResponseV144Base(event);assistedFormDirtyV144=false}
    finally{modalProgrammaticCloseV144=false;modalBusyV144=false}
  };
}
var openResponseEditorV144Base=typeof openResponseEditor==='function'?openResponseEditor:null;
if(openResponseEditorV144Base){
  openResponseEditor=function(id){
    lastModalTriggerV144=document.activeElement;
    responseEditDirtyV144=false;
    openResponseEditorV144Base(id);
    var form=document.getElementById('responseEditForm');
    if(form){
      form.addEventListener('input',markResponseEditDirtyV144);
      form.addEventListener('change',markResponseEditDirtyV144);
    }
  };
}
var closeResponseEditorV144Base=typeof closeResponseEditor==='function'?closeResponseEditor:null;
if(closeResponseEditorV144Base){
  closeResponseEditor=async function(force){
    if(modalBusyV144&&!modalProgrammaticCloseV144)return;
    if(!modalProgrammaticCloseV144&&!force&&responseEditDirtyV144&&!await confirmDialog('內容尚未儲存，確定關閉嗎？','尚未儲存'))return;
    responseEditDirtyV144=false;
    closeResponseEditorV144Base();
    if(lastModalTriggerV144&&lastModalTriggerV144.focus)lastModalTriggerV144.focus();
  };
}
var saveEditedResponseV144Base=typeof saveEditedResponse==='function'?saveEditedResponse:null;
if(saveEditedResponseV144Base){
  saveEditedResponse=async function(event){
    modalBusyV144=true;
    modalProgrammaticCloseV144=true;
    try{await saveEditedResponseV144Base(event);responseEditDirtyV144=false}
    finally{modalProgrammaticCloseV144=false;modalBusyV144=false}
  };
}
function topOpenModalV144(){
  var selectors=['.deleteFormModalV136','#creatorDialogMask','#dialogMask','#responseEditMask','#assistedFillMask'];
  for(var i=0;i<selectors.length;i++){
    var el=document.querySelector(selectors[i]);
    if(el&&getComputedStyle(el).display!=='none')return el;
  }
  return null;
}
document.addEventListener('keydown',async function(event){
  if(event.key!=='Escape')return;
  var modal=topOpenModalV144();
  if(!modal||modalBusyV144)return;
  event.preventDefault();
  if(modal.classList.contains('deleteFormModalV136'))return;
  if(modal.id==='dialogMask')return closeDialog(false);
  if(modal.id==='creatorDialogMask'&&typeof closeCreatorDialog==='function')return closeCreatorDialog('');
  if(modal.id==='assistedFillMask')return closeAssistedFill(false);
  if(modal.id==='responseEditMask')return closeResponseEditor(false);
});

/* v1.46: complete unsaved-change gates before main script merge. */
async function confirmDiscardFormChangesV145(){
  if(!formDirty)return true;
  return await confirmDialog('問卷內容尚未儲存，確定要離開或清空目前編輯內容？','尚未儲存');
}
var startNewFormRawV145=typeof startNewForm==='function'?startNewForm:null;
var editFormRawV145=typeof editForm==='function'?editForm:null;
var selectFormRawV145=typeof selectForm==='function'?selectForm:null;
if(startNewFormRawV145){
  openNewFormSafely=async function(button){
    var inEditor=document.querySelector('.panel.active')&&document.querySelector('.panel.active').id==='editorPanel';
    if(inEditor&&!await confirmDiscardFormChangesV145())return;
    formDirty=false;
    startNewFormRawV145();
    await showPanel('editorPanel',button);
  };
}
if(editFormRawV145){
  openEditFormSafely=async function(id){
    var inEditor=document.querySelector('.panel.active')&&document.querySelector('.panel.active').id==='editorPanel';
    if(inEditor&&formDirty&&!await confirmDiscardFormChangesV145())return;
    formDirty=false;
    activeQuestionIdV144='';
    editFormRawV145(id);
  };
  editForm=function(id){
    return openEditFormSafely(id);
  };
}
if(selectFormRawV145){
  selectForm=async function(id){
    var previous=activeFormId;
    if(!id||!canViewForm(id)){
      if(activeFormSelect)activeFormSelect.value=previous||'';
      return;
    }
    var inEditor=document.querySelector('.panel.active')&&document.querySelector('.panel.active').id==='editorPanel';
    if(inEditor&&formDirty&&!await confirmDiscardFormChangesV145()){
      if(activeFormSelect)activeFormSelect.value=previous||'';
      return;
    }
    formDirty=false;
    activeFormId=id;
    history.replaceState(null,'','#admin/'+encodeURIComponent(id));
    await loadResponses();
    renderAdmin();
    if(inEditor){
      if(canManageForm(id)&&editFormRawV145)editFormRawV145(id);
      else await showPanel('dashboardPanel');
    }
  };
}
var formRowHtmlV145Base=typeof formRowHtml==='function'?formRowHtml:null;
if(formRowHtmlV145Base){
  formRowHtml=function(f){
    return formRowHtmlV145Base(f).replace(/editForm\('/g,"openEditFormSafely('");
  };
}








/* v1.46: final cancel entry after removing legacy unsafe cancelEdit. */
async function cancelEdit(){
  if(!await confirmDiscardFormChangesV145())return;
  formDirty=false;
  if(startNewFormRawV145)startNewFormRawV145();
  await showPanel('formsPanel');
}

if(typeof window.startUniversalApp==='function')window.startUniversalApp();

