import fs from 'fs';
import path from 'path';

export interface WordTimestamp {
  word: string;
  start: number; // in seconds
  end: number;
}

export function generateAssFile(words: WordTimestamp[], outputPath: string): void {
  const dir = path.dirname(path.resolve(outputPath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Alignment, MarginL, MarginR, MarginV
Style: Premium,Inter,80,&H00FFFFFF,&H00000000,&H80000000,-1,0,2,10,10,150

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const formatTime = (s: number) => {
    const d = new Date(s * 1000);
    return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}.${String(Math.floor(d.getUTCMilliseconds() / 10)).padStart(2, '0')}`;
  };

  words.forEach((w) => {
    const start = formatTime(w.start);
    const end = formatTime(w.end);
    // Advanced Karaoke Bounce Animation
    const anim = `{\\t(0,100,\\fscx120\\fscy120)\\t(100,200,\\fscx100\\fscy100)}`;
    assContent += `Dialogue: 0,${start},${end},Premium,,0,0,0,,${anim}${w.word}\n`;
  });

  fs.writeFileSync(outputPath, assContent, 'utf-8');
}
