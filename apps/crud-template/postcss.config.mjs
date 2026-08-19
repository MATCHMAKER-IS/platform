/**
 * Tailwind CSS 4。
 *
 * **これが無いと素の HTML になる。** `@platform/ui` の部品は Tailwind のクラスで
 * 書かれているため、変換されないとレイアウトが一切効かない
 * (画面は出るが縦に積み上がる)。
 */
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
