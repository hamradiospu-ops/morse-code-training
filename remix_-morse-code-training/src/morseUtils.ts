/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Morse Code mappings
export const MORSE_ALPHABET: Record<string, string> = {
  'A': '.-',    'B': '-...',  'C': '-.-.',  'D': '-..',   'E': '.',
  'F': '..-.',  'G': '--.',   'H': '....',  'I': '..',    'J': '.---',
  'K': '-.-',   'L': '.-..',  'M': '--',    'N': '-.',    'O': '---',
  'P': '.--.',  'Q': '--.-',  'R': '.-.',   'S': '...',   'T': '-',
  'U': '..-',   'V': '...-',  'W': '.--',   'X': '-..-',  'Y': '-.--',
  'Z': '--..'
};

export const MORSE_NUMBERS: Record<string, string> = {
  '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
  '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----'
};

export const ALL_MORSE: Record<string, string> = {
  ...MORSE_ALPHABET,
  ...MORSE_NUMBERS
};

// Reverse mappings
export const REVERSE_MORSE: Record<string, string> = Object.entries(ALL_MORSE).reduce(
  (acc, [char, code]) => {
    acc[code] = char;
    return acc;
  },
  {} as Record<string, string>
);

// Amateur Radio abbreviations (คำย่อวิทยุสมัครเล่นยอดนิยม)
export const HAM_ABBREVIATIONS: Record<string, { definition: string; thaiDefinition: string }> = {
  'CQ': { definition: 'Calling any station (เรียกขานทั่วไป)', thaiDefinition: 'เรียกขานเพื่อติดต่อกับสถานีใด ๆ ก็ได้' },
  'DE': { definition: 'From (จาก / โดย)', thaiDefinition: 'จากสถานี... (ใช้คั่นระหว่างคู่สถานี)' },
  'K': { definition: 'Go ahead (เชิญส่งได้ / เปลี่ยน)', thaiDefinition: 'เชิญสถานีอื่นส่งข้อความตอบกลับมา' },
  'R': { definition: 'Received / Roger (รับทราบ)', thaiDefinition: 'รับข้อความถูกต้องสมบูรณ์แล้ว' },
  '73': { definition: 'Best regards (ด้วยความปรารถนาดี)', thaiDefinition: 'คำอวยพรแสดงความนับถือและปรารถนาดี' },
  '88': { definition: 'Love and kisses (รักและจุมพิต)', thaiDefinition: 'คำอำลาส่งความรัก (มักใช้กับนักวิทยุสตรี)' },
  'HI': { definition: 'Laughter in CW (เสียงหัวเราะ)', thaiDefinition: 'แสดงเสียงหัวเราะขบขันในโหมดรหัสมอร์ส' },
  'UR': { definition: 'Your (ของคุณ)', thaiDefinition: 'แสดงความเป็นเจ้าของ สัญญาณของคุณ สภาพของคุณ' },
  'RST': { definition: 'Readability, Strength, Tone (รายงานสัญญาณ)', thaiDefinition: 'การรายงานคุณภาพสัญญาณ (ความชัดเจน, ความแรง, เสียงโทน)' },
  'QTH': { definition: 'My location is... (ที่ตั้งสถานี)', thaiDefinition: 'พิกัดหรือที่ตั้งของสถานีวิทยุ' },
  'QSL': { definition: 'Acknowledge receipt (ยืนยันการรับ)', thaiDefinition: 'ขอยืนยันการรับฟัง / บัตรยืนยันการติดต่อ' },
  'QRZ': { definition: 'Who is calling me? (ใครเรียกฉัน?)', thaiDefinition: 'ใครกำลังเรียกสถานีของฉันอยู่?' }
};

// Convert plain text to Morse code representation
// Space between letters: 1 space
// Space between words: 3 spaces (corresponds to longer silence in play)
export function textToMorse(text: string): string {
  return text
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .map(word => 
      word
        .split('')
        .map(char => ALL_MORSE[char] || '')
        .filter(code => code !== '')
        .join(' ')
    )
    .join('   ');
}

// Convert Morse code representation back to plain text
export function morseToText(morse: string): string {
  return morse
    .trim()
    .split('   ') // Split by word spacer
    .map(word => 
      word
        .split(' ') // Split by letter spacer
        .map(code => REVERSE_MORSE[code] || '?')
        .join('')
    )
    .join(' ');
}

// Interface for Level
export interface CampaignLevel {
  id: number;
  title: string;
  description: string;
  targets: string[]; // Characters introduced in this level
  questions: string[]; // List of questions/words to practice
  minScoreToPass: number;
}

// Campaign levels definitions (10 Levels)
export const CAMPAIGN_LEVELS: CampaignLevel[] = [
  {
    id: 1,
    title: 'เลเวล 1: รากฐานแรก (E, T)',
    description: 'ฝึกฝนตัวอักษรที่สั้นที่สุดและยาวที่สุดเพียงอย่างเดียว ดอท (.) และ แดช (-)',
    targets: ['E', 'T'],
    questions: ['E', 'T', 'EE', 'TT', 'ET', 'TE', 'ETE', 'TET', 'EET', 'TTE'],
    minScoreToPass: 80
  },
  {
    id: 2,
    title: 'เลเวล 2: ทางเชื่อมโยง (A, I, M, N)',
    description: 'เรียนรู้สัญลักษณ์ความยาวสองตัว ผสมผสานดอทและแดชอย่างลงตัว',
    targets: ['A', 'I', 'M', 'N'],
    questions: ['A', 'I', 'M', 'N', 'AM', 'IN', 'AN', 'MA', 'IT', 'ME', 'TIE', 'NET'],
    minScoreToPass: 80
  },
  {
    id: 3,
    title: 'เลเวล 3: ขยายความสามารถ (D, G, K, O, R, S, U, W)',
    description: 'ฝึกสัญญาณรหัสมอร์สความยาวสามตัว ความซับซ้อนเริ่มเพิ่มขึ้น!',
    targets: ['D', 'G', 'K', 'O', 'R', 'S', 'U', 'W'],
    questions: ['S', 'O', 'R', 'K', 'SOS', 'DOG', 'SUN', 'RED', 'WAR', 'OUT', 'WIN', 'KID'],
    minScoreToPass: 80
  },
  {
    id: 4,
    title: 'เลเวล 4: ตัวอักษรขั้นสูง (B, C, F, H, J, L, P, Q, V, X, Y, Z)',
    description: 'รวบรวมตัวอักษรความยาวสี่ตัวที่เหลือทั้งหมดเพื่อพิชิตตัวอักษรภาษาอังกฤษ',
    targets: ['B', 'C', 'F', 'H', 'J', 'L', 'P', 'Q', 'V', 'X', 'Y', 'Z'],
    questions: ['FOX', 'JAZZ', 'CAMP', 'HELP', 'QUIET', 'ZERO', 'WAVE', 'BLUE', 'VOTE', 'LION'],
    minScoreToPass: 80
  },
  {
    id: 5,
    title: 'เลเวล 5: ปรมาจารย์ตัวอักษร (A-Z)',
    description: 'ทบทวนและท้าทายตนเองด้วยตัวอักษร A ถึง Z ผสมกันทั้งหมดในระดับคำศัพท์ทั่วไป',
    targets: ['A-Z'],
    questions: ['HELLO', 'MORSE', 'RADIO', 'HAM', 'SIGNAL', 'WORLD', 'CLUB', 'SPU', 'THAILAND', 'CW'],
    minScoreToPass: 80
  },
  {
    id: 6,
    title: 'เลเวล 6: รหัสมือใหม่ตัวเลข (1, 2, 3, 4, 5)',
    description: 'ฝึกฝนตัวเลขครึ่งแรก เริ่มต้นจาก 1 ถึง 5 ซึ่งใช้การรวมดอทและแดชอย่างเป็นระบบ',
    targets: ['1', '2', '3', '4', '5'],
    questions: ['1', '5', '12', '45', '321', '543', '152', '243', '5124', '3512'],
    minScoreToPass: 80
  },
  {
    id: 7,
    title: 'เลเวล 7: สัญญาณตัวเลขสมบูรณ์ (0-9)',
    description: 'เรียนรู้ตัวเลข 6 ถึง 9 และทบทวนตัวเลขทั้งหมด 0-9 เพื่อการรับส่งตัวเลขที่แม่นยำ',
    targets: ['6', '7', '8', '9', '0'],
    questions: ['0', '7', '98', '60', '789', '901', '1920', '8860', '2026', '7388'],
    minScoreToPass: 80
  },
  {
    id: 8,
    title: 'เลเวล 8: การเรียกขานวิทยุสมัครเล่น (CQ, DE, K, 73)',
    description: 'ก้าวเข้าสู่โลกของนักวิทยุสมัครเล่น เรียนรู้คำย่อพื้นฐานที่ใช้บ่อยที่สุดทางความถี่',
    targets: ['CQ', 'DE', 'K', '73'],
    questions: ['CQ', 'DE', '73', 'CQ CQ', 'CQ DE', '73 GD', 'DE SPU', 'CQ K', 'SPU DE', '73 OM'],
    minScoreToPass: 80
  },
  {
    id: 9,
    title: 'เลเวล 9: รหัส Q และคำสื่อสาร (QTH, QSL, QRZ, RST)',
    description: 'เรียนรู้รหัสคิว (Q-Codes) ยอดนิยมสำหรับการรายงานสัญญาณ พิกัดสถานี และการตอบรับ',
    targets: ['QTH', 'QSL', 'QRZ', 'RST'],
    questions: ['QTH', 'QSL', 'QRZ', 'RST', 'RST 599', 'QSL UR', 'QRZ K', 'QTH SPU', 'RST 579', 'QSL DE'],
    minScoreToPass: 80
  },
  {
    id: 10,
    title: 'เลเวล 10: ยอดฝีมือนักวิทยุ SPU (สัมผัสสัญญาณจริง)',
    description: 'การจำลองประโยคสื่อสารวิทยุสมัครเล่นจริงแบบผสมตัวอักษร ตัวเลข และรหัสสัญญาณเต็มรูปแบบ',
    targets: ['ผสมทั้งหมด'],
    questions: [
      'CQ CQ CQ DE E25DUV K',
      'UR RST 599 73',
      'QSL MY FRIEND 73',
      'QTH BANGKOK THAILAND',
      'E25DUV DE SPU CLUB K',
      'CQ DE SPU ARC K',
      '73 TO ALL AMATEUR RADIO'
    ],
    minScoreToPass: 80
  }
];

// Achievements list for display
export interface Achievement {
  id: string;
  title: string;
  thaiTitle: string;
  description: string;
  thaiDescription: string;
  icon: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_dot',
    title: 'First Step',
    thaiTitle: 'ก้าวแรกสู่วงการ',
    description: 'Complete your first practice round',
    thaiDescription: 'ฝึกฝนฟังเสียงมอร์สเสร็จสิ้นด่านแรก',
    icon: '🏆'
  },
  {
    id: 'campaign_star',
    title: 'Level Master',
    thaiTitle: 'ผู้พิชิตด่าน',
    description: 'Unlock at least 3 levels in Campaign Mode',
    thaiDescription: 'ปลดล็อกแคมเปญระดับ 3 ขึ้นไป',
    icon: '⭐'
  },
  {
    id: 'speed_demon',
    title: 'Speed Demon',
    thaiTitle: 'ความเร็วแสง',
    description: 'Complete a round at 20 WPM or faster',
    thaiDescription: 'ฟังหรือส่งรหัสมอร์สที่ความเร็วตั้งแต่ 20 WPM ขึ้นไป',
    icon: '⚡'
  },
  {
    id: 'perfect_score',
    title: 'Perfect Ear',
    thaiTitle: 'หูทองคำ',
    description: 'Get a 100% score on any campaign level',
    thaiDescription: 'ได้คะแนนเต็ม 100% ในเลเวลแคมเปญใดก็ได้',
    icon: '🌟'
  },
  {
    id: 'free_tapper',
    title: 'Morse Keyer Master',
    thaiTitle: 'นักเคาะกุญแจมืออาชีพ',
    description: 'Successfully decoded at least 10 letters in Free Tapping mode',
    thaiDescription: 'ถอดรหัสรหัสเคาะอิสระรวมสะสมมากกว่า 10 ตัวอักษร',
    icon: '🎹'
  },
  {
    id: 'spu_ham',
    title: 'SPU Ham Operator',
    thaiTitle: 'สุดยอดแฮม SPU',
    description: 'Complete Level 10 of the campaign',
    thaiDescription: 'เล่นผ่านเลเวล 10 ของการฝึกระดับนักวิทยุสมัครเล่น SPU',
    icon: '🎓'
  }
];

// Audio Engine for Morse Code Playback
export class MorseAudioEngine {
  private audioCtx: AudioContext | null = null;
  private currentOscillator: OscillatorNode | null = null;
  private currentGainNode: GainNode | null = null;
  private isPlaying: boolean = false;
  private stopRequested: boolean = false;
  private activeIntervals: number[] = [];

  private initCtx() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public stop() {
    this.stopRequested = true;
    this.isPlaying = false;
    
    // Clear timeouts
    this.activeIntervals.forEach(id => clearTimeout(id));
    this.activeIntervals = [];

    if (this.currentOscillator) {
      try {
        this.currentOscillator.stop();
        this.currentOscillator.disconnect();
      } catch (e) {}
      this.currentOscillator = null;
    }
    if (this.currentGainNode) {
      try {
        this.currentGainNode.disconnect();
      } catch (e) {}
      this.currentGainNode = null;
    }
  }

  private beep(durationMs: number, frequency: number): Promise<void> {
    if (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('morse_audio_muted') === 'true') {
      return this.sleep(durationMs);
    }
    return new Promise((resolve) => {
      if (this.stopRequested) {
        resolve();
        return;
      }
      try {
        this.initCtx();
        const ctx = this.audioCtx!;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        
        // Anti-click envelope
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.005);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + (durationMs / 1000) - 0.005);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationMs / 1000);
        
        this.currentOscillator = osc;
        this.currentGainNode = gain;
        
        osc.start();
        osc.stop(ctx.currentTime + durationMs / 1000);
        
        const timeoutId = window.setTimeout(() => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch(e){}
          if (this.currentOscillator === osc) {
            this.currentOscillator = null;
          }
          resolve();
        }, durationMs);
        
        this.activeIntervals.push(timeoutId);
      } catch (error) {
        console.error("Audio beep failed", error);
        resolve();
      }
    });
  }

  private sleep(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.stopRequested) {
        resolve();
        return;
      }
      const timeoutId = window.setTimeout(resolve, durationMs);
      this.activeIntervals.push(timeoutId);
    });
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Plays a plain text string or Morse string directly.
   * @param input Plain text or Morse string (composed of '.', '-', ' ', '/')
   * @param wpm Words per minute
   * @param frequency Audio frequency in Hz
   * @param isAlreadyMorse True if input is already raw Morse code
   * @param onStateChange Callback reporting active state
   * @param onFinished Callback when complete
   */
  public async play(
    input: string,
    wpm: number,
    frequency: number,
    isAlreadyMorse: boolean = false,
    onStateChange?: (state: {
      activeWordIndex: number;
      activeLetterIndex: number;
      activeSymbolIndex: number;
      charPlaying: string;
      symbolPlaying: 'dot' | 'dash' | 'space' | 'none';
    }) => void,
    onFinished?: () => void
  ) {
    this.stop();
    this.stopRequested = false;
    this.isPlaying = true;

    const unitDuration = 1200 / wpm; // length of 1 dot in ms
    
    let text = "";
    let morse = "";

    if (isAlreadyMorse) {
      morse = input;
      text = morseToText(input);
    } else {
      text = input.toUpperCase();
      morse = textToMorse(text);
    }

    // Replace slashes or multiple spaces to align with standardized separation
    // standard word space is '   ' (3 spaces in our morse string representation)
    const normalizedMorse = morse.replace(/\s{2,}/g, '   ');
    const wordsMorse = normalizedMorse.split('   ');
    const wordsText = text.split(/\s+/);

    for (let w = 0; w < wordsMorse.length; w++) {
      if (this.stopRequested) break;
      const wordMorse = wordsMorse[w];
      const lettersMorse = wordMorse.split(' ');
      const wordText = wordsText[w] || "";

      for (let l = 0; l < lettersMorse.length; l++) {
        if (this.stopRequested) break;
        const letterMorse = lettersMorse[l];
        const charPlaying = wordText[l] || "";

        for (let s = 0; s < letterMorse.length; s++) {
          if (this.stopRequested) break;
          const symbol = letterMorse[s];
          const symbolType = symbol === '.' ? 'dot' : 'dash';

          if (onStateChange) {
            onStateChange({
              activeWordIndex: w,
              activeLetterIndex: l,
              activeSymbolIndex: s,
              charPlaying,
              symbolPlaying: symbolType
            });
          }

          if (symbol === '.') {
            await this.beep(unitDuration, frequency);
          } else if (symbol === '-') {
            await this.beep(unitDuration * 3, frequency);
          }

          // Gap between parts of same letter
          if (s < letterMorse.length - 1) {
            if (onStateChange) {
              onStateChange({
                activeWordIndex: w,
                activeLetterIndex: l,
                activeSymbolIndex: s,
                charPlaying,
                symbolPlaying: 'space'
              });
            }
            await this.sleep(unitDuration);
          }
        }

        // Gap between letters (total 3 units. We already had 1 unit gap if symbol ended, wait 2 more units)
        if (l < lettersMorse.length - 1 && !this.stopRequested) {
          if (onStateChange) {
            onStateChange({
              activeWordIndex: w,
              activeLetterIndex: l,
              activeSymbolIndex: -1,
              charPlaying: "",
              symbolPlaying: 'space'
            });
          }
          await this.sleep(unitDuration * 2);
        }
      }

      // Gap between words (total 7 units. Wait 4 more units since letter transition is 3 units)
      if (w < wordsMorse.length - 1 && !this.stopRequested) {
        if (onStateChange) {
          onStateChange({
            activeWordIndex: w,
            activeLetterIndex: -1,
            activeSymbolIndex: -1,
            charPlaying: " ",
            symbolPlaying: 'space'
          });
        }
        await this.sleep(unitDuration * 4);
      }
    }

    this.isPlaying = false;
    if (onStateChange) {
      onStateChange({
        activeWordIndex: -1,
        activeLetterIndex: -1,
        activeSymbolIndex: -1,
        charPlaying: "",
        symbolPlaying: 'none'
      });
    }
    if (onFinished) onFinished();
  }
}

// Straight Key / Manual Tap Beep sound generator
export class MorseManualKeyer {
  private audioCtx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;

  public startBeep(frequency: number) {
    if (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('morse_audio_muted') === 'true') {
      return;
    }
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      
      this.stopBeep();

      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      // Smooth attack
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.005);

      osc.start();
      this.osc = osc;
      this.gain = gain;
    } catch (e) {
      console.error("Manual key start failed", e);
    }
  }

  public stopBeep() {
    if (this.osc && this.gain && this.audioCtx) {
      const ctx = this.audioCtx;
      const osc = this.osc;
      const gain = this.gain;
      
      try {
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.008);
        setTimeout(() => {
          try {
            osc.stop();
            osc.disconnect();
            gain.disconnect();
          } catch(e){}
        }, 15);
      } catch (e) {
        try {
          osc.stop();
          osc.disconnect();
          gain.disconnect();
        } catch (err) {}
      }
    }
    this.osc = null;
    this.gain = null;
  }
}
