export interface StickerRecord {
  c: number;        // Sticker count
  name?: string;    // Custom player name
}

export type AlbumState = Record<string, StickerRecord>;

export interface Team {
  code: string;
  name: string;
  flag: string;
  group: string;
}

export interface Group {
  id: string;
  teams: {
    code: string;
    name: string;
    flag: string;
  }[];
}

export interface UserProgress {
  pin: string;
  state: AlbumState;
  updatedAt: string;
}
