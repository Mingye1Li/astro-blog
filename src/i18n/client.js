import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { resources, defaultLanguage } from './resources.js';

export const i18n = i18next.createInstance();
export const t = (key, options) => i18n.t(key, options);
export const language = () => i18n.resolvedLanguage || defaultLanguage;

export function localizedText(element, key, options = {}) {
  element.dataset.i18n = key;
  element.dataset.i18nOptions = JSON.stringify(options);
  element.textContent = t(key, translatedOptions(options));
}
export function localizedAttribute(element, attribute, key, options = {}) {
  element.setAttribute(`data-i18n-${attribute}`, key);
  element.setAttribute(`data-i18n-${attribute}-options`, JSON.stringify(options));
  element.setAttribute(attribute, t(key, translatedOptions(options)));
}
export function dateText(value) {
  return new Intl.DateTimeFormat(language(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function translatedOptions(options = {}) {
  const translated = { ...options };
  // Nested labels are resolved at render time so dynamic rows update without a refetch.
  for (const [name, key] of Object.entries(options.$labels || {})) translated[name] = t(key);
  delete translated.$labels;
  return translated;
}
export function translatePage() {
  document.documentElement.lang = language();
  if (!document.querySelector('title')?.dataset.postTitle) {
    document.title = t('page.title');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('page.description'));
  }
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const options = translatedOptions(JSON.parse(element.dataset.i18nOptions || '{}'));
    element.textContent = t(element.dataset.i18n, options);
  });
  for (const attribute of ['placeholder', 'aria-label', 'title']) {
    document.querySelectorAll(`[data-i18n-${attribute}]`).forEach((element) => {
      const options = translatedOptions(JSON.parse(element.getAttribute(`data-i18n-${attribute}-options`) || '{}'));
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`), options));
    });
  }
  document.querySelectorAll('time[data-localized-date]').forEach((element) => {
    element.textContent = dateText(element.dateTime);
  });
  document.querySelectorAll('[data-validation-key]').forEach((element) => {
    element.setCustomValidity(t(element.dataset.validationKey));
  });
  const select = document.getElementById('languageSelect');
  if (select) select.value = language();
}

export const preferencesReady = i18n.use(LanguageDetector).init({
  resources,
  supportedLngs: ['en', 'zh-CN'],
  fallbackLng: defaultLanguage,
  detection: {
    order: ['localStorage', 'navigator'],
    lookupLocalStorage: 'liubai-language',
    caches: ['localStorage'],
    convertDetectedLanguage: (code) => code.toLowerCase().startsWith('zh') ? 'zh-CN' : code,
  },
  interpolation: { escapeValue: false }, // Translation strings use textContent; Markdown is separately sanitized.
}).then(() => {
  translatePage();
  i18n.on('languageChanged', translatePage);
  document.getElementById('languageSelect')?.addEventListener('change', (event) => {
    i18n.changeLanguage(event.target.value);
  });
  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('invalid', (event) => {
      const input = event.target;
      const key = input.validity?.valueMissing ? 'validation.required' : input.validity?.typeMismatch ? 'validation.email' : input.dataset.validationKey;
      if (key) { input.dataset.validationKey = key; input.setCustomValidity(t(key)); }
    }, true);
    form.addEventListener('input', (event) => {
      event.target.setCustomValidity?.('');
      delete event.target.dataset.validationKey;
    });
    form.addEventListener('reset', () => {
      form.querySelectorAll('[data-validation-key]').forEach((input) => {
        input.setCustomValidity(''); delete input.dataset.validationKey;
      });
    });
  });
  window.addEventListener('storage', (event) => {
    if (event.key === 'liubai-language' && ['en', 'zh-CN'].includes(event.newValue)) i18n.changeLanguage(event.newValue);
  });
});
