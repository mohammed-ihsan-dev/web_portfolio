import { DESKTOP_QUERY, experienceConfig } from '@/config/site.config';

/**
 * Runs synchronously in <head> before first paint. Picks the experience mode
 * so CSS can lay the page out correctly from the first frame (no CLS when the
 * cinematic layout kicks in). WebGL support is verified later, off the
 * critical path; a failure there downgrades to the static desktop layout.
 */
export const prePaintScript = `(function(){try{
var d=document.documentElement,q=new URLSearchParams(location.search),n=navigator;
var desk=matchMedia(${JSON.stringify(DESKTOP_QUERY)}).matches;
var rm=matchMedia('(prefers-reduced-motion: reduce)').matches||q.get('motion')==='0';
var low=(n.hardwareConcurrency||8)<${experienceConfig.minCores}||(n.deviceMemory||8)<${experienceConfig.minMemoryGB}||(${experienceConfig.respectSaveData}&&n.connection&&n.connection.saveData);
var m=!desk?'mobile':(rm||low||q.get('webgl')==='0')?'desktop-static':'desktop-3d';
d.setAttribute('data-experience',m);d.setAttribute('data-js','1');
if(m==='desktop-3d'){d.classList.add('is-preloading');if('scrollRestoration' in history)history.scrollRestoration='manual';}
}catch(e){}})();`;
