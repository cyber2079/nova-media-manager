export interface Game {
  id: string;
  name: string;
  executablePath: string;
  coverPath: string;
  landscapePath: string;
  platform: string;
  tags: string[];
  addTime: string;
  installed?: boolean;
}
