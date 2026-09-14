import {readFile,stat,realpath,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runCommand} from '../harness/tools.mjs';
// Output only: readers never extract archives to disk or modify the document.
const officePython=`import json, sys, zipfile, re, os, xml.etree.ElementTree as ET
filename=sys.argv[1]
with zipfile.ZipFile(filename) as archive:
    names=archive.namelist()
    if filename.lower().endswith('.docx'):
        selected=[n for n in names if n=='word/document.xml']
    else:
        selected=sorted([n for n in names if re.fullmatch(r'ppt/slides/slide[0-9]+.xml',n)], key=lambda n:int(re.search(r'slide([0-9]+)',n).group(1)))
    sections=[]
    total=0
    for name in selected:
        info=archive.getinfo(name)
        if info.file_size>10000000: raise ValueError('Document XML is too large')
        total+=info.file_size
        if total>30000000: raise ValueError('Document is too large')
        root=ET.fromstring(archive.read(name))
        paragraphs=[]
        for element in root.iter():
            if element.tag.split('}')[-1] in ('p','tr'):
                text=' '.join(item.text or '' for item in element.iter() if item.tag.split('}')[-1]=='t')
                if text.strip(): paragraphs.append(text)
        sections.append({'locator':name,'text':'\\n'.join(paragraphs)})
    images=[]
    output=sys.argv[2] if len(sys.argv)>2 else ''
    if output:
        os.makedirs(output,exist_ok=True)
        size=0
        for n in [n for n in names if '/media/' in n][:32]:
            ext=os.path.splitext(n)[1].lower()
            if ext not in ['.png','.jpg','.jpeg','.webp','.gif','.bmp']: continue
            info=archive.getinfo(n);size+=info.file_size
            if info.file_size>16000000 or size>64000000: raise ValueError('Embedded image limit exceeded')
            target=os.path.join(output,'media-'+str(len(images)+1)+ext)
            with open(target,'wb') as f: f.write(archive.read(n))
            images.append({'source':n,'path':target})
    print(json.dumps({'sections':sections,'images':images,'media':[n for n in names if '/media/' in n],'limitations':['Images, diagrams and formulas need separate visual review; text extraction does not prove their contents.']},ensure_ascii=False))
`;
const pdfPython=`import sys,json
filename=sys.argv[1]
try:
    import pymupdf
    with pymupdf.open(filename) as document:
        print(json.dumps({'sections':[{'locator':'page '+str(i+1),'text':page.get_text()} for i,page in enumerate(document)]},ensure_ascii=False))
except ImportError:
    from pypdf import PdfReader
    print(json.dumps({'sections':[{'locator':'page '+str(i+1),'text':page.extract_text() or ''} for i,page in enumerate(PdfReader(filename).pages)]},ensure_ascii=False))
`;
export async function readDocument(filename,{signal,imageDirectory=null,pages=[]}={}) {
  filename=await realpath(filename);const info=await stat(filename);if(!info.isFile()||info.size>64*1024*1024)throw Error('문서는 64MB 이하의 일반 파일이어야 합니다.');
  if(imageDirectory){imageDirectory=path.resolve(imageDirectory);await mkdir(imageDirectory,{recursive:true});}
  if(!Array.isArray(pages)||pages.length>16||pages.some(page=>!Number.isInteger(page)||page<1||page>10000))throw Error('PDF 페이지는 1~10000 범위에서 최대 16개 지정하세요.');
  const extension=path.extname(filename).toLowerCase();let data;
  if(['.docx','.pptx'].includes(extension)){
    const result=await runCommand({command:process.platform==='win32'?'python':'python3',args:['-I','-S','-c',officePython,filename,imageDirectory||''],signal,timeoutMs:30000});if(result.exitCode)throw Error('DOCX/PPTX 읽기 실패. Python 3 설치와 문서 형식을 확인하세요.');data=JSON.parse(result.stdout);
  }else if(extension==='.pdf'){
    try{const result=await runCommand({command:'pdftotext',args:['-layout',filename,'-'],signal,timeoutMs:30000});if(result.exitCode)throw Error('pdftotext failed');const extracted=result.stdout.split('\f');if(extracted.at(-1)==='')extracted.pop();data={sections:extracted.map((text,index)=>({locator:`page ${index+1}`,text}))};}
    catch(error){if(signal?.aborted)throw error;try{const result=await runCommand({command:process.platform==='win32'?'python':'python3',args:['-c',pdfPython,filename],signal,timeoutMs:30000});if(result.exitCode)throw Error('PDF reader failed');data=JSON.parse(result.stdout);}catch(error){if(signal?.aborted)throw error;throw Error('PDF 읽기에는 Poppler(pdftotext) 또는 Python 3 + PyMuPDF/pypdf가 필요합니다.');}}
    if(imageDirectory){
      const selected=pages.length?pages:Array.from({length:Math.min(8,data.sections.length)},(_,index)=>index+1);data.images=[];
      for(const page of selected){const prefix=path.join(imageDirectory,'page-'+page);try{const result=await runCommand({command:'pdftoppm',args:['-f',String(page),'-l',String(page),'-scale-to','1600','-singlefile','-png',filename,prefix],signal,timeoutMs:30000});if(result.exitCode)throw Error('render failed');data.images.push({source:'page '+page,path:prefix+'.png'});}catch(error){if(signal?.aborted)throw error;const code='import pymupdf,sys; d=pymupdf.open(sys.argv[1]); p=d[int(sys.argv[2])-1]; p.get_pixmap(matrix=pymupdf.Matrix(min(2,1600/p.rect.width,1600/p.rect.height),min(2,1600/p.rect.width,1600/p.rect.height))).save(sys.argv[3])';const result=await runCommand({command:process.platform==='win32'?'python':'python3',args:['-c',code,filename,String(page),prefix+'.png'],signal,timeoutMs:30000});if(result.exitCode)throw Error('PDF 이미지 추출에는 Poppler(pdftoppm) 또는 PyMuPDF가 필요합니다.');data.images.push({source:'page '+page,path:prefix+'.png'});}}
    }
    data.limitations=['스캔 PDF는 OCR이 필요합니다. 그림·표·수식의 정확한 내용은 별도 시각 검토가 필요합니다.'];
  }else{
    const buffer=await readFile(filename);if(buffer.subarray(0,8192).includes(0))throw Error('텍스트로 읽을 수 없는 형식입니다. 해당 형식의 전용 reader가 필요합니다.');
    data={sections:[{locator:'lines 1+',text:buffer.toString('utf8')}],limitations:extension==='.csv'?['원문 CSV입니다. 인용부호·구분자를 고려해 표를 분석하세요.']:[]};
  }
  return {file:filename,format:extension.slice(1)||'text',...data};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const result=await readDocument(process.argv[2],{imageDirectory:process.argv.includes('--images')?path.resolve('.px-runtime/doc-images'):null,pages:process.argv.includes('--pages')?String(process.argv[process.argv.indexOf('--pages')+1]).split(',').map(Number):[]});const output=JSON.stringify(result);if(output.length>1500000)throw Error('문서 추출 결과가 너무 큽니다. 문서를 나눠 분석하세요.');process.stdout.write(output+'\n');}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
}
