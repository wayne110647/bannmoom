import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { Icon } from './icon';

interface HelpPage {
  title: string;
  /** Numbered steps — one action each, in the words on the buttons. */
  steps: string[];
  tips?: string[];
}

/**
 * "วิธีใช้" for each screen. Written for someone who isn't used to apps:
 * short sentences, the exact button names in quotes, nothing technical.
 */
const HELP: Record<string, HelpPage> = {
  home: {
    title: 'หน้าแรก',
    steps: [
      'ดูยอดขาย กำไร และเงินที่จ่ายไปของวันนี้ได้ที่กล่องด้านบน',
      'แตะปุ่มใน “เมนูลัด” เพื่อไปทำงานที่ใช้บ่อย เช่น “บันทึกยอดขาย”',
      'ดู “รายการที่ต้องดูแล” ว่ามีวัตถุดิบใกล้หมด หรือใกล้หมดอายุไหม แตะเพื่อดูว่าเป็นอะไร',
    ],
    tips: ['ถ้ายังไม่ได้บันทึกยอดขายวันนี้ จะมีข้อความเตือนให้ ขายเสร็จแล้วอย่าลืมบันทึกนะคะ'],
  },
  sales: {
    title: 'บันทึกยอดขาย',
    steps: [
      'เลือกวันที่ขาย (ปกติเป็น “วันนี้” ถ้าลืมบันทึกเมื่อวานให้แตะ “เมื่อวาน”)',
      'ใส่จำนวนที่ขายได้ของแต่ละเมนู แตะ + หรือ − หรือแตะที่ช่องตัวเลขแล้วพิมพ์เลย',
      'ดูยอดเงินรวมที่แถบสีน้ำตาลด้านล่าง',
      'แตะ “บันทึกยอดขาย” ระบบจะตัดวัตถุดิบออกจากสต็อกให้เอง',
    ],
    tips: [
      'บันทึกผิด? แตะ “เลิกทำ” ที่ข้อความด้านบนได้ทันที หรือแตะ ⋯ ที่รายการแล้ว “ยกเลิกรายการนี้” ทีหลังก็ได้',
      'ถ้าขึ้นว่าวัตถุดิบไม่พอ แปลว่าในแอปมีของน้อยกว่าที่ใช้จริง ให้ไปที่ “สต็อก” แล้ว “รับเข้า” หรือ “ปรับยอด”',
      'บันทึกหลายครั้งในวันเดียวกันได้ ยอดจะรวมกันให้',
    ],
  },
  money: {
    title: 'รายรับ-รายจ่าย',
    steps: [
      'เลือกช่วงเวลา: วันนี้, 7 วันล่าสุด, เดือนนี้ หรือเดือนที่แล้ว',
      '“ขายได้” คือเงินที่ได้จากการขาย “จ่ายไป” คือค่าวัตถุดิบและค่าใช้จ่ายอื่น “เหลือ” คือส่วนต่าง',
      'จ่ายค่าแก๊ส ค่าไฟ ค่าส่ง หรือซื้อถุงกล่อง? แตะปุ่ม + มุมขวาบน แล้วบันทึกรายจ่าย',
    ],
    tips: [
      'ซื้อวัตถุดิบผ่าน “รับเข้า” ในหน้าสต็อก จะถูกนับเป็นรายจ่ายให้เอง ไม่ต้องบันทึกซ้ำ',
      'บันทึกรายจ่ายผิด? แตะ ⋯ ที่รายการนั้นแล้วเลือก “ลบรายจ่ายนี้”',
    ],
  },
  expense: {
    title: 'บันทึกรายจ่าย',
    steps: [
      'แตะเลือกว่าจ่ายค่าอะไร',
      'ใส่จำนวนเงิน',
      'เลือกวันที่จ่าย (ปกติเป็นวันนี้)',
      'แตะ “บันทึกรายจ่าย”',
    ],
    tips: ['ถ้าซื้อวัตถุดิบที่อยากให้นับในสต็อก (เช่น แป้ง เนย) ให้ไปที่ “สต็อก” แล้ว “รับเข้า” แทน'],
  },
  stock: {
    title: 'สต็อกวัตถุดิบ',
    steps: [
      'ดูว่าวัตถุดิบแต่ละอย่างเหลือเท่าไร ป้ายสีส้ม “ใกล้หมด” แปลว่าควรซื้อเพิ่ม',
      'ซื้อของมา: แตะ ⋯ ที่วัตถุดิบ แล้วเลือก “รับเข้า” ใส่จำนวนและราคาที่ซื้อ',
      'เอาของไปใช้นอกจากทำขนมขาย: แตะ ⋯ แล้วเลือก “เบิกใช้”',
      'มีวัตถุดิบใหม่: แตะปุ่ม + สีน้ำตาลมุมขวาล่าง',
    ],
    tips: [
      'กดค้างที่วัตถุดิบก็เปิดเมนูได้เหมือนแตะ ⋯',
      'ขายขนมแล้วไม่ต้องเบิกเอง ระบบตัดให้ตอนบันทึกยอดขาย',
      'ลบผิด? แตะ “เลิกทำ” ที่ข้อความด้านบนได้ทันที',
    ],
  },
  ingredientDetail: {
    title: 'รายละเอียดวัตถุดิบ',
    steps: [
      'ดูยอดคงเหลือ ราคาเฉลี่ย และวันหมดอายุที่ใกล้ที่สุด',
      '“รับเข้า” = ซื้อของมาเพิ่ม',
      '“เบิกใช้” = เอาของไปใช้',
      '“ปรับยอด” = นับของจริงแล้วไม่ตรงกับในแอป ให้ใส่จำนวนที่นับได้',
      'เลื่อนลงเพื่อดูประวัติว่าของเข้า-ออกเมื่อไร',
    ],
  },
  ingredientForm: {
    title: 'เพิ่ม / แก้ไขวัตถุดิบ',
    steps: [
      'ใส่ชื่อวัตถุดิบ',
      'เลือกหน่วยที่ใช้ดูบ่อย เช่น แป้ง = กิโลกรัม, ไข่ = ฟอง, เนย = กรัม',
      '“แจ้งเตือนเมื่อเหลือไม่ถึง” = ถ้าเหลือน้อยกว่านี้ แอปจะขึ้นป้ายใกล้หมด',
      'ถ้ามีของอยู่แล้ว ติ๊ก “มีของอยู่แล้ว” แล้วใส่ขนาดถุงและราคาที่ซื้อ',
      'แตะ “บันทึก”',
    ],
    tips: ['ราคาต่อกรัม/ต่อฟอง ระบบคิดให้เองจากราคาที่ซื้อ'],
  },
  stockMove: {
    title: 'รับเข้า / เบิกใช้ / ปรับยอด',
    steps: [
      'รับเข้า: ใส่ขนาดต่อถุง จำนวนถุง และราคาต่อถุง ระบบคิดราคาต่อหน่วยให้',
      'เบิกใช้: ใส่จำนวนที่เอาไปใช้',
      'ปรับยอด: ใส่จำนวนที่นับได้จริง และเลือกเหตุผล',
      'แตะ “ยืนยันบันทึก”',
    ],
  },
  menu: {
    title: 'เมนูขนม',
    steps: [
      'แต่ละการ์ดคือขนม 1 เมนู บอกราคาขาย ต้นทุน และกำไรต่อชิ้น',
      'แตะรูปขนม หรือปุ่ม ⋯ เพื่อดูต้นทุน แก้ไข หรือลบเมนู',
      'เพิ่มเมนูใหม่: แตะปุ่ม + มุมขวาบน',
    ],
    tips: ['ถ้าต้นทุนขึ้นว่า “ราคาวัตถุดิบไม่ครบ” ให้ไปที่ “สต็อก” แล้ว “รับเข้า” วัตถุดิบนั้นพร้อมราคา'],
  },
  recipes: {
    title: 'สูตรขนม',
    steps: [
      'ดูสูตรของทุกเมนู พร้อมต้นทุนและกำไรต่อชิ้น',
      '“แก้ไข” = เปลี่ยนวัตถุดิบ ปริมาณ หรือราคาขาย',
      '“คำนวณ” = ลองตั้งราคาใหม่ดูว่ากำไรเท่าไร',
      'เพิ่มเมนูใหม่: แตะปุ่ม + ด้านบน',
    ],
  },
  recipeForm: {
    title: 'เพิ่ม / แก้ไขเมนู',
    steps: [
      'ใส่ชื่อเมนู ขายเป็นอะไร (ชิ้น / กล่อง) และราคาขาย',
      'แตะ “เพิ่มวัตถุดิบ” แล้วเลือกวัตถุดิบที่ใช้ทำ 1 รอบ พร้อมปริมาณ ทีละอย่าง',
      'ใส่ว่า 1 รอบทำได้กี่ชิ้น และค่ากล่อง ค่าแรง ค่าแก๊ส (ถ้ามี)',
      'ดูต้นทุนและกำไรต่อชิ้นได้ทันทีที่ “สรุปต้นทุน” แล้วแตะ “บันทึก”',
    ],
    tips: ['วัตถุดิบไม่มีในรายการ? แตะ “+ วัตถุดิบใหม่” เพิ่มก่อน'],
  },
  cost: {
    title: 'คำนวณต้นทุน',
    steps: [
      'เลือกเมนู แล้วดูว่าต้นทุนต่อชิ้นเท่าไร',
      'ลองเปลี่ยนค่าใช้จ่าย จำนวนที่ทำได้ หรือราคาขาย ตัวเลขจะเปลี่ยนให้ทันที',
      'อยากได้กำไรเท่าไร แตะปุ่ม “กำไร 30%” ฯลฯ ระบบตั้งราคาขายให้',
    ],
    tips: ['ตัวเลขหน้านี้เป็นการลองคิด ถ้าจะเปลี่ยนราคาขายจริงให้ไปที่ “แก้ไขเมนู”'],
  },
  more: {
    title: 'เพิ่มเติม',
    steps: ['รวมเมนูอื่น ๆ เช่น “รายรับ-รายจ่าย” “คำนวณต้นทุน” และ “สูตรขนม” แตะเพื่อเข้าไปใช้'],
  },
};

/** First match wins, so more specific paths come first. */
const ROUTES: [RegExp, string][] = [
  [/^\/$/, 'home'],
  [/^\/sales/, 'sales'],
  [/^\/money\/expense/, 'expense'],
  [/^\/money/, 'money'],
  [/^\/stock\/(new|[^/]+\/edit)$/, 'ingredientForm'],
  [/^\/stock\/[^/]+\/move\//, 'stockMove'],
  [/^\/stock\/[^/]+$/, 'ingredientDetail'],
  [/^\/stock/, 'stock'],
  [/^\/menu/, 'menu'],
  [/^\/recipes\/(new|[^/]+\/edit)/, 'recipeForm'],
  [/^\/recipes/, 'recipes'],
  [/^\/cost/, 'cost'],
  [/^\/more/, 'more'],
];

const SEEN_KEY = 'banmoom.helpSeen';

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** The "วิธีใช้" pill in the bottom-right corner and the panel it slides up. Lives in the app shell. */
@Component({
  selector: 'app-help',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { '(document:keydown.escape)': 'open.set(false)' },
  template: `
    @if (page(); as p) {
      @if (!open()) {
        <button type="button" (click)="show()" aria-haspopup="dialog"
          class="fixed right-4 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-30 flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface/95 py-2 pr-4 pl-3 text-sm font-medium text-primary-dark shadow-lg backdrop-blur active:bg-soft lg:right-6 lg:bottom-6"
          [class.animate-help-nudge]="!seen()">
          <app-icon name="help" [size]="20" />
          วิธีใช้
        </button>
      } @else {
        <div class="fixed inset-0 z-50" role="presentation">
          <button type="button" class="animate-fade-in absolute inset-0 size-full cursor-default bg-ink/35 backdrop-blur-[2px]"
            aria-label="ปิดวิธีใช้" tabindex="-1" (click)="open.set(false)"></button>

          <section role="dialog" aria-modal="true" [attr.aria-label]="'วิธีใช้หน้า ' + p.title"
            class="animate-sheet-up absolute inset-x-0 bottom-0 mx-auto flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-surface shadow-xl lg:animate-pop-in lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-[26rem] lg:origin-bottom-right lg:rounded-3xl">
            <header class="flex items-center gap-3 border-b border-line px-5 pt-4 pb-3">
              <span class="flex size-10 items-center justify-center rounded-full bg-soft text-primary"><app-icon name="help" [size]="22" /></span>
              <div class="min-w-0 flex-1">
                <p class="text-xs text-muted">วิธีใช้หน้านี้</p>
                <h2 class="truncate text-lg font-medium text-primary-dark">{{ p.title }}</h2>
              </div>
              <button type="button" class="icon-btn -mr-2 text-muted" aria-label="ปิด" (click)="open.set(false)">
                <app-icon name="x" [size]="22" />
              </button>
            </header>

            <div class="overflow-y-auto px-5 py-4">
              <ol class="space-y-3">
                @for (step of p.steps; track $index) {
                  <li class="flex gap-3">
                    <span class="num flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-white">{{ $index + 1 }}</span>
                    <p class="pt-0.5 text-base leading-relaxed text-ink">{{ step }}</p>
                  </li>
                }
              </ol>
              @if (p.tips?.length) {
                <div class="mt-4 space-y-2 rounded-2xl bg-soft/70 p-4">
                  <p class="flex items-center gap-1.5 text-sm font-medium text-primary-dark"><app-icon name="info" [size]="18" /> รู้ไว้ก็ดี</p>
                  @for (tip of p.tips; track $index) {
                    <p class="text-sm leading-relaxed text-ink">• {{ tip }}</p>
                  }
                </div>
              }
            </div>

            <div class="border-t border-line px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:pb-4">
              <button type="button" class="btn-primary btn-block min-h-12 text-base" (click)="open.set(false)">เข้าใจแล้ว</button>
            </div>
          </section>
        </div>
      }
    }
  `,
})
export class Help {
  private readonly router = inject(Router);
  protected readonly open = signal(false);
  protected readonly seen = signal(readSeen());

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly page = computed<HelpPage | null>(() => {
    const path = this.url().split(/[?#]/)[0];
    const key = ROUTES.find(([re]) => re.test(path))?.[1];
    return key ? HELP[key] : null;
  });

  constructor() {
    // Close the panel when the page changes underneath it.
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.open.set(false));
  }

  protected show() {
    this.open.set(true);
    if (!this.seen()) {
      this.seen.set(true);
      try {
        localStorage.setItem(SEEN_KEY, '1');
      } catch {
        // Private mode etc. — the nudge just shows again next time.
      }
    }
  }
}
