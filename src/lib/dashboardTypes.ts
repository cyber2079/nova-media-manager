// ── 仪表盘共享类型（对应 Rust DashboardStats）──

export interface DailyCount { date: string; movies: number; music: number; games: number; total: number }
export interface TypeCounts { movies: number; music: number; games: number }
export interface TopItem { id: string; name: string; count: number; coverPath: string }
export interface TagCount { tag: string; count: number }
export interface RevisitItem { id: string; name: string; itemType: string; daysSince: number }
export interface Stats {
  daily: DailyCount[]; hourly: number[];
  weekNow: TypeCounts; weekPrev: TypeCounts;
  topMusic: TopItem[]; topTags: TagCount[]; revisit: RevisitItem[];
  library: TypeCounts; imagesCount: number;
}
