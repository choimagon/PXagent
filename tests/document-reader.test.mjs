import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readDocument} from '../tools/document-reader.mjs';
import {runCommand} from '../harness/tools.mjs';
test('document reader returns original UTF-8 text and rejects binary data without changing input',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'px-doc-reader-'));try{
    const file=path.join(root,'notes.md'),text='# 연구\n근거와 한계\n';await writeFile(file,text);const result=await readDocument(file);assert.equal(result.sections[0].text,text);assert.equal(await readFile(file,'utf8'),text);
    await writeFile(path.join(root,'data.csv'),'name,value\n"a,b",2\n');assert.equal((await readDocument(path.join(root,'data.csv'))).format,'csv');
    await writeFile(path.join(root,'binary'),Buffer.from([0,1,2]));await assert.rejects(readDocument(path.join(root,'binary')),/전용 reader/);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('DOCX and PPTX readers extract paragraph and slide evidence without unpacking media',async t=>{
  const python=process.platform==='win32'?'python':'python3';try{if((await runCommand({command:python,args:['--version']})).exitCode)throw Error();}catch{t.skip('Python not installed');return;}
  const root=await mkdtemp(path.join(tmpdir(),'px-doc-office-'));try{
    const code=`import zipfile,sys,os
for ext in ['docx','pptx']:
 with zipfile.ZipFile(os.path.join(sys.argv[1],'sample.'+ext),'w') as z:
  name='word/document.xml' if ext=='docx' else 'ppt/slides/slide2.xml'
  z.writestr(name,'<root><p><r><t>문서 근거</t></r></p><p><r><t>두 번째 문단</t></r></p></root>')
  if ext=='pptx': z.writestr('ppt/slides/slide1.xml','<root><p><r><t>첫 슬라이드</t></r></p></root>')
  z.writestr(('word' if ext=='docx' else 'ppt')+'/media/image.png','image-placeholder')
`;
    assert.equal((await runCommand({command:python,args:['-c',code,root]})).exitCode,0);
    const docx=await readDocument(path.join(root,'sample.docx'));assert.ok(docx.sections[0].text.includes('문서 근거'));assert.ok(docx.sections[0].text.includes('\n'));assert.equal(docx.media.length,1);const images=await readDocument(path.join(root,'sample.docx'),{imageDirectory:path.join(root,'cache')});assert.equal(images.images.length,1);assert.equal(await readFile(images.images[0].path,'utf8'),'image-placeholder');
    const ppt=await readDocument(path.join(root,'sample.pptx'));assert.ok(ppt.sections[0].locator.endsWith('slide1.xml'));assert.ok(ppt.sections[1].text.includes('문서 근거'));assert.equal(ppt.media.length,1);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('PDF reader preserves blank-page numbering and renders selected pages into the analysis cache',async t=>{
 try{if((await runCommand({command:'pdftotext',args:['-v']})).exitCode)throw Error();}catch{t.skip('Poppler is not installed');return;}
 const root=await mkdtemp(path.join(tmpdir(),'px-doc-pdf-'));try{
  const stream='BT /F1 12 Tf 20 100 Td (Actual PDF evidence) Tj ET\n';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 7 0 R >> >> /Contents 5 0 R >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>','<< /Length 0 >>\nstream\nendstream',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;});const start=Buffer.byteLength(pdf);pdf+=`xref\n0 8\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  const file=path.join(root,'source.pdf');await writeFile(file,pdf);const result=await readDocument(file,{imageDirectory:path.join(root,'cache'),pages:[2]});assert.equal(result.sections.length,2);assert.equal(result.sections[1].locator,'page 2');assert.ok(result.sections[1].text.includes('Actual PDF evidence'));assert.equal(result.images.length,1);assert.equal(result.images[0].source,'page 2');assert.equal((await readFile(result.images[0].path)).subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(await readFile(file,'utf8'),pdf);
 }finally{await rm(root,{recursive:true,force:true});}
});
