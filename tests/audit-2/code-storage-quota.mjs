// Code audit (C): how many characters one origin's localStorage takes in real Chrome, against the TownGrid save size.
// Usage: node tests/audit-2/code-storage-quota.mjs <playwright/index.mjs> <chrome.exe>. Uses a throwaway origin, never the game's.
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.argv[3]?{executablePath:process.argv[3]}:{})});
const page=await browser.newPage();await page.route('http://quota.test/**',r=>r.fulfill({contentType:'text/html',body:'<p>quota</p>'}));await page.goto('http://quota.test/');
const r=await page.evaluate(()=>{localStorage.clear();const chunk='x'.repeat(100000);let n=0,err='';try{for(;n<400;n++)localStorage.setItem('k'+n,chunk);}catch(e){err=e.name;}
 // Fine-tune with smaller chunks.
 const small='y'.repeat(1000);let m=0;try{for(;m<100000;m++)localStorage.setItem('s'+m,small);}catch(e){}
 let total=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);total+=k.length+localStorage.getItem(k).length;}localStorage.clear();return {chars:total,error:err,ua:navigator.userAgent};});
console.log(JSON.stringify(r));await browser.close();
