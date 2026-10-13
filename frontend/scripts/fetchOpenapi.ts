import { spawnSync } from 'node:child_process';
import path from 'node:path';

const BACKEND_DIR = path.resolve(import.meta.dirname, '../../backend');
const OUTPUT_PATH = path.resolve(import.meta.dirname, '../openapi.json');

const PYTHON_PATH =
  process.platform === 'win32'
    ? path.join(BACKEND_DIR, '.venv', 'Scripts', 'python.exe')
    : path.join(BACKEND_DIR, '.venv', 'bin', 'python');

const EXPORT_CODE = [
  'import json, sys',
  'from app.main import app',
  'spec = app.openapi()',
  "with open(sys.argv[1], 'w', encoding='utf-8', newline='\\n') as file:",
  '    json.dump(spec, file, ensure_ascii=False, indent=2)',
  "    file.write('\\n')",
].join('\n');

const result = spawnSync(PYTHON_PATH, ['-c', EXPORT_CODE, OUTPUT_PATH], {
  cwd: BACKEND_DIR,
  encoding: 'utf-8',
});

if (result.error !== undefined) {
  console.error(
    `백엔드 가상 환경의 파이썬을 실행하지 못했습니다: ${PYTHON_PATH}`,
  );
  console.error('backend/README.md를 따라 가상 환경을 만들었는지 확인하세요.');
  process.exit(1);
}

if (result.status !== 0) {
  console.error(result.stderr);
  console.error(
    'OpenAPI 스펙을 뽑지 못했습니다. 위 오류를 확인하세요. 모듈을 찾지 못했다면 backend/requirements.txt의 의존성을 가상 환경에 설치하세요.',
  );
  process.exit(1);
}

console.log(`OpenAPI 스펙을 저장했습니다: ${OUTPUT_PATH}`);
