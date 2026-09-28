/** Pure text formatters for the HUD; they take plain numbers and know nothing about React or the store. */

const pad3 = (n: number): string => String(n).padStart(3, '0');

/** A Standard score padded to at least three digits: `5` is `005`. */
export function formatScore(score: number): string {
    return pad3(score);
}

/** A move count padded to at least three digits, like the score. */
export function formatMoves(moves: number): string {
    return pad3(moves);
}

/** A Vegas bank in whole dollars with a leading minus sign when negative: `$47`, `-$52`. */
export function formatBank(bank: number): string {
    return bank < 0 ? `-$${String(-bank)}` : `$${String(bank)}`;
}

/** Play time in whole seconds as `m:ss` below one hour and `h:mm:ss` from one hour. */
export function formatTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const ss = String(seconds).padStart(2, '0');
    return hours > 0 ? `${String(hours)}:${String(minutes).padStart(2, '0')}:${ss}` : `${String(minutes)}:${ss}`;
}
