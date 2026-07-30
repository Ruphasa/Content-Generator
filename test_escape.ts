import path from 'path';

const FILTER_SPECIAL_CHARS = /[\\':,[\];= ]/g;

function escapeFilterPath(filePath: string): string {
  const forwardSlashed = path.resolve(filePath).replace(/\\/g, '/');
  const escapedOnce = forwardSlashed.replace(FILTER_SPECIAL_CHARS, (c) => '\\' + c);
  return escapedOnce.replace(FILTER_SPECIAL_CHARS, (c) => '\\' + c);
}

console.log(escapeFilterPath('L:\\Content-Generator\\public\\generations\\subtitles.ass'));
