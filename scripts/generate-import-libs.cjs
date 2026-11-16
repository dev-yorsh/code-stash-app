const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outDir = path.join(process.env.USERPROFILE, '.cargo', 'lib');
fs.mkdirSync(outDir, { recursive: true });

const readObj = 'C:\\Program Files\\LLVM\\bin\\llvm-readobj.exe';
const dlltool = 'C:\\Program Files\\LLVM\\bin\\llvm-dlltool.exe';

function createImportLib(dllPath, defName, libName) {
  console.log(`Generating ${libName} from ${dllPath}...`);
  const raw = execSync(`"${readObj}" --coff-exports "${dllPath}"`, { maxBuffer: 32 * 1024 * 1024 }).toString();

  const lines = raw.split('\n');
  const names = [];
  for (const line of lines) {
    const m = line.match(/^\s*Name:\s*(\S+)/);
    if (m) {
      names.push(m[1]);
    }
  }

  const defContent = `LIBRARY ${path.basename(dllPath)}\nEXPORTS\n` + names.map(n => `  ${n}`).join('\n');
  const defPath = path.join(outDir, defName);
  const libPath = path.join(outDir, libName);

  fs.writeFileSync(defPath, defContent);
  execSync(`"${dlltool}" -m i386:x86-64 -d "${defPath}" -l "${libPath}"`);
  console.log(`Successfully generated ${libPath} (${names.length} symbols)`);
}

createImportLib('C:\\Windows\\System32\\msvcrt.dll', 'msvcrt.def', 'msvcrt.lib');
createImportLib('C:\\Windows\\System32\\vcruntime140.dll', 'vcruntime.def', 'vcruntime.lib');
createImportLib('C:\\Windows\\System32\\vcruntime140.dll', 'vcruntime140.def', 'vcruntime140.lib');
createImportLib('C:\\Windows\\System32\\msvcp140.dll', 'msvcp.def', 'msvcp.lib');
createImportLib('C:\\Windows\\System32\\msvcp140.dll', 'msvcp140.def', 'msvcp140.lib');
