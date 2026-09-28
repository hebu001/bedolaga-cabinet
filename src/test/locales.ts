// Test-only complete dictionaries. Runtime continues to fetch user/admin assets separately.
import ruUser from '../locales/ru.json';
import enUser from '../locales/en.json';
import faUser from '../locales/fa.json';
import zhUser from '../locales/zh.json';
import ruAdmin from '../locales/admin/ru.json';
import enAdmin from '../locales/admin/en.json';
import faAdmin from '../locales/admin/fa.json';
import zhAdmin from '../locales/admin/zh.json';
export const ru = { ...ruUser, ...ruAdmin };
export const en = { ...enUser, ...enAdmin };
export const fa = { ...faUser, ...faAdmin };
export const zh = { ...zhUser, ...zhAdmin };
