/**
 * content/ui/he/wizard.ts
 * All wizard UI copy: step titles, labels, navigation, option chips, summary labels.
 *
 * NOTE: This file contains display copy only.
 * Wizard data (topic IDs, challenge options, prices, page counts) lives in:
 *   backend/config/wizard.ts
 *
 * Style picker options are sourced from `WIZARD_ILLUSTRATION_STYLES` in `lib/styles.ts`.
 * The static JS frontend reads content from JS/content.js (mirrored structure).
 * This TypeScript file is the typed source for Next.js components and future
 * React wizard implementation.
 */

import { WIZARD_ILLUSTRATION_STYLES } from '../../../lib/styles';

export const WIZARD = {
  progressLabel: 'שלב {current} מתוך {total}',

  steps: {
    s1: {
      title: 'בואו ניצור סיפור מיוחד עבור הילד שלכם',
      sub:   'כזה שהוא ירגיש שהוא חלק ממנו',
      cta:   'מתחילים',
    },
    s2: {
      title: 'מה הכי קשה לו לאחרונה?',
      sub:   'בחרו את מה שהכי מרגיש נכון',
    },
    s3: {
      title:         'איך קוראים לילד?',
      sub:           'כדי ליצור דמות שמבוססת עליו',
      nameLabel:     'איך קוראים לו?',
      ageLabel:      'בן כמה הוא?',
      genderLabel:   'מין',
      genderBoy:     'בן',
      genderGirl:    'בת',
      genderOther:   'אחר',
      traitsLabel:   'איזה ילד הוא?',
      traitsNote:    'אפשר לבחור כמה שרוצים',
      photoPrompt:   'כדי ליצור דמות שמבוססת עליו',
      photoOptional: 'העלו תמונה ברורה של הפנים — האיור ייווצר בסגנון ספר ילדים ובהשראת התמונה',
    },
    s4: {
      title:            'מה קצת קשה לו לאחרונה?',
      sub:              'בחרו את מה שמרגיש נכון',
      sub2:             '(אפשר לבחור כמה)',
      extraLabel:       'יש משהו נוסף שחשוב שנדע?',
      extraPlaceholder: 'כתוב כאן...',
    },
    s5: {
      title: 'איזה שינוי הייתם רוצים?',
      sub:   'מה הלב שלכם מקווה בשבילו',
      sub2:  '(אפשר לבחור כמה)',
    },
    s6: {
      title:            'מה עוזר לו להרגיש טוב?',
      sub:              'נשלב את אלה בסיפור',
      sub2:             '(אפשר לבחור כמה)',
      extraLabel:       'יש משהו נוסף שעוזר לו?',
      extraPlaceholder: 'כתוב כאן...',
    },
    s7: {
      title:            'משהו שעדיף להשאיר בחוץ?',
      sub:              'הסיפור יישאר נעים ובטוח',
      sub2:             '(אפשר לבחור כמה)',
      extraLabel:       'יש משהו נוסף?',
      extraPlaceholder: 'כתוב כאן...',
    },
    s8: {
      title:          'איזה סגנון איור הכי מתאים לסיפור?',
      sub:            'הדמות תיווצר בסגנון ספר ילדים, בהשראת התמונה',
      lengthTitle:    'כמה עמודים?',
      styleLabel:     'סגנון איור',
      addonsExpanded: 'רוצים להוסיף?',
      addonsCollapsed:'אפשרויות נוספות',
      addonsSub:      '*בתוספת תשלום',
      totalLabel:     'סה"כ לתשלום:',
      audio:  { badge: 'הכי פופולרי',  name: 'קריינות (+₪19)', desc: 'מושלם להאזנה לפני השינה' },
      pdf:    { badge: 'מושלם כמתנה', name: 'PDF (+₪12)',      desc: 'הדפיסו כספר פיזי' },
      bundle: { badge: 'חסכו ₪6',     name: 'קומבו (+₪25)',   desc: 'קריינות + PDF' },
      voiceTitle:   'קריינות (+₪19)',
      voicePreview: 'האזן לדוגמה',
      sleep: {
        name: 'מותאם לשינה 🌙',
        desc: 'קצב איטי, נעים לשינה',
      },
    },
    s9: {
      title:       'כמעט מתחילים ליצור את הסיפור',
      sub:         'ניצור עבורו סיפור אישי בעברית עם דמות מאוירת שמבוססת עליו',
      recognition: 'קיבלנו הכל. הסיפור של {name} כבר בדרך.',
      card1Title:  'פרטי ההזמנה',
      card2Title:  'סה"כ לתשלום',
      card3Title:  'פרטים להזמנה',
      nameLabel:   'שם מלא',
      emailLabel:  'אימייל',
      submitBtn:   'המשך לתשלום מאובטח',
      paymentLogos:'הספר כולל סיפור אישי ודמות מאוירת בהשראת התמונה',
    },
  },

  nav: {
    continueDefault:   'ממשיכים',
    continueToStory:   'ממשיכים לסיפור',
    continueToPackage: 'ממשיכים לחבילה',
    continueToSummary: 'ממשיכים לסיכום',
    back:              'חזור',
  },

  // Option labels for display (IDs MUST match backend/config/wizard.ts → TOPICS[].id)
  topics: [
    { id: 'sirens',         label: 'אזעקות / רעשים'     },
    { id: 'nightfear',      label: 'פחדים בלילה'         },
    { id: 'transition',     label: 'מעבר / גן חדש'       },
    { id: 'sibling',        label: 'אח / אחות חדשים'     },
    { id: 'selfconfidence', label: 'לא מאמין בעצמו'       },
    { id: 'social',         label: 'לא מוצא חברים'        },
    { id: 'focus',          label: 'קשה עם שיעורים'       },
    { id: 'other',          label: 'נושא אחר'            },
  ],

  traits: [
    { id: 'sensitive',   label: 'רגיש'         },
    { id: 'mischievous', label: 'שובב'          },
    { id: 'funny',       label: 'מצחיק'         },
    { id: 'dreamer',     label: 'חולם'          },
    { id: 'shy',         label: 'ביישן'         },
    { id: 'energetic',   label: 'אוהב להשתולל' },
    { id: 'other',       label: 'אחר'           },
    { id: 'gentle',      label: 'עדין'          },
    { id: 'curious',     label: 'סקרן'          },
    { id: 'brave',       label: 'אמיץ'          },
  ],

  difficulties: [
    { id: 'startled',   label: '🐳 נבהל מרעשים'         },
    { id: 'relaxation', label: '😴 מתקשה להירגע'         },
    { id: 'sleep',      label: '🌙 קשה להירדם לבד'       },
    { id: 'clingy',     label: '🫂 נצמד אלינו'           },
    { id: 'questions',  label: '❓ שאלות מדאגה'           },
    { id: 'withdrawn',  label: '🐹 שקט ומסוגר'           },
    { id: 'frustrated', label: '😟 מתעצבן בקלות'         },
    { id: 'other',      label: '✏️ אחר'                   },
  ],

  goals: [
    { id: 'calm',        label: '🐻 נרגע בקלות'          },
    { id: 'safe',        label: '🛡️ מרגיש בטוח יותר'     },
    { id: 'sleep',       label: '🌙 נרדם בשקט'           },
    { id: 'play',        label: '😄 שמח שוב'              },
    { id: 'cope',        label: '💪 חזק מבפנים'           },
    { id: 'curious',     label: '✨ שואל מתוך סקרנות'     },
    { id: 'alone',       label: '🌟 רגוע גם לבד'          },
    { id: 'independent', label: '💛 פחות נצמד אלינו'     },
    { id: 'other',       label: '✏️ אחר'                  },
  ],

  helpers: [
    { id: 'hug',        label: '🤗 חיבוק'           },
    { id: 'mom',        label: '👩 אמא'              },
    { id: 'dad',        label: '👨 אבא'              },
    { id: 'toy',        label: '🐻 בובה אהובה'      },
    { id: 'nightlight', label: '🌙 אור קטן בלילה'  },
    { id: 'music',      label: '🎵 שיר או מוזיקה'  },
    { id: 'talk',       label: '👆 לדבר על זה'     },
    { id: 'play',       label: '🎮 משחק או פעילות' },
    { id: 'quiet',      label: '🌿 זמן שקט לבד'    },
    { id: 'other',      label: '✏️ אחר'              },
  ],

  avoid: [
    { id: 'darkness',  label: '⚫ חושך'             },
    { id: 'noise',     label: '🔊 רעשים חזקים'      },
    { id: 'scary',     label: '😨 דמויות מפחידות'  },
    { id: 'war',       label: '💥 אזכורי מלחמה'    },
    { id: 'sadness',   label: '😢 עצב ובכי'         },
    { id: 'stress',    label: '⚡ מצבי לחץ'         },
    { id: 'harsh',     label: '💧 מילים קשות'       },
    { id: 'monsters',  label: '👾 מפלצות'            },
    { id: 'other',     label: '✏️ אחר'               },
  ],

  lengths: [
    { id: 'long',   label: 'ארוך',   pages: '15 עמודים' },
    { id: 'medium', label: 'בינוני', pages: '12 עמודים' },
    { id: 'short',  label: 'קצר',    pages: '8 עמודים' },
  ],

  styles: WIZARD_ILLUSTRATION_STYLES,

  voices: [
    { id: 'mom',   label: 'אמא',        emoji: '👩', description: 'קול חם, מחבק ורגוע'    },
    { id: 'dad',   label: 'אבא',        emoji: '👨', description: 'קול חזק, חם ומחבק'     },
    { id: 'fairy', label: 'פייה קסומה', emoji: '🧚', description: 'קול קסום, נעים ומיוחד' },
  ],

  // Spoken text used for the voice preview clip in the wizard voice picker.
  // Keep this short (one sentence). It is sent directly to ElevenLabs TTS.
  voicePreviewText: 'שלום! אני אהיה הקריין של הסיפור המיוחד שלך.',

  summary: {
    childNameLabel: 'שם הילד:',
    topicLabel:     'נושא:',
    lengthLabel:    'אורך:',
    styleLabel:     'סגנון:',
    audioLabel:     'קריינות:',
    pdfLabel:       'PDF:',
    sleepLabel:     'מצב שינה:',
    ageFormat:      '· גיל {age}',
    bookDigital:    'ספר דיגיטלי {length}',
    bundleLabel:    'קריינות + PDF (חבילה)',
    audioAddon:     'קריינות 🎧',
    pdfAddon:       'PDF 📥',
    totalLabel:     'סה"כ לתשלום:',
    defaultHero:    'הגיבור/ה שלכם',
  },

  // Keys MUST match backend/config/wizard.ts → TOPICS[].id
  topicQuotes: {
    sirens:         '"פעם, כש{name} שמע/ה רעש חזק בחוץ... {name} לקח/ה נשימה עמוקה ומצא/ה את הגיבור שבפנים..."',
    nightfear:      '"{name} היה/הייתה פעם קצת פוחד/ת בלילה... אבל אז {name} פגש/ה את שומר האור שלו/שלה..."',
    transition:     '"{name} הגיע/ה למקום חדש ולב {name} פעם הרגיש קצת רועד... עד שגילה/תה את הגיבור שבו/בה..."',
    sibling:        '"כש{name} פגש/ה את התינוק הקטן בפעם הראשונה... {name} גילה/תה כוח שלא ידע/ה שיש לו/לה..."',
    selfconfidence: '"{name} עמד/ה בפני האתגר ולב {name} דפק חזק... ואז {name} הבין/הבינה — הגיבור/ה תמיד היה/הייתה שם..."',
    social:         '"{name} הסתכל/ה על הילדים האחרים... ואז {name} החליט/ה להושיט יד עם לב פתוח..."',
    focus:          '"{name} ישב/ה לפני המשימה הגדולה... ואז {name} לקח/ה נשימה ומצא/ה את השקט שבפנים..."',
    other:          '"פעם {name} הרגיש/ה קצת קשה... אבל {name} גילה/תה שבתוכו/בתוכה חי גיבור/ה אמיתי/ת..."',
    default:        '"פעם {name} הרגיש/ה קצת קשה... אבל {name} גילה/תה שהגיבור/ה חי בפנים..."',
  },
} as const;
