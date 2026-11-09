export type TimetableDraft={id:string;day:string;subject:string;start:string;end:string;room?:string};
export type OcrWord={text:string;bbox:{x0:number;y0:number;x1:number;y1:number}};
const dayNames=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const dayPattern=/\\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\\b/i;
const timePattern=/\\b(\\d{1,2})(?::|\\.)(\\d{2})\\s*(a\\.?m\\.?|p\\.?m\\.?)?\\b/gi;
function normalizeDay(v:string){const k=v.toLowerCase();return dayNames.find(d=>d.toLowerCase()===k)||dayNames.find(d=>d.slice(0,3).toLowerCase()===k.slice(0,3))}
function minutes(h:number,m:number,mer?:string){if(m>59||h>24||h===24&&m!==0)return null;if(mer){h=h%12+(mer.toLowerCase().startsWith('p')?12:0);if(h>23)return null}return h*60+m}
function clock(n:number){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function unique(rows:TimetableDraft[]){const seen=new Set<string>();return rows.filter(r=>{const k=[r.day,r.start,r.end,r.subject.toLowerCase()].join('|');if(seen.has(k))return false;seen.add(k);return true})}
export function parseTimetableText(text:string):TimetableDraft[]{const rows:TimetableDraft[]=[];for(const raw of text.split(/[\\r\\n]+/)){const line=raw.replace(/[|•·]/g,' ').replace(/\\s+/g,' ').trim();if(!line)continue;const dm=line.match(dayPattern);if(!dm)continue;const day=normalizeDay(dm[0]);if(!day)continue;const ts=[...line.matchAll(timePattern)];if(ts.length<2)continue;const first=ts[0],second=ts[1];let start=minutes(Number(first[1]),Number(first[2]),first[3]),end=minutes(Number(second[1]),Number(second[2]),second[3]);if(start===null||end===null)continue;if(end<=start&&!(first[3]||second[3]))continue;if(end<=start&&first[3]&&!second[3])end+=first[3].toLowerCase().startsWith('p')?720:0;if(end<=start&&second[3]&&!first[3])start+=second[3].toLowerCase().startsWith('p')?0:720;if(end<=start||end-start>720)continue;const subject=line.replace(dm[0],' ').replace(timePattern,' ').replace(/\\b(to|until|till|am|pm|room|venue|classroom|lab)\\b/gi,' ').replace(/\\b[0-9]{2,}\\b/g,' ').replace(/[,:;()\\[\\]–—-]/g,' ').replace(/\\s+/g,' ').trim();if(!subject||/^(timetable|schedule)$/i.test(subject))continue;rows.push({id:Math.random().toString(36).slice(2,10),day,subject,start:clock(start),end:clock(end),room:''})}return unique(rows)}
function center(word:OcrWord){return{x:(word.bbox.x0+word.bbox.x1)/2,y:(word.bbox.y0+word.bbox.y1)/2}}
function dayFromWord(word:string){const key=word.toLowerCase().replace(/[^a-z]/g,'');const match=dayNames.find(day=>day.toLowerCase()===key||day.slice(0,3).toLowerCase()===key);return match}
function parseOcrTime(word:string){const m=word.replace(/[oO]/g,'0').match(/^(\\d{1,2})[.:](\\d{2})$/);if(!m)return null;const h=Number(m[1]),min=Number(m[2]);return h<=12&&min<60?{h,min}:null}
export function parseTimetableGridWords(words:OcrWord[]):TimetableDraft[]{
 const valid=words.filter(w=>w.text?.trim()&&w.bbox&&Number.isFinite(w.bbox.x0)&&Number.isFinite(w.bbox.y0));
 const lines:{y:number;words:OcrWord[]}[]=[];
 for(const word of valid){const p=center(word);let line=lines.find(item=>Math.abs(item.y-p.y)<8);if(!line){line={y:p.y,words:[]};lines.push(line)}line.words.push(word)}
 for(const line of lines)line.words.sort((a,b)=>center(a).x-center(b).x);
 const header=lines.find(line=>line.words.map(w=>w.text).join(' ').toLowerCase().includes('day/time')&&line.words.filter(w=>parseOcrTime(w.text)).length>=4)
  ||lines.find(line=>line.words.filter(w=>parseOcrTime(w.text)).length>=8);
 if(!header)return [];
 const timeWords=header.words.filter(w=>parseOcrTime(w.text)).sort((a,b)=>center(a).x-center(b).x);
 const times:{value:number;x:number}[]=[];
 for(const w of timeWords){const t=parseOcrTime(w.text);if(!t)continue;let value=t.h*60+t.min;if(times.length){while(value<=times[times.length-1].value)value+=720;}times.push({value,x:center(w).x})}
 const periods:{start:number;end:number;x:number}[]=[];
 for(let i=0;i<times.length-1;i++){const start=times[i].value,end=times[i+1].value,duration=end-start;if(duration<=30||duration>180)continue;periods.push({start,end,x:(times[i].x+times[i+1].x)/2})}
 if(periods.length<3)return [];
 const dayWords=valid.map(word=>({word,day:dayFromWord(word.text),...center(word)})).filter(x=>x.day&&x.y>header.y);
 const dayLabels=dayWords.sort((a,b)=>a.y-b.y).filter((item,index,array)=>array.findIndex(x=>x.day===item.day)===index);
 if(!dayLabels.length)return [];
 const rows:TimetableDraft[]=[];
 const ignored=new Set(['MON','TUE','TUES','WED','THU','THUR','THURS','FRI','SAT','SUN','ROOM','BREAK','LUNCH','TEA','NO']);
 for(let index=0;index<dayLabels.length;index++){
  const label=dayLabels[index],previous=dayLabels[index-1],next=dayLabels[index+1];
  const top=previous?(previous.y+label.y)/2:header.y+8;
  const bottom=next?(label.y+next.y)/2:label.y+(previous?(label.y-previous.y)/2:42);
  const candidates=valid.filter(word=>{const p=center(word);const text=word.text.replace(/[^a-z]/gi,'');return p.y>top&&p.y<bottom&&/^[A-Z]{2,6}$/.test(text)&&!ignored.has(text.toUpperCase())});
  for(const word of candidates){const p=center(word);const period=periods.reduce((best,current)=>Math.abs(current.x-p.x)<Math.abs(best.x-p.x)?current:best);const subject=word.text.replace(/[^a-z]/gi,'').toUpperCase();rows.push({id:Math.random().toString(36).slice(2,10),day:label.day!,subject,start:clock(period.start),end:clock(period.end),room:''})}
 }
 return unique(rows)
}
