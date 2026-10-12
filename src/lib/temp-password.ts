// 관리자 비밀번호 초기화의 임시 비밀번호 (AUTH-07 열린 질문). 읽어 주기 쉽게 헷갈리는 글자(0 O o 1 l I)를 뺀다.

export const TEMP_PASSWORD_LENGTH = 12;
const LETTERS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const ALPHABET = LETTERS + DIGITS;

/** 고르게 뽑는다 (나머지 치우침이 없도록 범위를 넘는 값은 다시 뽑는다) */
function pick(chars: string, random: (n: number) => Uint32Array): string {
  const limit = Math.floor(0x1_0000_0000 / chars.length) * chars.length;
  for (;;) {
    const [v] = random(1);
    if (v < limit) return chars[v % chars.length];
  }
}

const cryptoRandom = (n: number) => crypto.getRandomValues(new Uint32Array(n));

/** 12자, 영문과 숫자가 모두 들어간다 */
export function makeTempPassword(random: (n: number) => Uint32Array = cryptoRandom): string {
  for (;;) {
    let out = "";
    while (out.length < TEMP_PASSWORD_LENGTH) out += pick(ALPHABET, random);
    if (/[a-zA-Z]/.test(out) && /[0-9]/.test(out)) return out;
  }
}
