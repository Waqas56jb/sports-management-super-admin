/** Lower-case and strip accents so "Ismael" matches "Ismaël". */
export const normalize = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
