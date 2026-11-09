import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {createWorker} from 'tesseract.js';
import {parseTimetableText} from './timetable-parser';
pdfjs.GlobalWorkerOptions.workerSrc=pdfWorker;
function pageLines(content: {items: unknown[]}) {
 const rows:{y:number;items:{x:number;text:string}[]}[]=[];
 for(const raw of content.items){
  const item=raw as {str?:string;transform?:number[]};
  if(typeof item.str!=='string'||!item.str.trim()||!item.transform)continue;
  const y=item.transform[5],x=item.transform[4];
  let row=rows.find(candidate=>Math.abs(candidate.y-y)<3);
  if(!row){row={y,items:[]};rows.push(row)}
  row.items.push({x,text:item.str});
 }
 return rows.sort((a,b)=>b.y-a.y).map(row=>row.items.sort((a,b)=>a.x-b.x).map(item=>item.text).join(' ').trim()).filter(Boolean).join('\n');
}
export async function extractPdfText(file:File):Promise<{text:string;usedOcr:boolean}>{
 const doc=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise, pages:string[]=[];
 for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n);pages.push(pageLines(await page.getTextContent()))}
 let text=pages.join('\n');
 if(parseTimetableText(text).length)return{text,usedOcr:false};
 const worker=await createWorker('eng');
 try{
  const output:string[]=[];
  for(let n=1;n<=doc.numPages;n++){
   const page=await doc.getPage(n),viewport=page.getViewport({scale:1.7}),canvas=document.createElement('canvas');
   canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   const context=canvas.getContext('2d');
   if(!context)throw new Error('Your browser could not prepare this PDF page for OCR.');
   await page.render({canvasContext:context,canvas,viewport}).promise;
   output.push((await worker.recognize(canvas)).data.text);canvas.width=0;canvas.height=0;
  }
  text=output.join('\n');
 }finally{await worker.terminate()}
 return{text,usedOcr:true};
}
