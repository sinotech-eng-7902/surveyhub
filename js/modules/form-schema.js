/* Shared schema helpers introduced in v1.86. */
(function(global){
  'use strict';
  function normalizeRoute(value){value=value&&typeof value==='object'?value:{};return {mode:['next','submit','conditional'].includes(value.mode)?value.mode:'next',sourceQuestionId:String(value.sourceQuestionId||''),values:Array.from(new Set([].concat(value.values||[]).map(String).filter(Boolean))),targetSectionId:String(value.targetSectionId||'')}}
  function isSection(block){return !!block&&block.type==='image'&&block.contentKind==='section'}
  function isAnswer(block){return !!block&&block.type!=='image'}
  function schemaVersion(form){return Math.max(1,Number(form&&form.schemaVersion||1))}
  global.SurveyFormSchemaV186={normalizeRoute:normalizeRoute,isSection:isSection,isAnswer:isAnswer,schemaVersion:schemaVersion};
})(window);
