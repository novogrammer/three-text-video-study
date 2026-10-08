/** 秒単位の時刻を、ループの進行値（0以上1未満）に変換する。 */
export function getLoopProgress(time: number, duration: number): number {
  return ((time % duration) + duration) % duration / duration
}
