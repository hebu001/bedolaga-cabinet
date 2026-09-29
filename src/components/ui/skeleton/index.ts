/**
 * Generic loading placeholders for the current interface.
 * Restored user pages instead use their original markup from 55a4038f;
 * LegacyVisualContext suppresses these additional placeholders there.
 *
 * Правила (продублированы в Design Canon файла CLAUDE.md, но он в .gitignore,
 * поэтому нормативная копия живёт здесь, рядом с кодом):
 *
 * - Новая инлайновая разметка `animate-pulse` + `bg-dark-*` запрещена. Её ловит
 *   skeletonUsage.test.ts — там же проверка, что CSS-класс `.skeleton`
 *   не вернулся в globals.css. Исключения — явно восстановленные старые страницы.
 * - Два варианта заливки: `line` — плейсхолдер контента внутри карточки,
 *   `card` — плейсхолдер самой карточки, с рамкой. Третьего не заводить.
 * - Размер задают классы `h-*`/`w-*`; без них плейсхолдер повторяет высоту
 *   текста родителя. `shrink-0` примитив не навязывает — добавлять там, где
 *   элемент не должен сжиматься во flex-ряду.
 * - О загрузке скринридеру сообщает `SkeletonGroup` (role="status" +
 *   aria-busy + aria-label). Отдельные `Skeleton` молчат: иначе экран из
 *   двадцати заглушек зачитывается двадцать раз.
 * - Скелетон обязан совпадать с формой будущего контента. Если форма
 *   неизвестна (проверка авторизации, загрузка чанка маршрута) — честнее
 *   спиннер из `components/ui/Spinner`.
 * - `animate-pulse` без `bg-dark-*` — это НЕ скелетон (статус-точки нод,
 *   тинт кнопок, декоративные пульсации), такие места трогать не нужно.
 */

export { PageSkeleton } from './PageSkeleton';
export { Skeleton, SkeletonGroup, type SkeletonProps } from './Skeleton';
export {
  skeletonClass,
  type SkeletonClassOptions,
  type SkeletonVariant,
} from './skeletonStyles';
