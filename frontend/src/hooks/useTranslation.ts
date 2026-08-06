import { useAppStore } from "@/stores/appStore";
import { translations, type Language } from "@/lib/i18n";

type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${K}.${NestedKeyOf<T[K]>}`
        : K;
    }[keyof T & string]
  : never;

export type TranslationPath = NestedKeyOf<typeof translations.en>;

function resolvePath(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function translate(
  language: Language,
  key: TranslationPath | string,
  params?: Record<string, string | number>
): string {
  const fromLang = resolvePath(translations[language], key);
  const fromEn = resolvePath(translations.en, key);
  let text = fromLang ?? fromEn ?? key;

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    });
  }
  return text;
}

export function useTranslation() {
  const language = useAppStore((state) => state.language);

  return {
    language,
    t: (key: TranslationPath | string, params?: Record<string, string | number>) =>
      translate(language, key, params),
  };
}
