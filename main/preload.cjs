// Puente entre el renderer y el proceso principal. CommonJS obligatorio por el sandbox.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Invoca un canal y desenvuelve { ok, value }; si falla, relanza el error del manejador.
async function invoke(channel, ...args) {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (result.ok) {
    return result.value;
  }
  throw new Error(result.error);
}

contextBridge.exposeInMainWorld('dsw', {
  pickFile: (kind) => invoke('dsw:pickFile', kind),
  loadXml: (xmlPath) => invoke('dsw:loadXml', xmlPath),
  videoUrl: (videoPath) => invoke('dsw:videoUrl', videoPath),
  findSiblingXml: (videoPath) => invoke('dsw:findSiblingXml', videoPath),
  loadSettings: () => invoke('dsw:loadSettings'),
  saveSettings: (partial) => invoke('dsw:saveSettings', partial),
  loadDraft: (videoPath) => invoke('dsw:loadDraft', videoPath),
  saveDraft: (videoPath, draft) => invoke('dsw:saveDraft', videoPath, draft),
  shotlistExists: (videoPath) => invoke('dsw:shotlistExists', videoPath),
  outputPathFor: (videoPath) => invoke('dsw:outputPathFor', videoPath),
  writeShotlist: (videoPath, text) => invoke('dsw:writeShotlist', videoPath, text),
  showInFolder: (target) => invoke('dsw:showInFolder', target),
  fileExists: (target) => invoke('dsw:fileExists', target),
  translate: (text, targetLang) => invoke('dsw:translate', text, targetLang),
  transcriberStatus: () => invoke('dsw:transcriberStatus'),
  transcribe: (videoPath, startSeconds, endSeconds, language) =>
    invoke('dsw:transcribe', videoPath, startSeconds, endSeconds, language),
  voiceActivity: (videoPath) => invoke('dsw:voiceActivity', videoPath),
  adjustWindowWidth: (delta) => invoke('dsw:adjustWindowWidth', delta),
  pathForFile: (file) => webUtils.getPathForFile(file),
  platform: process.platform,
});
