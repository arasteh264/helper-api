export interface SkillRepository {
  findOrCreateByName(name: string): Promise<{ id: string; name: string }>;
  findManyByIds(ids: string[]): Promise<{ id: string; name: string }[]>;
}
